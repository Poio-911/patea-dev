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
  playerId: z.string().describe('El ID del jugador para generar sugerencias.'),
  playerStats: z.object({
    matchesPlayed: z.number().describe('El número de partidos que ha jugado el jugador.'),
    goals: z.number().describe('El número de goles que ha marcado el jugador.'),
    assists: z.number().describe('El número de asistencias que ha realizado el jugador.'),
    averageRating: z.number().describe('La calificación promedio del jugador.'),
  }).describe('Las estadísticas actuales del jugador.'),
  evaluations: z.array(
    z.object({
      rating: z.number().describe('La calificación recibida por el jugador en un partido (1-10).'),
      performanceTags: z.array(z.string()).describe('Las etiquetas de rendimiento recibidas por el jugador en un partido.'),
      evaluatedBy: z.string().describe('El ID del usuario que evaluó al jugador.'),
      evaluatedAt: z.string().describe('La fecha y hora de la evaluación.'),
      matchId: z.string().describe('El ID del partido.'),
    })
  ).describe('Las evaluaciones históricas del jugador.'),
});
export type SuggestPlayerImprovementsInput = z.infer<typeof SuggestPlayerImprovementsInputSchema>;

const SuggestPlayerImprovementsOutputSchema = z.object({
  suggestions: z.array(
    z.string().describe('Una sugerencia para que el jugador mejore su rendimiento.')
  ).describe('La lista de sugerencias para el jugador.'),
});
export type SuggestPlayerImprovementsOutput = z.infer<typeof SuggestPlayerImprovementsOutputSchema>;

export async function suggestPlayerImprovements(input: SuggestPlayerImprovementsInput): Promise<SuggestPlayerImprovementsOutput> {
  return suggestPlayerImprovementsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestPlayerImprovementsPrompt',
  input: {schema: SuggestPlayerImprovementsInputSchema},
  output: {schema: SuggestPlayerImprovementsOutputSchema},
  prompt: `Eres un entrenador de fútbol profesional y estás dando consejos personalizados a un jugador amateur para que mejore. Habla en español, de forma directa y motivadora.

  Analiza las estadísticas y el historial de evaluaciones del jugador para identificar 1 o 2 áreas clave de mejora.

  Estadísticas del Jugador:
  - Partidos Jugados: {{{playerStats.matchesPlayed}}}
  - Goles: {{{playerStats.goals}}}
  - Asistencias: {{{playerStats.assists}}}
  - Calificación Promedio: {{{playerStats.averageRating}}}

  Historial de Evaluaciones Recientes:
  {{#if evaluations.length}}
    {{#each evaluations}}
    - Calificación: {{this.rating}}/10, Etiquetas: {{#if this.performanceTags.length}}{{this.performanceTags}}{{else}}Ninguna{{/if}}
    {{/each}}
  {{else}}
    - No hay datos de evaluaciones anteriores.
  {{/if}}

  Basado en estos datos, proporciona 2 o 3 sugerencias MUY CONCISAS y ACCIONABLES para que el jugador pueda mejorar. Si no hay suficientes datos (por ejemplo, menos de 2 evaluaciones), una de tus sugerencias debe ser que necesita jugar más partidos para poder tener un análisis más profundo.

  Formatea las sugerencias como una lista. No añadas introducciones ni despedidas, solo la lista de sugerencias.
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
