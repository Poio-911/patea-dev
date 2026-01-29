'use server';

/**
 * @fileOverview Group summary generation AI agent.
 *
 * - generateGroupSummary - A function that generates a descriptive summary of a group.
 * - GenerateGroupSummaryInput - The input type for the generateGroupSummary function.
 * - GenerateGroupSummaryOutput - The return type for the generateGroupSummary function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateGroupSummaryInputSchema = z.object({
  groupName: z.string().describe('El nombre del grupo'),
  memberCount: z.number().describe('Cantidad de miembros en el grupo'),
  topPlayers: z.array(
    z.object({
      name: z.string().describe('Nombre del jugador'),
      ovr: z.number().describe('OVR del jugador'),
      position: z.string().describe('Posición del jugador (DEL, MED, DEF, POR)'),
    })
  ).describe('Los mejores jugadores del grupo'),
  totalMatches: z.number().describe('Total de partidos jugados por el grupo'),
  groupStats: z.object({
    totalGoals: z.number().describe('Total de goles anotados en el grupo'),
    averageOVR: z.number().describe('OVR promedio del grupo'),
  }).describe('Estadísticas generales del grupo'),
});
export type GenerateGroupSummaryInput = z.infer<typeof GenerateGroupSummaryInputSchema>;

const GenerateGroupSummaryOutputSchema = z.object({
  summary: z.string().describe('Párrafo descriptivo del grupo'),
});
export type GenerateGroupSummaryOutput = z.infer<typeof GenerateGroupSummaryOutputSchema>;

export async function generateGroupSummary(input: GenerateGroupSummaryInput): Promise<GenerateGroupSummaryOutput> {
  return generateGroupSummaryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateGroupSummaryPrompt',
  input: {schema: GenerateGroupSummaryInputSchema},
  output: {schema: GenerateGroupSummaryOutputSchema},
  prompt: `Sos un redactor deportivo que escribe resúmenes de grupos de fútbol amateur. Habla en español rioplatense.
Genera un párrafo breve y atractivo (2-3 oraciones) que describa al grupo.

DATOS DEL GRUPO:
- Nombre: {{groupName}}
- Miembros: {{memberCount}}
- Partidos jugados: {{totalMatches}}
- Goles totales: {{groupStats.totalGoals}}
- OVR promedio: {{groupStats.averageOVR}}

{{#if topPlayers.length}}
MEJORES JUGADORES:
{{#each topPlayers}}
- {{this.name}} ({{this.position}}, OVR {{this.ovr}})
{{/each}}
{{/if}}

INSTRUCCIONES:
- Escribí un resumen corto y enganchador del grupo
- Mencioná el nivel competitivo según el OVR promedio
- Si hay jugadores destacados, mencioná 1 o 2
- Incluí un dato sobre la actividad (partidos, goles)
- Usá un tono positivo y motivador
- NO uses listas, escribí en prosa fluida
- Máximo 3 oraciones

Respondé solo con el JSON del summary.
`,
});

const generateGroupSummaryFlow = ai.defineFlow(
  {
    name: 'generateGroupSummaryFlow',
    inputSchema: GenerateGroupSummaryInputSchema,
    outputSchema: GenerateGroupSummaryOutputSchema,
  },
  async input => {
    const {output} = await prompt(input, {model: 'googleai/gemini-2.5-flash'});
    return output!;
  }
);
