console.log("🔑 GEMINI_API_KEY:", process.env.GEMINI_API_KEY);
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [googleAI()],
});
