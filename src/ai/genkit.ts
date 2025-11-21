
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { config } from 'dotenv';

// Cargar variables de entorno desde .env
config({ path: './.env' });

// Deshabilitar completamente el servidor de reflexión de Genkit y la conexión al emulador
// Usamos notación de corchetes para evitar que Next.js reemplace las variables en tiempo de compilación
// lo que causaría errores de "Invalid left-hand side in assignment"
process.env['GENKIT_ENV'] = 'prod';
process.env['GENKIT_REFLECTION'] = 'false';
process.env['GENKIT_URL'] = '';
process.env['GENKIT_HOST'] = '';
process.env['GENKIT_PORT'] = '';

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.GOOGLE_GENAI_API_KEY || "AIzaSyDDN2IFxzPbAHJRpnLUbQ6lnCFs3Ua4O-k",
    }),
  ],
});
