
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

// Main Genkit Flow
const getMatchDayForecastFlow = ai.defineFlow(
  {
    name: 'getMatchDayForecastFlow',
    inputSchema: GetMatchDayForecastInputSchema,
    outputSchema: GetMatchDayForecastOutputSchema,
  },
  async ({ location, date }) => {
    console.log('🌦️ [getMatchDayForecastFlow] Iniciado');
    console.log('📍 Ubicación:', location);
    console.log('🗓️ Fecha:', date);
    console.log('🔑 GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? '[OK]' : '[FALTA]');
    console.log('🔧 Model: gemini-1.5-flash');

    try {
      const { output } = await ai.generate({
        model: 'models/gemini-1.5-flash',
        prompt: `
          You are a helpful assistant. Provide a short, friendly Spanish weather summary.
          Location: ${location}
          Date: ${date}
          Include:
          - short description (in Spanish)
          - temperature in °C
          - one icon from: Sun, Cloud, Cloudy, CloudRain, CloudSnow, Wind, Zap
        `,
        output: { schema: GetMatchDayForecastOutputSchema },
      });

      console.log('✅ [getMatchDayForecastFlow] Salida:', output);
      return output!;
    } catch (error: any) {
      console.error('❌ [getMatchDayForecastFlow] Error en ai.generate:', error);
      throw new Error('Failed to fetch weather');
    }
  }
);

// Export wrapper
export async function getMatchDayForecast(input: GetMatchDayForecastInput): Promise<GetMatchDayForecastOutput> {
  console.log('🚀 Ejecutando getMatchDayForecast...');
  return getMatchDayForecastFlow(input);
}
