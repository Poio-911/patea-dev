import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { randomUUID } from 'crypto';
import { GoogleGenAI, Modality, type GenerateContentResponse } from '@google/genai';

/**
 * Genera la foto de la carta con IA a partir de la foto actual del jugador.
 *
 * Usa el mismo patrón de Vertex AI (`vertexai: true`, `location: 'global'`) y
 * `@google/genai` que `generateMatchChronicle` y `analyzeTextPerformance`, sin
 * depender de secretos externos de API key ni SDKs legados.
 */

export const IMAGE_MODEL_CANDIDATES = [
  'gemini-nano-banana-2.1',
  'gemini-3-pro-image',
] as const;

const MAX_SOURCE_BYTES = 5 * 1024 * 1024;
const EXTERNAL_FETCH_TIMEOUT_MS = 15_000;
const VERTEX_TIMEOUT_MS = 65_000;

export const PROMPT = `
Transform the reference photo into a crisp, natural football player card portrait while strictly preserving the exact same person.
CRITICAL — Identity & Exact Age Preservation: Keep 100% identical facial structure, bone structure, eyes, nose, lips, jawline, hairline, facial expression, skin tone, and the exact apparent age shown in the reference image.
Do NOT make the person look older, do NOT add wrinkles, fine lines, eye bags, deep laugh lines, heavy stubble, or exaggerated skin pores/texture, and do NOT reinterpret or redraw the face.
Pose & Outfit: Facing forward with arms crossed over the chest, wearing a modern football (soccer) jersey with a clean athletic design and varied color.
Lighting: Bright, soft, diffused frontal studio fill lighting (softbox / butterfly lighting) with even, flattering illumination on the face. Eliminate harsh contrast and eliminate heavy shadows under the eyes, nose, and cheekbones.
Background: A single flat, smooth solid color (vibrant, pastel, or neutral — never pure white or pure black) with zero gradients, shadows, patterns, or textures.
Render as a clean high-resolution photograph without borders, frames, text, watermarks, or fake transparency.
`.trim();

export type PhotoSource =
  | { kind: 'storage'; path: string }
  | { kind: 'https'; url: string };

export interface PhotoLookupSources {
  player?: Record<string, unknown> | null;
  userData?: Record<string, unknown> | null;
  tokenPicture?: unknown;
  authPhotoUrl?: unknown;
}

const ALLOWED_EXTERNAL_HOST_SUFFIXES = ['.googleusercontent.com', '.ggpht.com'] as const;

function cleanPhotoString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isAllowedBucket(candidateBucket: string, defaultBucketName?: string): boolean {
  if (!defaultBucketName || candidateBucket === defaultBucketName) return true;
  const projectPrefix = defaultBucketName.split('.')[0];
  return (
    projectPrefix.length > 0 &&
    (candidateBucket === `${projectPrefix}.appspot.com` ||
      candidateBucket === `${projectPrefix}.firebasestorage.app`)
  );
}

/** Detecta si la URL corresponde a una foto generada previamente por IA. */
export function isAiGeneratedPhotoUrl(rawUrl: string): boolean {
  return /(\/|%2F)generated_\d+\./i.test(rawUrl);
}

/**
 * Si es una miniatura chica de Google (`=s96-c`), prioriza `=s512-c` para dar
 * mejor detalle facial sin arrugas inventadas, manteniendo la URL original como fallback.
 */
export function buildHttpsPhotoCandidates(rawUrl: string): string[] {
  const match = /^(.+)=s(\d+)(-c)?$/.exec(rawUrl);
  if (match && Number(match[2]) < 512) {
    const upgraded = `${match[1]}=s512${match[3] ?? ''}`;
    if (upgraded !== rawUrl) return [upgraded, rawUrl];
  }
  return [rawUrl];
}

/**
 * Resuelve la URL base para la IA. Si la foto actual ya fue generada por IA y
 * guardamos la última foto real (`aiSourcePhotoUrl`), parte de esa foto real
 * para evitar degradación y envejecimiento acumulativo al regenerar.
 */
export function resolveInitialPhotoUrl({
  player,
  userData,
  tokenPicture,
  authPhotoUrl,
}: PhotoLookupSources): string {
  const candidates = [
    player?.photoUrl,
    player?.photoURL,
    userData?.photoURL,
    userData?.photoUrl,
    tokenPicture,
    authPhotoUrl,
  ];
  let displayPhoto = '';
  for (const candidate of candidates) {
    const cleaned = cleanPhotoString(candidate);
    if (cleaned) {
      displayPhoto = cleaned;
      break;
    }
  }
  if (!displayPhoto) return '';

  if (isAiGeneratedPhotoUrl(displayPhoto)) {
    const originalSource = cleanPhotoString(player?.aiSourcePhotoUrl);
    if (originalSource && !isAiGeneratedPhotoUrl(originalSource)) {
      return originalSource;
    }
  }
  return displayPhoto;
}

/** Clasifica la URL actual como objeto de Firebase Storage o URL externa permitida. */
export function parseSourcePhotoUrl(rawUrl: string, defaultBucketName?: string): PhotoSource {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new HttpsError('failed-precondition', 'No se pudo leer la ruta de tu foto actual.');
  }

  if (url.protocol !== 'https:') {
    throw new HttpsError('failed-precondition', 'La URL de tu foto actual no es válida.');
  }

  const host = url.hostname.toLowerCase();
  const isStorageHost =
    host === 'firebasestorage.googleapis.com' ||
    host === 'storage.googleapis.com' ||
    host.endsWith('.firebasestorage.app');

  if (isStorageHost) {
    const bucketPathMatch = /\/b\/([^/]+)\/o\/(.+)$/.exec(url.pathname);
    if (bucketPathMatch) {
      const urlBucket = decodeURIComponent(bucketPathMatch[1]);
      if (isAllowedBucket(urlBucket, defaultBucketName)) {
        return { kind: 'storage', path: decodeURIComponent(bucketPathMatch[2]) };
      }
      throw new HttpsError('failed-precondition', 'No se pudo leer la ruta de tu foto actual.');
    }
    const oIndex = url.pathname.indexOf('/o/');
    if (oIndex !== -1) {
      const encoded = url.pathname.substring(oIndex + 3);
      if (encoded) return { kind: 'storage', path: decodeURIComponent(encoded) };
    }
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length >= 2 && isAllowedBucket(decodeURIComponent(parts[0]), defaultBucketName)) {
      return { kind: 'storage', path: decodeURIComponent(parts.slice(1).join('/')) };
    }
    throw new HttpsError('failed-precondition', 'No se pudo leer la ruta de tu foto actual.');
  }

  if (
    host === 'lh3.googleusercontent.com' ||
    ALLOWED_EXTERNAL_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))
  ) {
    return { kind: 'https', url: url.toString() };
  }

  console.error('Rejected source photo host', { host });
  throw new HttpsError(
    'failed-precondition',
    'Subí una foto tuya desde el dispositivo antes de generar con IA.',
  );
}

/** Extrae la imagen binaria devuelta por `@google/genai`. */
export function extractGeneratedImage(
  response: Pick<GenerateContentResponse, 'candidates'>,
): { data: Buffer; mimeType: string } {
  const candidate = response.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];
  // Prefer final output parts over intermediate thinking draft images.
  const imagePart =
    parts.find((p) => !p.thought && Boolean(p.inlineData?.data)) ??
    parts.find((p) => Boolean(p.inlineData?.data));
  if (!imagePart?.inlineData?.data) {
    const reason = candidate?.finishReason ? String(candidate.finishReason) : 'UNKNOWN';
    throw new Error(`Model returned no image data (finishReason: ${reason})`);
  }
  return {
    data: Buffer.from(imagePart.inlineData.data, 'base64'),
    mimeType: imagePart.inlineData.mimeType || 'image/png',
  };
}

function extensionForMime(mimeType: string): string {
  switch (mimeType.toLowerCase()) {
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    default:
      return 'png';
  }
}

async function loadSourcePhoto(
  rawUrl: string,
  bucket: ReturnType<ReturnType<typeof admin.storage>['bucket']>,
): Promise<{ buffer: Buffer; mimeType: string }> {
  const source = parseSourcePhotoUrl(rawUrl, bucket.name);

  if (source.kind === 'storage') {
    const file = bucket.file(source.path);
    const [metadata] = await file.getMetadata();
    if (metadata.size && Number(metadata.size) > MAX_SOURCE_BYTES) {
      throw new HttpsError('failed-precondition', 'Tu foto es muy grande (máximo 5 MB).');
    }
    const [buffer] = await file.download();
    if (buffer.byteLength > MAX_SOURCE_BYTES) {
      throw new HttpsError('failed-precondition', 'Tu foto es muy grande (máximo 5 MB).');
    }
    return { buffer, mimeType: metadata.contentType || 'image/jpeg' };
  }

  const externalCandidates = buildHttpsPhotoCandidates(source.url);
  for (let i = 0; i < externalCandidates.length; i++) {
    const candidateUrl = externalCandidates[i];
    const hasFallback = i < externalCandidates.length - 1;
    try {
      const res = await fetch(candidateUrl, {
        signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS),
      });
      if (!res.ok) {
        console.error('External source photo download failed', {
          status: res.status,
          host: new URL(candidateUrl).hostname,
          hasFallback,
        });
        if (hasFallback) continue;
        throw new HttpsError(
          'failed-precondition',
          'No pudimos descargar tu foto actual. Probá subir una nueva.',
        );
      }
      const contentType = res.headers.get('content-type') || 'image/jpeg';
      if (!contentType.toLowerCase().startsWith('image/')) {
        console.error('External source photo has invalid content-type', {
          contentType,
          host: new URL(candidateUrl).hostname,
          hasFallback,
        });
        if (hasFallback) continue;
        throw new HttpsError('failed-precondition', 'Tu foto actual no es una imagen válida.');
      }
      const arrayBuf = await res.arrayBuffer();
      if (arrayBuf.byteLength === 0 || arrayBuf.byteLength > MAX_SOURCE_BYTES) {
        if (hasFallback) continue;
        throw new HttpsError('failed-precondition', 'Tu foto es muy grande (máximo 5 MB).');
      }
      return { buffer: Buffer.from(arrayBuf), mimeType: contentType.split(';')[0].trim() };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      if (hasFallback) continue;
      throw new HttpsError(
        'failed-precondition',
        'No pudimos descargar tu foto actual. Probá subir una nueva.',
      );
    }
  }
  throw new HttpsError(
    'failed-precondition',
    'No pudimos descargar tu foto actual. Probá subir una nueva.',
  );
}

export const generatePlayerPhoto = onCall(
  {
    region: 'us-central1',
    timeoutSeconds: 180,
    memory: '1GiB',
  },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Debés iniciar sesión.');
    const uid = request.auth.uid;

    const db = admin.firestore();
    const bucket = admin.storage().bucket();
    const playerRef = db.collection('players').doc(uid);

    const [playerSnap, userSnap] = await Promise.all([
      playerRef.get(),
      db.collection('users').doc(uid).get(),
    ]);
    if (!playerSnap.exists) {
      throw new HttpsError('not-found', 'No se encontró tu perfil de jugador.');
    }
    const player = playerSnap.data()!;
    const userData = userSnap.data();

    // Chequeo temprano de créditos: no tiene sentido gastar la llamada a la IA
    // si igual va a fallar después. El descuento real va en la transacción.
    const credits = player.cardGenerationCredits;
    if (typeof credits === 'number' && credits <= 0) {
      throw new HttpsError(
        'resource-exhausted',
        'No te quedan créditos para generar imágenes este mes.',
      );
    }

    const tokenPicture = request.auth.token?.picture;
    let currentPhoto = resolveInitialPhotoUrl({
      player,
      userData,
      tokenPicture,
    });
    if (!currentPhoto) {
      try {
        const authUser = await admin.auth().getUser(uid);
        currentPhoto = resolveInitialPhotoUrl({
          player,
          userData,
          tokenPicture,
          authPhotoUrl: authUser.photoURL,
        });
      } catch (err) {
        console.error('Failed to load Firebase Auth photo fallback', {
          uid,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
    if (!currentPhoto) {
      throw new HttpsError('failed-precondition', 'Primero subí una foto de perfil.');
    }
    if (currentPhoto.includes('picsum.photos')) {
      throw new HttpsError(
        'failed-precondition',
        'La generación no funciona con fotos de ejemplo. Subí una foto tuya.',
      );
    }

    // ── Bajar la foto actual ────────────────────────────────────────────────
    const { buffer: sourceBuffer, mimeType: sourceMimeType } = await loadSourcePhoto(
      currentPhoto,
      bucket,
    );

    // ── Generar via Vertex AI Global (`@google/genai`) ──────────────────────
    const genAI = new GoogleGenAI({
      vertexai: true,
      project: process.env.GCLOUD_PROJECT || admin.app().options.projectId,
      location: 'global',
    });

    let generatedImage: { data: Buffer; mimeType: string } | null = null;
    let lastError: unknown;

    for (const model of IMAGE_MODEL_CANDIDATES) {
      try {
        const result = await genAI.models.generateContent({
          model,
          contents: [
            {
              inlineData: {
                data: sourceBuffer.toString('base64'),
                mimeType: sourceMimeType,
              },
            },
            { text: PROMPT },
          ],
          config: {
            responseModalities: [Modality.TEXT, Modality.IMAGE],
            imageConfig: { aspectRatio: '3:4' },
            httpOptions: { timeout: VERTEX_TIMEOUT_MS },
          },
        });
        generatedImage = extractGeneratedImage(result);
        break;
      } catch (err) {
        lastError = err;
        console.error('Player photo Vertex generation failed', {
          model,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (!generatedImage) {
      const msg = lastError instanceof Error ? lastError.message : '';
      if (msg.includes('SAFETY') || msg.includes('IMAGE_SAFETY')) {
        throw new HttpsError(
          'invalid-argument',
          'La IA rechazó la imagen por políticas de contenido. Probá con otra foto.',
        );
      }
      throw new HttpsError(
        'internal',
        'No se pudo generar la imagen. Probá de nuevo en un rato.',
      );
    }

    // ── Guardar con token de descarga ───────────────────────────────────────
    const token = randomUUID();
    const ext = extensionForMime(generatedImage.mimeType);
    const path = `profile-images/${uid}/generated_${Date.now()}.${ext}`;
    await bucket.file(path).save(generatedImage.data, {
      metadata: {
        contentType: generatedImage.mimeType,
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
          ...(!isAiGeneratedPhotoUrl(currentPhoto)
            ? { aiSourcePhotoUrl: currentPhoto }
            : {}),
          ...(typeof freshCredits === 'number'
            ? { cardGenerationCredits: admin.firestore.FieldValue.increment(-1) }
            : {}),
        },
        { merge: true },
      );

      tx.set(
        db.collection('users').doc(uid),
        { photoURL: photoUrl, cropPosition: { x: 50, y: 50 }, cropZoom: 1 },
        { merge: true },
      );

      if (availableSnap.exists) {
        tx.set(availableRef, photoUpdates, { merge: true });
      }
    });

    await admin.auth().updateUser(uid, { photoURL: photoUrl });

    return { ok: true, photoUrl, creditsRemaining: remaining };
  },
);
