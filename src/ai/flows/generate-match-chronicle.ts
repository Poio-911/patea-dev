// NOTE: Removed 'use server' directive.
// This file defines AI flow utilities and exports non-async objects (schemas, prompt definitions).
// Using 'use server' here triggers Next.js server action validation which requires only async function exports,
// causing the runtime error: "A 'use server' file can only export async functions, found object.".
// Server actions that call this flow (e.g. generateMatchChronicleAction) reside in a proper 'use server' file.

/**
 * @fileOverview An AI flow to generate a journalistic chronicle of a football match.
 *
 * - generateMatchChronicle - A function that returns a match summary in a "minute by minute" style.
 * - GenerateMatchChronicleInput - The input type for the function.
 * - GenerateMatchChronicleOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const KeyEventSchema = z.object({
  minute: z.number().describe("Minuto aproximado del evento (e.g., 15, 40, 75)."),
  type: z.enum(['Goal', 'Assist', 'Save', 'KeyDefensivePlay', 'KeyPlay']).describe("Tipo de evento."),
  playerName: z.string().describe("Nombre del jugador protagonista."),
  description: z.string().describe("Descripción de la acción basada en su etiqueta de rendimiento (e.g., 'Definió como los dioses', 'Cierre providencial')."),
  relatedPlayerName: z.string().optional().describe("Nombre de un segundo jugador involucrado (e.g., el asistidor)."),
});

const GenerateMatchChronicleInputSchema = z.object({
  matchTitle: z.string().describe("Título del partido."),
  team1Name: z.string().describe("Nombre del Equipo 1."),
  team1Score: z.number().describe("Goles del Equipo 1."),
  team2Name: z.string().describe("Nombre del Equipo 2."),
  team2Score: z.number().describe("Goles del Equipo 2."),
  keyEvents: z.array(KeyEventSchema).describe("Lista de 3 a 5 eventos clave del partido."),
  mvp: z.object({
    name: z.string(),
    reason: z.string(),
  }).describe("El Jugador Más Valioso (MVP) y la razón."),
});
export type GenerateMatchChronicleInput = z.infer<typeof GenerateMatchChronicleInputSchema>;

const GenerateMatchChronicleOutputSchema = z.object({
  headline: z.string().describe("Un titular periodístico y llamativo para la crónica."),
  introduction: z.string().describe("Un párrafo introductorio que resume el partido y el resultado final."),
  keyMoments: z.array(
    z.object({
      minute: z.string().describe("El minuto del evento, en formato 'Min XX'."),
      event: z.string().describe("La descripción del evento clave, narrado en estilo de relator de fútbol."),
    })
  ).describe("Una lista de los 3-4 momentos más importantes del partido."),
  conclusion: z.string().describe("Un párrafo final que resume el partido y nombra al MVP."),
});
export type GenerateMatchChronicleOutput = z.infer<typeof GenerateMatchChronicleOutputSchema>;

const prompt = ai.definePrompt({
  name: 'generateMatchChroniclePrompt',
  input: { schema: GenerateMatchChronicleInputSchema },
  output: { schema: GenerateMatchChronicleOutputSchema },
  prompt: `
    Sos un cronista deportivo del Río de la Plata, como Victor Hugo Morales o el Bambino Pons. Tu tarea es escribir una crónica emocionante, estilo "minuto a minuto", para un partido de fútbol amateur. Usá un lenguaje apasionado y futbolero.

    DATOS DEL PARTIDO:
    - Partido: {{matchTitle}}
    - Resultado: {{team1Name}} {{team1Score}} - {{team2Score}} {{team2Name}}
    - MVP: {{mvp.name}} ({{mvp.reason}})

    EVENTOS CLAVE DEL PARTIDO:
    {{#each keyEvents}}
    - Minuto aproximado {{this.minute}}': {{this.playerName}} - {{this.description}} {{#if this.relatedPlayerName}} (asistido por {{this.relatedPlayerName}}){{/if}}
    {{/each}}

    INSTRUCCIONES:
    1.  **Titular:** Escribí un titular corto, potente y periodístico.
    2.  **Introducción:** Redactá un párrafo inicial que presente el partido y el resultado final, dándole un poco de color.
    3.  **Momentos Clave:** Elegí los 3 o 4 eventos más importantes de la lista y narralos como si estuvieras en una transmisión de radio. Empezá cada uno con el minuto (ej: "Min 15': ¡GOLAZO!"). Usá la descripción del evento para darle vida al relato.
    4.  **Conclusión:** Terminá con un párrafo que resuma el partido y confirme al MVP.

    IMPORTANTE: No inventes eventos. Sé creativo con la redacción pero basate estrictamente en los datos provistos. La respuesta debe ser un JSON válido.
  `,
});

export const generateMatchChronicleFlow = ai.defineFlow(
  {
    name: 'generateMatchChronicleFlow',
    inputSchema: GenerateMatchChronicleInputSchema,
    outputSchema: GenerateMatchChronicleOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input, { model: 'googleai/gemini-2.5-flash' });
    if (!output) {
      throw new Error('La IA no pudo generar la crónica del partido.');
    }
    return output;
  }
);
