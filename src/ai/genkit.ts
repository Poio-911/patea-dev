import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.GOOGLE_GENAI_API_KEY!,
      defaultModel: 'gemini-1.5-flash', // o 'gemini-1.5-pro' si querés más precisión
    }),
  ],
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});