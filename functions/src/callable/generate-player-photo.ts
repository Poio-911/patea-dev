import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import { randomUUID } from 'crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const GOOGLE_GENAI_API_KEY = defineSecret('GOOGLE_GENAI_API_KEY');

/**
 * Genera la foto de la carta con IA a partir de la foto actual del jugador.
 *
 * Port de `generatePlayerCardImageAction` (src/lib/actions/image-generation.ts).
 * Mantiene lo importante: el mismo prompt, el descuento atómico de créditos y
 * el reseteo del encuadre al centrar la imagen nueva.
 *
 * Diferencias con la web:
 *
 * - **No usa `makePublic()`.** La web hace pública la imagen generada a nivel de
 *   objeto, lo que la deja accesible sin sesión para siempre y esquiva las
 *   reglas de Storage. Acá se guarda con un token de descarga de Firebase, que
 *   es el mismo mecanismo que usa `getDownloadURL` desde el cliente.
 * - El uid sale del token de auth, no de un parámetro.
 * - Devuelve los créditos restantes, para poder mostrarlos sin otra consulta.
 */

/// La web usa `gemini-3.1-flash-image-preview`. Acá se usa la versión estable
/// de la misma familia: los modelos "preview" se dan de baja sin aviso y esto
/// es una función que cobra créditos al usuario cuando corre.
const MODEL_NAME = 'gemini-3.1-flash-image';
const MAX_SOURCE_BYTES = 5 * 1024 * 1024;

const PROMPT = `
Create a professional studio portrait of the same person from the reference image.
Recreate their facial structure, skin tone, and expression so it clearly represents the same individual,
but as a natural reinterpretation, not a direct copy.
The person should be facing forward with arms crossed, wearing a random modern football (soccer) jersey (any color or design).
Use soft studio lighting, realistic shadows on the person only.
The background should be a single solid random color (choose randomly from any visually appealing tones,
like vibrant, pastel, or neutral colors — but not pure white or pure black).
The background must be smooth and free of gradients, patterns, shadows, or textures.
Render as a high-resolution PNG. Avoid fake transparency, borders, frames, text, or watermarks.
`.trim();

/** Saca la ruta dentro del bucket de una URL de descarga de Firebase Storage. */
function storagePathFromUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  const oIndex = url.pathname.indexOf('/o/');
  if (oIndex !== -1) return decodeURIComponent(url.pathname.substring(oIndex + 3));
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length >= 2) return decodeURIComponent(parts.slice(1).join('/'));
  throw new HttpsError('failed-precondition', 'No se pudo leer la ruta de tu foto actual.');
}

export const generatePlayerPhoto = onCall(
  {
    region: 'us-central1',
    secrets: [GOOGLE_GENAI_API_KEY],
    timeoutSeconds: 180,
    memory: '1GiB',
  },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Debés iniciar sesión.');
    const uid = request.auth.uid;

    const db = admin.firestore();
    const bucket = admin.storage().bucket();
    const playerRef = db.collection('players').doc(uid);

    const playerSnap = await playerRef.get();
    if (!playerSnap.exists) {
      throw new HttpsError('not-found', 'No se encontró tu perfil de jugador.');
    }
    const player = playerSnap.data()!;

    // Chequeo temprano de créditos: no tiene sentido gastar la llamada a la IA
    // si igual va a fallar después. El descuento real va en la transacción.
    const credits = player.cardGenerationCredits;
    if (typeof credits === 'number' && credits <= 0) {
      throw new HttpsError(
        'resource-exhausted',
        'No te quedan créditos para generar imágenes este mes.'
      );
    }

    const currentPhoto: string | undefined = player.photoUrl ?? player.photoURL;
    if (!currentPhoto) {
      throw new HttpsError('failed-precondition', 'Primero subí una foto de perfil.');
    }
    if (currentPhoto.includes('picsum.photos')) {
      throw new HttpsError(
        'failed-precondition',
        'La generación no funciona con fotos de ejemplo. Subí una foto tuya.'
      );
    }

    // ── Bajar la foto actual ────────────────────────────────────────────────
    const sourceFile = bucket.file(storagePathFromUrl(currentPhoto));
    const [metadata] = await sourceFile.getMetadata();
    if (metadata.size && Number(metadata.size) > MAX_SOURCE_BYTES) {
      throw new HttpsError('failed-precondition', 'Tu foto es muy grande (máximo 5 MB).');
    }
    const [sourceBuffer] = await sourceFile.download();

    // ── Generar ─────────────────────────────────────────────────────────────
    const genAI = new GoogleGenerativeAI(GOOGLE_GENAI_API_KEY.value());
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    let generated: Buffer;
    try {
      const result = await model.generateContent([
        {
          inlineData: {
            data: sourceBuffer.toString('base64'),
            mimeType: metadata.contentType || 'image/jpeg',
          },
        },
        { text: PROMPT },
      ]);

      const parts = result.response.candidates?.[0]?.content?.parts ?? [];
      const imagePart = parts.find((p: any) => p.inlineData?.data);
      if (!imagePart) {
        throw new HttpsError('internal', 'La IA no devolvió una imagen. Probá de nuevo.');
      }
      generated = Buffer.from((imagePart as any).inlineData.data, 'base64');
    } catch (err: any) {
      if (err instanceof HttpsError) throw err;
      throw new HttpsError('internal', 'No se pudo generar la imagen. Probá de nuevo en un rato.');
    }

    // ── Guardar ─────────────────────────────────────────────────────────────
    // Token de descarga en vez de makePublic(): la URL sigue siendo compartible
    // pero el objeto no queda con ACL público, así que las reglas de Storage
    // siguen valiendo para todo lo demás.
    const token = randomUUID();
    const path = `profile-images/${uid}/generated_${Date.now()}.png`;
    await bucket.file(path).save(generated, {
      metadata: {
        contentType: 'image/png',
        metadata: { firebaseStorageDownloadTokens: token },
      },
    });

    const photoUrl =
      `https://firebasestorage.googleapis.com/v0/b/${bucket.name}` +
      `/o/${encodeURIComponent(path)}?alt=media&token=${token}`;

    // ── Escribir, descontando el crédito de forma atómica ───────────────────
    let remaining: number | null = null;

    await db.runTransaction(async (tx) => {
      const fresh = await tx.get(playerRef);
      if (!fresh.exists) throw new HttpsError('not-found', 'No se encontró tu perfil.');

      const freshCredits = fresh.data()!.cardGenerationCredits;
      if (typeof freshCredits === 'number') {
        if (freshCredits <= 0) {
          throw new HttpsError('resource-exhausted', 'No te quedan créditos este mes.');
        }
        remaining = freshCredits - 1;
      }

      const availableRef = db.collection('availablePlayers').doc(uid);
      const availableSnap = await tx.get(availableRef);

      // El encuadre se resetea al centro: la imagen es nueva, el recorte que
      // tenía la anterior no significa nada sobre ésta.
      const photoUpdates = {
        photoUrl,
        photoURL: photoUrl, // LEGACY: la web todavía lee este campo
        cropPosition: { x: 50, y: 50 },
        cropZoom: 1,
      };

      tx.set(
        playerRef,
        {
          ...photoUpdates,
          ...(typeof freshCredits === 'number'
            ? { cardGenerationCredits: admin.firestore.FieldValue.increment(-1) }
            : {}),
        },
        { merge: true }
      );

      tx.set(
        db.collection('users').doc(uid),
        { photoURL: photoUrl, cropPosition: { x: 50, y: 50 }, cropZoom: 1 },
        { merge: true }
      );

      if (availableSnap.exists) {
        tx.set(availableRef, photoUpdates, { merge: true });
      }
    });

    await admin.auth().updateUser(uid, { photoURL: photoUrl });

    return { ok: true, photoUrl, creditsRemaining: remaining };
  }
);
