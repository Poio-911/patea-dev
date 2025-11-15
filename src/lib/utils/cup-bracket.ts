import type { BracketMatch, CupRound, GroupTeam, Jersey } from '@/lib/types';

/**
 * Get the appropriate cup round based on number of teams
 */
export function getInitialRound(numTeams: number): CupRound | null {
  if (numTeams === 32) return 'round_of_32';
  if (numTeams === 16) return 'round_of_16';
  if (numTeams === 8) return 'round_of_8';
  if (numTeams === 4) return 'semifinals';
  if (numTeams === 2) return 'final';
  return null; // Invalid number of teams
}

/**
 * Get the next round in the tournament
 */
export function getNextRound(currentRound: CupRound): CupRound | null {
  const roundOrder: CupRound[] = ['round_of_32', 'round_of_16', 'round_of_8', 'semifinals', 'final'];
  const currentIndex = roundOrder.indexOf(currentRound);
  if (currentIndex === -1 || currentIndex === roundOrder.length - 1) return null;
  return roundOrder[currentIndex + 1];
}

/**
 * Get round display name in Spanish
 */
export function getRoundName(round: CupRound): string {
  const names: Record<CupRound, string> = {
    round_of_32: 'Ronda de 32',
    round_of_16: 'Octavos de Final',
    round_of_8: 'Cuartos de Final',
    semifinals: 'Semifinales',
    final: 'Final',
  };
  return names[round];
}

/**
 * Shuffle array using Fisher-Yates algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Generate initial bracket for cup tournament
 * Teams are randomly distributed in the bracket
 */
export function generateBracket(
  teams: GroupTeam[]
): BracketMatch[] {
  const numTeams = teams.length;
  const initialRound = getInitialRound(numTeams);

  if (!initialRound) {
    throw new Error(`Invalid number of teams: ${numTeams}. Must be 2, 4, 8, 16, or 32.`);
  }

  // Shuffle teams randomly
  const shuffledTeams = shuffleArray(teams);

  // Calculate total matches needed for entire tournament
  // For single elimination: (n-1) matches total, where n = number of teams
  const bracket: BracketMatch[] = [];
  let matchId = 1;

  // Generate all rounds
  let currentRound: CupRound | null = initialRound;
  let teamsInRound = numTeams;
  const rounds: CupRound[] = [];

  // Build list of all rounds
  while (currentRound) {
    rounds.push(currentRound);
    currentRound = getNextRound(currentRound);
  }

  // Generate matches for each round
  let teamIndex = 0;

  for (let roundIndex = 0; roundIndex < rounds.length; roundIndex++) {
    const round = rounds[roundIndex];
    const matchesInRound = teamsInRound / 2;

    for (let matchNum = 0; matchNum < matchesInRound; matchNum++) {
      const bracketMatch: BracketMatch = {
        id: `match-${matchId}`,
        round,
        matchNumber: matchNum + 1,
      };

      // First round: assign teams directly
      if (roundIndex === 0) {
        const team1 = shuffledTeams[teamIndex];
        const team2 = shuffledTeams[teamIndex + 1];

        bracketMatch.team1Id = team1.id;
        bracketMatch.team1Name = team1.name;
        bracketMatch.team1Jersey = team1.jersey;

        bracketMatch.team2Id = team2.id;
        bracketMatch.team2Name = team2.name;
        bracketMatch.team2Jersey = team2.jersey;

        teamIndex += 2;
      }

      // Calculate which match the winner advances to
      if (roundIndex < rounds.length - 1) {
        // Winner advances to match number: floor((current match number + 1) / 2) in next round
        bracketMatch.nextMatchNumber = Math.floor((matchNum + 1) / 2) + (matchNum % 2 === 0 ? 0 : 0.5);
        bracketMatch.nextMatchNumber = Math.ceil(bracketMatch.nextMatchNumber);
      }

      bracket.push(bracketMatch);
      matchId++;
    }

    teamsInRound = teamsInRound / 2;
  }

  return bracket;
}

/**
 * Advance winner to next round in bracket
 */
export function advanceWinner(
  bracket: BracketMatch[],
  completedMatchId: string,
  winnerId: string,
  winnerName: string,
  winnerJersey: Jersey
): BracketMatch[] {
  const updatedBracket = [...bracket];

  // Find the completed match
  const completedMatchIndex = updatedBracket.findIndex(m => m.id === completedMatchId);
  if (completedMatchIndex === -1) {
    throw new Error(`Match ${completedMatchId} not found in bracket`);
  }

  const completedMatch = updatedBracket[completedMatchIndex];

  // Mark winner in completed match
  updatedBracket[completedMatchIndex] = {
    ...completedMatch,
    winnerId,
  };

  // If final, no advancement needed
  if (completedMatch.round === 'final') {
    return updatedBracket;
  }

  // Find next match to advance winner to
  const nextRound = getNextRound(completedMatch.round);
  if (!nextRound) {
    return updatedBracket;
  }

  const nextMatchNumber = completedMatch.nextMatchNumber;
  if (!nextMatchNumber) {
    throw new Error(`No next match defined for ${completedMatchId}`);
  }

  const nextMatchIndex = updatedBracket.findIndex(
    m => m.round === nextRound && m.matchNumber === nextMatchNumber
  );

  if (nextMatchIndex === -1) {
    throw new Error(`Next match not found: Round ${nextRound}, Match ${nextMatchNumber}`);
  }

  const nextMatch = updatedBracket[nextMatchIndex];

  // Determine if winner goes to team1 or team2 slot
  // Even match numbers (2, 4, 6...) advance to team2, odd to team1
  const isTeam1Slot = completedMatch.matchNumber % 2 === 1;

  if (isTeam1Slot) {
    updatedBracket[nextMatchIndex] = {
      ...nextMatch,
      team1Id: winnerId,
      team1Name: winnerName,
      team1Jersey: winnerJersey,
    };
  } else {
    updatedBracket[nextMatchIndex] = {
      ...nextMatch,
      team2Id: winnerId,
      team2Name: winnerName,
      team2Jersey: winnerJersey,
    };
  }

  return updatedBracket;
}

/**
 * Check if all matches in a round are completed
 */
export function isRoundComplete(bracket: BracketMatch[], round: CupRound): boolean {
  const roundMatches = bracket.filter(m => m.round === round);
  return roundMatches.every(m => m.winnerId !== undefined);
}

/**
 * Check if entire tournament is complete
 */
export function isTournamentComplete(bracket: BracketMatch[]): boolean {
  const finalMatch = bracket.find(m => m.round === 'final');
  return finalMatch?.winnerId !== undefined;
}

/**
 * Get champion from completed tournament
 */
export function getChampion(bracket: BracketMatch[]): {
  teamId: string;
  teamName: string;
} | null {
  const finalMatch = bracket.find(m => m.round === 'final');
  if (!finalMatch?.winnerId) return null;

  const winnerName = finalMatch.team1Id === finalMatch.winnerId
    ? finalMatch.team1Name
    : finalMatch.team2Name;

  return {
    teamId: finalMatch.winnerId,
    teamName: winnerName || 'Unknown',
  };
}

/**
 * Get runner-up from completed tournament
 */
export function getRunnerUp(bracket: BracketMatch[]): {
  teamId: string;
  teamName: string;
} | null {
  const finalMatch = bracket.find(m => m.round === 'final');
  if (!finalMatch?.winnerId || !finalMatch.team1Id || !finalMatch.team2Id) return null;

  const runnerUpId = finalMatch.team1Id === finalMatch.winnerId
    ? finalMatch.team2Id
    : finalMatch.team1Id;

  const runnerUpName = finalMatch.team1Id === finalMatch.winnerId
    ? finalMatch.team2Name
    : finalMatch.team1Name;

  return {
    teamId: runnerUpId,
    teamName: runnerUpName || 'Unknown',
  };
}

/**
 * Get matches for a specific round
 */
export function getMatchesByRound(bracket: BracketMatch[], round: CupRound): BracketMatch[] {
  return bracket.filter(m => m.round === round).sort((a, b) => a.matchNumber - b.matchNumber);
}

/**
 * Get current active round (first incomplete round)
 */
export function getCurrentRound(bracket: BracketMatch[]): CupRound | null {
  const rounds: CupRound[] = ['round_of_32', 'round_of_16', 'round_of_8', 'semifinals', 'final'];

  for (const round of rounds) {
    const roundMatches = bracket.filter(m => m.round === round);
    if (roundMatches.length === 0) continue;

    // If round has incomplete matches, it's the current round
    if (!isRoundComplete(bracket, round)) {
      return round;
    }
  }

  // All rounds complete
  return null;
}
