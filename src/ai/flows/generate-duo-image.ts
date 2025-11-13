
'use server';

/**
 * @fileOverview An AI flow to generate an image depicting an interaction between two players.
 *
 * - generateDuoImage - A function that returns a generated image as a data URI.
 * - GenerateDuoImageInput - The input type for the function.
 */

import { ai } from '@/ai/genkit';
import { GenerateDuoImageInputSchema, type GenerateDuoImageInput } from '@/lib/types';
import { z } from 'genkit';


export async function generateDuoImage(player1DataUri: string, player2DataUri: string, player1Name: string, player2Name: string, prompt: string): Promise<string> {
  const isIndividualImage = !player2DataUri || player1DataUri === player2DataUri;
  
  const mediaPrompts = isIndividualImage 
    ? [{ media: { url: player1DataUri, contentType: 'image/jpeg' } }]
    : [
        { media: { url: player1DataUri, contentType: 'image/jpeg' } },
        { media: { url: player2DataUri, contentType: 'image/jpeg' } }
      ];
      
  const instructionText = isIndividualImage 
    ? `
        INSTRUCCIONES PARA IMAGEN INDIVIDUAL:
        1. Identifica a la persona en la imagen de referencia (${player1Name}).
        2. Recrea su estructura facial, tono de piel y expresión para que represente claramente a la misma persona, pero como una reinterpretación natural, no una copia directa.
        3. Crea una escena de fútbol amateur siguiendo esta descripción: "${prompt}".
        4. Es FUNDAMENTAL que el rostro en la nueva escena sea claramente reconocible como el de ${player1Name} de la foto de referencia.
        5. El estilo debe ser cinematográfico y épico, con iluminación dramática y un fondo de cancha de fútbol amateur ligeramente desenfocado.
        6. La persona debe llevar una camiseta de fútbol moderna (cualquier color o diseño).
        7. La calidad de la imagen debe ser alta y realista.
        8. No incluyas texto, logos ni marcas de agua en la imagen.
      `
    : `
        INSTRUCCIONES PARA IMAGEN DE DÚOS:
        1. Identifica a las dos personas en las imágenes de referencia. La primera imagen es de ${player1Name}, la segunda es de ${player2Name}.
        2. Recrea sus estructuras faciales, tonos de piel y expresiones para que representen claramente a las mismas personas, pero como reinterpretaciones naturales, no copias directas.
        3. Crea una nueva escena de fútbol amateur siguiendo esta descripción: "${prompt}".
        4. Es FUNDAMENTAL que los rostros en la nueva escena sean claramente reconocibles como los de ${player1Name} y ${player2Name} de las fotos de referencia.
        5. El estilo debe ser cinematográfico y épico, con iluminación dramática y un fondo de cancha de fútbol amateur ligeramente desenfocado.
        6. Ambos jugadores deben llevar camisetas de fútbol modernas (cualquier color o diseño).
        7. La calidad de la imagen debe ser alta y realista.
        8. No incluyas texto, logos ni marcas de agua en la imagen.
      `;
      
  const { media } = await ai.generate({
    model: 'googleai/gemini-2.5-flash-image-preview',
    prompt: [
      ...mediaPrompts,
      { text: instructionText },
    ],
    config: {
      responseModalities: ['IMAGE'],
    },
  });

  if (!media?.url) {
    throw new Error('La IA no pudo generar la imagen.');
  }

  return media.url;
}
