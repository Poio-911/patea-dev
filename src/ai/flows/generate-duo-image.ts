'use server';

/**
 * @fileOverview An AI flow to generate an image depicting an interaction between two players.
 *
 * - generateDuoImage - A function that returns a generated image as a data URI.
 * - GenerateDuoImageInput - The input type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

export const GenerateDuoImageInputSchema = z.object({
  player1Photo: z.string().describe("Data URI de la foto del primer jugador."),
  player1Name: z.string().describe("Nombre del primer jugador."),
  player2Photo: z.string().describe("Data URI de la foto del segundo jugador."),
  player2Name: z.string().describe("Nombre del segundo jugador."),
  prompt: z.string().describe("La instrucción que describe la escena a generar entre los dos jugadores."),
});
export type GenerateDuoImageInput = z.infer<typeof GenerateDuoImageInputSchema>;

export async function generateDuoImage(input: GenerateDuoImageInput): Promise<string> {
  const { media } = await ai.generate({
    model: 'googleai/gemini-2.5-flash-image-preview',
    prompt: [
      { media: { url: input.player1Photo, contentType: 'image/jpeg' } },
      { media: { url: input.player2Photo, contentType: 'image/jpeg' } },
      { text: `
        INSTRUCCIONES:
        1. Identifica a las dos personas en las imágenes de referencia. La primera imagen es de ${input.player1Name}, la segunda es de ${input.player2Name}.
        2. Crea una nueva escena de fútbol amateur siguiendo esta descripción: "${input.prompt}".
        3. Es FUNDAMENTAL que los rostros en la nueva escena sean claramente reconocibles como los de ${input.player1Name} y ${input_player2Name} de las fotos de referencia.
        4. El estilo debe ser cinematográfico y épico, con iluminación dramática y un fondo de cancha de fútbol amateur ligeramente desenfocado.
        5. La calidad de la imagen debe ser alta.
        6. No incluyas texto, logos ni marcas de agua en la imagen.
      `},
    ],
    config: {
      responseModalities: ['IMAGE'],
    },
  });

  if (!media?.url) {
    throw new Error('La IA no pudo generar la imagen de la dupla.');
  }

  return media.url;
}
