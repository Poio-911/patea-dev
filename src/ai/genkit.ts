
import { genkit, Genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

// Deshabilitar completamente el servidor de reflexión de Genkit y la conexión al emulador
// Usamos notación de corchetes para evitar que Next.js reemplace las variables en tiempo de compilación
// lo que causaría errores de "Invalid left-hand side in assignment"
process.env['GENKIT_ENV'] = 'prod';
process.env['GENKIT_REFLECTION'] = 'false';
process.env['GENKIT_URL'] = '';
process.env['GENKIT_HOST'] = '';
process.env['GENKIT_PORT'] = '';

// Lazy initialization - solo crear instancia cuando se use
// Esto evita errores de build cuando la API key no está disponible
let _ai: Genkit | null = null;

export function getAI(): Genkit {
  if (_ai) return _ai;

  const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      'Falta la API key de Google Gemini. Configurá GOOGLE_GENAI_API_KEY o GEMINI_API_KEY en .env.local (no se expone al cliente).'
    );
  }

  try {
    _ai = genkit({
      plugins: [googleAI({ apiKey })],
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[Genkit] Failed to initialize:', msg);
    throw error;
  }

  return _ai;
}

// Proxy para mantener compatibilidad con imports existentes de `ai`
// El Proxy delega todas las operaciones a la instancia lazy de Genkit
export const ai = new Proxy({} as Genkit, {
  get(_, prop) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (getAI() as any)[prop];
  },
});
