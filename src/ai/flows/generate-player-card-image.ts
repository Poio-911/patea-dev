'use server';
import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';

export async function generatePlayerCardImage(photoDataUri: string): Promise<string> {
    const { media } = await ai.generate({
        model: googleAI('gemini-1.5-flash'),
        prompt: [
          { media: { url: photoDataUri, contentType: 'image/jpeg' } },
          { text: 'Create a professional studio portrait of the same person from the reference image. Recreate their facial structure, skin tone, and expression so it clearly represents the same individual, but as a natural reinterpretation, not a direct copy. The person should be facing forward with arms crossed, wearing a random modern football (soccer) jersey (any color or design). Use soft studio lighting, realistic shadows on the person only, and no visible background. Render with an actual transparent background (alpha channel) — not simulated transparency — and export as a real PNG with alpha channel. There must be no white, gray, black, or colored backdrop, and no shadows extending outside the person. The final output must be a high-resolution PNG with a real transparent background.' },
        ],
        config: {
          responseModalities: ['IMAGE'],
          negativePrompt: 'solid background, fake transparency, white background, black background, gray background, colored backdrop, halo, glow, frame, floor, shadow on background, border, watermark, text, blur, low quality'
        },
    });

    if (!media?.url) {
        throw new Error('La IA no pudo generar la imagen.');
    }

    return media.url; // Retorna el data URI de la imagen generada
}
