
'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { googleAI } from '@genkit-ai/google-genai';

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

const forecastPrompt = ai.definePrompt({
  name: 'matchDayForecast',
  input: { schema: GetMatchDayForecastInputSchema },
  output: { schema: GetMatchDayForecastOutputSchema },
  prompt: `
    Eres un asistente meteorológico para una app de fútbol amateur.
    Proporciona un breve y amigable resumen del clima en ESPAÑOL.

    Lugar: {{{location}}}
    Fecha: {{{date}}}

    Responde estrictamente en JSON con:
    {
      "description": "texto corto en español",
      "temperature": número en Celsius,
      "icon": uno de: Sun, Cloud, Cloudy, CloudRain, CloudSnow, Wind, Zap
    }
  `,
});

export const getMatchDayForecast = ai.defineFlow(
  {
    name: 'getMatchDayForecastFlow',
    inputSchema: GetMatchDayForecastInputSchema,
    outputSchema: GetMatchDayForecastOutputSchema,
  },
  async (input) => {
    const { output } = await forecastPrompt(input, { model: 'googleai/gemini-2.5-flash' });
    if (!output) throw new Error('No se obtuvo respuesta válida del modelo.');
    return output;
  }
);
