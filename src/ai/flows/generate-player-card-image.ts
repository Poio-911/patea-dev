'use server';
import { ai } from '@/ai/genkit';

export async function generatePlayerCardImage(photoDataUri: string): Promise<string> {
  const { media } = await ai.generate({
    model: 'googleai/gemini-2.5-flash-image-preview',
    prompt: [
      { media: { url: photoDataUri, contentType: 'image/jpeg' } },
      {
        text: `
        Create a professional studio portrait of the same person from the reference image. 
        Recreate their facial structure, skin tone, and expression so it clearly represents the same individual, 
        but as a natural reinterpretation, not a direct copy. 
        The person should be facing forward with arms crossed, wearing a random modern football (soccer) jersey (any color or design).
        Use soft studio lighting, realistic shadows on the person only.
        The background should be a single solid random color (choose randomly from any visually appealing tones, 
        like vibrant, pastel, or neutral colors — but not pure white or pure black).
        The background must be smooth and free of gradients, patterns, shadows, or textures.
        Render as a high-resolution PNG. Avoid fake transparency, borders, frames, text, or watermarks.
        `,
      },
    ],
    config: {
      responseModalities: ['IMAGE'],
    },
  });

  if (!media?.url) {
    throw new Error('La IA no pudo generar la imagen.');
  }

  return media.url; // Retorna la URL de la imagen generada
}
