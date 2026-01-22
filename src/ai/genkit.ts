
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

// Deshabilitar completamente el servidor de reflexión de Genkit y la conexión al emulador
// Usamos notación de corchetes para evitar que Next.js reemplace las variables en tiempo de compilación
// lo que causaría errores de "Invalid left-hand side in assignment"
process.env['GENKIT_ENV'] = 'prod';
process.env['GENKIT_REFLECTION'] = 'false';
process.env['GENKIT_URL'] = '';
process.env['GENKIT_HOST'] = '';
process.env['GENKIT_PORT'] = '';

// Validate required API key (Next.js loads .env.local for server automatically)
const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error(
    'Falta la API key de Google Gemini. Configurá GOOGLE_GENAI_API_KEY o GEMINI_API_KEY en .env.local (no se expone al cliente).'
  );
}

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey,
    }),
  ],
});
