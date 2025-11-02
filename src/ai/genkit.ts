import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

// Next.js carga automáticamente .env.local y otras variables de entorno
// No es necesario usar dotenv/config manualmente

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.GOOGLE_GENAI_API_KEY,
    }),
  ],
});
