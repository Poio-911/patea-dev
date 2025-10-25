'use server';
import { ai } from '@/ai/genkit';

export async function generatePlayerCardImage(photoDataUri: string): Promise<string> {
    const { media } = await ai.generate({
        model: 'googleai/gemini-1.5-flash-image-preview', // Reverted to the older, more compatible model name as per further analysis
        prompt: [
          { media: { url: photoDataUri, contentType: 'image/jpeg' } },
          { text: 'Toma a la persona de esta foto y transfórmala en un retrato de estudio profesional, al estilo de una carta de jugador de fútbol. Agrega un fondo de estadio desenfocado, iluminación dramática y un estilo artístico vibrante, como en las cartas de FC24. Mantén los rasgos faciales del jugador. Asegúrate de que el resultado sea una imagen de alta calidad.' },
        ],
        config: {
          responseModalities: ['IMAGE']
        },
    });

    if (!media?.url) {
        throw new Error('La IA no pudo generar la imagen.');
    }

    return media.url;
}
