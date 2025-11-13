
'use server';

import { adminDb, adminAuth, adminStorage, buildPublicFileURL } from '@/firebase/admin-init';
import { FieldValue } from 'firebase-admin/firestore';
import { generatePlayerCardImage } from '@/ai/flows/generate-player-card-image';
import type { Player } from '@/lib/types';
import { logger } from '@/lib/logger';

// ✅ CORRECCIÓN: La función ahora solo necesita el userId.
// El servidor se encargará de descargar la imagen desde Storage.
export async function generatePlayerCardImageAction(userId: string) {
  const playerRef = adminDb.doc(`players/${userId}`);

  try {
    const playerSnap = await playerRef.get();

    if (!playerSnap.exists) {
      return { error: 'No se encontró tu perfil de jugador.' };
    }

    const player = playerSnap.data() as Player;
    const credits = player.cardGenerationCredits;

    if (credits !== undefined && credits <= 0) {
      return { error: 'No te quedan créditos para generar imágenes este mes.' };
    }

    if (!player.photoUrl) {
      return { error: 'Primero debes subir una foto de perfil.' };
    }
    
    if (player.photoUrl.includes('picsum.photos')) {
      return { error: 'La generación de imágenes no funciona con fotos de marcador de posición. Por favor, sube una foto tuya real.' };
    }
    
    // ✅ PASO 1: Descargar la imagen directamente desde Firebase Storage en el servidor.
    // Esto evita enviar un archivo pesado desde el cliente.
    const url = new URL(player.photoUrl);
    // Extraer el path del archivo soportando ambos formatos:
    // 1) https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<encodedPath>?alt=media
    // 2) https://storage.googleapis.com/<bucket>/<rawPath>
    function extractFilePath(u: URL): string {
      const oIndex = u.pathname.indexOf('/o/');
      if (oIndex !== -1) {
        // v0 form
        return decodeURIComponent(u.pathname.substring(oIndex + 3));
      }
      // storage.googleapis.com form: /<bucket>/<path>
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts.length >= 2) {
        // bucket = parts[0]; rest = parts.slice(1)
        return decodeURIComponent(parts.slice(1).join('/'));
      }
      throw new Error('No se pudo extraer la ruta del archivo de la URL de la foto.');
    }
    const filePath = extractFilePath(url);
    const file = adminStorage.file(filePath);

    const [imageBuffer] = await file.download();
    const photoDataUri = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;


    // ✅ PASO 2: Llamar al flujo de IA con el Data URI obtenido en el servidor.
    const generatedImageDataUri = await generatePlayerCardImage(photoDataUri);

    const generatedImageBuffer = Buffer.from(generatedImageDataUri.split(',')[1], 'base64');
    const newFilePath = `profile-images/${userId}/generated_${Date.now()}.png`;
    const newFile = adminStorage.file(newFilePath);
    
    await newFile.save(generatedImageBuffer, {
      metadata: { contentType: 'image/png' },
    });
    
  // Usamos la URL canónica (v0) que respeta CORS y permisos.
  // No necesitamos makePublic si las reglas y token permiten acceso mediante alt=media, pero mantenemos publicación para retrocompatibilidad.
  await newFile.makePublic();
  const newPhotoURL = buildPublicFileURL(newFilePath);

    const batch = adminDb.batch();
    const userRef = adminDb.doc(`users/${userId}`);
    batch.update(userRef, { photoURL: newPhotoURL });
    batch.update(playerRef, {
      photoUrl: newPhotoURL,
      cardGenerationCredits: FieldValue.increment(-1),
      cropPosition: { x: 50, y: 50 },
      cropZoom: 1,
    });

    const availablePlayerRef = adminDb.doc(`availablePlayers/${userId}`);
    const availablePlayerSnap = await availablePlayerRef.get();
    if (availablePlayerSnap.exists) {
      batch.update(availablePlayerRef, { photoUrl: newPhotoURL });
    }

    await batch.commit();
    await adminAuth.updateUser(userId, { photoURL: newPhotoURL });

    return { success: true, newPhotoURL };
  } catch (error: any) {
    logger.error("Error in generatePlayerCardImageAction", error);
    return { error: error.message || "Un error inesperado ocurrió en el servidor." };
  }
}

/**
 * Convierte una URL de Firebase Storage a base64 (data URI)
 * Esto evita problemas de CORS al cargar imágenes para cropear
 */
export async function convertStorageUrlToBase64(storageUrl: string): Promise<{ success?: boolean; dataUri?: string; error?: string }> {
  try {
    if (!storageUrl) {
      return { error: 'URL no proporcionada' };
    }

    // Si ya es un data URI, devolverlo directamente
    if (storageUrl.startsWith('data:')) {
      return { success: true, dataUri: storageUrl };
    }

    const url = new URL(storageUrl);

    // Función para extraer el path del archivo desde la URL
    function extractFilePath(u: URL): string {
      const oIndex = u.pathname.indexOf('/o/');
      if (oIndex !== -1) {
        // Formato v0: https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<encodedPath>?alt=media
        return decodeURIComponent(u.pathname.substring(oIndex + 3));
      }
      // Formato storage.googleapis.com: https://storage.googleapis.com/<bucket>/<rawPath>
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts.length >= 2) {
        return decodeURIComponent(parts.slice(1).join('/'));
      }
      throw new Error('No se pudo extraer la ruta del archivo de la URL.');
    }

    const filePath = extractFilePath(url);
    const file = adminStorage.file(filePath);

    // Descargar la imagen desde Storage
    const [imageBuffer] = await file.download();

    // Detectar el tipo MIME desde los metadatos o usar jpeg por defecto
    const [metadata] = await file.getMetadata();
    const contentType = metadata.contentType || 'image/jpeg';

    // Convertir a base64
    const dataUri = `data:${contentType};base64,${imageBuffer.toString('base64')}`;

    return { success: true, dataUri };
  } catch (error: any) {
    logger.error('Error converting storage URL to base64', error);
    return { error: error.message || 'No se pudo convertir la imagen.' };
  }
}
