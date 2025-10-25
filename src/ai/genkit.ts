import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

// ⚙️ Configuración de Genkit
export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.GOOGLE_GENAI_API_KEY!,
    }),
  ],
});
