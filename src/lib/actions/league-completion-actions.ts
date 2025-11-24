
'use server';

import { getAdminDb } from '../../firebase/admin-init';
import type { League, Match, GroupTeam, MatchLocation, Player } from '../../lib/types';
import { calculateLeagueStandings, determineChampion } from '../../lib/utils/league-standings';
import { addDays, format } from 'date-fns';

/**
 * Check if all league matches are completed and determine champion
 * This should be called after each match is finalized
 * @param leagueId - The league ID to check
 * @returns Object with success status and message
 */
export async function checkAndCompleteLeague(leagueId: string): Promise<{
  success: boolean;
  message: string;
  requiresTiebreaker?: boolean;
  finalMatchId?: string;
}> {
  try {
    // Get league document
    const leagueDoc = await getAdminDb().collection('leagues').doc(leagueId).get();
    if (!leagueDoc.exists) {
      return { success: false, message: 'Liga no encontrada' };
    }

    const league = { id: leagueDoc.id, ...leagueDoc.data() } as League;

    // Only process leagues that are in progress
    if (league.status !== 'in_progress') {
      return { success: false, message: 'La liga no está en curso' };
    }

    // Get all league matches
    const matchesSnapshot = await getAdminDb()
      .collection('matches')
      .where('leagueInfo.leagueId', '==', leagueId)
      .where('type', '==', 'league')
      .get();

    const matches = matchesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Match[];

    // Check if all matches are completed
    const allCompleted = matches.every(m =>
      m.status === 'completed' || m.status === 'evaluated'
    );

    if (!allCompleted) {
      return {
        success: true,
        message: 'Todavía hay partidos pendientes',
      };
    }

    // Get teams data
    const teamsSnapshot = await getAdminDb()
      .collection('teams')
      .where('__name__', 'in', league.teams)
      .get();

    const teams = teamsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as GroupTeam[];

    // Calculate final standings
    const standings = calculateLeagueStandings(matches, teams);

    // Determine champion
    const championResult = determineChampion(standings, matches);

    if (!championResult) {
      return { success: false, message: 'No se pudo determinar el campeón' };
    }

    // If tiebreaker is needed, create final match
    if (championResult.requiresTiebreaker) {
      const finalMatch = await createTiebreakerMatch(
        league,
        championResult.championId,
        championResult.runnerUpId,
        teams
      );

      // Update league with tiebreaker status
      await getAdminDb().collection('leagues').doc(leagueId).update({
        requiresTiebreaker: true,
        finalMatchId: finalMatch.id,
      });

      return {
        success: true,
        message: 'Se requiere un partido final para definir el campeón',
        requiresTiebreaker: true,
        finalMatchId: finalMatch.id,
      };
    }

    // No tiebreaker needed, declare champion
    await getAdminDb().collection('leagues').doc(leagueId).update({
      status: 'completed',
      championTeamId: championResult.championId,
      championTeamName: championResult.championName,
      runnerUpTeamId: championResult.runnerUpId,
      runnerUpTeamName: championResult.runnerUpName,
      completedAt: new Date().toISOString(),
      requiresTiebreaker: false,
    });

    return {
      success: true,
      message: `¡${championResult.championName} es el campeón!`,
      requiresTiebreaker: false,
    };
  } catch (error) {
    console.error('Error completing league:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Error al completar la liga',
    };
  }
}

/**
 * Create a tiebreaker final match between two tied teams
 * @param league - The league object
 * @param team1Id - First team ID
 * @param team2Id - Second team ID
 * @param teams - All team objects
 * @returns The created match
 */
async function createTiebreakerMatch(
  league: League,
  team1Id: string,
  team2Id: string,
  teams: GroupTeam[]
): Promise<Match> {
  const team1 = teams.find(t => t.id === team1Id);
  const team2 = teams.find(t => t.id === team2Id);

  if (!team1 || !team2) {
    throw new Error('Equipos no encontrados');
  }

  // Get all players from both teams
  const allPlayerIds = [
    ...team1.members.map(m => m.playerId),
    ...team2.members.map(m => m.playerId),
  ];

  const playersSnapshot = await getAdminDb()
    .collection('players')
    .where('__name__', 'in', allPlayerIds)
    .get();

  const players = playersSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as Player[];

  // Build team1 players array
  const team1Players = team1.members.map(member => {
    const player = players.find(p => p.id === member.playerId);
    return {
      uid: member.playerId,
      displayName: player?.name || 'Desconocido',
      ovr: player?.ovr || 0,
      position: player?.position || 'DEF',
      photoUrl: player?.photoUrl || '',
    };
  });

  // Build team2 players array
  const team2Players = team2.members.map(member => {
    const player = players.find(p => p.id === member.playerId);
    return {
      uid: member.playerId,
      displayName: player?.name || 'Desconocido',
      ovr: player?.ovr || 0,
      position: player?.position || 'DEF',
      photoUrl: player?.photoUrl || '',
    };
  });

  // Calculate match date (3 days from now)
  const matchDate = addDays(new Date(), 3);
  const matchLocation: MatchLocation = league.defaultLocation || {
    name: 'Por definir',
    address: 'Por definir',
    lat: 0,
    lng: 0,
    placeId: '',
  };

  // Create the final match
  const matchData: Omit<Match, 'id'> = {
    title: `Final - ${league.name}`,
    date: format(matchDate, 'yyyy-MM-dd'),
    time: league.matchTime || '20:00',
    location: matchLocation,
    type: 'league_final',
    matchSize: (team1Players.length + team2Players.length) as 10 | 14 | 22,
    players: [...team1Players, ...team2Players],
    playerUids: [...team1Players.map(p => p.uid), ...team2Players.map(p => p.uid)],
    teams: [
      {
        id: team1Id,
        name: team1.name,
        players: team1Players,
        totalOVR: team1Players.reduce((sum, p) => sum + p.ovr, 0),
        averageOVR: team1Players.reduce((sum, p) => sum + p.ovr, 0) / team1Players.length,
        jersey: team1.jersey,
      },
      {
        id: team2Id,
        name: team2.name,
        players: team2Players,
        totalOVR: team2Players.reduce((sum, p) => sum + p.ovr, 0),
        averageOVR: team2Players.reduce((sum, p) => sum + p.ovr, 0) / team2Players.length,
        jersey: team2.jersey,
      },
    ],
    status: 'upcoming',
    ownerUid: league.ownerUid,
    groupId: league.groupId,
    isPublic: league.isPublic,
    participantTeamIds: [team1Id, team2Id],
    createdAt: new Date().toISOString(),
    leagueInfo: {
      leagueId: league.id,
      round: 999, // Special round number for finals
    },
  };

  const matchRef = await getAdminDb().collection('matches').add(matchData);

  return {
    id: matchRef.id,
    ...matchData,
  } as Match;
}

/**
 * Resolve tiebreaker final after it's completed
 * This should be called after a league_final match is completed
 * @param leagueId - The league ID
 * @param matchId - The final match ID
 * @returns Object with success status and champion info
 */
export async function resolveTiebreakerFinal(
  leagueId: string,
  matchId: string
): Promise<{
  success: boolean;
  message: string;
  championName?: string;
}> {
  try {
    // Get the match
    const matchDoc = await getAdminDb().collection('matches').doc(matchId).get();
    if (!matchDoc.exists) {
      return { success: false, message: 'Partido no encontrado' };
    }

    const match = { id: matchDoc.id, ...matchDoc.data() } as Match;

    // Verify it's a completed final
    if (match.type !== 'league_final') {
      return { success: false, message: 'No es un partido final' };
    }

    if (match.status !== 'completed' && match.status !== 'evaluated') {
      return { success: false, message: 'El partido aún no ha finalizado' };
    }

    if (!match.teams || match.teams.length !== 2) {
      return { success: false, message: 'Datos del partido inválidos' };
    }

    const team1Score = match.finalScore ? match.finalScore.team1 : (match.teams[0].finalScore ?? 0);
    const team2Score = match.finalScore ? match.finalScore.team2 : (match.teams[1].finalScore ?? 0);

    // Check for draw (shouldn't happen in a final, but handle it)
    if (team1Score === team2Score) {
      return {
        success: false,
        message: 'El partido final no puede terminar en empate. Por favor, actualiza el resultado.',
      };
    }

    // Determine winner
    const championId = team1Score > team2Score ? match.teams[0].id! : match.teams[1].id!;
    const championName = team1Score > team2Score ? match.teams[0].name : match.teams[1].name;
    const runnerUpId = team1Score > team2Score ? match.teams[1].id! : match.teams[0].id!;
    const runnerUpName = team1Score > team2Score ? match.teams[1].name : match.teams[0].name;

    // Update league with champion
    await getAdminDb().collection('leagues').doc(leagueId).update({
      status: 'completed',
      championTeamId: championId,
      championTeamName: championName,
      runnerUpTeamId: runnerUpId,
      runnerUpTeamName: runnerUpName,
      completedAt: new Date().toISOString(),
    });

    return {
      success: true,
      message: `¡${championName} es el campeón!`,
      championName,
    };
  } catch (error) {
    console.error('Error resolving tiebreaker:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Error al resolver el desempate',
    };
  }
}
