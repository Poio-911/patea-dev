'use server';

/**
 * @fileOverview A flow to generate a bizarre but real quote from a footballer.
 *
 * - generateBizarreQuote - A function that returns a quote.
 * - BizarreQuoteOutput - The return type for the generateBizarreQuote function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const BizarreQuoteOutputSchema = z.object({
  quote: z.string().describe('A real, bizarre, or funny quote from a footballer, in Spanish.'),
  author: z.string().describe("The name of the footballer who said the quote."),
});

export type BizarreQuoteOutput = z.infer<typeof BizarreQuoteOutputSchema>;

export async function generateBizarreQuote(): Promise<BizarreQuoteOutput> {
  return generateBizarreQuoteFlow();
}

const prompt = ai.definePrompt({
  name: 'bizarreQuotePrompt',
  output: { schema: BizarreQuoteOutputSchema },
  prompt: `
    Eres un historiador deportivo especializado en trivia de fútbol.
    Tu tarea es proporcionar una cita real, bizarra, divertida o extraña de un futbolista famoso (pasado o presente).

    Asegúrate de que la cita sea auténtica.

    Devuelve la cita y el nombre del autor en el formato JSON especificado y asegúrate de que la respuesta esté en español.
  `,
});

const generateBizarreQuoteFlow = ai.defineFlow(
  {
    name: 'generateBizarreQuoteFlow',
    outputSchema: BizarreQuoteOutputSchema,
  },
  async () => {
    const { output } = await prompt();
    return output!;
  }
);
