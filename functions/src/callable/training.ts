import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

/**
 * Mi entrenamiento: cada ejercicio que la persona termina queda registrado en
 * `players/{uid}/trainingLog`. Con eso la pantalla deja de ser una guía fija:
 * cuenta la semana, la racha y rota la sugerencia. No toca el OVR (el OVR sólo
 * cambia con las evaluaciones de los partidos).
 */

export const TRAINING_FOCUS_IDS = ['pac', 'sho', 'pas', 'dri', 'def', 'phy'] as const;
const MAX_PER_DAY = 5;

export const logTrainingSession = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debés iniciar sesión.');
  const uid = request.auth.uid;
  const focusId = String(request.data?.focusId ?? '');
  if (!(TRAINING_FOCUS_IDS as readonly string[]).includes(focusId)) {
    throw new HttpsError('invalid-argument', 'Objetivo de entrenamiento inválido.');
  }
  const db = admin.firestore();
  const player = await db.doc(`players/${uid}`).get();
  if (!player.exists) throw new HttpsError('failed-precondition', 'No se encontró tu ficha de jugador.');

  const log = db.collection(`players/${uid}/trainingLog`);
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const today = await log.where('createdAt', '>=', startOfDay.toISOString()).limit(MAX_PER_DAY + 1).get();
  if (today.size >= MAX_PER_DAY) {
    throw new HttpsError('resource-exhausted', 'Ya registraste varias sesiones hoy. ¡Descansá un poco!');
  }
  await log.add({ focusId, createdAt: new Date().toISOString() });
  return { ok: true };
});
