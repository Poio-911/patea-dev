
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
  prompt: `Eres un DT de fútbol profesional, directo y motivador. Habla en español rioplatense.
  Analiza los datos del jugador y da 2 o 3 consejos MUY CONCISOS y accionables para que mejore.

  DATOS:
  - Partidos: {{{playerStats.matchesPlayed}}}, Goles: {{{playerStats.goals}}}, Rating Promedio: {{{playerStats.averageRating}}}
  - Evaluaciones:
  {{#if evaluations.length}}
    {{#each evaluations}}
    - Rating: {{this.rating}}/10, Tags: {{#if this.performanceTags.length}}{{this.performanceTags}}{{else}}Ninguna{{/if}}
    {{/each}}
  {{else}}
    - Sin datos de evaluaciones.
  {{/if}}

  Si no hay suficientes datos (menos de 2 evaluaciones), uno de tus consejos debe ser que juegue más partidos para tener un mejor análisis.
  Sé directo. No uses introducciones ni despedidas, solo la lista de sugerencias en formato JSON.
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
