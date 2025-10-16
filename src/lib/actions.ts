// @ts-nocheck
'use server';

import { generateBalancedTeams, GenerateBalancedTeamsInput } from '@/ai/flows/generate-balanced-teams';
import { suggestPlayerImprovements, SuggestPlayerImprovementsInput } from '@/ai/flows/suggest-player-improvements';
import { Player } from './types';

export async function generateTeamsAction(players: Player[]) {
  if (!players || players.length < 2) {
    return { error: 'Se necesitan al menos 2 jugadores para generar equipos.'};
  }

  const input: GenerateBalancedTeamsInput = {
    players: players.map(p => ({
      uid: p.id || p.uid,
      displayName: p.name || p.displayName,
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
        result.teams[0].balanceMetrics = result.balanceMetrics;
    }
    return result;
  } catch (error) {
    console.error('Error generating teams:', error);
    return { error: 'La IA no pudo generar los equipos. Inténtalo de nuevo.' };
  }
}

export async function getPlayerImprovementSuggestionsAction(player: Player, evaluations: any[]) {
    const input: SuggestPlayerImprovementsInput = {
        playerId: player.id,
        playerStats: player.stats,
        evaluations: evaluations,
    };

    try {
        const result = await suggestPlayerImprovements(input);
        return result;
    } catch (error) {
        console.error('Error getting player improvement suggestions:', error);
        return { error: 'Failed to get suggestions.' };
    }
}
