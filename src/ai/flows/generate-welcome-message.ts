'use server';

/**
 * @fileOverview A flow to generate a welcome message for a player joining a public match.
 *
 * - generateWelcomeMessage - A function that returns a welcome message.
 * - WelcomeMessageInput - The input type for the generateWelcomeMessage function.
 * - WelcomeMessageOutput - The return type for the generateWelcomeMessage function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

export const WelcomeMessageInputSchema = z.object({
  playerName: z.string().describe('The name of the player who just joined.'),
  matchTitle: z.string().describe('The title of the match.'),
  matchLocation: z.string().describe('The address where the match will be played.'),
});
export type WelcomeMessageInput = z.infer<typeof WelcomeMessageInputSchema>;

export const WelcomeMessageOutputSchema = z.object({
  welcomeMessage: z.string().describe('A warm, helpful welcome message in Spanish.'),
});
export type WelcomeMessageOutput = z.infer<typeof WelcomeMessageOutputSchema>;

export async function generateWelcomeMessage(input: WelcomeMessageInput): Promise<WelcomeMessageOutput> {
  return generateWelcomeMessageFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateWelcomeMessagePrompt',
  input: { schema: WelcomeMessageInputSchema },
  output: { schema: WelcomeMessageOutputSchema },
  prompt: `
    Eres el organizador virtual de un partido de fútbol amateur. Tu tarea es dar la bienvenida a un nuevo jugador que se ha unido a un partido público.
    Sé amable, claro y proporciona información útil. El mensaje debe estar en español.

    Datos del partido:
    - Nombre del jugador: {{{playerName}}}
    - Título del partido: {{{matchTitle}}}
    - Ubicación: {{{matchLocation}}}

    Crea un mensaje de bienvenida que incluya:
    1. Un saludo cálido y personal al jugador.
    2. Confirmación de que se ha unido al partido correcto.
    3. La dirección del partido.
    4. Un recordatorio amigable de que debe consultar al organizador sobre el costo del alquiler de la cancha o cualquier otro detalle.
    5. Anima al jugador a presentarse en el chat.

    Ejemplo de tono y estructura:
    "¡Bienvenido, {{{playerName}}}! Ya estás dentro del partido '{{{matchTitle}}}'. Nos vemos en {{{matchLocation}}}. No te olvides de coordinar con el organizador el pago de la cancha. ¡Preséntate en el chat y que ruede la pelota!"

    Ahora, genera un nuevo mensaje con la misma estructura y tono.
  `,
});

const generateWelcomeMessageFlow = ai.defineFlow(
  {
    name: 'generateWelcomeMessageFlow',
    inputSchema: WelcomeMessageInputSchema,
    outputSchema: WelcomeMessageOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
