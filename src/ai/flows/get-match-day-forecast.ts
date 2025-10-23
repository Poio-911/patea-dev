
'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { googleAI } from '@genkit-ai/googleai';

const GetMatchDayForecastInputSchema = z.object({
  location: z.string(),
  date: z.string(),
});
export type GetMatchDayForecastInput = z.infer<typeof GetMatchDayForecastInputSchema>;

const GetMatchDayForecastOutputSchema = z.object({
  description: z.string().describe("Una descripción muy corta del clima, de 2 a 3 palabras máximo (ej: 'Parcialmente Nublado', 'Sol y Nubes', 'Lluvias Aisladas')."),
  icon: z.enum(['Sun', 'Cloud', 'Cloudy', 'CloudRain', 'CloudSnow', 'Wind', 'Zap']),
  temperature: z.number(),
});
export type GetMatchDayForecastOutput = z.infer<typeof GetMatchDayForecastOutputSchema>;

const forecastPrompt = ai.definePrompt({
  name: 'matchDayForecast',
  inputSchema: GetMatchDayForecastInputSchema,
  outputSchema: GetMatchDayForecastOutputSchema,
  prompt: `
    Eres un asistente meteorológico para una app de fútbol amateur.
    Proporciona un resumen del clima en ESPAÑOL. La descripción debe ser muy concisa, de 2 a 3 palabras.

    Lugar: {{{location}}}
    Fecha: {{{date}}}

    Responde estrictamente en JSON.
  `,
});

export const getMatchDayForecast = ai.defineFlow(
  {
    name: 'getMatchDayForecastFlow',
    inputSchema: GetMatchDayForecastInputSchema,
    outputSchema: GetMatchDayForecastOutputSchema,
  },
  async (input) => {
    const { output } = await forecastPrompt(input);
    if (!output) throw new Error('No se obtuvo respuesta válida del modelo.');
    return output;
  }
);
