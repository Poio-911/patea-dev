import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { analyzeTextPerformanceCore } from '../lib/text-performance-analyzer';

/**
 * Callable para previsualizar el impacto en atributos a partir de una reseña
 * escrita por el evaluador. Usa Vertex AI Flash-Lite.
 */
export const analyzeTextPerformance = onCall(
  { region: 'us-central1', timeoutSeconds: 60 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Debés iniciar sesión.');
    }
    const text = typeof request.data?.text === 'string' ? request.data.text : '';
    const playerPosition =
      typeof request.data?.playerPosition === 'string'
        ? request.data.playerPosition
        : 'MED';
    const playerName =
      typeof request.data?.playerName === 'string'
        ? request.data.playerName
        : 'Jugador';

    try {
      return await analyzeTextPerformanceCore({
        text,
        playerPosition,
        playerName,
      });
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      console.error('Text performance Vertex analysis failed', {
        message: err instanceof Error ? err.message : 'Unknown error',
      });
      throw new HttpsError(
        'internal',
        'No se pudo analizar la reseña en este momento. Probá de nuevo.',
      );
    }
  },
);
