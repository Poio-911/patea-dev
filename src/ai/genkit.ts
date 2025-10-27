import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

// Esta configuración se aplica al entorno del servidor (Next.js server-side, Cloud Functions)
// Genkit es lo suficientemente inteligente como para usar las Credenciales por Defecto de la Aplicación
// cuando se ejecuta en un entorno de Google Cloud, por lo que no es necesario pasar una API key explícita.
export const ai = genkit({
  plugins: [
    googleAI(),
  ],
});
