
'use server';

import 'dotenv/config';
import { generateBalancedTeams, GenerateBalancedTeamsInput } from '@/ai/flows/generate-balanced-teams';
import { suggestPlayerImprovements, SuggestPlayerImprovementsInput } from '@/ai/flows/suggest-player-improvements';
import { getMatchDayForecast, GetMatchDayForecastInput } from '@/ai/flows/get-match-day-forecast';
import { findBestFitPlayer, FindBestFitPlayerInput } from '@/ai/flows/find-best-fit-player';
import { generatePlayerCardImage } from '@/ai/flows/generate-player-card-image';
import { coachConversation, type CoachConversationInput } from '@/ai/flows/coach-conversation';
import { detectPlayerPatterns, type DetectPlayerPatternsInput } from '@/ai/flows/detect-player-patterns';
import { getAppHelp, AppHelpInput } from '@/ai/flows/get-app-help';
import { Player, Evaluation, OvrHistory, PerformanceTag, SelfEvaluation } from './types';
import { getFirestore as getAdminFirestore, FieldValue } from 'firebase-admin/firestore';
import { initializeApp, getApps, App as AdminApp, cert } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getStorage as getAdminStorage } from 'firebase-admin/storage';


// Desactivar emuladores de Firebase para forzar conexión a producción
delete process.env.FIRESTORE_EMULATOR_HOST;
delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
delete process.env.FIREBASE_STORAGE_EMULATOR_HOST;

let adminApp: AdminApp;
if (!getApps().length) {
  adminApp = initializeApp();
} else {
  adminApp = getApps()[0];
}

const adminDb = getAdminFirestore(adminApp);
const adminAuth = getAdminAuth(adminApp);
const adminStorage = getAdminStorage(adminApp).bucket('mil-disculpis.firebasestorage.app');

export async function generateTeamsAction(players: Player[]) {
  if (!players || players.length < 2) {
    return { error: 'Se necesitan al menos 2 jugadores para generar equipos.'};
  }

  const input: GenerateBalancedTeamsInput = {
    players: players.map((p: Player) => ({
      uid: p.id, // Use the document ID as the unique identifier
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
    console.error('Error generating teams:', error);
    return { error: 'La IA no pudo generar los equipos. Inténtalo de nuevo.' };
  }
}

export async function getPlayerEvaluationsAction(playerId: string, groupId: string): Promise<Partial<Evaluation>[]> {
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
        console.error("Error fetching player evaluations:", error);
        return [];
    }
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
                performanceTags: e.performanceTags?.map(t => t.name) || [],
                evaluatedBy: e.evaluatorId || '',
                evaluatedAt: e.evaluatedAt || '',
                matchId: e.matchId || ''
            })),
        };
        
        const result = await suggestPlayerImprovements(input);
        return result;

    } catch (error) {
        console.error('Error getting player improvement suggestions:', error);
        return { error: 'No se pudieron obtener las sugerencias de la IA.' };
    }
}

export async function getWeatherForecastAction(input: GetMatchDayForecastInput) {
    try {
        const result = await getMatchDayForecast(input);
        return result;
    } catch (error) {
        console.error('Error getting weather forecast:', error);
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
        console.error('Error finding best fit player:', error);
        // This is a safeguard against invalid JSON responses from the LLM
        if (error instanceof SyntaxError || error.message.includes('Unexpected token')) {
             return { error: 'La IA devolvió una respuesta inesperada. Por favor, inténtalo de nuevo.' };
        }
        return { error: error.message || 'La IA no pudo procesar la solicitud en este momento.' };
    }
}

export async function generatePlayerCardImageAction(userId: string) {
    const playerRef = adminDb.doc(`players/${userId}`);

    try {
        const playerSnap = await playerRef.get();

        if (!playerSnap.exists) {
            return { error: "No se encontró tu perfil de jugador." };
        }

        const player = playerSnap.data() as Player;
        const credits = player.cardGenerationCredits === undefined ? 2 : player.cardGenerationCredits;

        if (credits <= 0) {
            return { error: "No te quedan créditos para generar imágenes." };
        }

        if (!player.photoUrl) {
            return { error: "Primero debes subir una foto de perfil." };
        }
        
        if (player.photoUrl.includes('picsum.photos')) {
            return { error: "La generación de imágenes no funciona con fotos de marcador de posición. Por favor, sube una foto tuya real." };
        }

        const generatedImageDataUri = await generatePlayerCardImage(player.photoUrl);

        const filePath = `profile-images/${userId}/generated_${Date.now()}.png`;
        const file = adminStorage.file(filePath);
        
        const buffer = Buffer.from(generatedImageDataUri.split(',')[1], 'base64');
        
        await file.save(buffer, {
            metadata: {
                contentType: 'image/png',
            },
        });
        
        const [newPhotoURL] = await file.getSignedUrl({
            action: 'read',
            expires: '03-09-2491'
        });

        const batch = adminDb.batch();
        const userRef = adminDb.doc(`users/${userId}`);
        batch.update(userRef, { photoURL: newPhotoURL });

        batch.update(playerRef, {
            photoUrl: newPhotoURL,
            cardGenerationCredits: FieldValue.increment(-1)
        });

        const availablePlayerRef = adminDb.doc(`availablePlayers/${userId}`);
        const availablePlayerSnap = await availablePlayerRef.get();
        if (availablePlayerSnap.exists) {
            batch.update(availablePlayerRef, { photoUrl: newPhotoURL });
        }

        await batch.commit();
        await adminAuth.updateUser(userId, { photoURL: newPhotoURL });

        return { success: true, newPhotoURL };
    } catch (error: any) {
        console.error("Error generating player card image:", error);
        return { error: error.message || "La IA no pudo generar la imagen. Inténtalo más tarde." };
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
    console.error('Error in coach conversation:', error);
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
    
    // Extract match IDs from recent evaluations to fetch self-reported goals
    const recentMatchIds = [...new Set(evaluations.slice(0, 15).map(e => e.matchId))];
    
    // Fetch self-evaluations for these matches
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
            performanceTags: (e.performanceTags || []).map((tag: PerformanceTag) => ({
                name: tag.name,
                impact: tag.impact,
            })),
            goals: selfEval?.goals || 0, // Include goals from self-evaluation
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
    console.error('Error detecting player patterns:', error);
    return { error: error.message || 'No se pudo analizar el rendimiento del jugador.' };
  }
}

export async function getAppHelpAction(
  userMessage: string,
  conversationHistory?: AppHelpInput['conversationHistory']
) {
  try {
    const result = await getAppHelp({
      userMessage,
      conversationHistory: conversationHistory || [],
    });
    return result;
  } catch (error: any) {
    console.error('Error in app help action:', error);
    return { error: 'El asistente de ayuda no está disponible en este momento.' };
  }
}
