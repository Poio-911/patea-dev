'use server';
/**
 * @fileOverview This file contains all the server-side actions that use the Firebase Admin SDK.
 * It is marked with 'use server' to ensure it only runs on the server.
 */

import { adminDb } from '@/firebase/admin-init';
import { FieldValue } from 'firebase-admin/firestore';
import { generateBalancedTeams, GenerateBalancedTeamsInput } from '@/ai/flows/generate-balanced-teams';
import { suggestPlayerImprovements, SuggestPlayerImprovementsInput } from '@/ai/flows/suggest-player-improvements';
import { getMatchDayForecast, GetMatchDayForecastInput } from '@/ai/flows/get-match-day-forecast';
import { findBestFitPlayer, FindBestFitPlayerInput } from '@/ai/flows/find-best-fit-player';
import { coachConversation, type CoachConversationInput } from '@/ai/flows/coach-conversation';
import { detectPlayerPatterns, type DetectPlayerPatternsInput } from '@/ai/flows/detect-player-patterns';
import { analyzePlayerProgression, type AnalyzePlayerProgressionInput } from '@/ai/flows/analyze-player-progression';
import { type GenerateMatchChronicleOutput, type GenerateMatchChronicleInput } from '@/lib/types';
import { generateMatchChronicleFlow } from '@/ai/flows/generate-match-chronicle';
import { generateDuoImage } from '@/ai/flows/generate-duo-image';
import { Player, Evaluation, OvrHistory, PerformanceTag, SelfEvaluation, Invitation, Notification, GroupTeam, TeamAvailabilityPost, Match, MatchLocation, GenerateDuoImageInput, League, LeagueFormat } from '../types';
import { logger } from '../logger';
import { handleServerActionError, createError, ErrorCodes, formatErrorResponse, isErrorResponse, type ErrorResponse } from '../errors';

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

        let team1Score = 0;
        let team2Score = 0;
        match.teams[0].players.forEach(p => team1Score += goalsByPlayer[p.uid] || 0);
        match.teams[1].players.forEach(p => team2Score += goalsByPlayer[p.uid] || 0);

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

function getAdminInstances() {
    return { adminDb };
}

export async function acceptTeamChallengeAction(invitationId: string, teamId: string, userId: string): Promise<{ success: boolean; matchId: string } | ErrorResponse> {
  try {
    const { adminDb } = getAdminInstances();
    
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
        const { adminDb } = getAdminInstances();
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
        const { adminDb } = getAdminInstances();
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
        const { adminDb } = getAdminInstances();
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
    ownerUid: string
): Promise<{ success: boolean; leagueId?: string; error?: string }> {
    try {
        const { adminDb } = getAdminInstances();
        
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
        };
        
        await leagueRef.set(newLeague);

        return { success: true, leagueId: leagueRef.id };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}
    

    
