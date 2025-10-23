import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import 'dotenv/config';

// Explicitly read the API key from environment variables.
const apiKey = process.env.GOOGLE_GENAI_API_KEY;

// Check if the API key is available. If not, throw a configuration error.
if (!apiKey) {
  throw new Error("GOOGLE_GENAI_API_KEY is not defined in the environment. Please set it in your .env file.");
}

// Configure Genkit with the Google AI plugin and the API key.
export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: apiKey,
    }),
  ],
});
