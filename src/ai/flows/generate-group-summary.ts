
'use server';

/**
 * @fileOverview A flow to generate a summary of a group's activity.
 *
 * - generateGroupSummary - A function that returns a summary.
 * - GroupSummaryInput - The input type for the generateGroupSummary function.
 * - GroupSummaryOutput - The return type for the generateGroupSummary function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

const GroupSummaryInputSchema = z.object({
  playerCount: z.number().describe('El número total de jugadores en el grupo.'),
  upcomingMatchesCount: z.number().describe('El número de partidos programados para el futuro.'),
  topPlayer: z.object({
    name: z.string().describe('El nombre del jugador con el OVR más alto.'),
    ovr: z.number().describe('El OVR del jugador con el OVR más alto.'),
  }).optional().describe('El jugador con el OVR más alto del grupo.'),
});

export type GroupSummaryInput = z.infer<typeof GroupSummaryInputSchema>;

const GroupSummaryOutputSchema = z.object({
  summary: z.string().describe('Un resumen corto, ingenioso y en tono periodístico sobre la actualidad del grupo, en español.'),
  author: z.string().describe("La firma del 'periodista' o la fuente de la noticia (ej: 'El Analista de AFM', 'Pizarra Táctica')."),
});

export type GroupSummaryOutput = z.infer<typeof GroupSummaryOutputSchema>;

export async function generateGroupSummary(input: GroupSummaryInput): Promise<GroupSummaryOutput> {
  return generateGroupSummaryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateGroupSummaryPrompt',
  inputSchema: GroupSummaryInputSchema,
  outputSchema: GroupSummaryOutputSchema,
  prompt: `
    Eres un periodista deportivo carismático y con un gran conocimiento del fútbol amateur del Río de la Plata.
    Tu tarea es escribir un titular o un breve análisis (1-2 frases) sobre la situación actual de un grupo de fútbol.
    Sé creativo, usa un lenguaje futbolero y un tono optimista o humorístico.

    Aquí están los datos del grupo:
    - Cantidad de jugadores: {{{playerCount}}}
    - Próximos partidos: {{{upcomingMatchesCount}}}
    {{#if topPlayer}}
    - Jugador destacado: {{{topPlayer.name}}} (OVR {{{topPlayer.ovr}}})
    {{/if}}

    Basándote en estos datos, genera un análisis. Por ejemplo:
    - Si no hay partidos: "Con {{{playerCount}}} cracks en la plantilla, el mercado de pases está que arde, pero la hinchada pide fútbol. ¿Cuándo vuelve a rodar la pelota?"
    - Si hay muchos partidos: "La agenda está cargada para la banda. Con {{{upcomingMatchesCount}}} partidos en el horizonte, el DT deberá rotar la plantilla para mantener la frescura."
    - Si hay un jugador destacado: "Todos los ojos están puestos en {{{topPlayer.name}}}, la figura del equipo con {{{topPlayer.ovr}}} de OVR. ¿Podrá mantener el nivel y llevar al equipo a la gloria?"
    - Si hay pocos jugadores: "El grupo está en plena formación con {{{playerCount}}} valientes. Se buscan refuerzos para ampliar la plantilla y empezar a competir."

    Firma tu análisis con un nombre de autor o fuente creativa, como "El Pizarrón de AFM", "Crónicas de Vestuario", "El Ojo del Ascenso", o "Análisis de Entrecasa".

    Genera una nueva y original pieza de análisis en el formato JSON especificado.
  `,
});

const generateGroupSummaryFlow = ai.defineFlow(
  {
    name: 'generateGroupSummaryFlow',
    inputSchema: GroupSummaryInputSchema,
    outputSchema: GroupSummaryOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
