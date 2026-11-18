import { optionalProfileFields } from '../lib/profile-optional-fields';
import { isAiGeneratedPhotoUrl } from './generate-player-photo';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

/**
 * Actualiza el perfil del usuario que llama.
 *
 * Equivalente a `updateProfileAction` (server-actions.ts:4504), pero con dos
 * diferencias deliberadas:
 *
 * 1. **Valida del lado servidor.** La web valida sólo en el cliente con zod;
 *    la server action acepta lo que le manden. Acá cada campo se valida y se
 *    normaliza antes de escribir.
 *
 * 2. **Sólo el dueño.** La acción de la web recibe el `uid` como argumento, o
 *    sea que confía en quien la llama. Acá el uid sale del token de auth y no
 *    se puede pasar otro.
 *
 * Sobre `photoUrl` / `photoURL`: los documentos tienen los dos campos y la web
 * escribe ambos "to be safe due to legacy code". La app usa `photoUrl` como
 * canónico; acá se sigue escribiendo `photoURL` en paralelo para no romper la
 * web mientras convivan. Cuando la web deje de leerlo, sacar las tres líneas
 * marcadas con LEGACY y correr una migración que borre el campo.
 */

const POSITIONS = ['DEL', 'MED', 'DEF', 'POR'] as const;

const MIN_NAME = 3;
const MAX_NAME = 40;
const MAX_BIO = 160;

type Updates = Record<string, unknown>;

function invalid(message: string): never {
  throw new HttpsError('invalid-argument', message);
}

export const updateProfile = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debés iniciar sesión.');
  const uid = request.auth.uid;
  const data = (request.data ?? {}) as Updates;

  const userUpdates: Updates = {};
  const playerUpdates: Updates = {};
  const authUpdates: { displayName?: string; photoURL?: string } = {};

  // ── Nombre ──────────────────────────────────────────────────────────────
  if (data.displayName !== undefined) {
    const name = String(data.displayName).trim();
    if (name.length < MIN_NAME) invalid(`El nombre debe tener al menos ${MIN_NAME} caracteres.`);
    if (name.length > MAX_NAME) invalid(`El nombre no puede superar los ${MAX_NAME} caracteres.`);
    userUpdates.displayName = name;
    playerUpdates.name = name;
    authUpdates.displayName = name;
  }

  // ── Foto ────────────────────────────────────────────────────────────────
  // Sólo se aceptan URLs del Storage del proyecto: si no, cualquiera podría
  // apuntar la foto de perfil a un host externo.
  if (data.photoUrl !== undefined) {
    const url = String(data.photoUrl);
    const ok =
      url.startsWith('https://firebasestorage.googleapis.com/') ||
      url.startsWith('https://storage.googleapis.com/') ||
      url.startsWith('https://lh3.googleusercontent.com/'); // fotos de Google Sign-In
    if (!ok) invalid('La foto debe estar alojada en el Storage del proyecto.');

    userUpdates.photoURL = url;
    playerUpdates.photoUrl = url;
    playerUpdates.photoURL = url; // LEGACY
    if (!isAiGeneratedPhotoUrl(url)) {
      playerUpdates.aiSourcePhotoUrl = url;
    }
    authUpdates.photoURL = url;
  }

  // ── Posición ────────────────────────────────────────────────────────────
  if (data.position !== undefined) {
    const pos = String(data.position).toUpperCase();
    if (!POSITIONS.includes(pos as typeof POSITIONS[number])) {
      invalid('Posición inválida.');
    }
    playerUpdates.position = pos;
  }

  Object.assign(playerUpdates, optionalProfileFields(data));

  // ── Bio ─────────────────────────────────────────────────────────────────
  if (data.bio !== undefined) {
    const bio = String(data.bio).trim();
    if (bio.length > MAX_BIO) invalid(`La bio no puede superar los ${MAX_BIO} caracteres.`);
    playerUpdates.bio = bio;
  }

  // ── Nacionalidad y teléfono ─────────────────────────────────────────────
  if (data.nationality !== undefined) {
    playerUpdates.nationality = String(data.nationality).trim().slice(0, 60);
  }
  if (data.phoneNumber !== undefined) {
    userUpdates.phoneNumber = String(data.phoneNumber).trim().slice(0, 30);
  }

  // ── Encuadre de la foto ─────────────────────────────────────────────────
  if (data.cropPosition !== undefined && data.cropPosition !== null) {
    const cp = data.cropPosition as { x?: unknown; y?: unknown };
    const x = Number(cp.x);
    const y = Number(cp.y);
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 100 || y < 0 || y > 100) {
      invalid('Encuadre inválido.');
    }
    playerUpdates.cropPosition = { x, y };
  }
  if (data.cropZoom !== undefined && data.cropZoom !== null) {
    const zoom = Number(data.cropZoom);
    if (!Number.isFinite(zoom) || zoom < 1 || zoom > 4) invalid('Zoom inválido.');
    playerUpdates.cropZoom = zoom;
  }

  if (Object.keys(userUpdates).length === 0 && Object.keys(playerUpdates).length === 0) {
    return { ok: true, changed: false };
  }

  const db = admin.firestore();
  const batch = db.batch();

  if (Object.keys(userUpdates).length > 0) {
    batch.set(db.collection('users').doc(uid), userUpdates, { merge: true });
  }
  if (Object.keys(playerUpdates).length > 0) {
    batch.set(db.collection('players').doc(uid), playerUpdates, { merge: true });
  }

  // El documento de "jugador disponible" duplica foto y encuadre para el
  // mercado de fichajes. Sólo se toca si existe.
  const availableRef = db.collection('availablePlayers').doc(uid);
  const availableSnap = await availableRef.get();
  if (availableSnap.exists) {
    const availableUpdates: Updates = {};
    if (playerUpdates.photoUrl !== undefined) {
      availableUpdates.photoUrl = playerUpdates.photoUrl;
      availableUpdates.photoURL = playerUpdates.photoUrl; // LEGACY
    }
    if (playerUpdates.name !== undefined) availableUpdates.displayName = playerUpdates.name;
    if (playerUpdates.position !== undefined) availableUpdates.position = playerUpdates.position;
    if (playerUpdates.cropPosition !== undefined) availableUpdates.cropPosition = playerUpdates.cropPosition;
    if (playerUpdates.cropZoom !== undefined) availableUpdates.cropZoom = playerUpdates.cropZoom;
    if (Object.keys(availableUpdates).length > 0) {
      batch.set(availableRef, availableUpdates, { merge: true });
    }
  }

  await batch.commit();

  if (Object.keys(authUpdates).length > 0) {
    await admin.auth().updateUser(uid, authUpdates);
  }

  return { ok: true, changed: true };
});
