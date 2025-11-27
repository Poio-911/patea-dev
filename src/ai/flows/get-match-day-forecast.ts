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
  description: z.string().describe("Una descripción muy corta del clima, de 2 a 3 palabras máximo (ej: 'Parcialmente Nublado', 'Sol y Nubes', 'Lluvias Aisladas')."),
  icon: z.enum(['Sun', 'Cloud', 'Cloudy', 'CloudRain', 'CloudSnow', 'Wind', 'Zap']),
  temperature: z.number().describe('Temperatura en grados Celsius'),
  humidity: z.number().describe('Humedad en porcentaje (0-100)'),
  windSpeed: z.number().describe('Velocidad del viento en km/h'),
  precipitation: z.number().describe('Probabilidad de precipitación en porcentaje (0-100)'),
  uvIndex: z.number().describe('Índice UV (0-11+)'),
  feelsLike: z.number().describe('Sensación térmica en grados Celsius'),
  conditions: z.string().describe('Descripción detallada de las condiciones (1-2 líneas)'),
  recommendation: z.string().describe('Recomendación breve para jugar (ej: "Ideal para jugar", "Hidrátate bien", "Lleva impermeable")'),
});
export type GetMatchDayForecastOutput = z.infer<typeof GetMatchDayForecastOutputSchema>;

const forecastPrompt = ai.definePrompt({
  name: 'matchDayForecast',
  input: { schema: GetMatchDayForecastInputSchema },
  output: { schema: GetMatchDayForecastOutputSchema },
  prompt: `
    Eres un asistente meteorológico especializado para una app de fútbol amateur.
    Proporciona un pronóstico detallado del clima en ESPAÑOL para la fecha y ubicación especificadas.

    Lugar: {{{location}}}
    Fecha y Hora: {{{date}}}

    Genera un pronóstico realista basado en patrones climáticos típicos de la región.

    Instrucciones para cada campo:
    - description: 2-3 palabras máximo (ej: "Parcialmente Nublado", "Sol y Nubes")
    - icon: Elige el ícono más apropiado según las condiciones
    - temperature: Temperatura en °C (realista para la ubicación y estación)
    - humidity: Humedad relativa en % (0-100)
    - windSpeed: Velocidad del viento en km/h
    - precipitation: Probabilidad de lluvia en % (0-100)
    - uvIndex: Índice UV (0-11+, típicamente 3-8 en días normales)
    - feelsLike: Sensación térmica considerando viento y humedad
    - conditions: Descripción detallada en 1-2 líneas
    - recommendation: Consejo breve específico para jugar fútbol

    Responde estrictamente en JSON siguiendo el schema.
  `,
});

export const getMatchDayForecast = ai.defineFlow(
  {
    name: 'getMatchDayForecastFlow',
    inputSchema: GetMatchDayForecastInputSchema,
    outputSchema: GetMatchDayForecastOutputSchema,
  },
  async (input) => {
    const { output } = await forecastPrompt(input, { model: 'googleai/gemini-2.5-flash'});
    if (!output) throw new Error('No se obtuvo respuesta válida del modelo.');
    return output;
  }
);
