import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

// Next.js loads environment variables from .env.local automatically.
// No need to use dotenv/config manually.

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: "AIzaSyDDN2IFxzPbAHJRpnLUbQ6lnCFs3Ua4O-k", // Hardcoded key to fix API errors
    }),
  ],
});
