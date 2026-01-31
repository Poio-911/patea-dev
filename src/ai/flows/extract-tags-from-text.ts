'use server';

/**
 * @fileOverview Extracts performance tags from free-form text evaluation.
 *
 * - extractTagsFromText - A function that analyzes text and extracts matching tags.
 * - ExtractTagsFromTextInput - The input type for the extractTagsFromText function.
 * - ExtractTagsFromTextOutput - The return type for the extractTagsFromText function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ExtractTagsFromTextInputSchema = z.object({
  text: z.string().min(10).max(500).describe('Free-form text describing player performance'),
  playerPosition: z.enum(['DEL', 'MED', 'DEF', 'POR']).describe('Player position'),
  playerName: z.string().describe('Player name'),
  availableTags: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      impact: z.enum(['positive', 'negative', 'neutral']),
    })
  ).describe('Available tags for this position'),
});

export type ExtractTagsFromTextInput = z.infer<typeof ExtractTagsFromTextInputSchema>;

const ExtractTagsFromTextOutputSchema = z.object({
  extractedTagIds: z.array(z.string()).min(1).max(5).describe('IDs of extracted tags'),
  confidence: z.number().min(0).max(1).describe('Confidence level of extraction'),
  reasoning: z.string().optional().describe('Brief explanation of why these tags were selected'),
  summary: z.string().optional().describe('Short summary of attributes impacted based on the description'),
});

export type ExtractTagsFromTextOutput = z.infer<typeof ExtractTagsFromTextOutputSchema>;

export async function extractTagsFromText(
  input: ExtractTagsFromTextInput
): Promise<ExtractTagsFromTextOutput> {
  return extractTagsFromTextFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractTagsFromTextPrompt',
  input: { schema: ExtractTagsFromTextInputSchema },
  output: { schema: ExtractTagsFromTextOutputSchema },
  prompt: `Eres un analista de fútbol amateur. Analiza el siguiente comentario sobre el rendimiento de {{playerName}} (posición: {{playerPosition}}) en un partido:

"{{text}}"

Basándote en este comentario, selecciona las etiquetas más relevantes de la siguiente lista. Solo puedes seleccionar etiquetas que existan en esta lista:

{{#each availableTags}}
- ID: {{this.id}} | Nombre: {{this.name}} | Descripción: {{this.description}} | Impacto: {{this.impact}}
{{/each}}

Reglas:
- Selecciona entre 1 y 5 etiquetas que mejor reflejen el comentario
- Prioriza etiquetas que coincidan con acciones específicas mencionadas
- Si el comentario es positivo, prioriza tags con impact="positive"
- Si el comentario es negativo, prioriza tags con impact="negative"
- Si el comentario menciona tanto aspectos positivos como negativos, incluye etiquetas de ambos tipos
 - Si el comentario menciona aspectos negativos claros (p. ej., errores, falta de marca, imprecisiones), asegúrate de incluir AL MENOS UNA etiqueta con impact="negative"
- Si no hay etiquetas exactas, selecciona las más cercanas conceptualmente
- Evalúa tu confianza en la selección (0 a 1): alta si las acciones descritas coinciden claramente, baja si tuviste que inferir mucho

Además, genera un resumen MUY BREVE (1–2 frases) indicando qué atributos se verían afectados (ej.: “+PAS y +DRI; −DEF” o “Mejoró el tiro, bajó la precisión de pase”).

Responde con los IDs de las etiquetas seleccionadas, tu nivel de confianza, una breve explicación opcional, y el resumen corto.`,
});

const extractTagsFromTextFlow = ai.defineFlow(
  {
    name: 'extractTagsFromTextFlow',
    inputSchema: ExtractTagsFromTextInputSchema,
    outputSchema: ExtractTagsFromTextOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input, { model: 'googleai/gemini-2.0-flash' });

    if (!output || !output.extractedTagIds || output.extractedTagIds.length === 0) {
      throw new Error('La IA no pudo extraer etiquetas del texto.');
    }

    // Filter to only include valid tag IDs
    const validTagIds = input.availableTags.map(t => t.id);
    const filteredTagIds = output.extractedTagIds.filter(id => validTagIds.includes(id));

    if (filteredTagIds.length === 0) {
      throw new Error('No se encontraron etiquetas válidas en la respuesta.');
    }

    return {
      extractedTagIds: filteredTagIds,
      confidence: output.confidence ?? 0.5,
      reasoning: output.reasoning,
      summary: output.summary,
    };
  }
);
