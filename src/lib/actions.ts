// @ts-nocheck
'use server';

import { generateBalancedTeams, GenerateBalancedTeamsInput } from '@/ai/flows/generate-balanced-teams';
import { suggestPlayerImprovements, SuggestPlayerImprovementsInput } from '@/ai/flows/suggest-player-improvements';
import { getMatchDayForecast, GetMatchDayForecastInput } from '@/ai/flows/get-match-day-forecast';
import { generateEvaluationTags, GenerateEvaluationTagsInput } from '@/ai/flows/generate-evaluation-tags';
import { Player, Evaluation } from './types';

// Use Firebase Admin SDK for server-side operations
import * as admin from 'firebase-admin';
import { getFirestore as getAdminFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage as getAdminStorage } from 'firebase-admin/storage';
import { firebaseConfig } from '@/firebase/config';

// Helper to initialize Firebase Admin SDK safely
function initializeAdminApp() {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
      : undefined;

    if (admin.apps.length > 0) {
        return admin.app();
    }
    
    return admin.initializeApp({
        credential: serviceAccount ? admin.credential.cert(serviceAccount) : undefined,
        storageBucket: firebaseConfig.storageBucket,
    });
}

export async function uploadProfileImageAction(formData: FormData) {
    try {
        const app = initializeAdminApp();
        const firestore = getAdminFirestore(app);
        const storage = getAdminStorage(app);
        
        const file = formData.get('file') as File;
        const userId = formData.get('userId') as string;

        if (!file || !userId) {
            return { error: 'Faltan datos para subir la imagen.' };
        }

        const fileExtension = file.name.split('.').pop();
        const fileName = `${userId}-${crypto.randomUUID()}.${fileExtension}`;
        const filePath = `profile-images/${fileName}`;

        const buffer = Buffer.from(await file.arrayBuffer());
        
        const bucket = storage.bucket();
        const fileUpload = bucket.file(filePath);

        await fileUpload.save(buffer, {
            metadata: {
                contentType: file.type,
            },
        });
        
        // Make the file public to get a URL
        await fileUpload.makePublic();
        const newPhotoURL = fileUpload.publicUrl();

        // Update Firestore documents
        const userDocRef = firestore.collection('users').doc(userId);
        const playerDocRef = firestore.collection('players').doc(userId);

        const batch = firestore.batch();
        batch.update(userDocRef, { photoURL: newPhotoURL });
        batch.update(playerDocRef, { photoUrl: newPhotoURL });
        await batch.commit();

        return { newPhotoURL };

    } catch (error: any) {
        console.error("Error en la Server Action de subida (Admin):", error);
        return { error: 'No se pudo subir la imagen desde el servidor. ' + (error.message || 'Error desconocido.') };
    }
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
    const firestore = getAdminFirestore(initializeAdminApp());
    const evaluations: Partial<Evaluation>[] = [];
    
    try {
        const q = firestore.collection('evaluations').where('playerId', '==', playerId);
        const querySnapshot = await q.get();

        const matchesQuery = firestore.collection('matches').where('groupId', '==', groupId);
        const matchesSnapshot = await matchesQuery.get();
        const groupMatchIds = new Set(matchesSnapshot.docs.map(doc => doc.id));

        querySnapshot.forEach(doc => {
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
    const firestore = getAdminFirestore(initializeAdminApp());

    try {
        const playerDocRef = firestore.collection('players').doc(playerId);
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
                performanceTags: e.performanceTags || [],
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

export async function generateTagsAction(input: GenerateEvaluationTagsInput) {
    try {
        const result = await generateEvaluationTags(input);
        return result;
    } catch (error) {
        console.error('Error generating evaluation tags:', error);
        return { error: 'No se pudieron generar las etiquetas de evaluación.' };
    }
}
