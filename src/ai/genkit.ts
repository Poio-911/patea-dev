'use server';

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

// Next.js loads environment variables from .env.local automatically.
// No need to use dotenv/config manually.

export const ai = genkit({
  plugins: [
    googleAI({
      // The API key is now read from the environment variable set in apphosting.yaml
      // or your local .env.local file. This file runs on the server, so it can access
      // server-side environment variables.
      apiKey: process.env.GOOGLE_GENAI_API_KEY,
    }),
  ],
});
