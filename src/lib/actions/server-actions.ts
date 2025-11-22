
'use server';
/**
 * @fileOverview This file contains all the server-side actions that use the Firebase Admin SDK.
 * It is marked with 'use server' to ensure it only runs on the server.
 */

import { adminDb, adminStorage } from '@/firebase/admin-init';
import { FieldValue } from 'firebase-admin/firestore';
import { generateBalancedTeams, GenerateBalancedTeamsInput } from '@/ai/flows/generate-balanced-teams';
import { suggestPlayerImprovements, SuggestPlayerImprovementsInput } from '@/ai/flows/suggest-player-improvements';
import { getMatchDayForecast, GetMatchDayForecastInput } from '@/ai/flows/get-match-day-forecast';
import { findBestFitPlayer, FindBestFitPlayerInput } from '@/ai/flows/find-best-fit-player';
import { coachConversation, type CoachConversationInput } from '@/ai/flows/coach-conversation';
import { detectPlayerPatterns, type DetectPlayerPatternsInput } from '@/ai/flows/detect-player-patterns';
import { analyzePlayerProgression, type AnalyzePlayerProgressionInput } from '@/ai/flows/analyze-player-progression';
import { type GenerateMatchChronicleOutput, type GenerateMatchChronicleInput, MatchLocation } from '@/lib/types';
import { generateMatchChronicleFlow } from '@/ai/flows/generate-match-chronicle';
import { generateDuoImage } from '@/ai/flows/generate-duo-image';
import { Player, Evaluation, OvrHistory, PerformanceTag, SelfEvaluation, Invitation, Notification, GroupTeam, TeamAvailabilityPost, Match, GenerateDuoImageInput, League, LeagueFormat, CompetitionStatus, Cup, CupFormat, BracketMatch, CompetitionApplication, CompetitionFormat, HealthConnection, PlayerPerformance, GoogleFitAuthUrl, GoogleFitSession, SocialActivity, Follow, NotificationType } from '../types';
import { GOOGLE_FIT_CONFIG, calculateAttributeImpact } from '../config/google-fit';
import { logger } from '../logger';
import { handleServerActionError, createError, ErrorCodes, formatErrorResponse, isErrorResponse, type ErrorResponse } from '../errors';
import { addDays, format } from 'date-fns';
import { generateBracket, advanceWinner, isTournamentComplete, getChampion, getRunnerUp, getNextRound } from '@/lib/utils/cup-bracket';

// --- Server Actions ---

export async function generateTeamsAction(players: Player[]) {
  if (!players || players.length < 2) {
    return { error: 'Se necesitan al menos 2 jugadores para generar equipos.'};
  }

  const input: GenerateBalancedTeamsInput = {
    players: players.map((p: Player) => ({
      uid: p.id,
      displayName: p.name,
      ovr: p.ovr,
      position: p.position,
    })),
    teamCount: 2,
  };

  try {
    const result = await generateBalancedTeams(input);
    if ('error' in result) {
      throw new Error(String(result.error) || 'La IA no pudo generar los equipos.');
    }
    if (!result || !result.teams) {
      throw new Error('La respuesta de la IA no contiene equipos.');
    }
    
    result.teams.forEach(team => {
        team.players.forEach(player => {
            const originalPlayer = players.find(p => p.name === player.displayName && p.position === player.position);
            if (originalPlayer) {
                player.uid = originalPlayer.id;
            }
        });
    });

    return result;
  } catch (error) {
    logger.error('Error generating teams', error);
    return { error: 'La IA no pudo generar los equipos. Inténtalo de nuevo.' };
  }
}

export async function getPlayerEvaluationsAction(playerId: string, groupId: string): Promise<Partial<Evaluation>[]> {
    const evalsSnapshot = await adminDb.collection('evaluations').where('playerId', '==', playerId).orderBy('evaluatedAt', 'desc').get();
    const matchesSnapshot = await adminDb.collection('matches').where('groupId', '==', groupId).get();
    const groupMatchIds = new Set(matchesSnapshot.docs.map(doc => doc.id));
    
    const evaluations: Partial<Evaluation>[] = [];
    evalsSnapshot.forEach(doc => {
        const evaluation = doc.data() as Evaluation;
        if (groupMatchIds.has(evaluation.matchId)) {
            evaluations.push(evaluation);
        }
    });

    return evaluations;
}


export async function getPlayerImprovementSuggestionsAction(playerId: string, groupId: string) {
    try {
        const playerDocRef = adminDb.doc(`players/${playerId}`);
        const playerDocSnap = await playerDocRef.get();

        if (!playerDocSnap.exists) {
            return { error: 'No se pudo encontrar al jugador.' };
        }
        const player = playerDocSnap.data() as Player;

        const evaluations = await getPlayerEvaluationsAction(playerId, groupId);

        const input: SuggestPlayerImprovementsInput = {
            playerId: playerId,
            playerStats: player.stats,
            evaluations: evaluations.map(e => ({
                rating: e.rating || 0,
                performanceTags: e.performanceTags?.map((t: any) => t.name) || [],
                evaluatedBy: e.evaluatorId || '',
                evaluatedAt: e.evaluatedAt || '',
                matchId: e.matchId || ''
            })),
        };
        
        const result = await suggestPlayerImprovements(input);
        return result;

    } catch (error) {
        logger.error('Error getting player improvement suggestions', error, { playerId });
        return { error: 'No se pudieron obtener las sugerencias de la IA.' };
    }
}

export async function getWeatherForecastAction(input: GetMatchDayForecastInput) {
    try {
        const result = await getMatchDayForecast(input);
        return result;
    } catch (error) {
        logger.error('Error getting weather forecast', error, { location: input.location });
        return { error: 'No se pudo obtener el pronóstico del tiempo.' };
    }
}

export async function findBestFitPlayerAction(input: Omit<FindBestFitPlayerInput, 'spotsToFill'>) {
    try {
        const result = await findBestFitPlayer(input);
        if (isErrorResponse(result)) {
            throw new Error(String(result.error));
        }
        return result;
    } catch (error: any) {
        logger.error('Error finding best fit player', error);
        if (error instanceof SyntaxError || error.message.includes('Unexpected token')) {
             return { error: 'La IA devolvió una respuesta inesperada. Por favor, inténtalo de nuevo.' };
        }
        return { error: error.message || 'La IA no pudo procesar la solicitud en este momento.' };
    }
}

export async function coachConversationAction(
  playerId: string,
  groupId: string,
  userMessage: string,
  conversationHistory?: CoachConversationInput['conversationHistory']
) {
  try {
    const playerDocRef = adminDb.doc(`players/${playerId}`);
    const playerDocSnap = await playerDocRef.get();

    if (!playerDocSnap.exists) {
      return { error: 'No se pudo encontrar al jugador.' };
    }

    const player = playerDocSnap.data() as Player;
    const evaluations = await getPlayerEvaluationsAction(playerId, groupId) as Evaluation[];

    const recentTags = evaluations
        .flatMap(e => e.performanceTags?.map(t => t?.name).filter(Boolean) || [])
        .slice(0, 10);
    
    const positiveTags = evaluations
        .flatMap(e => e.performanceTags
            ?.filter(t => t?.effects?.some(ef => ef.change > 0))
            .map(t => t?.name)
            .filter(Boolean) || []
        );
        
    const negativeTags = evaluations
        .flatMap(e => e.performanceTags
            ?.filter(t => t?.effects?.some(ef => ef.change < 0))
            .map(t => t?.name)
            .filter(Boolean) || []
        );

    const input: CoachConversationInput = {
      userMessage,
      conversationHistory: conversationHistory || [],
      playerContext: {
        playerId: playerId,
        playerName: player.name,
        position: player.position,
        ovr: player.ovr,
        stats: {
          matchesPlayed: player.stats.matchesPlayed || 0,
          goals: player.stats.goals || 0,
          assists: player.stats.assists || 0,
          averageRating: player.stats.averageRating || 0,
        },
        recentTags: recentTags.length > 0 ? recentTags : undefined,
        strengths: positiveTags.length > 0 ? positiveTags : undefined,
        weaknesses: negativeTags.length > 0 ? negativeTags : undefined,
      },
    };

    const result = await coachConversation(input);
    return result;
  } catch (error: any) {
    logger.error('Error in coach conversation', error, { playerId });
    return { error: error.message || 'Error al generar la respuesta del entrenador.' };
  }
}

export async function detectPlayerPatternsAction(playerId: string, groupId: string) {
    try {
      const playerDocRef = adminDb.doc(`players/${playerId}`);
      const playerDocSnap = await playerDocRef.get();
  
      if (!playerDocSnap.exists) {
        return { error: 'No se pudo encontrar al jugador.' };
      }
      const player = playerDocSnap.data() as Player;
  
      const evaluations = await getPlayerEvaluationsAction(playerId, groupId) as Evaluation[];
  
      const ovrHistorySnapshot = await adminDb
        .collection(`players/${playerId}/ovrHistory`)
        .orderBy('date', 'desc')
        .limit(20)
        .get();
      const ovrHistory = ovrHistorySnapshot.docs.map(doc => doc.data() as OvrHistory);
      
      const recentMatchIds = [...new Set(evaluations.slice(0, 15).map(e => e.matchId))];
      
      const selfEvalsByMatchId = new Map<string, SelfEvaluation>();
      if (recentMatchIds.length > 0) {
          const selfEvalsPromises = recentMatchIds.map(matchId => 
              adminDb.collection(`matches/${matchId}/selfEvaluations`).where('playerId', '==', playerId).get()
          );
          const selfEvalsSnapshots = await Promise.all(selfEvalsPromises);
          
          selfEvalsSnapshots.forEach(snapshot => {
              snapshot.forEach(doc => {
                  const selfEval = doc.data() as SelfEvaluation;
                  selfEvalsByMatchId.set(selfEval.matchId, selfEval);
              });
          });
      }
  
      const recentEvaluations = evaluations.slice(0, 15).map(e => {
          const selfEval = selfEvalsByMatchId.get(e.matchId);
          
          const validTags = (e.performanceTags || [])
            .filter((tag): tag is PerformanceTag => tag && typeof tag === 'object' && !!tag.name && !!tag.impact)
            .map(tag => ({
              name: tag.name,
              impact: tag.impact,
            }));
  
          return {
              matchDate: e.evaluatedAt || new Date().toISOString(),
              rating: e.rating,
              performanceTags: validTags,
              goals: selfEval?.goals || 0,
          };
      });
  
      const input: DetectPlayerPatternsInput = {
        playerId,
        playerName: player.name,
        position: player.position,
        currentOVR: player.ovr,
        stats: {
          matchesPlayed: player.stats.matchesPlayed || 0,
          goals: player.stats.goals || 0,
          assists: player.stats.assists || 0,
          averageRating: player.stats.averageRating || 0,
        },
        recentEvaluations,
        ovrHistory: ovrHistory.length > 0 ? ovrHistory : undefined,
      };
  
      const result = await detectPlayerPatterns(input);
      return result;
    } catch (error: any) {
      logger.error('Error detecting player patterns', error, { playerId });
      return { error: error.message || 'No se pudo analizar el rendimiento del jugador.' };
    }
}

export async function analyzePlayerProgressionAction(playerId: string, groupId: string) {
  try {
      const playerDocRef = adminDb.doc(`players/${playerId}`);
      const playerDocSnap = await playerDocRef.get();
      if (!playerDocSnap.exists) {
          return { error: 'No se pudo encontrar al jugador.' };
      }
      const player = playerDocSnap.data() as Player;

      const evaluations = await getPlayerEvaluationsAction(playerId, groupId) as Evaluation[];
      
      const ovrHistorySnapshot = await adminDb.collection(`players/${playerId}/ovrHistory`).orderBy('date', 'desc').limit(10).get();
      const ovrHistory = ovrHistorySnapshot.docs.map(doc => doc.data() as OvrHistory).reverse();
      
      const recentEvaluationsForAI = evaluations.slice(0, 10).map(e => ({
          matchDate: e.evaluatedAt,
          rating: e.rating,
          performanceTags: e.performanceTags?.map(t => t.name) || [],
      }));

      const input: AnalyzePlayerProgressionInput = {
          playerName: player.name,
          ovrHistory: ovrHistory.map(h => ({
              date: h.date,
              newOVR: h.newOVR,
              change: h.change
          })),
          recentEvaluations: recentEvaluationsForAI,
      };

      return await analyzePlayerProgression(input);
  } catch (error: any) {
      logger.error('Error in analyzePlayerProgressionAction', error, { playerId });
      return { error: 'No se pudo generar el análisis de progresión.' };
  }
}

export async function generateMatchChronicleAction(matchId: string): Promise<{ data?: GenerateMatchChronicleOutput; error?: string }> {
    logger.info('[generateMatchChronicleAction] Starting chronicle generation', { matchId });
    try {
        const matchRef = adminDb.doc(`matches/${matchId}`);
        const matchSnap = await matchRef.get();
        if (!matchSnap.exists) {
            logger.error('[generateMatchChronicleAction] Match not found', { matchId });
            throw createError(ErrorCodes.DATA_NOT_FOUND, {matchId});
        }

        const match = { id: matchSnap.id, ...matchSnap.data() } as Match;
        
        if (match.status !== 'evaluated' || !match.teams || match.teams.length < 2) {
            throw createError(ErrorCodes.VAL_INVALID_FORMAT, { status: match.status, matchId });
        }

        const evalsQuery = adminDb.collection('evaluations').where('matchId', '==', matchId);
        const selfEvalsQuery = adminDb.collection(`matches/${matchId}/selfEvaluations`);
        const [evalsSnap, selfEvalsSnap] = await Promise.all([evalsQuery.get(), selfEvalsQuery.get()]);
        
        const evaluations = evalsSnap.docs.map(d => d.data() as Evaluation);
        const selfEvaluations = selfEvalsSnap.docs.map(d => d.data() as SelfEvaluation);

        const goalsByPlayer = selfEvaluations.reduce((acc, ev) => {
            acc[ev.playerId] = (acc[ev.playerId] || 0) + ev.goals;
            return acc;
        }, {} as Record<string, number>);
        const assistsByPlayer = selfEvaluations.reduce((acc, ev) => {
            if (typeof ev.assists === 'number') {
              acc[ev.playerId] = (acc[ev.playerId] || 0) + ev.assists;
            }
            return acc;
        }, {} as Record<string, number>);

        // Prefer canonical match.finalScore if present; fallback reconstructing from selfEvaluations
        let team1Score: number;
        let team2Score: number;
        if (match.finalScore && typeof match.finalScore.team1 === 'number' && typeof match.finalScore.team2 === 'number') {
            team1Score = match.finalScore.team1;
            team2Score = match.finalScore.team2;
        } else {
            let t1 = 0; let t2 = 0;
            match.teams[0].players.forEach(p => t1 += goalsByPlayer[p.uid] || 0);
            match.teams[1].players.forEach(p => t2 += goalsByPlayer[p.uid] || 0);
            team1Score = t1; team2Score = t2;
        }

        const playersMap = new Map(match.players.map(p => [p.uid, p.displayName]));
        
        const keyEvents = evaluations
            .filter(e => Array.isArray(e.performanceTags) && e.performanceTags.length > 0)
            .sort(() => 0.5 - Math.random())
            .slice(0, 5)
            .map(e => {
                const firstTag = e.performanceTags![0];
                const safeDescription = firstTag?.description || firstTag?.name || 'Acción destacada';
                return {
                    minute: Math.floor(Math.random() * 85) + 5,
                    type: 'KeyPlay' as const,
                    playerName: playersMap.get(e.playerId) || 'Un jugador',
                    description: safeDescription,
                };
            });

        const enrichedEvents: GenerateMatchChronicleInput['keyEvents'] = [...keyEvents];
        const usedMinutes = new Set(enrichedEvents.map(e => e.minute));

        function randomMinute() {
            let m = Math.floor(Math.random() * 85) + 5;
            let attempts = 0;
            while (usedMinutes.has(m) && attempts < 10) {
                m = Math.floor(Math.random() * 85) + 5;
                attempts++;
            }
            usedMinutes.add(m);
            return m;
        }

                if (enrichedEvents.length < 3) {
            const goalEntries = Object.entries(goalsByPlayer)
                .filter(([, g]) => g > 0)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3);
            for (const [playerId, goals] of goalEntries) {
                if (enrichedEvents.length >= 5) break;
                const displayName = playersMap.get(playerId) || 'Jugador';
                const description = goals > 1
                    ? `Marcó un doblete decisivo para su equipo.`
                    : `Definió con categoría para abrir el marcador.`;
                enrichedEvents.push({
                    minute: randomMinute(),
                    type: 'Goal' as const,
                    playerName: displayName,
                    description,
                });
            }
        }

                if (enrichedEvents.length < 5) {
                    const assistEntries = Object.entries(assistsByPlayer)
                        .filter(([, a]) => a > 0)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 3);
                    for (const [playerId, assists] of assistEntries) {
                        if (enrichedEvents.length >= 5) break;
                        const displayName = playersMap.get(playerId) || 'Jugador';
                        const description = assists > 1
                            ? `Repartió ${assists} asistencias clave que inclinaron el partido.`
                            : `Asistencia precisa que cambió el marcador.`;
                        enrichedEvents.push({
                            minute: randomMinute(),
                            type: 'Assist' as const,
                            playerName: displayName,
                            description,
                        });
                    }
                }

        if (enrichedEvents.length < 3) {
            const ratedEvals = evaluations
                .filter(e => typeof e.rating === 'number' && e.rating && e.rating >= 7)
                .sort((a, b) => (b.rating || 0) - (a.rating || 0))
                .slice(0, 3);
            for (const ev of ratedEvals) {
                if (enrichedEvents.length >= 5) break;
                enrichedEvents.push({
                    minute: randomMinute(),
                    type: 'KeyPlay' as const,
                    playerName: playersMap.get(ev.playerId) || 'Jugador',
                    description: `Actuación destacada con calificación ${ev.rating}.`,
                });
            }
        }

        if (enrichedEvents.length === 0) {
            enrichedEvents.push({
                minute: randomMinute(),
                type: 'KeyPlay',
                playerName: 'El partido',
                description: 'Partido parejo sin acciones destacadas registradas.',
            });
        }

        const mvp = evaluations.reduce((best, current) => {
            if (!current.rating) return best;
            return (current.rating > best.rating) ? {playerId: current.playerId, rating: current.rating} : best;
        }, {playerId: '', rating: 0});
        
        const input: GenerateMatchChronicleInput = {
            matchTitle: match.title,
            team1Name: match.teams[0].name,
            team1Score,
            team2Name: match.teams[1].name,
            team2Score,
            keyEvents: enrichedEvents,
            mvp: {
                name: playersMap.get(mvp.playerId) || 'El Equipo',
                reason: 'por su rendimiento excepcional y una calificación de ' + mvp.rating
            }
        };
        
        const result = await generateMatchChronicleFlow(input);
        
        if (!result) {
            throw createError(ErrorCodes.AI_GENERATION_FAILED, { matchId });
        }

        return { data: result };

    } catch (error) {
        logger.error('[generateMatchChronicleAction] Error occurred', error, { matchId, action: 'generateMatchChronicle' });
        const formattedError = handleServerActionError(error, {matchId, action: 'generateMatchChronicle'});
        return { error: formattedError.error };
    }
}

// ============================================================================
// LEGACY FINAL SCORE MIGRATION
// ============================================================================
export async function migrateLegacyFinalScoresAction(batchSize: number = 200): Promise<{ success: boolean; updated: number; skipped: number; error?: string }> {
    try {
        const matchesSnap = await adminDb.collection('matches').get();
        let updated = 0; let skipped = 0; const writeBatch = adminDb.batch();
        matchesSnap.docs.forEach(doc => {
            const data = doc.data() as Partial<Match>;
            if (!data.teams || data.teams.length !== 2) { skipped++; return; }
            // Already migrated
            if (data.finalScore && typeof data.finalScore.team1 === 'number') { skipped++; return; }
            const t1 = data.teams[0].finalScore;
            const t2 = data.teams[1].finalScore;
            if (typeof t1 === 'number' && typeof t2 === 'number') {
                writeBatch.update(doc.ref, {
                    finalScore: { team1: t1, team2: t2 },
                });
                updated++;
            } else {
                skipped++;
            }
        });
        if (updated > 0) {
            await writeBatch.commit();
        }
        return { success: true, updated, skipped };
    } catch (error) {
        const err = handleServerActionError(error, { action: 'migrateLegacyFinalScores' });
        return { success: false, updated: 0, skipped: 0, error: err.error };
    }
}

// ============================================================================
// MIGRATION: Add assists field to existing selfEvaluations
// ============================================================================
export async function migrateAddAssistsToSelfEvaluationsAction(): Promise<{ success: boolean; updated: number; skipped: number; error?: string }> {
    try {
        const matchesSnap = await adminDb.collection('matches').get();
        let updated = 0; let skipped = 0;
        for (const matchDoc of matchesSnap.docs) {
            const selfEvalsSnap = await adminDb.collection(`matches/${matchDoc.id}/selfEvaluations`).get();
            const batch = adminDb.batch();
            let batchHasWrites = false;
            selfEvalsSnap.docs.forEach(evDoc => {
                const data = evDoc.data();
                if (typeof data.assists === 'number') { skipped++; return; }
                batch.update(evDoc.ref, { assists: 0 });
                updated++; batchHasWrites = true;
            });
            if (batchHasWrites) {
                await batch.commit();
            }
        }
        return { success: true, updated, skipped };
    } catch (error) {
        const err = handleServerActionError(error, { action: 'migrateAddAssistsToSelfEvaluations' });
        return { success: false, updated: 0, skipped: 0, error: err.error };
    }
}

// ============================================================================
// ACTION: Update player contribution (goals/assists) for a match
// ============================================================================
export async function updateMatchPlayerContributionAction(
    matchId: string,
    playerId: string,
    goalsDelta: number = 0,
    assistsDelta: number = 0,
    userId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const matchRef = adminDb.collection('matches').doc(matchId);
        const matchSnap = await matchRef.get();
        if (!matchSnap.exists) return { success: false, error: 'Partido no encontrado.' };
        const match = { id: matchSnap.id, ...matchSnap.data() } as Match;
        if (match.ownerUid !== userId) return { success: false, error: 'No autorizado.' };

        const selfEvalRef = adminDb.collection(`matches/${matchId}/selfEvaluations`).where('playerId', '==', playerId);
        const existingSnap = await selfEvalRef.get();
        let docRefToUpdate;
        if (existingSnap.empty) {
            docRefToUpdate = adminDb.collection(`matches/${matchId}/selfEvaluations`).doc();
            await docRefToUpdate.set({
                playerId,
                matchId,
                goals: Math.max(0, goalsDelta),
                assists: Math.max(0, assistsDelta),
                reportedAt: new Date().toISOString(),
            });
        } else {
            docRefToUpdate = existingSnap.docs[0].ref;
            const data = existingSnap.docs[0].data();
            await docRefToUpdate.update({
                goals: Math.max(0, (data.goals || 0) + goalsDelta),
                assists: Math.max(0, (data.assists || 0) + assistsDelta),
            });
        }
        return { success: true };
    } catch (error) {
        const err = handleServerActionError(error, { action: 'updateMatchPlayerContribution' });
        return { success: false, error: err.error };
    }
}


export async function generateDuoImageAction(input: GenerateDuoImageInput) {
    try {
        const { convertStorageUrlToBase64 } = await import('./image-generation');
        
        const player1Result = await convertStorageUrlToBase64(input.player1PhotoUrl);
        if (player1Result.error || !player1Result.dataUri) {
            throw new Error(player1Result.error || 'No se pudo procesar la foto del primer jugador.');
        }
        
        let player2DataUri = player1Result.dataUri;
        
        if (input.player2PhotoUrl && input.player2PhotoUrl !== input.player1PhotoUrl) {
            const player2Result = await convertStorageUrlToBase64(input.player2PhotoUrl);
            if (player2Result.error || !player2Result.dataUri) {
                throw new Error(player2Result.error || 'No se pudo procesar la foto del segundo jugador.');
            }
            player2DataUri = player2Result.dataUri;
        }
        
        const imageUrl = await generateDuoImage(
            player1Result.dataUri,
            player2DataUri,
            input.player1Name,
            input.player2Name || input.player1Name,
            input.prompt
        );
        
        return { success: true, imageUrl };
    } catch(error) {
        return handleServerActionError(error);
    }
}


// --- TEAM AVAILABILITY POSTS ACTIONS ---

export async function createTeamAvailabilityPostAction(
    teamId: string,
    userId: string,
    postData: {
        date: string;
        time: string;
        location: MatchLocation;
        description?: string;
    }
) {
    try {
        const teamSnap = await adminDb.doc(`teams/${teamId}`).get();
        if (!teamSnap.exists) {
            throw createError(ErrorCodes.DATA_NOT_FOUND, { teamId });
        }

        const team = { id: teamSnap.id, ...teamSnap.data() } as GroupTeam;

        if (team.createdBy !== userId) {
            throw createError(ErrorCodes.AUTH_INSUFFICIENT_PERMISSIONS, { userId, teamId });
        }

        const postRef = adminDb.collection('teamAvailabilityPosts').doc();
        const newPost: any = {
            teamId: team.id,
            teamName: team.name,
            jersey: team.jersey,
            date: postData.date,
            time: postData.time,
            location: postData.location,
            createdBy: userId,
            createdAt: new Date().toISOString(),
        };

        if (postData.description) {
            newPost.description = postData.description;
        }

        await postRef.set(newPost);

        return { success: true, postId: postRef.id };
    } catch (error: any) {
        return handleServerActionError(error);
    }
}

export async function getAvailableTeamPostsAction(userId: string): Promise<{ success: boolean; posts: TeamAvailabilityPost[] } | ErrorResponse> {
    try {
        const today = new Date().toISOString().split('T')[0];

        const postsSnapshot = await adminDb
            .collection('teamAvailabilityPosts')
            .where('createdBy', '!=', userId)
            .where('date', '>=', today)
            .orderBy('date', 'asc')
            .orderBy('createdBy')
            .get();

        const posts = postsSnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as TeamAvailabilityPost))
            .filter(post => {
                const isActive = !post.status || post.status === 'active';
                const postDateTime = new Date(`${post.date}T${post.time}`);
                const isValidTime = postDateTime > new Date();
                return isActive && isValidTime;
            });

        return { success: true, posts };
    } catch (error: any) {
        return handleServerActionError(error, {userId});
    }
}

export async function getUserTeamPostsAction(userId: string) {
    try {
        const postsSnapshot = await adminDb
            .collection('teamAvailabilityPosts')
            .where('createdBy', '==', userId)
            .orderBy('date', 'asc')
            .get();

        const posts = postsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as TeamAvailabilityPost));

        return { success: true, posts };
    } catch (error: any) {
        return handleServerActionError(error);
    }
}

export async function challengeTeamPostAction(
    postId: string,
    challengingTeamId: string,
    challengerUserId: string
) {
    try {
        const batch = adminDb.batch();

        const [postSnap, challengingTeamSnap] = await Promise.all([
            adminDb.doc(`teamAvailabilityPosts/${postId}`).get(),
            adminDb.doc(`teams/${challengingTeamId}`).get(),
        ]);

        if (!postSnap.exists || !challengingTeamSnap.exists) {
            throw createError(ErrorCodes.DATA_NOT_FOUND, { postId, challengingTeamId });
        }

        const post = { id: postSnap.id, ...postSnap.data() } as TeamAvailabilityPost;
        const challengingTeam = { id: challengingTeamSnap.id, ...challengingTeamSnap.data() } as GroupTeam;
        
        const challengedTeamSnap = await adminDb.doc(`teams/${post.teamId}`).get();
        if (!challengedTeamSnap.exists) throw new Error("El equipo desafiado no existe.");
        const challengedTeam = { id: challengedTeamSnap.id, ...challengedTeamSnap.data() } as GroupTeam;

        const invitationRef = adminDb.collection(`teams/${post.teamId}/invitations`).doc();
        const newInvitation: Omit<Invitation, 'id'> = {
            type: 'team_challenge',
            fromTeamId: challengingTeam.id,
            fromTeamName: challengingTeam.name,
            fromTeamJersey: challengingTeam.jersey,
            toTeamId: challengedTeam.id,
            toTeamName: challengedTeam.name,
            toTeamJersey: challengedTeam.jersey,
            postId: post.id,
            status: 'pending',
            createdBy: challengerUserId,
            createdAt: new Date().toISOString(),
        };
        batch.set(invitationRef, newInvitation);

        const notificationRef = adminDb.collection(`users/${challengedTeam.createdBy}/notifications`).doc();
        const notification: Omit<Notification, 'id'> = {
            type: 'match_invite',
            title: '¡Desafío Recibido!',
            message: `El equipo "${challengingTeam.name}" quiere aceptar tu postulación.`,
            link: '/competitions/challenges',
            isRead: false,
            createdAt: new Date().toISOString(),
        };
        batch.set(notificationRef, notification);

        await batch.commit();

        return { success: true };
    } catch (error: any) {
        return handleServerActionError(error);
    }
}


export async function acceptTeamChallengeAction(invitationId: string, teamId: string, userId: string): Promise<{ success: boolean; matchId: string } | ErrorResponse> {
  try {
    const result = await adminDb.runTransaction(async (transaction) => {
      const invitationRef = adminDb.doc(`teams/${teamId}/invitations/${invitationId}`);
      const invitationSnap = await transaction.get(invitationRef);

      if (!invitationSnap.exists || invitationSnap.data()?.status !== 'pending') {
        throw createError(ErrorCodes.DATA_NOT_FOUND, { reason: "Invitation not found or already processed." });
      }

      const invitation = invitationSnap.data() as Invitation;
      
      const team1Ref = adminDb.doc(`teams/${invitation.toTeamId}`);
      const team2Ref = adminDb.doc(`teams/${invitation.fromTeamId}`);
      const [team1Snap, team2Snap] = await Promise.all([transaction.get(team1Ref), transaction.get(team2Ref)]);

      if (!team1Snap.exists || !team2Snap.exists) {
        throw createError(ErrorCodes.DATA_NOT_FOUND, { reason: "One of the teams does not exist." });
      }

      const team1Data = {id: team1Snap.id, ...team1Snap.data()} as GroupTeam;
      const team2Data = {id: team2Snap.id, ...team2Snap.data()} as GroupTeam;

      if (team1Data.createdBy !== userId) {
        throw createError(ErrorCodes.AUTH_INSUFFICIENT_PERMISSIONS);
      }

      let matchDate: string = new Date().toISOString().split('T')[0];
      let matchTime: string = '19:00';
      let matchLocation: MatchLocation = { name: 'A confirmar', address: '', lat: 0, lng: 0, placeId: '' };
      
      if (invitation.postId) {
        const postRef = adminDb.doc(`teamAvailabilityPosts/${invitation.postId}`);
        const postSnap = await transaction.get(postRef);
        if (postSnap.exists) {
          const postData = postSnap.data() as TeamAvailabilityPost;
          matchDate = postData.date;
          matchTime = postData.time;
          matchLocation = postData.location;
          transaction.update(postRef, { status: 'matched' });
        }
      }
      
      const matchRef = adminDb.collection('matches').doc();
      const newMatch: Omit<Match, 'id'> = {
        title: `${team1Data.name} vs ${team2Data.name}`,
        date: matchDate,
        time: matchTime,
        location: matchLocation,
        type: 'intergroup_friendly',
        matchSize: 22,
        players: [],
        playerUids: [],
        teams: [],
        status: 'upcoming',
        ownerUid: team1Data.createdBy,
        groupId: team1Data.groupId,
        isPublic: false,
        startTimestamp: new Date(`${matchDate}T${matchTime}`).toISOString(),
        participantTeamIds: [team1Data.id!, team2Data.id!],
        createdAt: new Date().toISOString(),
      };
      
      transaction.set(matchRef, newMatch);
      transaction.update(invitationRef, { status: 'accepted' });

      return { success: true, matchId: matchRef.id };
    });

    return result;

  } catch (error) {
    return handleServerActionError(error, { invitationId, teamId, userId });
  }
}

export async function rejectTeamChallengeAction(invitationId: string, teamId: string, userId: string) {
    try {
        const batch = adminDb.batch();

        const invitationSnap = await adminDb.doc(`teams/${teamId}/invitations/${invitationId}`).get();
        if (!invitationSnap.exists) {
            throw createError(ErrorCodes.DATA_NOT_FOUND, { invitationId });
        }
        const invitation = invitationSnap.data() as Invitation;
        
        const challengedTeamSnap = await adminDb.doc(`teams/${teamId}`).get();
        if (challengedTeamSnap.data()?.createdBy !== userId) {
            throw createError(ErrorCodes.AUTH_INSUFFICIENT_PERMISSIONS);
        }

        batch.update(invitationSnap.ref, { status: 'declined' });

        const challengingTeamSnap = await adminDb.doc(`teams/${invitation.fromTeamId}`).get();
        if (challengingTeamSnap.exists) {
            const challengingTeam = challengingTeamSnap.data() as GroupTeam;
            const notificationRef = adminDb.collection(`users/${challengingTeam.createdBy}/notifications`).doc();
            batch.set(notificationRef, {
                type: 'match_update',
                title: 'Desafío Rechazado',
                message: `"${invitation.toTeamName}" ha rechazado tu desafío.`,
                link: '/competitions',
                isRead: false,
                createdAt: new Date().toISOString(),
            });
        }
        await batch.commit();
        return { success: true };
    } catch(error) {
        return handleServerActionError(error);
    }
}

export async function deleteTeamAvailabilityPostAction(postId: string, userId: string) {
    try {
        const postRef = adminDb.doc(`teamAvailabilityPosts/${postId}`);
        const postSnap = await postRef.get();

        if (!postSnap.exists) {
            throw createError(ErrorCodes.DATA_NOT_FOUND);
        }

        if (postSnap.data()?.createdBy !== userId) {
            throw createError(ErrorCodes.AUTH_INSUFFICIENT_PERMISSIONS);
        }

        await postRef.delete();
        return { success: true };
    } catch(error) {
        return handleServerActionError(error);
    }
}
export async function sendTeamChallengeAction(challengingTeamId: string, challengedTeamId: string, challengerUserId: string) {
    try {
        const batch = adminDb.batch();

        const [challengingTeamSnap, challengedTeamSnap] = await Promise.all([
            adminDb.doc(`teams/${challengingTeamId}`).get(),
            adminDb.doc(`teams/${challengedTeamId}`).get(),
        ]);
        
        if (!challengingTeamSnap.exists || !challengedTeamSnap.exists) {
            throw createError(ErrorCodes.DATA_NOT_FOUND, { challengingTeamId, challengedTeamId });
        }
        
        const challengingTeam = { id: challengingTeamSnap.id, ...challengingTeamSnap.data() } as GroupTeam;
        const challengedTeam = { id: challengedTeamSnap.id, ...challengedTeamSnap.data() } as GroupTeam;
        
        const invitationRef = adminDb.collection(`teams/${challengedTeam.id}/invitations`).doc();
        const newInvitation: Omit<Invitation, 'id'> = {
            type: 'team_challenge',
            fromTeamId: challengingTeam.id,
            fromTeamName: challengingTeam.name,
            fromTeamJersey: challengingTeam.jersey,
            toTeamId: challengedTeam.id,
            toTeamName: challengedTeam.name,
            toTeamJersey: challengedTeam.jersey,
            status: 'pending',
            createdBy: challengerUserId,
            createdAt: new Date().toISOString(),
        };
        batch.set(invitationRef, newInvitation);
        
        const notificationRef = adminDb.collection(`users/${challengedTeam.createdBy}/notifications`).doc();
        const notification: Omit<Notification, 'id'> = {
            type: 'match_invite',
            title: '¡Nuevo Desafío!',
            message: `El equipo "${challengingTeam.name}" te ha desafiado a un amistoso.`,
            link: '/competitions/challenges',
            isRead: false,
            createdAt: new Date().toISOString(),
        };
        batch.set(notificationRef, notification);

        await batch.commit();

        return { success: true };
    } catch (error: any) {
        return handleServerActionError(error);
    }
}

export async function createLeagueAction(
    name: string,
    format: LeagueFormat,
    teamIds: string[],
    isPublic: boolean,
    groupId: string,
    ownerUid: string,
    scheduleConfig?: {
        startDate: string;
        matchFrequency: 'weekly' | 'biweekly' | 'custom';
        matchDayOfWeek: number;
        matchTime: string;
        defaultLocation?: MatchLocation;
    },
    logoUrl?: string
): Promise<{ success: boolean; leagueId?: string; error?: string }> {
    try {
        const batch = adminDb.batch();

        const leagueRef = adminDb.collection('leagues').doc();
        const newLeague: Omit<League, 'id'> = {
            name,
            format,
            teams: teamIds,
            isPublic,
            groupId,
            ownerUid,
            status: 'draft',
            createdAt: new Date().toISOString(),
            ...(logoUrl && { logoUrl }),
            ...(scheduleConfig && {
                startDate: scheduleConfig.startDate,
                matchFrequency: scheduleConfig.matchFrequency,
                matchDayOfWeek: scheduleConfig.matchDayOfWeek,
                matchTime: scheduleConfig.matchTime,
                defaultLocation: scheduleConfig.defaultLocation,
            }),
        };
        batch.set(leagueRef, newLeague);

        // Generate Fixture
        const teamsData = await Promise.all(teamIds.map(id => adminDb.doc(`teams/${id}`).get()));
        let teams = teamsData.map(snap => ({ id: snap.id, ...snap.data() } as GroupTeam));

        if (teams.length % 2 !== 0) {
            teams.push({ id: 'bye', name: 'Descansa', jersey: { type: 'plain', primaryColor: '#ffffff', secondaryColor: '#000000' }} as GroupTeam);
        }

        const numRounds = teams.length - 1;
        const matchesPerRound = teams.length / 2;
        const isDoubleRoundRobin = format === 'double_round_robin';
        const totalPhases = isDoubleRoundRobin ? 2 : 1; // Ida y vuelta

        // Helper function to calculate match date
        const getMatchDate = (round: number): Date => {
            if (!scheduleConfig) {
                return new Date(); // Fallback to current date if no schedule
            }

            const startDate = new Date(scheduleConfig.startDate);
            const daysToAdd = scheduleConfig.matchFrequency === 'weekly' ? round * 7 : round * 14;
            const matchDate = new Date(startDate);
            matchDate.setDate(matchDate.getDate() + daysToAdd);

            // Set time
            const [hours, minutes] = scheduleConfig.matchTime.split(':');
            matchDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

            return matchDate;
        };

        let globalRound = 0;

        for (let phase = 0; phase < totalPhases; phase++) {
            // Reset teams rotation for second phase
            if (phase === 1) {
                teams = teamsData.map(snap => ({ id: snap.id, ...snap.data() } as GroupTeam));
                if (teams.length % 2 !== 0) {
                    teams.push({ id: 'bye', name: 'Descansa', jersey: { type: 'plain', primaryColor: '#ffffff', secondaryColor: '#000000' }} as GroupTeam);
                }
            }

            for (let round = 0; round < numRounds; round++) {
                globalRound++;
                const matchDate = getMatchDate(globalRound - 1);

                for (let i = 0; i < matchesPerRound; i++) {
                    const team1 = teams[i];
                    const team2 = teams[teams.length - 1 - i];

                    if (team1.id === 'bye' || team2.id === 'bye') continue;

                    // For second phase (vuelta), invert home/away
                    const homeTeam = phase === 0 ? team1 : team2;
                    const awayTeam = phase === 0 ? team2 : team1;

                    const matchRef = adminDb.collection('matches').doc();
                    const matchData: Partial<Match> = {
                        title: `${homeTeam.name} vs ${awayTeam.name}`,
                        date: matchDate.toISOString(),
                        time: scheduleConfig?.matchTime || "19:00",
                        location: scheduleConfig?.defaultLocation || { name: "A definir", address: "", lat: 0, lng: 0, placeId: "" },
                        type: 'league',
                        matchSize: 22,
                        status: 'upcoming',
                        ownerUid,
                        groupId,
                        participantTeamIds: [homeTeam.id, awayTeam.id],
                        teams: [
                            { name: homeTeam.name, players: [], totalOVR: 0, averageOVR: 0, jersey: homeTeam.jersey },
                            { name: awayTeam.name, players: [], totalOVR: 0, averageOVR: 0, jersey: awayTeam.jersey },
                        ],
                        leagueInfo: {
                            leagueId: leagueRef.id,
                            round: globalRound,
                        },
                        createdAt: new Date().toISOString(),
                    };
                    batch.set(matchRef, matchData);
                }
                // Rotate teams for next round
                teams.splice(1, 0, teams.pop()!);
            }
        }

        await batch.commit();

        return { success: true, leagueId: leagueRef.id };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

/**
 * Update league status (draft -> in_progress -> completed)
 */
export async function updateLeagueStatusAction(
    leagueId: string,
    newStatus: CompetitionStatus
): Promise<{ success: boolean; error?: string }> {
    try {
        const leagueRef = adminDb.collection('leagues').doc(leagueId);

        await leagueRef.update({
            status: newStatus,
        });

        return { success: true };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

/**
 * Delete a league and all its associated matches
 */
export async function deleteLeagueAction(
    leagueId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        // Delete all matches associated with this league
        const matchesSnapshot = await adminDb
            .collection('matches')
            .where('leagueInfo.leagueId', '==', leagueId)
            .get();

        const deleteMatchesPromises = matchesSnapshot.docs.map(doc => doc.ref.delete());
        await Promise.all(deleteMatchesPromises);

        // Get league data to check for logo
        const leagueDoc = await adminDb.collection('leagues').doc(leagueId).get();
        const leagueData = leagueDoc.data();

        // Delete logo from storage if it exists
        if (leagueData?.logoUrl) {
            try {
                const bucket = adminStorage;
                // Extract file path from URL
                const urlParts = leagueData.logoUrl.split('/o/')[1];
                if (urlParts) {
                    const filePath = decodeURIComponent(urlParts.split('?')[0]);
                    await bucket.file(filePath).delete();
                }
            } catch (storageError) {
                console.error('Error deleting logo from storage:', storageError);
                // Continue with league deletion even if logo deletion fails
            }
        }

        // Delete the league document
        await adminDb.collection('leagues').doc(leagueId).delete();

        return { success: true };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

// ===== CUP ACTIONS =====

/**
 * Create a new cup
 */
export async function createCupAction(
    name: string,
    format: CupFormat,
    isPublic: boolean,
    teamIds: string[],
    groupId: string,
    ownerUid: string,
    logoUrl?: string,
    startDate?: string,
    defaultLocation?: MatchLocation
): Promise<{ success: boolean; cupId?: string; error?: string }> {
    try {
        if (teamIds.length < 2 || ![2, 4, 8, 16, 32].includes(teamIds.length)) {
            return {
                success: false,
                error: 'El número de equipos debe ser 2, 4, 8, 16 o 32'
            };
        }

        const cupData: Omit<Cup, 'id'> = {
            name,
            format,
            status: 'draft',
            ownerUid,
            groupId,
            isPublic,
            teams: teamIds,
            createdAt: new Date().toISOString(),
            logoUrl,
            startDate,
            defaultLocation,
        };

        const cupRef = await adminDb.collection('cups').add(cupData);

        return { success: true, cupId: cupRef.id };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

/**
 * Start cup and generate bracket
 */
export async function startCupAction(
    cupId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const cupDoc = await adminDb.collection('cups').doc(cupId).get();
        if (!cupDoc.exists) {
            return { success: false, error: 'Copa no encontrada' };
        }

        const cup = { id: cupDoc.id, ...cupDoc.data() } as Cup;

        if (cup.status !== 'draft') {
            return { success: false, error: 'La copa ya fue iniciada' };
        }

        // Get teams data
        const teamsSnapshot = await adminDb
            .collection('teams')
            .where('__name__', 'in', cup.teams)
            .get();

        const teams = teamsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        })) as GroupTeam[];

        // Generate bracket
        const bracket = generateBracket(teams);

        // Update cup with bracket
        await adminDb.collection('cups').doc(cupId).update({
            status: 'in_progress',
            bracket,
            currentRound: bracket[0]?.round || 'final',
        });

        return { success: true };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

/**
 * Update cup status
 */
export async function updateCupStatusAction(
    cupId: string,
    status: CompetitionStatus
): Promise<{ success: boolean; error?: string }> {
    try {
        await adminDb.collection('cups').doc(cupId).update({ status });
        return { success: true };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

/**
 * Delete cup
 */
export async function deleteCupAction(
    cupId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        // Delete all matches
        const matchesSnapshot = await adminDb
            .collection('matches')
            .where('leagueInfo.leagueId', '==', cupId) // Using same field for cups
            .get();

        const deleteMatchesPromises = matchesSnapshot.docs.map(doc => doc.ref.delete());
        await Promise.all(deleteMatchesPromises);

        // Get cup data for logo
        const cupDoc = await adminDb.collection('cups').doc(cupId).get();
        const cupData = cupDoc.data();

        // Delete logo
        if (cupData?.logoUrl) {
            try {
                const bucket = adminStorage;
                const urlParts = cupData.logoUrl.split('/o/')[1];
                if (urlParts) {
                    const filePath = decodeURIComponent(urlParts.split('?')[0]);
                    await bucket.file(filePath).delete();
                }
            } catch (storageError) {
                console.error('Error deleting logo:', storageError);
            }
        }

        await adminDb.collection('cups').doc(cupId).delete();

        return { success: true };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

/**
 * Update match date/time/location
 */
export async function updateMatchDateAction(
    matchId: string,
    date: string,
    time: string,
    location?: MatchLocation
): Promise<{ success: boolean; error?: string }> {
    try {
        const matchRef = adminDb.collection('matches').doc(matchId);

        const updateData: any = {
            date,
            time,
        };

        if (location) {
            updateData.location = location;
        }

        await matchRef.update(updateData);

        return { success: true };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

// ============================================================================
// COMPETITION APPLICATIONS
// ============================================================================

/**
 * Get all public leagues and cups that are open for applications
 */
export async function getPublicCompetitionsAction(): Promise<{
    success: boolean;
    leagues?: League[];
    cups?: Cup[];
    error?: string;
}> {
    try {
        // Fetch public leagues
        const leaguesSnapshot = await adminDb
            .collection('leagues')
            .where('isPublic', '==', true)
            .where('status', '==', 'open_for_applications')
            .get();

        const leagues = leaguesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as League));

        // Fetch public cups
        const cupsSnapshot = await adminDb
            .collection('cups')
            .where('isPublic', '==', true)
            .where('status', '==', 'open_for_applications')
            .get();

        const cups = cupsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Cup));

        return { success: true, leagues, cups };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

/**
 * Submit an application for a team to join a competition
 */
export async function submitCompetitionApplicationAction(
    competitionId: string,
    competitionType: CompetitionFormat,
    teamId: string,
    userId: string
): Promise<{ success: boolean; applicationId?: string; error?: string }> {
    try {
        // Fetch team data
        const teamDoc = await adminDb.collection('teams').doc(teamId).get();
        if (!teamDoc.exists) {
            return { success: false, error: 'Equipo no encontrado.' };
        }

        const team = teamDoc.data() as GroupTeam;

        // Check if user owns the team
        if (team.createdBy !== userId) {
            return { success: false, error: 'No tienes permiso para postular este equipo.' };
        }

        // Check if application already exists
        const existingApplications = await adminDb
            .collection('competitionApplications')
            .where('competitionId', '==', competitionId)
            .where('teamId', '==', teamId)
            .where('status', 'in', ['pending', 'approved'])
            .get();

        if (!existingApplications.empty) {
            return { success: false, error: 'Ya existe una postulación para este equipo en esta competición.' };
        }

        // Create application
        const applicationData: Omit<CompetitionApplication, 'id'> = {
            competitionId,
            competitionType,
            teamId,
            teamName: team.name,
            teamJersey: team.jersey,
            status: 'pending',
            submittedAt: new Date().toISOString(),
            submittedBy: userId,
        };

        const applicationRef = await adminDb.collection('competitionApplications').add(applicationData);

        return { success: true, applicationId: applicationRef.id };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

/**
 * Get all applications for a specific competition
 */
export async function getCompetitionApplicationsAction(
    competitionId: string,
    competitionType: CompetitionFormat
): Promise<{ success: boolean; applications?: CompetitionApplication[]; error?: string }> {
    try {
        const snapshot = await adminDb
            .collection('competitionApplications')
            .where('competitionId', '==', competitionId)
            .where('competitionType', '==', competitionType)
            .orderBy('submittedAt', 'asc')
            .get();

        const applications = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as CompetitionApplication));

        return { success: true, applications };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

/**
 * Approve a competition application and add team to the competition
 */
export async function approveApplicationAction(
    applicationId: string,
    competitionId: string,
    competitionType: CompetitionFormat
): Promise<{ success: boolean; error?: string }> {
    try {
        const applicationRef = adminDb.collection('competitionApplications').doc(applicationId);
        const applicationDoc = await applicationRef.get();

        if (!applicationDoc.exists) {
            return { success: false, error: 'Aplicación no encontrada.' };
        }

        const application = applicationDoc.data() as CompetitionApplication;

        // Update application status
        await applicationRef.update({ status: 'approved' });

        // Add team to competition
        const competitionCollection = competitionType === 'league' ? 'leagues' : 'cups';
        const competitionRef = adminDb.collection(competitionCollection).doc(competitionId);

        await competitionRef.update({
            teams: FieldValue.arrayUnion(application.teamId)
        });

        return { success: true };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

/**
 * Reject a competition application
 */
export async function rejectApplicationAction(
    applicationId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const applicationRef = adminDb.collection('competitionApplications').doc(applicationId);
        const applicationDoc = await applicationRef.get();

        if (!applicationDoc.exists) {
            return { success: false, error: 'Aplicación no encontrada.' };
        }

        await applicationRef.update({ status: 'rejected' });

        return { success: true };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

// ============================================================================
// MATCH FINAL SCORE NORMALIZATION
// ============================================================================
export async function updateMatchFinalScoreAction(
    matchId: string,
    team1Score: number,
    team2Score: number,
    userId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const matchRef = adminDb.collection('matches').doc(matchId);
        const matchSnap = await matchRef.get();
        if (!matchSnap.exists) {
            return { success: false, error: 'Partido no encontrado.' };
        }
        const match = { id: matchSnap.id, ...matchSnap.data() } as Match;

        if (!match.participantTeamIds || match.participantTeamIds.length !== 2) {
            return { success: false, error: 'Estructura de equipos inválida.' };
        }
        if (!match.teams || match.teams.length !== 2) {
            return { success: false, error: 'Datos de equipos incompletos.' };
        }

        // Basic permission: only owner can set score (extend later for admins)
        if (match.ownerUid !== userId) {
            return { success: false, error: 'No autorizado para actualizar el resultado.' };
        }

        const updateData: Partial<Match> = {
            finalScore: { team1: team1Score, team2: team2Score },
            teams: [
                { ...match.teams[0], finalScore: team1Score },
                { ...match.teams[1], finalScore: team2Score },
            ],
        };

        // Auto-complete match if not yet finalized
        if (match.status === 'upcoming' || match.status === 'active') {
            updateData.status = 'completed';
            updateData.finalizedAt = new Date().toISOString();
        }

        await matchRef.update(updateData as any);
        return { success: true };
    } catch (error) {
        const err = handleServerActionError(error, { matchId });
        return { success: false, error: err.error };
    }
}

// ============================================================================
// LEAGUE STANDINGS
// ============================================================================

/**
 * Update league standings table based on all completed matches
 * This should be called after a league match is finalized
 */
export async function updateLeagueStandingsAction(
    leagueId: string
): Promise<{ success: boolean; standings?: any[]; error?: string }> {
    try {
        // Get league data
        const leagueDoc = await adminDb.collection('leagues').doc(leagueId).get();
        if (!leagueDoc.exists) {
            return { success: false, error: 'Liga no encontrada.' };
        }
        const league = { id: leagueDoc.id, ...leagueDoc.data() } as League;

        // Get all league matches that are completed or evaluated
        const matchesSnapshot = await adminDb
            .collection('matches')
            .where('leagueInfo.leagueId', '==', leagueId)
            .where('status', 'in', ['completed', 'evaluated'])
            .get();

        const matches = matchesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Match));

        // Get team data to include jersey info
        const teamsSnapshot = await adminDb
            .collection('teams')
            .where('__name__', 'in', league.teams)
            .get();

        const teamsMap = new Map(
            teamsSnapshot.docs.map(doc => [doc.id, { id: doc.id, ...doc.data() } as GroupTeam])
        );

        // Initialize standings for each team
        const standingsMap = new Map<string, {
            teamId: string;
            teamName: string;
            teamJersey: any;
            matchesPlayed: number;
            wins: number;
            draws: number;
            losses: number;
            goalsFor: number;
            goalsAgainst: number;
            goalDifference: number;
            points: number;
        }>();

        // Initialize all teams with zero stats
        league.teams.forEach(teamId => {
            const team = teamsMap.get(teamId);
            if (team) {
                standingsMap.set(teamId, {
                    teamId,
                    teamName: team.name,
                    teamJersey: team.jersey,
                    matchesPlayed: 0,
                    wins: 0,
                    draws: 0,
                    losses: 0,
                    goalsFor: 0,
                    goalsAgainst: 0,
                    goalDifference: 0,
                    points: 0,
                });
            }
        });

        // Process each completed match
        matches.forEach(match => {
            if (!match.participantTeamIds || match.participantTeamIds.length !== 2) return;
            if (!match.finalScore) return;

            const team1Id = match.participantTeamIds[0];
            const team2Id = match.participantTeamIds[1];
            const team1Score = match.finalScore.team1;
            const team2Score = match.finalScore.team2;

            const team1Stats = standingsMap.get(team1Id);
            const team2Stats = standingsMap.get(team2Id);

            if (!team1Stats || !team2Stats) return;

            // Update matches played
            team1Stats.matchesPlayed++;
            team2Stats.matchesPlayed++;

            // Update goals
            team1Stats.goalsFor += team1Score;
            team1Stats.goalsAgainst += team2Score;
            team2Stats.goalsFor += team2Score;
            team2Stats.goalsAgainst += team1Score;

            // Update results
            if (team1Score > team2Score) {
                // Team 1 wins
                team1Stats.wins++;
                team1Stats.points += 3;
                team2Stats.losses++;
            } else if (team2Score > team1Score) {
                // Team 2 wins
                team2Stats.wins++;
                team2Stats.points += 3;
                team1Stats.losses++;
            } else {
                // Draw
                team1Stats.draws++;
                team2Stats.draws++;
                team1Stats.points++;
                team2Stats.points++;
            }

            // Update goal difference
            team1Stats.goalDifference = team1Stats.goalsFor - team1Stats.goalsAgainst;
            team2Stats.goalDifference = team2Stats.goalsFor - team2Stats.goalsAgainst;
        });

        // Convert to array and sort
        const standings = Array.from(standingsMap.values()).sort((a, b) => {
            // 1. Sort by points (descending)
            if (b.points !== a.points) return b.points - a.points;
            // 2. Sort by goal difference (descending)
            if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
            // 3. Sort by goals for (descending)
            if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
            // 4. Alphabetically by team name
            return a.teamName.localeCompare(b.teamName);
        });

        // Add position
        const standingsWithPosition = standings.map((team, index) => ({
            ...team,
            position: index + 1,
        }));

        // Save standings to league document
        await adminDb.collection('leagues').doc(leagueId).update({
            standings: standingsWithPosition,
        });

        return { success: true, standings: standingsWithPosition };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

// ============================================================================
// CUP BRACKET ADVANCEMENT
// ============================================================================

/**
 * Advance winner in cup bracket and create next match if both teams are ready
 * This should be called after a cup match is finalized
 */
export async function advanceCupWinnerAction(
    cupId: string,
    matchId: string,
    winnerId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        // Get cup data
        const cupDoc = await adminDb.collection('cups').doc(cupId).get();
        if (!cupDoc.exists) {
            return { success: false, error: 'Copa no encontrada.' };
        }
        const cup = { id: cupDoc.id, ...cupDoc.data() } as Cup;

        if (!cup.bracket) {
            return { success: false, error: 'Bracket no generado.' };
        }

        // Get match data
        const matchDoc = await adminDb.collection('matches').doc(matchId).get();
        if (!matchDoc.exists) {
            return { success: false, error: 'Partido no encontrado.' };
        }
        const match = { id: matchDoc.id, ...matchDoc.data() } as Match;

        // Find the bracket match
        const bracketMatch = cup.bracket.find(bm => bm.matchId === matchId);
        if (!bracketMatch) {
            return { success: false, error: 'Partido no encontrado en el bracket.' };
        }

        // Get winner team data
        const winnerTeamDoc = await adminDb.collection('teams').doc(winnerId).get();
        if (!winnerTeamDoc.exists) {
            return { success: false, error: 'Equipo ganador no encontrado.' };
        }
        const winnerTeam = { id: winnerTeamDoc.id, ...winnerTeamDoc.data() } as GroupTeam;

        // Advance winner in bracket
        const updatedBracket = advanceWinner(
            cup.bracket,
            bracketMatch.id,
            winnerId,
            winnerTeam.name,
            winnerTeam.jersey
        );

        // Check if tournament is complete
        const isComplete = isTournamentComplete(updatedBracket);

        const updateData: Partial<Cup> = {
            bracket: updatedBracket,
        };

        if (isComplete) {
            const champion = getChampion(updatedBracket);
            const runnerUp = getRunnerUp(updatedBracket);

            updateData.status = 'completed';
            updateData.completedAt = new Date().toISOString();
            if (champion) {
                updateData.championTeamId = champion.teamId;
                updateData.championTeamName = champion.teamName;
            }
            if (runnerUp) {
                updateData.runnerUpTeamId = runnerUp.teamId;
                updateData.runnerUpTeamName = runnerUp.teamName;
            }
        } else {
            // Check if we need to create next match
            // Find the next match in the bracket
            const nextRound = getNextRound(bracketMatch.round);
            if (nextRound) {
                const nextMatchNumber = bracketMatch.nextMatchNumber;
                if (nextMatchNumber) {
                    const nextBracketMatch = updatedBracket.find(
                        bm => bm.round === nextRound && bm.matchNumber === nextMatchNumber
                    );

                    // If both teams are defined and match hasn't been created yet
                    if (nextBracketMatch && nextBracketMatch.team1Id && nextBracketMatch.team2Id && !nextBracketMatch.matchId) {
                        // Create the next match
                        const nextMatchRef = adminDb.collection('matches').doc();
                        const nextMatchData: Partial<Match> = {
                            title: `${nextBracketMatch.team1Name} vs ${nextBracketMatch.team2Name}`,
                            date: cup.startDate || new Date().toISOString(),
                            time: '19:00',
                            location: cup.defaultLocation || { name: 'A definir', address: '', lat: 0, lng: 0, placeId: '' },
                            type: 'cup',
                            matchSize: 22,
                            status: 'upcoming',
                            ownerUid: cup.ownerUid,
                            groupId: cup.groupId,
                            participantTeamIds: [nextBracketMatch.team1Id, nextBracketMatch.team2Id],
                            teams: [
                                { name: nextBracketMatch.team1Name || '', players: [], totalOVR: 0, averageOVR: 0, jersey: nextBracketMatch.team1Jersey || { type: 'plain', primaryColor: '#000000', secondaryColor: '#ffffff' } },
                                { name: nextBracketMatch.team2Name || '', players: [], totalOVR: 0, averageOVR: 0, jersey: nextBracketMatch.team2Jersey || { type: 'plain', primaryColor: '#000000', secondaryColor: '#ffffff' } },
                            ],
                            leagueInfo: {
                                leagueId: cupId, // Using same field for cups
                                round: 0, // Not used for cups
                            },
                            createdAt: new Date().toISOString(),
                        };

                        await nextMatchRef.set(nextMatchData);

                        // Update bracket with matchId
                        const bracketIndex = updatedBracket.findIndex(
                            bm => bm.round === nextRound && bm.matchNumber === nextMatchNumber
                        );
                        if (bracketIndex !== -1) {
                            updatedBracket[bracketIndex].matchId = nextMatchRef.id;
                        }

                        updateData.bracket = updatedBracket;
                    }
                }
            }
        }

        // Update cup document
        await adminDb.collection('cups').doc(cupId).update(updateData);

        return { success: true };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

// ============================================================================
// GOOGLE FIT INTEGRATION (Smartwatch)
// ============================================================================

/**
 * Generate Google Fit OAuth2 authorization URL
 * Step 1: User initiates connection
 */
export async function generateGoogleFitAuthUrlAction(
    userId: string
): Promise<{ success: boolean; authUrl?: string; state?: string; error?: string }> {
    try {
        const clientId = process.env.GOOGLE_FIT_CLIENT_ID;
        const redirectUri = process.env.GOOGLE_FIT_REDIRECT_URI;

        if (!clientId || !redirectUri) {
            return {
                success: false,
                error: 'Google Fit credentials not configured. Please contact support.',
            };
        }

        // Generate CSRF token (state)
        const state = Buffer.from(
            JSON.stringify({
                userId,
                timestamp: Date.now(),
                nonce: Math.random().toString(36).substring(7),
            })
        ).toString('base64');

        // Build OAuth2 URL
        const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: GOOGLE_FIT_CONFIG.scopes.join(' '),
            access_type: 'offline', // Request refresh token
            prompt: 'consent', // Force consent screen to get refresh token
            state,
        });

        const authUrl = `${GOOGLE_FIT_CONFIG.authEndpoint}?${params.toString()}`;

        return { success: true, authUrl, state };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

/**
 * Exchange authorization code for tokens and save connection
 * Step 2: After user authorizes, process callback
 */
export async function processGoogleFitCallbackAction(
    code: string,
    state: string
): Promise<{ success: boolean; tokens?: any; userId?: string; error?: string }> {
    try {
        console.log('[processGoogleFitCallback] Starting...');

        // Decode and validate state
        const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
        const userId = stateData.userId;

        console.log('[processGoogleFitCallback] User ID:', userId);

        if (!userId) {
            return { success: false, error: 'Invalid state parameter.' };
        }

        const clientId = process.env.GOOGLE_FIT_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_FIT_CLIENT_SECRET;
        const redirectUri = process.env.GOOGLE_FIT_REDIRECT_URI;

        console.log('[processGoogleFitCallback] Config:', {
            hasClientId: !!clientId,
            hasClientSecret: !!clientSecret,
            hasRedirectUri: !!redirectUri,
            redirectUri
        });

        if (!clientId || !clientSecret || !redirectUri) {
            return { success: false, error: 'Server configuration error.' };
        }

        // Exchange code for tokens
        console.log('[processGoogleFitCallback] Exchanging code for tokens...');
        const tokenResponse = await fetch(GOOGLE_FIT_CONFIG.tokenEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code',
            }),
        });

        console.log('[processGoogleFitCallback] Token response status:', tokenResponse.status);

        if (!tokenResponse.ok) {
            const errorData = await tokenResponse.json();
            console.error('[processGoogleFitCallback] Token exchange failed:', errorData);
            logger.error('Google Fit token exchange failed', errorData);
            return { success: false, error: 'Failed to connect to Google Fit.' };
        }

        const tokens = await tokenResponse.json();
        console.log('[processGoogleFitCallback] Tokens received:', {
            hasAccessToken: !!tokens.access_token,
            hasRefreshToken: !!tokens.refresh_token,
            expiresIn: tokens.expires_in
        });

        // Calculate token expiration
        const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

        // Return tokens to client to save via client SDK
        console.log('[processGoogleFitCallback] Returning tokens to client for saving');
        return {
            success: true,
            userId,
            tokens: {
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
                expiresAt,
                scopes: GOOGLE_FIT_CONFIG.scopes,
                connectedAt: new Date().toISOString(),
                isActive: true,
            }
        };
    } catch (error) {
        console.error('[processGoogleFitCallback] Exception:', error);
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

/**
 * Fetch activity sessions from Google Fit for a specific date range
 * Step 3: Search for activities around match time
 */
export async function fetchGoogleFitActivitiesAction(
    userId: string,
    startTime: string, // ISO timestamp
    endTime: string // ISO timestamp
): Promise<{ success: boolean; sessions?: GoogleFitSession[]; error?: string }> {
    try {
        // Get user's Google Fit connection
        const connectionDoc = await adminDb
            .collection('users')
            .doc(userId)
            .collection('healthConnections')
            .doc('google_fit')
            .get();

        if (!connectionDoc.exists) {
            return {
                success: false,
                error: 'Google Fit not connected. Please connect your account first.',
            };
        }

        const connection = connectionDoc.data() as HealthConnection;

        // Check if token expired
        if (new Date(connection.expiresAt) < new Date()) {
            // TODO: Implement token refresh
            return {
                success: false,
                error: 'Google Fit connection expired. Please reconnect.',
            };
        }

        // Convert ISO timestamps to milliseconds
        const startTimeMs = new Date(startTime).getTime();
        const endTimeMs = new Date(endTime).getTime();

        // Fetch sessions from Google Fit API
        const sessionsUrl = `${GOOGLE_FIT_CONFIG.fitnessApiBase}/sessions?startTime=${startTimeMs * 1000000}&endTime=${endTimeMs * 1000000}`;

        const sessionsResponse = await fetch(sessionsUrl, {
            headers: {
                Authorization: `Bearer ${connection.accessToken}`,
            },
        });

        if (!sessionsResponse.ok) {
            logger.error('Failed to fetch Google Fit sessions', {
                status: sessionsResponse.status,
            });
            return {
                success: false,
                error: 'Failed to fetch activities from Google Fit.',
            };
        }

        const sessionsData = await sessionsResponse.json();
        const sessions: GoogleFitSession[] = [];

        // Process each session
        for (const session of sessionsData.session || []) {
            const sessionStartMs = parseInt(session.startTimeMillis);
            const sessionEndMs = parseInt(session.endTimeMillis);

            // Fetch aggregated data for this session
            const aggregateUrl = `${GOOGLE_FIT_CONFIG.fitnessApiBase}/dataset:aggregate`;
            const aggregateBody = {
                aggregateBy: [
                    { dataTypeName: 'com.google.distance.delta' },
                    { dataTypeName: 'com.google.step_count.delta' },
                    { dataTypeName: 'com.google.calories.expended' },
                    { dataTypeName: 'com.google.heart_rate.bpm' },
                ],
                bucketBySession: {
                    minDurationMillis: 60000, // 1 minute minimum
                },
                startTimeMillis: sessionStartMs,
                endTimeMillis: sessionEndMs,
            };

            const aggregateResponse = await fetch(aggregateUrl, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${connection.accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(aggregateBody),
            });

            let metrics: {
                distance?: number;
                steps?: number;
                calories?: number;
                avgHeartRate?: number;
                maxHeartRate?: number;
            } = {};

            if (aggregateResponse.ok) {
                const aggregateData = await aggregateResponse.json();

                // Extract metrics
                for (const bucket of aggregateData.bucket || []) {
                    for (const dataset of bucket.dataset || []) {
                        const dataTypeName = dataset.dataTypeName;

                        for (const point of dataset.point || []) {
                            if (dataTypeName.includes('distance.delta')) {
                                const meters = point.value[0]?.fpVal || 0;
                                metrics = { ...metrics, distance: meters / 1000 }; // Convert to km
                            } else if (dataTypeName.includes('step_count.delta')) {
                                metrics = { ...metrics, steps: point.value[0]?.intVal || 0 };
                            } else if (dataTypeName.includes('calories.expended')) {
                                metrics = { ...metrics, calories: point.value[0]?.fpVal || 0 };
                            } else if (dataTypeName.includes('heart_rate.bpm')) {
                                const hr = point.value[0]?.fpVal || 0;
                                if (!metrics.avgHeartRate) {
                                    metrics = { ...metrics, avgHeartRate: hr, maxHeartRate: hr };
                                } else {
                                    metrics = {
                                        ...metrics,
                                        avgHeartRate:
                                            (metrics.avgHeartRate + hr) / 2,
                                        maxHeartRate: Math.max(
                                            metrics.maxHeartRate ?? 0,
                                            hr
                                        ),
                                    };
                                }
                            }
                        }
                    }
                }
            }

            sessions.push({
                id: session.id,
                name: session.name || 'Unnamed Activity',
                description: session.description,
                startTime: new Date(sessionStartMs).toISOString(),
                endTime: new Date(sessionEndMs).toISOString(),
                activityType: session.activityType?.toString() || 'unknown',
                duration: sessionEndMs - sessionStartMs,
                metrics,
            });
        }

        return { success: true, sessions };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

/**
 * Link a Google Fit activity to a match
 * Step 4: User selects activity and links to match
 */
export async function linkActivityToMatchAction(
    userId: string,
    playerId: string,
    matchId: string,
    activityData: {
        distance?: number;
        avgHeartRate?: number;
        maxHeartRate?: number;
        steps?: number;
        calories?: number;
        duration?: number;
        activityStartTime: string;
        activityEndTime: string;
        source: 'google_fit' | 'manual';
        rawData?: any;
    }
): Promise<{ success: boolean; performanceId?: string; error?: string }> {
    try {
        // Calculate attribute impact
        const impact = calculateAttributeImpact(activityData);

        // Create performance record
        const performanceData: Omit<PlayerPerformance, 'id'> = {
            playerId,
            matchId,
            userId,
            distance: activityData.distance,
            avgHeartRate: activityData.avgHeartRate,
            maxHeartRate: activityData.maxHeartRate,
            steps: activityData.steps,
            calories: activityData.calories,
            duration: activityData.duration,
            source: activityData.source,
            activityStartTime: activityData.activityStartTime,
            activityEndTime: activityData.activityEndTime,
            linkedAt: new Date().toISOString(),
            impactOnAttributes: impact,
            rawData: activityData.rawData,
        };

        const performanceRef = await adminDb
            .collection('matches')
            .doc(matchId)
            .collection('playerPerformance')
            .add(performanceData);

        logger.info('Activity linked to match', {
            matchId,
            playerId,
            performanceId: performanceRef.id,
            impact,
        });

        return { success: true, performanceId: performanceRef.id };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

/**
 * Get player performance data for a specific match
 */
export async function getPlayerPerformanceAction(
    matchId: string,
    playerId: string
): Promise<{ success: boolean; performance?: PlayerPerformance; error?: string }> {
    try {
        const performanceSnapshot = await adminDb
            .collection('matches')
            .doc(matchId)
            .collection('playerPerformance')
            .where('playerId', '==', playerId)
            .limit(1)
            .get();

        if (performanceSnapshot.empty) {
            return { success: true, performance: undefined };
        }

        const performance = {
            id: performanceSnapshot.docs[0].id,
            ...performanceSnapshot.docs[0].data(),
        } as PlayerPerformance;

        return { success: true, performance };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

/**
 * Disconnect Google Fit
 */
export async function disconnectGoogleFitAction(
    userId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        await adminDb
            .collection('users')
            .doc(userId)
            .collection('healthConnections')
            .doc('google_fit')
            .delete();

        logger.info('Google Fit disconnected', { userId });

        return { success: true };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

/**
 * Add manual physical performance data (for users without smartwatch)
 * Includes validation to prevent abuse
 */
export async function addManualPerformanceAction(
    userId: string,
    playerId: string,
    matchId: string,
    manualData: {
        distance?: number;
        duration?: number; // in minutes
    }
): Promise<{ success: boolean; performanceId?: string; error?: string }> {
    try {
        // Validation: Reasonable limits
        if (manualData.distance && (manualData.distance < 0 || manualData.distance > 20)) {
            return {
                success: false,
                error: 'La distancia debe estar entre 0 y 20 km.',
            };
        }

        if (manualData.duration && (manualData.duration < 0 || manualData.duration > 180)) {
            return {
                success: false,
                error: 'La duración debe estar entre 0 y 180 minutos.',
            };
        }

        // Get match data to use as activity time
        const matchDoc = await adminDb.collection('matches').doc(matchId).get();
        if (!matchDoc.exists) {
            return { success: false, error: 'Partido no encontrado.' };
        }

        const matchData = matchDoc.data();
        const matchDateTime = new Date(matchData.date);

        // Estimate metrics based on manual input
        // These are rough estimates, not precise like smartwatch data
        const estimatedMetrics: any = {};

        if (manualData.distance) {
            estimatedMetrics.distance = manualData.distance;

            // Rough estimates based on distance
            if (manualData.duration) {
                // Calculate average pace
                const paceMinPerKm = manualData.duration / manualData.distance;

                // Estimate steps (very rough: ~1300 steps per km)
                estimatedMetrics.steps = Math.round(manualData.distance * 1300);

                // Estimate calories (very rough: ~65 kcal per km for average person)
                estimatedMetrics.calories = Math.round(manualData.distance * 65);

                // Estimate heart rate based on pace (very rough)
                if (paceMinPerKm < 5) {
                    // Fast pace
                    estimatedMetrics.avgHeartRate = 160;
                    estimatedMetrics.maxHeartRate = 175;
                } else if (paceMinPerKm < 6) {
                    // Moderate pace
                    estimatedMetrics.avgHeartRate = 145;
                    estimatedMetrics.maxHeartRate = 165;
                } else {
                    // Slower pace
                    estimatedMetrics.avgHeartRate = 130;
                    estimatedMetrics.maxHeartRate = 150;
                }
            }
        }

        // Calculate impact (same function as smartwatch data)
        const impact = calculateAttributeImpact(estimatedMetrics);

        // Create performance record
        const performanceData: Omit<PlayerPerformance, 'id'> = {
            playerId,
            matchId,
            userId,
            distance: estimatedMetrics.distance,
            avgHeartRate: estimatedMetrics.avgHeartRate,
            maxHeartRate: estimatedMetrics.maxHeartRate,
            steps: estimatedMetrics.steps,
            calories: estimatedMetrics.calories,
            duration: manualData.duration,
            source: 'manual',
            activityStartTime: matchDateTime.toISOString(),
            activityEndTime: new Date(
                matchDateTime.getTime() + (manualData.duration || 90) * 60000
            ).toISOString(),
            linkedAt: new Date().toISOString(),
            impactOnAttributes: impact,
            rawData: {
                manualInput: manualData,
                note: 'Estimated metrics based on manual input',
            },
        };

        const performanceRef = await adminDb
            .collection('matches')
            .doc(matchId)
            .collection('playerPerformance')
            .add(performanceData);

        logger.info('Manual performance data added', {
            matchId,
            playerId,
            performanceId: performanceRef.id,
            impact,
        });

        return { success: true, performanceId: performanceRef.id };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

// ============================================
// SOCIAL FEATURES - Follow System
// ============================================

/**
 * Follow a user
 */
export async function followUserAction(
    followerId: string,
    followingId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        if (followerId === followingId) {
            return { success: false, error: 'No podés seguirte a vos mismo.' };
        }

        // Check if already following using subcollection
        const followingDoc = await adminDb
            .collection('users')
            .doc(followerId)
            .collection('following')
            .doc(followingId)
            .get();

        if (followingDoc.exists) {
            return { success: false, error: 'Ya estás siguiendo a este usuario.' };
        }

        // Create follow relationship using batch
        const batch = adminDb.batch();

        // Add to follower's "following" subcollection
        const followingRef = adminDb
            .collection('users')
            .doc(followerId)
            .collection('following')
            .doc(followingId);
        batch.set(followingRef, {
            userId: followingId,
            createdAt: new Date().toISOString(),
        });

        // Add to target user's "followers" subcollection
        const followerRef = adminDb
            .collection('users')
            .doc(followingId)
            .collection('followers')
            .doc(followerId);
        batch.set(followerRef, {
            userId: followerId,
            createdAt: new Date().toISOString(),
        });

        await batch.commit();

        // Create notification for the followed user
        await createNotificationAction(followingId, {
            type: 'new_follower',
            title: 'Nuevo Seguidor',
            message: 'Te está siguiendo',
            fromUserId: followerId,
            link: `/players/${followerId}`,
        });

        // Create social activity
        await createActivityAction({
            type: 'new_follower',
            userId: followerId,
            timestamp: new Date().toISOString(),
        });

        logger.info('User followed successfully', { followerId, followingId });
        return { success: true };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

/**
 * Unfollow a user
 */
export async function unfollowUserAction(
    followerId: string,
    followingId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        // Check if following using subcollection
        const followingDoc = await adminDb
            .collection('users')
            .doc(followerId)
            .collection('following')
            .doc(followingId)
            .get();

        if (!followingDoc.exists) {
            return { success: false, error: 'No estás siguiendo a este usuario.' };
        }

        // Delete follow relationship using batch
        const batch = adminDb.batch();

        // Remove from follower's "following" subcollection
        const followingRef = adminDb
            .collection('users')
            .doc(followerId)
            .collection('following')
            .doc(followingId);
        batch.delete(followingRef);

        // Remove from target user's "followers" subcollection
        const followerRef = adminDb
            .collection('users')
            .doc(followingId)
            .collection('followers')
            .doc(followerId);
        batch.delete(followerRef);

        await batch.commit();

        logger.info('User unfollowed successfully', { followerId, followingId });
        return { success: true };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

/**
 * Check if user is following another user
 */
export async function isFollowingAction(
    followerId: string,
    followingId: string
): Promise<{ success: boolean; isFollowing: boolean; error?: string }> {
    try {
        const followingDoc = await adminDb
            .collection('users')
            .doc(followerId)
            .collection('following')
            .doc(followingId)
            .get();

        return { success: true, isFollowing: followingDoc.exists };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, isFollowing: false, error: err.error };
    }
}

/**
 * Get followers of a user
 */
export async function getFollowersAction(
    userId: string
): Promise<{ success: boolean; followers?: string[]; count?: number; error?: string }> {
    try {
        // New model: top-level 'follows' collection with documents { followerId, followingId }
        const topLevelSnapshot = await adminDb
            .collection('follows')
            .where('followingId', '==', userId)
            .get();

        let followers: string[] = [];
        if (!topLevelSnapshot.empty) {
            followers = topLevelSnapshot.docs.map(d => (d.data() as any).followerId).filter(Boolean);
        } else {
            // Fallback to legacy subcollection if exists
            const legacySnapshot = await adminDb
                .collection('users')
                .doc(userId)
                .collection('followers')
                .get();
            followers = legacySnapshot.docs.map(doc => doc.id);
        }

        return { success: true, followers, count: followers.length };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

/**
 * Get users that a user is following
 */
export async function getFollowingAction(
    userId: string
): Promise<{ success: boolean; following?: string[]; count?: number; error?: string }> {
    try {
        const topLevelSnapshot = await adminDb
            .collection('follows')
            .where('followerId', '==', userId)
            .get();

        let following: string[] = [];
        if (!topLevelSnapshot.empty) {
            following = topLevelSnapshot.docs.map(d => (d.data() as any).followingId).filter(Boolean);
        } else {
            const legacySnapshot = await adminDb
                .collection('users')
                .doc(userId)
                .collection('following')
                .get();
            following = legacySnapshot.docs.map(doc => doc.id);
        }

        return { success: true, following, count: following.length };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

// ============================================
// SOCIAL FEATURES - Activity Feed
// ============================================

/**
 * Create a social activity (internal function)
 */
export async function createActivityAction(activity: Omit<SocialActivity, 'id'>): Promise<void> {
    await adminDb.collection('socialActivities').add(activity);
}

/**
 * Get social feed for a user (activities from users they follow)
 */
export async function getFeedActivitiesAction(
    userId: string,
    limit: number = 20
): Promise<{ success: boolean; activities?: SocialActivity[]; error?: string }> {
    try {
        // Get list of users that this user follows
        const followingResult = await getFollowingAction(userId);
        if (!followingResult.success || !followingResult.following) {
            return { success: true, activities: [] };
        }

        const following = followingResult.following;

        // Include own activities too
        const userIds = [userId, ...following];

        // Get activities from followed users (limited)
        const activitiesSnapshot = await adminDb
            .collection('socialActivities')
            .where('userId', 'in', userIds.slice(0, 10)) // Firestore 'in' query limited to 10 items
            .orderBy('timestamp', 'desc')
            .limit(limit)
            .get();

        const activities = activitiesSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        })) as SocialActivity[];

        return { success: true, activities };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

// ============================================
// SOCIAL FEATURES - Notifications
// ============================================

/**
 * Create a notification (internal function)
 */
async function createNotificationAction(
    userId: string,
    notification: {
        type: NotificationType;
        title: string;
        message: string;
        fromUserId?: string;
        matchId?: string;
        achievementId?: string;
        playerId?: string;
        link?: string;
    }
): Promise<void> {
    // Get fromUser details if provided
    let fromUserName: string | undefined;
    let fromUserPhoto: string | undefined;

    if (notification.fromUserId) {
        const userDoc = await adminDb.collection('users').doc(notification.fromUserId).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            fromUserName = userData?.displayName;
            fromUserPhoto = userData?.photoURL;
        }
    }

    await adminDb.collection('users').doc(userId).collection('notifications').add({
        type: notification.type,
        title: notification.title,
        message: notification.message,
        isRead: false,
        createdAt: new Date().toISOString(),
        metadata: {
            fromUserId: notification.fromUserId,
            fromUserName,
            fromUserPhoto,
            matchId: notification.matchId,
            achievementId: notification.achievementId,
            playerId: notification.playerId,
        },
        link: notification.link || '/dashboard',
    });
}

/**
 * Get notifications for a user
 */
export async function getNotificationsAction(
    userId: string,
    limit: number = 20
): Promise<{ success: boolean; notifications?: Notification[]; unreadCount?: number; error?: string }> {
    try {
        const notificationsSnapshot = await adminDb
            .collection('users')
            .doc(userId)
            .collection('notifications')
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .get();

        const notifications = notificationsSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        })) as Notification[];

        const unreadCount = notifications.filter((n) => !n.isRead).length;

        return { success: true, notifications, unreadCount };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

/**
 * Mark notification as read
 */
export async function markNotificationAsReadAction(
    userId: string,
    notificationId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        await adminDb
            .collection('users')
            .doc(userId)
            .collection('notifications')
            .doc(notificationId)
            .update({
                isRead: true,
            });

        return { success: true };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsAsReadAction(
    userId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const unreadNotifications = await adminDb
            .collection('users')
            .doc(userId)
            .collection('notifications')
            .where('isRead', '==', false)
            .get();

        const batch = adminDb.batch();
        unreadNotifications.docs.forEach((doc) => {
            batch.update(doc.ref, { isRead: true });
        });
        await batch.commit();

        return { success: true };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}
