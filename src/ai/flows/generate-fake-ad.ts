
'use server';

/**
 * @fileOverview A flow to generate a fake, humorous football-related ad.
 *
 * - generateFakeAd - A function that returns a fake ad.
 * - FakeAdOutput - The return type for the generateFakeAd function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

const FakeAdOutputSchema = z.object({
  productName: z.string().describe('The completely fictional, absurd name of the product or service.'),
  slogan: z.string().describe('A catchy, humorous, and slightly dark slogan for the product.'),
  description: z.string().describe('A short, funny description of what the product supposedly does.'),
});

export type FakeAdOutput = z.infer<typeof FakeAdOutputSchema>;

export async function generateFakeAd(): Promise<FakeAdOutput> {
  return generateFakeAdFlow();
}

const prompt = ai.definePrompt({
  name: 'generateFakeAdPrompt',
  output: { schema: FakeAdOutputSchema },
  prompt: `
    You are a cynical, dark-humored marketing creative specialized in the world of amateur football.
    Your task is to invent a completely fake, slightly absurd, and funny product or service for amateur football players and generate a short ad for it.
    The tone should be comical, with a touch of "rioplatense" dark humor.

    Think of common pains in amateur football: the player who never passes, the one who complains about everything, the terrible goalkeeper, the guy who thinks he's Messi, etc.

    Here are some examples for inspiration:
    - Product: "GPS-Balón". Slogan: "Para que el 'fominha' se dé cuenta de que hay compañeros". Description: "Un balón con GPS que grita '¡Pasala, muerto!' cada vez que un jugador lo retiene por más de 10 segundos."
    - Service: "Alibi-Crafter". Slogan: "La excusa perfecta para faltar al partido del sábado.". Description: "Generamos coartadas creíbles con certificado médico falso para que puedas evitar ese partido injugable sin quedar mal con el grupo."
    - Product: "Silbato de Autoridad Instantánea". Slogan: "Más poder que el árbitro comprado". Description: "Un silbato que emite un sonido tan irritante que detiene cualquier discusión al instante. Úselo con precaución."

    Now, generate a new, original, and funny ad concept following the specified JSON format.
  `,
});

const generateFakeAdFlow = ai.defineFlow(
  {
    name: 'generateFakeAdFlow',
    outputSchema: FakeAdOutputSchema,
  },
  async () => {
    const { output } = await prompt({}, { model: 'googleai/gemini-2.5-flash' });
    return output!;
  }
);
