
'use server';

/**
 * @fileOverview An AI flow to generate a journalistic chronicle of a football match.
 * This file is marked as 'use server' and should only export async functions.
 * The Zod schemas for input/output are defined in 'src/lib/types.ts' to avoid build errors.
 */

import { ai } from '@/ai/genkit';
import { GenerateMatchChronicleInputSchema, GenerateMatchChronicleOutputSchema, type GenerateMatchChronicleInput } from '@/lib/types';

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

// Wrapper async function to be called from server actions
export async function generateMatchChronicle(input: GenerateMatchChronicleInput) {
    return await generateMatchChronicleFlow(input);
}
