

// @ts-nocheck
'use server';

import 'dotenv/config';
import { generateBalancedTeams, GenerateBalancedTeamsInput } from '@/ai/flows/generate-balanced-teams';
import { suggestPlayerImprovements, SuggestPlayerImprovementsInput } from '@/ai/flows/suggest-player-improvements';
import { getMatchDayForecast, GetMatchDayForecastInput } from '@/ai/flows/get-match-day-forecast';
import { findBestFitPlayer, FindBestFitPlayerInput } from '@/ai/flows/find-best-fit-player';
import { generatePlayerCardImage } from '@/ai/flows/generate-player-card-image';
import { Player, Evaluation } from './types';
import { getFirestore as getAdminFirestore, FieldValue } from 'firebase-admin/firestore';
import { initializeApp, getApps, App as AdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getStorage as getAdminStorage } from 'firebase-admin/storage';
import { getFirestore, doc, collection, getDocs, where, query, getDoc, writeBatch, updateDoc, increment } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import { getAuth, updateProfile } from 'firebase/auth';

let adminApp: AdminApp;
if (!getApps().length) {
  adminApp = initializeApp();
} else {
  adminApp = getApps()[0];
}

const adminDb = getAdminFirestore(adminApp);
const adminAuth = getAdminAuth(adminApp);
const adminStorage = getAdminStorage(adminApp).bucket('mil-disculpis.appspot.com');


// This approach uses the Client SDK on the server, which is not standard.
// For robust applications, using the Firebase Admin SDK is the recommended practice.
function getClientFirebase() {
    const { firebaseApp } = initializeFirebase();
    const firestore = getFirestore(firebaseApp);
    const auth = getAuth(firebaseApp);
    const storage = getStorage(firebaseApp);
    return { firestore, auth, storage };
}


export async function generateTeamsAction(players: Player[]) {
  if (!players || players.length < 2) {
    return { error: 'Se necesitan al menos 2 jugadores para generar equipos.'};
  }

  const input: GenerateBalancedTeamsInput = {
    players: players.map(p => ({
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
      throw new Error(result.error || 'La IA no pudo generar los equipos.');
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
        const evalsSnapshot = await adminDb.collection('evaluations').where('playerId', '==', playerId).get();
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
            throw new Error(result.error);
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
        const credits = player.cardGenerationCredits ?? 2;

        if (credits <= 0) {
            return { error: "No te quedan créditos para generar imágenes." };
        }

        if (!player.photoUrl) {
            return { error: "Primero debes subir una foto de perfil." };
        }
        
        // This check was too broad. Now it only checks for the placeholder domain.
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
        if (availablePlayerSnap.exists()) {
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
