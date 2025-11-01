'use client';
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

// Cargar variables de entorno desde .env
// config({ path: './.env' });
console.log(process.env.NODE_ENV, 'key', process.env.GOOGLE_GENAI_API_KEY);

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: "AIzaSyDDN2IFxzPbAHJRpnLUbQ6lnCFs3Ua4O-k",
    }),
  ],
});
