// @ts-nocheck
'use server';

import { generateBalancedTeams, GenerateBalancedTeamsInput } from '@/ai/flows/generate-balanced-teams';
import { suggestPlayerImprovements, SuggestPlayerImprovementsInput } from '@/ai/flows/suggest-player-improvements';
import { getMatchDayForecast, GetMatchDayForecastInput } from '@/ai/flows/get-match-day-forecast';
import { generateEvaluationTags, GenerateEvaluationTagsInput } from '@/ai/flows/generate-evaluation-tags';
import { Player, Evaluation } from './types';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';

// Helper to get firestore instance on the server
function getFirestoreInstance() {
    return initializeFirebase().firestore;
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
    
    // Ensure the player UIDs from the AI output match the original player IDs
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
    const firestore = getFirestoreInstance();
    const evaluations: Partial<Evaluation>[] = [];
    
    try {
        // Use { cache: 'no-store' } to always fetch fresh data from the server
        const q = query(
            collection(firestore, 'evaluations'), 
            where('playerId', '==', playerId)
        );
        const querySnapshot = await getDocs(q);

        const matchesQuery = query(collection(firestore, 'matches'), where('groupId', '==', groupId));
        const matchesSnapshot = await getDocs(matchesQuery);
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
    const firestore = getFirestoreInstance();

    try {
        const playerDocRef = doc(firestore, 'players', playerId);
        const playerDocSnap = await getDoc(playerDocRef);

        if (!playerDocSnap.exists()) {
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
