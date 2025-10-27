'use client';

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { firebase } from '@genkit-ai/firebase';
import 'dotenv/config';

// ⚙️ Configuración de Genkit
export const ai = genkit({
  plugins: [
    googleAI({
        apiKey: process.env.GEMINI_API_KEY,
    }),
    firebase(),
  ],
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});
