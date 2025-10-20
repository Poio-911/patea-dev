
'use server';
/**
 * @fileOverview A flow to get a weather forecast for a match day.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const GetMatchDayForecastInputSchema = z.object({
  location: z.string(),
  date: z.string(),
});
export type GetMatchDayForecastInput = z.infer<typeof GetMatchDayForecastInputSchema>;

const GetMatchDayForecastOutputSchema = z.object({
  description: z.string(),
  icon: z.enum(['Sun', 'Cloud', 'Cloudy', 'CloudRain', 'CloudSnow', 'Wind', 'Zap']),
  temperature: z.number(),
});
export type GetMatchDayForecastOutput = z.infer<typeof GetMatchDayForecastOutputSchema>;

// Define the prompt for the AI
const prompt = ai.definePrompt({
  name: 'getMatchDayForecastPrompt',
  input: { schema: GetMatchDayForecastInputSchema },
  output: { schema: GetMatchDayForecastOutputSchema },
  prompt: `
    You are a helpful assistant. Provide a short, friendly Spanish weather summary.
    Location: {{{location}}}
    Date: {{{date}}}
    Include:
    - short description (in Spanish)
    - temperature in °C
    - one icon from: Sun, Cloud, Cloudy, CloudRain, CloudSnow, Wind, Zap
  `,
});


// Main Genkit Flow
const getMatchDayForecastFlow = ai.defineFlow(
  {
    name: 'getMatchDayForecastFlow',
    inputSchema: GetMatchDayForecastInputSchema,
    outputSchema: GetMatchDayForecastOutputSchema,
  },
  async ({location, date}) => {
      
    const { output } = await ai.generate({
        prompt: `
            You are a helpful assistant. Provide a short, friendly Spanish weather summary.
            Location: ${location}
            Date: ${date}
            Include:
            - short description (in Spanish)
            - temperature in °C
            - one icon from: Sun, Cloud, Cloudy, CloudRain, CloudSnow, Wind, Zap
        `,
        model: 'gemini-1.5-flash',
        output: {
            schema: GetMatchDayForecastOutputSchema
        }
    });
    
    if (!output) {
        throw new Error("Failed to get a valid response from the AI.");
    }
    
    return output;
  }
);

// Export wrapper
export async function getMatchDayForecast(input: GetMatchDayForecastInput): Promise<GetMatchDayForecastOutput> {
  return getMatchDayForecastFlow(input);
}
