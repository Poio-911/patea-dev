import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { firebase } from '@genkit-ai/firebase';

// Esta configuración se aplica al entorno del servidor (Next.js server-side, Cloud Functions)
export const ai = genkit({
  plugins: [
    firebase(), // El plugin de Firebase debe ir primero
    googleAI({
      // Genkit es lo suficientemente inteligente como para usar las Credenciales por Defecto de la Aplicación
      // que se establecen al inicializar Firebase Admin con una cuenta de servicio.
      // No se necesita una clave explícita aquí cuando se ejecuta en el servidor.
      // Para desarrollo local, se tomará de la variable de entorno GOOGLE_GENAI_API_KEY si está presente.
    }),
  ],
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});
