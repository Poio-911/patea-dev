
import { genkit, configureGenkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { firebase } from '@genkit-ai/firebase';

// Esta configuración se aplica al entorno del servidor (Next.js server-side, Cloud Functions)
// Genkit es lo suficientemente inteligente como para usar las Credenciales por Defecto de la Aplicación
// que se establecen al inicializar Firebase Admin. No necesita una clave explícita aquí.
configureGenkit({
  plugins: [
    firebase(), // El plugin de Firebase debe ir primero
    googleAI(), // El plugin de Google AI tomará las credenciales del entorno
  ],
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});

export { genkit as ai };
