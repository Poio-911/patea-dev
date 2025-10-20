import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.GOOGLE_GENAI_API_KEY!,
      location: 'us-central1', // 🔥 obligatorio para Gemini
    }),
  ],
  logger: {
    level: 'debug', // ✅ reemplaza logLevel
    transports: ['console'], // muestra logs en consola
  },
});
