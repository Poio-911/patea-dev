// @ts-nocheck
'use server';

import { generateBalancedTeams, GenerateBalancedTeamsInput } from '@/ai/flows/generate-balanced-teams';
import { suggestPlayerImprovements, SuggestPlayerImprovementsInput } from '@/ai/flows/suggest-player-improvements';
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
    if (!result || !result.teams) {
      throw new Error('La respuesta de la IA no contiene equipos.');
    }
    // Attach balance metrics to the first team for easier access
    if (result.teams.length > 0 && result.balanceMetrics) {
        // Ensure the player UIDs from the AI output match the original player IDs
        result.teams.forEach(team => {
            team.players.forEach(player => {
                const originalPlayer = players.find(p => p.name === player.displayName && p.position === player.position);
                if (originalPlayer) {
                    player.uid = originalPlayer.id;
                }
            });
        });
        result.teams[0].balanceMetrics = result.balanceMetrics;
    }
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
        const matchesQuery = query(collection(firestore, 'matches'), where('groupId', '==', groupId));
        const matchesSnapshot = await getDocs(matchesQuery);

        for (const matchDoc of matchesSnapshot.docs) {
            const evalDocRef = doc(firestore, 'matches', matchDoc.id, 'evaluations', playerId);
            const evalDocSnap = await getDoc(evalDocRef);

            if (evalDocSnap.exists()) {
                evaluations.push(evalDocSnap.data() as Partial<Evaluation>);
            }
        }
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
                evaluatedBy: e.evaluatedBy || '',
                evaluatedAt: e.evaluatedAt || '',
            })),
        };
        
        const result = await suggestPlayerImprovements(input);
        return result;

    } catch (error) {
        console.error('Error getting player improvement suggestions:', error);
        return { error: 'No se pudieron obtener las sugerencias de la IA.' };
    }
}