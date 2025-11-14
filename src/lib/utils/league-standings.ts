import type { Match, LeagueStanding, GroupTeam, Jersey } from '@/lib/types';

/**
 * Calculate league standings from completed matches
 * @param matches - Array of league matches (should be filtered to only completed matches)
 * @param teams - Array of teams participating in the league
 * @returns Array of LeagueStanding sorted by position
 */
export function calculateLeagueStandings(
  matches: Match[],
  teams: Array<{ id: string; name: string; jersey: Jersey }>
): LeagueStanding[] {
  // Initialize standings for each team
  const standingsMap = new Map<string, LeagueStanding>();

  teams.forEach(team => {
    standingsMap.set(team.id, {
      teamId: team.id,
      teamName: team.name,
      teamJersey: team.jersey,
      position: 0, // Will be calculated after sorting
      matchesPlayed: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
    });
  });

  // Process each completed match
  matches.forEach(match => {
    if (match.status !== 'evaluated' && match.status !== 'completed') return;
    if (!match.teams || match.teams.length !== 2) return;
    if (!match.participantTeamIds || match.participantTeamIds.length !== 2) return;

    const team1Id = match.participantTeamIds[0];
    const team2Id = match.participantTeamIds[1];
    const team1Data = match.teams[0];
    const team2Data = match.teams[1];

    // Get goals (from finalScore or default to 0)
    const team1Goals = team1Data.finalScore ?? 0;
    const team2Goals = team2Data.finalScore ?? 0;

    const team1Standing = standingsMap.get(team1Id);
    const team2Standing = standingsMap.get(team2Id);

    if (!team1Standing || !team2Standing) return;

    // Update matches played
    team1Standing.matchesPlayed++;
    team2Standing.matchesPlayed++;

    // Update goals
    team1Standing.goalsFor += team1Goals;
    team1Standing.goalsAgainst += team2Goals;
    team2Standing.goalsFor += team2Goals;
    team2Standing.goalsAgainst += team1Goals;

    // Determine result and update points
    if (team1Goals > team2Goals) {
      // Team 1 wins
      team1Standing.wins++;
      team1Standing.points += 3;
      team2Standing.losses++;
    } else if (team2Goals > team1Goals) {
      // Team 2 wins
      team2Standing.wins++;
      team2Standing.points += 3;
      team1Standing.losses++;
    } else {
      // Draw
      team1Standing.draws++;
      team1Standing.points += 1;
      team2Standing.draws++;
      team2Standing.points += 1;
    }

    // Update goal difference
    team1Standing.goalDifference = team1Standing.goalsFor - team1Standing.goalsAgainst;
    team2Standing.goalDifference = team2Standing.goalsFor - team2Standing.goalsAgainst;
  });

  // Convert map to array and sort
  const standings = Array.from(standingsMap.values());

  standings.sort((a, b) => {
    // 1. Points (descending)
    if (b.points !== a.points) return b.points - a.points;

    // 2. Goal difference (descending)
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;

    // 3. Goals for (descending)
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;

    // 4. Alphabetical by team name
    return a.teamName.localeCompare(b.teamName);
  });

  // Assign positions
  standings.forEach((standing, index) => {
    standing.position = index + 1;
  });

  return standings;
}

/**
 * Get current round number based on completed matches
 * @param matches - All league matches
 * @returns The current round number (1-indexed)
 */
export function getCurrentRound(matches: Match[]): number {
  if (!matches || matches.length === 0) return 1;

  // Group matches by round
  const roundsMap = new Map<number, Match[]>();
  matches.forEach(match => {
    const round = match.leagueInfo?.round || 0;
    if (!roundsMap.has(round)) {
      roundsMap.set(round, []);
    }
    roundsMap.get(round)!.push(match);
  });

  // Find the last round where ALL matches are completed
  const sortedRounds = Array.from(roundsMap.keys()).sort((a, b) => a - b);

  for (let i = sortedRounds.length - 1; i >= 0; i--) {
    const round = sortedRounds[i];
    const roundMatches = roundsMap.get(round) || [];
    const allCompleted = roundMatches.every(m => m.status === 'completed' || m.status === 'evaluated');

    if (allCompleted) {
      // Current round is the next one after this completed round
      return round + 1;
    }
  }

  // If no rounds are completed, current round is 1
  return 1;
}

/**
 * Calculate total rounds in the league
 * @param numTeams - Number of teams
 * @param isDoubleRoundRobin - Whether it's a double round-robin format
 * @returns Total number of rounds
 */
export function getTotalRounds(numTeams: number, isDoubleRoundRobin: boolean): number {
  const baseRounds = numTeams % 2 === 0 ? numTeams - 1 : numTeams;
  return isDoubleRoundRobin ? baseRounds * 2 : baseRounds;
}

/**
 * Get league progress percentage
 * @param matches - All league matches
 * @returns Percentage of completed matches (0-100)
 */
export function getLeagueProgress(matches: Match[]): number {
  if (!matches || matches.length === 0) return 0;

  const completedMatches = matches.filter(m =>
    m.status === 'completed' || m.status === 'evaluated'
  ).length;

  return Math.round((completedMatches / matches.length) * 100);
}

/**
 * Get next match for a specific team
 * @param matches - All league matches
 * @param teamId - Team ID to find next match for
 * @returns Next upcoming match or undefined
 */
export function getNextMatchForTeam(matches: Match[], teamId: string): Match | undefined {
  const now = new Date();

  return matches
    .filter(m =>
      m.status === 'upcoming' &&
      m.participantTeamIds?.includes(teamId) &&
      new Date(m.date) >= now
    )
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
}
