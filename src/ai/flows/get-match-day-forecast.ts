
'use server';

/**
 * @fileOverview Flujo para obtener un pronóstico del clima en español para un día de partido.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
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

const forecastPrompt = ai.definePrompt(
  {
    name: 'matchDayForecast',
    input: { schema: GetMatchDayForecastInputSchema },
    output: { schema: GetMatchDayForecastOutputSchema },
    prompt: `
    Eres un asistente meteorológico para una aplicación de fútbol amateur. 
    Proporciona un breve resumen del clima en español para el siguiente lugar y fecha. 
    Lugar: {{{location}}}
    Fecha: {{{date}}}
    
    Tu respuesta DEBE incluir:
    - una breve descripción amigable (ej: "Ideal para jugar", "Se recomienda llevar paraguas").
    - la temperatura aproximada en °C.
    - un ícono de esta lista estricta: Sun, Cloud, Cloudy, CloudRain, CloudSnow, Wind, Zap.
    
    Ejemplo de respuesta:
    Clima perfecto para un partido, algo fresco. Temp: 18°C. Icono: Sun
    `,
    model: googleAI('gemini-1.5-flash-preview-0514'),
    output: {
        format: 'json'
    }
  }
);


export const getMatchDayForecast = ai.defineFlow(
  {
    name: 'getMatchDayForecastFlow',
    inputSchema: GetMatchDayForecastInputSchema,
    outputSchema: GetMatchDayForecastOutputSchema,
  },
  async (input) => {
    const { output } = await forecastPrompt(input);
    return output!;
  }
);
