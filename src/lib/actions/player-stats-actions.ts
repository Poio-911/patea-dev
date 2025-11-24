'use server';

import { getAdminDb } from '../../firebase/admin-init';
import type { Match, Player, MatchGoalScorer, MatchCard } from '../../lib/types';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Update global player stats after a match is completed
 * @param matchId - The completed match ID
 * @returns Success status
 */
export async function updatePlayerStatsFromMatch(matchId: string): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    // Get match data
    const matchDoc = await getAdminDb().collection('matches').doc(matchId).get();
    if (!matchDoc.exists) {
      return { success: false, message: 'Partido no encontrado' };
    }

    const match = { id: matchDoc.id, ...matchDoc.data() } as Match;

    // Only process completed matches
    if (match.status !== 'completed' && match.status !== 'evaluated') {
      return { success: false, message: 'El partido no está completado' };
    }

    // Get all player IDs involved
    const playerIds = new Set<string>();

    // Add players from teams
    match.playerUids?.forEach(uid => playerIds.add(uid));

    // Add goal scorers
    match.goalScorers?.forEach(scorer => playerIds.add(scorer.playerId));

    // Add card recipients
    match.cards?.forEach(card => playerIds.add(card.playerId));

    if (playerIds.size === 0) {
      return { success: true, message: 'No hay jugadores para actualizar' };
    }

    // Process stats updates for each player
    const batch = getAdminDb().batch();

    for (const playerId of playerIds) {
      const playerRef = getAdminDb().collection('players').doc(playerId);
      const playerDoc = await playerRef.get();

      if (!playerDoc.exists) {
        console.warn(`Player ${playerId} not found, skipping stats update`);
        continue;
      }

      const player = { id: playerDoc.id, ...playerDoc.data() } as Player;

      // Calculate stats changes
      const goalsScored = match.goalScorers?.filter(g => g.playerId === playerId).length || 0;
      const yellowCardsReceived = match.cards?.filter(c => c.playerId === playerId && c.cardType === 'yellow').length || 0;
      const redCardsReceived = match.cards?.filter(c => c.playerId === playerId && c.cardType === 'red').length || 0;

      // Update player stats
      const currentStats = player.stats || {
        matchesPlayed: 0,
        goals: 0,
        assists: 0,
        averageRating: 0,
        yellowCards: 0,
        redCards: 0,
      };

      batch.update(playerRef, {
        'stats.matchesPlayed': (currentStats.matchesPlayed || 0) + 1,
        'stats.goals': (currentStats.goals || 0) + goalsScored,
        'stats.yellowCards': (currentStats.yellowCards || 0) + yellowCardsReceived,
        'stats.redCards': (currentStats.redCards || 0) + redCardsReceived,
      });
    }

    // Commit all updates
    await batch.commit();

    return {
      success: true,
      message: `Estadísticas actualizadas para ${playerIds.size} jugadores`,
    };
  } catch (error) {
    console.error('Error updating player stats:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Error al actualizar estadísticas',
    };
  }
}

/**
 * Recalculate all player stats from scratch based on completed matches
 * Useful for fixing inconsistencies or initial data migration
 * @param groupId - Optional group ID to limit recalculation
 * @returns Success status with count of updated players
 */
export async function recalculateAllPlayerStats(groupId?: string): Promise<{
  success: boolean;
  message: string;
  playersUpdated?: number;
}> {
  try {
    // Get all players (optionally filtered by group)
    let playersQuery = getAdminDb().collection('players');
    if (groupId) {
      playersQuery = playersQuery.where('groupId', '==', groupId) as any;
    }

    const playersSnapshot = await playersQuery.get();
    const players = playersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Player[];

    // Get all completed matches
    const matchesSnapshot = await db
      .collection('matches')
      .where('status', 'in', ['completed', 'evaluated'])
      .get();

    const matches = matchesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Match[];

    // Calculate stats for each player
    const batch = getAdminDb().batch();
    let updatedCount = 0;

    for (const player of players) {
      // Find all matches this player participated in
      const playerMatches = matches.filter(m =>
        m.playerUids?.includes(player.id)
      );

      // Calculate total stats
      let totalGoals = 0;
      let totalYellowCards = 0;
      let totalRedCards = 0;
      const matchesPlayed = playerMatches.length;

      playerMatches.forEach(match => {
        // Count goals
        totalGoals += match.goalScorers?.filter(g => g.playerId === player.id).length || 0;

        // Count yellow cards
        totalYellowCards += match.cards?.filter(c => c.playerId === player.id && c.cardType === 'yellow').length || 0;

        // Count red cards
        totalRedCards += match.cards?.filter(c => c.playerId === player.id && c.cardType === 'red').length || 0;
      });

      // Update player stats
      const playerRef = getAdminDb().collection('players').doc(player.id);
      batch.update(playerRef, {
        'stats.matchesPlayed': matchesPlayed,
        'stats.goals': totalGoals,
        'stats.yellowCards': totalYellowCards,
        'stats.redCards': totalRedCards,
      });

      updatedCount++;
    }

    // Commit all updates
    await batch.commit();

    return {
      success: true,
      message: `Estadísticas recalculadas exitosamente`,
      playersUpdated: updatedCount,
    };
  } catch (error) {
    console.error('Error recalculating player stats:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Error al recalcular estadísticas',
    };
  }
}
