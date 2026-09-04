import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

/**
 * Crea los documentos que una cuenta necesita para existir en la app.
 *
 * Port de `initializeUserProfileAction` (src/lib/auth-actions.ts:72).
 *
 * Sin esto la cuenta existe sólo en Authentication: puede iniciar sesión y
 * después no tiene perfil de jugador, ni grupo, ni nada — que es exactamente
 * lo que pasaba al registrarse desde el móvil, porque el registro llamaba
 * únicamente a `createUserWithEmailAndPassword`. La web sí llamaba a su
 * server action y por eso allá funcionaba.
 *
 * Va por Cloud Function y no desde el cliente porque `users/{uid}` y
 * `players/{id}` tienen `allow create: if false` en firestore.rules, a
 * propósito.
 *
 * Es idempotente: si los documentos ya están no toca nada. Así se puede
 * llamar también al iniciar sesión, para reparar cuentas viejas que quedaron
 * a medias.
 */

const BASE_STAT = 50;
const POSITIONS = ['POR', 'DEF', 'MED', 'DEL'];

export const initializeUserProfile = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debés iniciar sesión.');
  const uid = request.auth.uid;

  const displayName = String(request.data?.displayName ?? '').trim();
  const rawPosition = String(request.data?.position ?? '').toUpperCase();
  const position = POSITIONS.includes(rawPosition) ? rawPosition : 'MED';
  const photoURL = String(request.data?.photoURL ?? '');

  if (!displayName) {
    throw new HttpsError('invalid-argument', 'Falta el nombre.');
  }

  const db = admin.firestore();
  const userRef = db.collection('users').doc(uid);
  const playerRef = db.collection('players').doc(uid);

  const [userSnap, playerSnap] = await Promise.all([userRef.get(), playerRef.get()]);
  if (userSnap.exists && playerSnap.exists) {
    return { ok: true, alreadyInitialized: true };
  }

  const batch = db.batch();

  if (!userSnap.exists) {
    batch.set(userRef, {
      uid,
      email: request.auth.token.email ?? null,
      displayName,
      photoURL: photoURL || null,
      // Arranca sin grupo: el usuario nuevo crea uno o entra con un código.
      groups: [],
      activeGroupId: null,
    });
  }

  if (!playerSnap.exists) {
    batch.set(playerRef, {
      name: displayName,
      position,
      pac: BASE_STAT,
      sho: BASE_STAT,
      pas: BASE_STAT,
      dri: BASE_STAT,
      def: BASE_STAT,
      phy: BASE_STAT,
      ovr: BASE_STAT,
      photoUrl: photoURL || '',
      stats: { matchesPlayed: 0, goals: 0, assists: 0, averageRating: 0 },
      ownerUid: uid,
      groupId: null,
      cardGenerationCredits: 3,
      lastCreditReset: new Date().toISOString(),
    });
  }

  await batch.commit();
  return { ok: true, alreadyInitialized: false };
});
