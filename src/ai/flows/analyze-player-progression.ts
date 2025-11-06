
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

    Evaluaciones Recientes (con etiquetas de rendimiento):
    {{#each recentEvaluations}}
    - Partido del {{this.matchDate}}: {{#if this.rating}}Rating {{this.rating}}/10.{{/if}} Tags: {{#if this.performanceTags}}{{this.performanceTags}}{{else}}Ninguna{{/if}}.
    {{/each}}

    INSTRUCCIONES:
    1.  **Resumen General:** Empezá con un párrafo corto que resuma la trayectoria general del jugador. ¿Está en una racha positiva? ¿Es irregular? ¿Viene de un bajón?
    2.  **Tendencias Positivas:** Identificá 2 o 3 patrones positivos. Basate en los datos. Por ejemplo:
        - "Muestra una notable mejora en su definición, como lo demuestran las etiquetas 'La Colgó del Ángulo' en sus últimos partidos, lo que se refleja en su subida de OVR."
        - "Su consistencia es su mayor fuerte. Mantiene un OVR estable y rara vez recibe etiquetas negativas."
    3.  **Áreas de Mejora:** Identificá 2 o 3 áreas donde podría mejorar. Sé constructivo. Por ejemplo:
        - "Si bien su defensa es sólida, las etiquetas 'Pase al Rival' sugieren que debe trabajar en la precisión de la salida desde el fondo."
        - "Parece tener un bajón físico en los segundos tiempos, evidenciado por las etiquetas 'Se Cansó'. Mejorar la resistencia podría evitar esas caídas de OVR."
    
    Sé específico y conectá los datos (cambios de OVR, etiquetas) con tus conclusiones. No inventes información. Si no hay suficientes datos, mencionalo.
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
    const { output } = await prompt(input, { model: 'googleai/gemini-2.5-flash' });
    if (!output) {
      throw new Error('La IA no pudo generar el análisis de progresión.');
    }
    return output;
  }
);
