
'use server';

/**
 * @fileOverview An AI flow to analyze and summarize a player's OVR progression and performance history.
 *
 * - analyzePlayerProgression - A function that returns a detailed analysis of a player's performance trajectory.
 * - AnalyzePlayerProgressionInput - The input type for the function.
 * - AnalyzePlayerProgressionOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const OvrHistoryEntrySchema = z.object({
  date: z.string().describe('Fecha del cambio de OVR.'),
  newOVR: z.number().describe('El nuevo OVR después del partido.'),
  change: z.number().describe('El cambio (+/-) en el OVR en ese partido.'),
});

const RecentEvaluationSchema = z.object({
  matchDate: z.string().describe('Fecha del partido.'),
  rating: z.number().optional().describe('Calificación recibida (1-10).'),
  performanceTags: z.array(z.string()).optional().describe('Etiquetas de rendimiento recibidas.'),
  goals: z.number().optional().describe('Goles marcados en el partido.'),
  assists: z.number().optional().describe('Asistencias realizadas en el partido.'),
  personalChronicle: z.string().optional().describe('Crónica personal escrita por el jugador sobre su rendimiento.'),
  peerFeedbackSummary: z.string().optional().describe('Resumen de comentarios de texto recibidos de compañeros.'),
});

const AnalyzePlayerProgressionInputSchema = z.object({
  playerName: z.string().describe('El nombre del jugador.'),
  ovrHistory: z.array(OvrHistoryEntrySchema).describe('El historial de cambios en el OVR del jugador.'),
  recentEvaluations: z.array(RecentEvaluationSchema).describe('Las evaluaciones de los últimos partidos.'),
});
export type AnalyzePlayerProgressionInput = z.infer<typeof AnalyzePlayerProgressionInputSchema>;


const AnalyzePlayerProgressionOutputSchema = z.object({
  summary: z.string().describe('Un resumen general y conciso de la trayectoria del jugador.'),
  positiveTrends: z.array(z.string()).describe('Una lista de 2-3 patrones positivos observados en el rendimiento.'),
  areasForImprovement: z.array(z.string()).describe('Una lista de 2-3 áreas concretas donde el jugador puede mejorar.'),
});
export type AnalyzePlayerProgressionOutput = z.infer<typeof AnalyzePlayerProgressionOutputSchema>;


export async function analyzePlayerProgression(input: AnalyzePlayerProgressionInput): Promise<AnalyzePlayerProgressionOutput> {
  return analyzePlayerProgressionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzePlayerProgressionPrompt',
  input: { schema: AnalyzePlayerProgressionInputSchema },
  output: { schema: AnalyzePlayerProgressionOutputSchema },
  prompt: `
    Sos un analista de datos deportivos de primer nivel, especializado en fútbol amateur. Tu tono es profesional pero cercano, como el de un scout que le presenta un informe al DT. Usá español rioplatense.

    Tu tarea es analizar el historial de rendimiento de {{playerName}} y generar un informe de progresión.

    DATOS DISPONIBLES:
    Historial de OVR:
    {{#each ovrHistory}}
    - Fecha: {{this.date}}, Nuevo OVR: {{this.newOVR}} (Cambio: {{this.change}})
    {{/each}}

    Evaluaciones Recientes:
    {{#each recentEvaluations}}
    - Partido del {{this.matchDate}}: 
      {{#if this.rating}}Rating: {{this.rating}}/10.{{/if}}
      Goles: {{this.goals}}, Asistencias: {{this.assists}}.
      Tags: {{#if this.performanceTags}}{{this.performanceTags}}{{else}}Ninguna{{/if}}.
      {{#if this.personalChronicle}}Autocrítica: "{{this.personalChronicle}}"{{/if}}
      {{#if this.peerFeedbackSummary}}Comentarios de compañeros: "{{this.peerFeedbackSummary}}"{{/if}}
    {{/each}}

    INSTRUCCIONES:
    1.  **Resumen General:** Empezá con un párrafo corto que resuma la trayectoria general del jugador. ¿Está en una racha positiva? ¿Es irregular? ¿Viene de un bajón?
    2.  **Tendencias Positivas:** Identificá 2 o 3 patrones positivos. Basate en los datos (OVR, Goles, Asistencias, Comentarios):
        - Si tiene muchas asistencias, destacan su generosidad o visión.
        - Si su autocrítica coincide con las mejoras, valora su mentalidad.
        - Ejemplo: "Muestra una notable mejora en su definición, reflejada en sus 3 goles recenties y etiquetas 'La Colgó del Ángulo'."
    3.  **Áreas de Mejora:** Identificá 2 o 3 áreas donde podría mejorar. Sé constructivo.
        - Contrastá su autocrítica con la realidad si es necesario.
        - Ejemplo: "Aunque su autocrítica menciona cansancio, los compañeros destacan su entrega ('Correcaminos'). Quizás deba dosificar mejor su energía."
    
    Sé específico y conectá los datos (cambios de OVR, etiquetas, estadísticas) con tus conclusiones. No inventes información. Si no hay suficientes datos, mencionalo.
    Devolvé tu análisis en formato JSON.
  `,
});

const analyzePlayerProgressionFlow = ai.defineFlow(
  {
    name: 'analyzePlayerProgressionFlow',
    inputSchema: AnalyzePlayerProgressionInputSchema,
    outputSchema: AnalyzePlayerProgressionOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input, { model: 'googleai/gemini-2.0-flash' });
    if (!output) {
      throw new Error('La IA no pudo generar el análisis de progresión.');
    }
    return output;
  }
);
