'use server';

/**
 * @fileOverview Analyzes free-form text evaluation and extracts attribute changes.
 *
 * - analyzeTextPerformance - A function that analyzes text and extracts attribute impacts.
 * - AnalyzeTextPerformanceInput - The input type for the function.
 * - AnalyzeTextPerformanceOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AnalyzeTextPerformanceInputSchema = z.object({
  text: z.string().min(10).max(500).describe('Free-form text describing player performance'),
  playerPosition: z.enum(['DEL', 'MED', 'DEF', 'POR']).describe('Player position'),
  playerName: z.string().describe('Player name'),
});

export type AnalyzeTextPerformanceInput = z.infer<typeof AnalyzeTextPerformanceInputSchema>;

const AttributeChangeSchema = z.object({
  attribute: z.enum(['pac', 'sho', 'pas', 'dri', 'def', 'phy']).describe('The attribute to change'),
  change: z.number().min(-3).max(3).describe('The change value (-3 to +3)'),
  reason: z.string().describe('Brief reason for this change based on the text'),
});

const AnalyzeTextPerformanceOutputSchema = z.object({
  attributeChanges: z.array(AttributeChangeSchema).min(1).max(4).describe('Attribute changes extracted from the text (1-4 changes)'),
  confidence: z.number().min(0).max(1).describe('Confidence level of the analysis'),
  summary: z.string().describe('Brief summary of the performance analysis'),
});

export type AnalyzeTextPerformanceOutput = z.infer<typeof AnalyzeTextPerformanceOutputSchema>;

export async function analyzeTextPerformance(
  input: AnalyzeTextPerformanceInput
): Promise<AnalyzeTextPerformanceOutput> {
  return analyzeTextPerformanceFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeTextPerformancePrompt',
  input: { schema: AnalyzeTextPerformanceInputSchema },
  output: { schema: AnalyzeTextPerformanceOutputSchema },
  prompt: `Eres un analista de fútbol amateur. Analiza el siguiente comentario sobre el rendimiento de {{playerName}} (posición: {{playerPosition}}) en un partido:

"{{text}}"

Basándote en este comentario, determina qué ATRIBUTOS deben cambiar y en cuánto.

Atributos disponibles:
- pac: Velocidad/Ritmo (sprints, velocidad, aceleración)
- sho: Tiro/Disparo (goles, remates, definición, potencia de tiro)
- pas: Pase (precisión de pases, visión, asistencias, distribución)
- dri: Regate/Dribling (control de balón, gambetas, habilidad técnica)
- def: Defensa (marcaje, recuperación, intercepciones, cierres)
- phy: Físico (fuerza, resistencia, aguante, duelos aéreos)

Reglas:
- Extrae entre 1 y 4 cambios de atributos
- Cada cambio debe estar entre -3 y +3
- Si el comentario menciona algo POSITIVO sobre un aspecto → cambio positivo (+1 a +3)
- Si el comentario menciona algo NEGATIVO sobre un aspecto → cambio negativo (-1 a -3)
- La intensidad depende de qué tan enfático sea el comentario:
  - "muy bueno", "excelente", "destacado" → +2 o +3
  - "bueno", "bien" → +1
  - "mal", "flojo" → -1
  - "muy mal", "pésimo", "desastroso" → -2 o -3
- Si el comentario es mixto, incluye tanto cambios positivos como negativos
- Prioriza atributos relevantes para la posición:
  - DEL: sho, dri, pac
  - MED: pas, dri, def
  - DEF: def, phy, pac
  - POR: def, phy, pas

Además, genera un resumen MUY BREVE (1 frase) del rendimiento.

Evalúa tu confianza (0 a 1): alta si el texto es claro y específico, baja si es ambiguo.`,
});

const analyzeTextPerformanceFlow = ai.defineFlow(
  {
    name: 'analyzeTextPerformanceFlow',
    inputSchema: AnalyzeTextPerformanceInputSchema,
    outputSchema: AnalyzeTextPerformanceOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input, { model: 'googleai/gemini-2.0-flash' });

    if (!output || !output.attributeChanges || output.attributeChanges.length === 0) {
      throw new Error('La IA no pudo extraer cambios de atributos del texto.');
    }

    // Clamp changes to valid range and deduplicate by attribute
    const seenAttributes = new Set<string>();
    const validChanges = output.attributeChanges
      .filter(change => {
        if (seenAttributes.has(change.attribute)) return false;
        seenAttributes.add(change.attribute);
        return true;
      })
      .map(change => ({
        ...change,
        change: Math.max(-3, Math.min(3, Math.round(change.change))),
      }));

    if (validChanges.length === 0) {
      throw new Error('No se encontraron cambios de atributos válidos.');
    }

    return {
      attributeChanges: validChanges,
      confidence: output.confidence ?? 0.5,
      summary: output.summary || 'No se pudo generar un resumen.',
    };
  }
);
