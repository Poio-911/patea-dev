
'use server';
/**
 * @fileOverview A flow to get a weather forecast for a match day.
 *
 * - getMatchDayForecast - A function that returns a weather forecast.
 * - GetMatchDayForecastInput - The input type for the getMatchDayForecast function.
 * - GetMatchDayForecastOutput - The return type for the getMatchDayForecast function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Define the input and output schemas for our main flow
const GetMatchDayForecastInputSchema = z.object({
  location: z.string().describe('The location of the match (e.g., "Montevideo, Uruguay").'),
  date: z.string().describe('The date and time of the match in ISO 8601 format.'),
});
type GetMatchDayForecastInput = z.infer<typeof GetMatchDayForecastInputSchema>;

const GetMatchDayForecastOutputSchema = z.object({
  description: z.string().describe('A concise, user-friendly description of the weather in Spanish.'),
  icon: z.enum(['Sun', 'Cloud', 'Cloudy', 'CloudRain', 'CloudSnow', 'Wind', 'Zap']).describe('An icon name representing the weather condition.'),
  temperature: z.number().describe('The temperature in Celsius.'),
});
type GetMatchDayForecastOutput = z.infer<typeof GetMatchDayForecastOutputSchema>;


// Define the main Genkit Flow
const getMatchDayForecastFlow = ai.defineFlow(
  {
    name: 'getMatchDayForecastFlow',
    inputSchema: GetMatchDayForecastInputSchema,
    outputSchema: GetMatchDayForecastOutputSchema,
  },
  async ({location, date}) => {
      
    const { output } = await ai.generate({
        prompt: `
        You are a helpful sports assistant. Your task is to provide a weather forecast for a specific location and date.
        Search for the weather forecast for the following location and date:
        Location: ${location}
        Date: ${date}

        Based on the forecast, generate a very concise and friendly description in SPANISH.
        Also, select the most appropriate icon from the provided list and extract the temperature in Celsius.

        - The description should be short and easy to read (e.g., "Noche clara, 18°C, poco viento.").
        - Choose one of these icons based on the weather condition: 'Sun', 'Cloud', 'Cloudy', 'CloudRain', 'CloudSnow', 'Wind', 'Zap'.
        - Extract the temperature in Celsius.
      `,
        output: { schema: GetMatchDayForecastOutputSchema },
        model: 'googleai/gemini-2.5-flash',
    });
    return output!;
  }
);

// Export the wrapper function
export async function getMatchDayForecast(input: GetMatchDayForecastInput): Promise<GetMatchDayForecastOutput> {
  return getMatchDayForecastFlow(input);
}
