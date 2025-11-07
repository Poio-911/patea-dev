
'use server';
/**
 * @fileOverview This file contains all the server-side actions that use the Firebase Admin SDK.
 * It is marked with 'use server' to ensure it only runs on the server.
 */

import { initializeApp, getApps, App as AdminApp, cert } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore, FieldValue } from 'firebase-admin/firestore';
import { generateBalancedTeams, GenerateBalancedTeamsInput } from '@/ai/flows/generate-balanced-teams';
import { suggestPlayerImprovements, SuggestPlayerImprovementsInput } from '@/ai/flows/suggest-player-improvements';
import { getMatchDayForecast, GetMatchDayForecastInput } from '@/ai/flows/get-match-day-forecast';
import { findBestFitPlayer, FindBestFitPlayerInput } from '@/ai/flows/find-best-fit-player';
import { coachConversation, type CoachConversationInput } from '@/ai/flows/coach-conversation';
import { detectPlayerPatterns, type DetectPlayerPatternsInput } from '@/ai/flows/detect-player-patterns';
import { analyzePlayerProgression, type AnalyzePlayerProgressionInput } from '@/ai/flows/analyze-player-progression';
import { Player, Evaluation, OvrHistory, PerformanceTag, SelfEvaluation, Invitation, Notification, GroupTeam } from '../types';
import { logger } from '../logger';

// --- ADMIN SDK INITIALIZATION ---
function getAdminInstances() {
    if (getApps().length > 0) {
        const adminApp = getApps()[0];
        return {
            adminDb: getAdminFirestore(adminApp),
            adminAuth: getAdminAuth(adminApp),
        };
    }
    
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountKey) {
        throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set.");
    }
    const serviceAccount = JSON.parse(serviceAccountKey);

    const adminApp = initializeApp({
        credential: cert(serviceAccount),
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    }, 'firebase-admin-app-pateá'); // Unique app name

    return {
        adminDb: getAdminFirestore(adminApp),
        adminAuth: getAdminAuth(adminApp),
    };
}


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
    const { adminDb } = getAdminInstances();
    const evaluations: Partial<Evaluation>[] = [];
    
    try {
        if (!playerId || !groupId) return [];
        const evalsSnapshot = await adminDb.collection('evaluations').where('playerId', '==', playerId).orderBy('evaluatedAt', 'desc').get();
        const matchesSnapshot = await adminDb.collection('matches').where('groupId', '==', groupId).get();
        const groupMatchIds = new Set(matchesSnapshot.docs.map(doc => doc.id));

        evalsSnapshot.forEach(doc => {
            const evaluation = doc.data() as Evaluation;
            if (groupMatchIds.has(evaluation.matchId)) {
                evaluations.push(evaluation);
            }
        });

        return evaluations;

    } catch (error) {
        logger.error("Error fetching player evaluations", error, { playerId, groupId });
        return [];
    }
}


export async function getPlayerImprovementSuggestionsAction(playerId: string, groupId: string) {
    const { adminDb } = getAdminInstances();
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
        if ('error' in result) {
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
  const { adminDb } = getAdminInstances();
  try {
    const playerDocRef = adminDb.doc(`players/${playerId}`);
    const playerDocSnap = await playerDocRef.get();

    if (!playerDocSnap.exists) {
      return { error: 'No se pudo encontrar al jugador.' };
    }

    const player = playerDocSnap.data() as Player;
    const evaluations = await getPlayerEvaluationsAction(playerId, groupId) as Evaluation[];

    const recentTags = evaluations
      .flatMap((e) => e.performanceTags?.map((t: PerformanceTag) => t.name) || [])
      .slice(0, 10);
      
    const positiveTags = evaluations
      .flatMap((e) => e.performanceTags?.filter((t: PerformanceTag) => t.effects.some((ef) => ef.change > 0)).map((t: PerformanceTag) => t.name) || []);
      
    const negativeTags = evaluations
      .flatMap((e) => e.performanceTags?.filter((t: PerformanceTag) => t.effects.some((ef) => ef.change < 0)).map((t: PerformanceTag) => t.name) || []);

    const input: CoachConversationInput = {
      userMessage,
      conversationHistory: conversationHistory || [],
      playerContext: {
        playerId: playerId,
        playerName: player.name,
        position: player.position,
        ovr: player.ovr,
        stats: {
          matchesPlayed: player.stats.matchesPlayed,
          goals: player.stats.goals,
          assists: player.stats.assists || 0,
          averageRating: player.stats.averageRating,
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
  const { adminDb } = getAdminInstances();
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
        return {
            matchDate: e.evaluatedAt || new Date().toISOString(),
            rating: e.rating,
            performanceTags: (e.performanceTags || []).map((tag: any) => ({
                name: tag.name,
                impact: tag.impact,
            })),
            goals: selfEval?.goals || 0,
        };
    });

    const input: DetectPlayerPatternsInput = {
      playerId,
      playerName: player.name,
      position: player.position,
      currentOVR: player.ovr,
      stats: {
        matchesPlayed: player.stats.matchesPlayed,
        goals: player.stats.goals,
        assists: player.stats.assists || 0,
        averageRating: player.stats.averageRating,
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
  const { adminDb } = getAdminInstances();
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

export async function sendTeamChallengeAction(
    challengingTeamId: string, 
    challengedTeamId: string, 
    challengerUserId: string
) {
    const { adminDb } = getAdminInstances();
    try {
        const batch = adminDb.batch();

        const [challengingTeamSnap, challengedTeamSnap, challengerUserSnap] = await Promise.all([
            adminDb.doc(`teams/${challengingTeamId}`).get(),
            adminDb.doc(`teams/${challengedTeamId}`).get(),
            adminDb.doc(`users/${challengerUserId}`).get(),
        ]);
        
        if (!challengingTeamSnap.exists || !challengedTeamSnap.exists || !challengerUserSnap.exists) {
            throw new Error("Uno de los equipos o el usuario no existe.");
        }
        
        const challengingTeam = { id: challengingTeamSnap.id, ...challengingTeamSnap.data() } as GroupTeam;
        const challengedTeam = { id: challengedTeamSnap.id, ...challengedTeamSnap.data() } as GroupTeam;
        const challengerUser = challengerUserSnap.data();

        // 1. Create invitation in challenged team's subcollection
        const invitationRef = adminDb.collection(`teams/${challengedTeamId}/invitations`).doc();
        const newInvitation: Omit<Invitation, 'id'> = {
            type: 'team_challenge',
            fromTeamId: challengingTeam.id,
            fromTeamName: challengingTeam.name,
            fromTeamJersey: challengingTeam.jersey,
            toTeamId: challengedTeam.id,
            toTeamName: challengedTeam.name,
            status: 'pending',
            createdBy: challengerUserId,
            createdAt: new Date().toISOString(),
        };
        batch.set(invitationRef, newInvitation);

        // 2. Create notification for the owner of the challenged team
        const notificationRef = adminDb.collection(`users/${challengedTeam.createdBy}/notifications`).doc();
        const notification: Omit<Notification, 'id'> = {
            type: 'match_invite', // Re-using type for now
            title: '¡Desafío Recibido!',
            message: `El equipo "${challengingTeam.name}" ha desafiado a tu equipo "${challengedTeam.name}" a un partido.`,
            link: '/competitions', // Link to competitions/challenges section
            isRead: false,
            createdAt: new Date().toISOString(),
        };
        batch.set(notificationRef, notification);

        await batch.commit();

        return { success: true };
    } catch (error: any) {
        logger.error('Error sending team challenge', error);
        return { error: error.message || "No se pudo enviar el desafío." };
    }
}
