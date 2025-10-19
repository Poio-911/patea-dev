'use server';
import { ai } from '@/ai/genkit';

export async function generatePlayerCardImage(photoDataUri: string): Promise<string> {
    const { media } = await ai.generate({
        model: 'googleai/gemini-2.5-flash-image-preview',
        prompt: [
          { media: { url: photoDataUri, contentType: 'image/jpeg' } },
          { text: 'Generate a professional studio portrait of the same person from the reference image. Preserve the person’s distinct facial features, expression, and skin tone, so it’s clearly the same individual — but recreate the portrait naturally, not by copying the photo directly. The person should be facing forward with arms crossed, in a confident, professional posture as if posing for a corporate or studio headshot. Use soft, balanced studio lighting, sharp focus, and photorealistic quality. The background must be completely transparent (alpha channel). Export the image as a high-resolution PNG with transparent background.' },
        ],
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
          negativePrompt: 'blurry, distorted face, disfigured, bad lighting, low quality, duplicate, unnatural proportions, cartoon, overexposed, watermark, compression artifacts, background, shadows, jpeg artifacts'
        },
    });

    if (!media?.url) {
        throw new Error('La IA no pudo generar la imagen.');
    }

    return media.url; // Retorna el data URI de la imagen generada
}
