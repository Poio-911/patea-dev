import { ai } from '@/ai/genkit';
import { getCachedOrGenerate, generateCacheKey } from '@/lib/ai-cache';
import { withTimeout } from '@/ai/ai-utils';

export async function generatePlayerCardImage(photoDataUri: string): Promise<string> {
  // Generate cache key from photo URI
  const cacheKey = generateCacheKey({ photoDataUri });

  // Use cache with 24-hour TTL (image generation is very expensive)
  const imageUrl = await getCachedOrGenerate(
    cacheKey,
    async () => {
      const { media } = await withTimeout(
        ai.generate({
          model: 'googleai/gemini-2.0-flash-exp',
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
        }),
        25_000
      );

      if (!media?.url) {
        throw new Error('La IA no pudo generar la imagen.');
      }

      return media.url;
    },
    { ttlHours: 24, category: 'card-image-generation' }
  );

  return imageUrl;
}
