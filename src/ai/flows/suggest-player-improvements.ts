'use server';

/**
 * @fileOverview A player improvement suggestion AI agent.
 *
 * - suggestPlayerImprovements - A function that handles the player improvement suggestion process.
 * - SuggestPlayerImprovementsInput - The input type for the suggestPlayerImprovements function.
 * - SuggestPlayerImprovementsOutput - The return type for the suggestPlayerImprovements function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestPlayerImprovementsInputSchema = z.object({
  playerId: z.string().describe('The ID of the player to generate suggestions for.'),
  playerStats: z.object({
    matchesPlayed: z.number().describe('The number of matches the player has played.'),
    goals: z.number().describe('The number of goals the player has scored.'),
    assists: z.number().describe('The number of assists the player has made.'),
    averageRating: z.number().describe('The average rating of the player.'),
  }).describe('The current stats of the player.'),
  evaluations: z.array(
    z.object({
      performanceTags: z.array(z.string()).describe('The performance tags received by the player in a match.'),
      evaluatedBy: z.string().describe('The ID of the user who evaluated the player.'),
      timestamp: z.string().describe('The timestamp of the evaluation.'),
    })
  ).describe('The historical evaluations of the player.'),
});
export type SuggestPlayerImprovementsInput = z.infer<typeof SuggestPlayerImprovementsInputSchema>;

const SuggestPlayerImprovementsOutputSchema = z.object({
  suggestions: z.array(
    z.string().describe('A suggestion for the player to improve their performance.')
  ).describe('The list of suggestions for the player.'),
});
export type SuggestPlayerImprovementsOutput = z.infer<typeof SuggestPlayerImprovementsOutputSchema>;

export async function suggestPlayerImprovements(input: SuggestPlayerImprovementsInput): Promise<SuggestPlayerImprovementsOutput> {
  return suggestPlayerImprovementsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestPlayerImprovementsPrompt',
  input: {schema: SuggestPlayerImprovementsInputSchema},
  output: {schema: SuggestPlayerImprovementsOutputSchema},
  prompt: `You are a football coach providing personalized suggestions to players based on their past performance.

  Analyze the player's stats and evaluations to identify areas for improvement.

  Stats:
  Matches Played: {{{playerStats.matchesPlayed}}}
  Goals: {{{playerStats.goals}}}
  Assists: {{{playerStats.assists}}}
  Average Rating: {{{playerStats.averageRating}}}

  Evaluations:
  {{#each evaluations}}
  - Performance Tags: {{performanceTags}}
  {{/each}}

  Provide 3-5 concise and actionable suggestions for the player to improve their key stats.
  Format the suggestions as a list.
  `,
});

const suggestPlayerImprovementsFlow = ai.defineFlow(
  {
    name: 'suggestPlayerImprovementsFlow',
    inputSchema: SuggestPlayerImprovementsInputSchema,
    outputSchema: SuggestPlayerImprovementsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
