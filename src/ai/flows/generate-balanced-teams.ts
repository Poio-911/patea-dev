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
      name: z.string().describe('The name of the team.'),
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
    })
  ),
  balanceMetrics: z
    .object({
      ovrDifference: z
        .number()
        .describe('The difference in overall rating between the best and worst teams.'),
      fairnessPercentage: z
        .number()
        .describe('A percentage indicating how fair the team balance is.'),
    })
    .optional(),
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
  prompt: `You are an expert sports team organizer, skilled at creating balanced teams for football matches.

Given a list of players with their positions and overall ratings (OVR), your task is to divide them into {{teamCount}} teams such that the teams are as balanced as possible.

Here's the player data:

{{#each players}}
- Name: {{this.displayName}}, Position: {{this.position}}, OVR: {{this.ovr}}
{{/each}}

Consider player positions when forming the teams.

Ensure that each team has a mix of positions, if possible.

Try to minimize the difference in total OVR between the strongest and weakest teams.

Output the teams with the following information:
- Team Name
- List of Players (Name, Position, OVR)
- Total Team OVR
- Average Team OVR

Also, calculate and output the following balance metrics:
- OVR Difference (between the best and worst teams)
- Fairness Percentage (higher is better, 100% is perfectly fair)

Ensure the response is valid JSON.
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
