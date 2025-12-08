
'use server';

import { getAdminDb, getAdminAuth, getAdminStorage } from '../../firebase/admin-init';
import { FieldValue } from 'firebase-admin/firestore';
import { generatePlayerCardImage } from '../../ai/flows/generate-player-card-image';
import type { Player } from '../../lib/types';
import { logger } from '../../lib/logger';
import { sanitizeText } from '../../lib/validation';

export async function generatePlayerCardImageAction(userId: string) {
  // ✅ VALIDATION: Validate userId
  if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
    return { error: 'ID de usuario inválido' };
  }

  // Sanitize userId to prevent injection
  const sanitizedUserId = sanitizeText(userId);
  if (sanitizedUserId !== userId || sanitizedUserId.length > 128) {
    return { error: 'ID de usuario inválido' };
  }

  const db = getAdminDb();
  const playerRef = db.doc(`players/${sanitizedUserId}`);

  try {
    // First read to validate before expensive AI operation
    const playerSnap = await playerRef.get();

    if (!playerSnap.exists) {
      return { error: 'No se encontró tu perfil de jugador.' };
    }

    const player = playerSnap.data() as Player;

    // Validate photo before AI generation
    if (!player.photoUrl) {
      return { error: 'Primero debes subir una foto de perfil.' };
    }

    if (player.photoUrl.includes('picsum.photos')) {
      return { error: 'La generación de imágenes no funciona con fotos de marcador de posición. Por favor, sube una foto tuya real.' };
    }
    
    // Convert current photo to data URI to send to AI
    const url = new URL(player.photoUrl);
    function extractFilePath(u: URL): string {
      const oIndex = u.pathname.indexOf('/o/');
      if (oIndex !== -1) {
        return decodeURIComponent(u.pathname.substring(oIndex + 3));
      }
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts.length >= 2) {
        return decodeURIComponent(parts.slice(1).join('/'));
      }
      throw new Error('No se pudo extraer la ruta del archivo de la URL de la foto.');
    }
    const filePath = extractFilePath(url);
    const file = getAdminStorage().file(filePath);

    const [imageBuffer] = await file.download();
    const photoDataUri = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;

    // Call AI flow
    const generatedImageDataUri = await generatePlayerCardImage(photoDataUri);

    // Upload new image to storage
    const generatedImageBuffer = Buffer.from(generatedImageDataUri.split(',')[1], 'base64');
    const newFilePath = `profile-images/${userId}/generated_${Date.now()}.png`;
    const newFile = getAdminStorage().file(newFilePath);

    await newFile.save(generatedImageBuffer, {
      metadata: { contentType: 'image/png' },
    });

    // Get download URL with access token (same method as crop - this works reliably)
    const [newPhotoURL] = await newFile.getSignedUrl({
      action: 'read',
      expires: '03-01-2500', // Far future expiration
    });

    // Use transaction instead of batch to ensure atomicity and credit validation
    await db.runTransaction(async (transaction) => {
      // Re-read player within transaction to verify credits atomically
      const playerSnap = await transaction.get(playerRef);

      if (!playerSnap.exists) {
        throw new Error('Jugador no encontrado');
      }

      const playerData = playerSnap.data() as Player;
      const credits = playerData.cardGenerationCredits;

      // Atomic credit check - ensures no race condition
      if (credits !== undefined && credits <= 0) {
        throw new Error('No te quedan créditos para generar imágenes este mes.');
      }

      // Prepare updates for all 3 locations with consistent crop data
      const photoUpdates = {
        photoUrl: newPhotoURL,
        cropPosition: { x: 50, y: 50 }, // Reset crop to center the new image
        cropZoom: 1, // Reset zoom
      };

      const userRef = db.doc(`users/${userId}`);
      const availablePlayerRef = db.doc(`availablePlayers/${userId}`);

      // Check if availablePlayer exists
      const availablePlayerSnap = await transaction.get(availablePlayerRef);

      // Update all 3 locations atomically
      transaction.update(userRef, {
        photoURL: newPhotoURL,
        cropPosition: { x: 50, y: 50 },
        cropZoom: 1,
      });

      transaction.update(playerRef, {
        ...photoUpdates,
        cardGenerationCredits: FieldValue.increment(-1), // Decrement credits atomically
      });

      // Only update availablePlayers if document exists
      if (availablePlayerSnap.exists) {
        transaction.update(availablePlayerRef, photoUpdates);
      }
    });

    // Force update auth user profile for immediate UI change on client
    await getAdminAuth().updateUser(userId, { photoURL: newPhotoURL });

    return { success: true, newPhotoURL };
  } catch (error: any) {
    logger.error("Error in generatePlayerCardImageAction", error);
    return { error: error.message || "Un error inesperado ocurrió en el servidor." };
  }
}

export async function convertStorageUrlToBase64(storageUrl: string): Promise<{ success?: boolean; dataUri?: string; error?: string }> {
  try {
    if (!storageUrl) {
      return { error: 'URL no proporcionada' };
    }

    if (storageUrl.startsWith('data:')) {
      return { success: true, dataUri: storageUrl };
    }

    const url = new URL(storageUrl);

    function extractFilePath(u: URL): string {
      const oIndex = u.pathname.indexOf('/o/');
      if (oIndex !== -1) {
        return decodeURIComponent(u.pathname.substring(oIndex + 3));
      }
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts.length >= 2) {
        return decodeURIComponent(parts.slice(1).join('/'));
      }
      throw new Error('No se pudo extraer la ruta del archivo de la URL.');
    }

    const filePath = extractFilePath(url);
    const file = getAdminStorage().file(filePath);

    const [imageBuffer] = await file.download();
    const [metadata] = await file.getMetadata();
    const contentType = metadata.contentType || 'image/jpeg';
    const dataUri = `data:${contentType};base64,${imageBuffer.toString('base64')}`;

    return { success: true, dataUri };
  } catch (error: any) {
    logger.error('Error converting storage URL to base64', error);
    return { error: error.message || 'No se pudo convertir la imagen.' };
  }
}
