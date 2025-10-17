'use server';

/**
 * @fileOverview Generates balanced teams based on player ratings and positions.
 *
 * - generateBalancedTeams - A function that generates balanced teams.
 * - GenerateBalancedTeamsInput - The input type for the generateBalancedTeams function.
 * - GenerateBalancedTeamsOutput - The return type for the generateBalancedTeams function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateBalancedTeamsInputSchema = z.object({
  players: z
    .array(
      z.object({
        uid: z.string().describe('The unique identifier of the player.'),
        displayName: z.string().describe('The display name of the player.'),
        position: z.string().describe('The position of the player (DEL, MED, DEF, POR).'),
        ovr: z.number().describe('The overall rating of the player.'),
      })
    )
    .describe('An array of player objects to balance into teams.'),
  teamCount: z
    .number()
    .describe('The number of teams to generate. Must be at least 2.')
    .default(2),
});

export type GenerateBalancedTeamsInput = z.infer<typeof GenerateBalancedTeamsInputSchema>;

const GenerateBalancedTeamsOutputSchema = z.object({
  teams: z.array(
    z.object({
      name: z.string().describe('A creative and cool name for the team (e.g., "Titanes Azules", "Furia Roja").'),
      players: z.array(
        z.object({
          uid: z.string().describe('The unique identifier of the player.'),
          displayName: z.string().describe('The display name of the player.'),
          position: z.string().describe('The position of the player (DEL, MED, DEF, POR).'),
          ovr: z.number().describe('The overall rating of the player.'),
        })
      ),
      totalOVR: z.number().describe('The sum of all player OVRs.'),
      averageOVR: z.number().describe('The average team strength.'),
      suggestedFormation: z.string().describe('A suggested tactical formation (e.g., 1-2-1 for 5-a-side).'),
      tags: z.array(z.string()).describe('2-3 tactical tags describing the team (e.g., "Ataque Veloz", "Defensa Sólida", "Sin Portero Fijo").'),
    })
  ),
  balanceMetrics: z
    .object({
      ovrDifference: z
        .number()
                .describe('The absolute difference in average OVR between the strongest and weakest teams.'),
      fairnessPercentage: z
        .number()
        .describe('A percentage from 0 to 100 indicating how fair the team balance is. 100 is perfectly balanced.'),
    })
    .describe("Metrics describing how balanced the teams are."),
});


export type GenerateBalancedTeamsOutput = z.infer<typeof GenerateBalancedTeamsOutputSchema>;

export async function generateBalancedTeams(
  input: GenerateBalancedTeamsInput
): Promise<GenerateBalancedTeamsOutput> {
  return generateBalancedTeamsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateBalancedTeamsPrompt',
  input: {schema: GenerateBalancedTeamsInputSchema},
  output: {schema: GenerateBalancedTeamsOutputSchema},
  prompt: `You are an expert sports team organizer, skilled at creating balanced teams for amateur football matches.

Given a list of players with their positions and overall ratings (OVR), your task is to divide them into {{teamCount}} teams such that the teams are as balanced as possible.

Here's the player data:

{{#each players}}
- Name: {{this.displayName}}, Position: {{this.position}}, OVR: {{this.ovr}}
{{/each}}

Based on the players in each team, you must:
1.  **Create a cool, creative name** for each team (e.g., "Titanes Azules", "Furia Roja", "CF Leyendas"). Avoid generic names like "Equipo A".
2.  **Suggest a tactical formation** based on the number of players (e.g., for a 5-a-side match, "1-2-1" or "2-1-1").
3.  **Generate 2-3 tactical tags** that describe the team's characteristics (e.g., "Ataque Veloz", "Defensa Sólida", "Control del Mediocampo", "Sin Portero Fijo" if no 'POR' is present).
4.  Try to minimize the difference in total OVR between the strongest and weakest teams.
5.  Calculate the total and average OVR for each team.
6.  Calculate balance metrics: the absolute difference in average OVR and a fairness percentage (100% is perfect balance, 0% is completely unbalanced).

Ensure the response is valid JSON that strictly follows the provided output schema.
`,
});

const generateBalancedTeamsFlow = ai.defineFlow(
  {
    name: 'generateBalancedTeamsFlow',
    inputSchema: GenerateBalancedTeamsInputSchema,
    outputSchema: GenerateBalancedTeamsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
