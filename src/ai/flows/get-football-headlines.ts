
'use server';

/**
 * @fileOverview A flow to generate recent football headlines.
 *
 * - getFootballHeadlines - A function that returns a list of headlines.
 * - FootballHeadlinesOutput - The return type for the getFootballHeadlines function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

const FootballHeadlineSchema = z.object({
  title: z.string().describe('The headline of the news story.'),
  summary: z.string().describe('A one-sentence summary of the news.'),
  source: z.string().describe('The fictional source of the news (e.g., "Diario Deportivo", "Ovación Digital").'),
});

export type FootballHeadline = z.infer<typeof FootballHeadlineSchema>;

const FootballHeadlinesOutputSchema = z.object({
  headlines: z.array(FootballHeadlineSchema).describe('A list of 3-4 recent football headlines.'),
});

export type FootballHeadlinesOutput = z.infer<typeof FootballHeadlinesOutputSchema>;

export async function getFootballHeadlines(): Promise<FootballHeadlinesOutput> {
  return getFootballHeadlinesFlow();
}

const prompt = ai.definePrompt({
  name: 'footballHeadlinesPrompt',
  outputSchema: FootballHeadlinesOutputSchema,
  prompt: `
    Eres un periodista deportivo de un importante diario del Río de la Plata.
    Tu tarea es generar 3 o 4 titulares de noticias de fútbol que parezcan recientes y relevantes.

    Las noticias deben centrarse en el fútbol uruguayo (Campeonato Uruguayo, selección nacional) y también pueden incluir noticias importantes del fútbol sudamericano (Copa Libertadores, Copa Sudamericana) o de jugadores uruguayos en Europa.

    Para cada noticia, proporciona:
    1. Un titular corto y llamativo.
    2. Un resumen de una sola frase.
    3. Una fuente ficticia (ej: "Diario El Observador", "Referí", "Ovación Digital", "Fútbol.uy").

    Asegúrate de que la respuesta sea un JSON válido que se ajuste al esquema proporcionado.
  `,
});

const getFootballHeadlinesFlow = ai.defineFlow(
  {
    name: 'getFootballHeadlinesFlow',
    outputSchema: FootballHeadlinesOutputSchema,
  },
  async () => {
    const { output } = await prompt();
    return output!;
  }
);
