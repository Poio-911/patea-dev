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
  quote: z.string().describe('A real, bizarre, or funny quote from a footballer.'),
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
    You are a sports historian specializing in football trivia.
    Your task is to provide one real, bizarre, funny, or weird quote from a famous footballer (past or present).

    Ensure the quote is authentic.

    Return the quote and the author's name in the specified JSON format.
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
