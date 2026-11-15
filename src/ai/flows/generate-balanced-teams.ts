import {
  balanceTeams,
  type BalancedTeamsOutput,
} from '../../../functions/src/lib/team-balancer';

export type GenerateBalancedTeamsInput = {
  players: Array<{ uid: string; displayName: string; position: string; ovr: number; photoURL?: string }>;
  teamCount?: number;
};
export type GenerateBalancedTeamsOutput = BalancedTeamsOutput;

/**
 * Team assignment is a bounded combinatorial calculation, not a text-generation
 * task. Both clients use the same algorithm, exact IDs and measured OVR totals.
 * No API key, AI credit or cached model response is needed to form a match.
 */
export async function generateBalancedTeams(
  input: GenerateBalancedTeamsInput,
): Promise<GenerateBalancedTeamsOutput> {
  return balanceTeams(input.players, input.teamCount ?? 2);
}
