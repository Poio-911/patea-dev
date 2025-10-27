'use client';

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { firebase } from '@genkit-ai/firebase';
import 'dotenv/config';

// ⚙️ Configuración de Genkit
export const ai = genkit({
  plugins: [
    // El plugin de Google AI se inicializa sin apiKey para usar las 
    // credenciales del entorno (Application Default Credentials), 
    // lo que soluciona los errores de refresco de token.
    googleAI(),
    firebase(),
  ],
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});
