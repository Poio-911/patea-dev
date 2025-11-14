
'use server';

import { adminDb, adminAuth, adminStorage, buildPublicFileURL } from '@/firebase/admin-init';
import { FieldValue } from 'firebase-admin/firestore';
import { generatePlayerCardImage } from '@/ai/flows/generate-player-card-image';
import type { Player } from '@/lib/types';
import { logger } from '@/lib/logger';

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
    const file = adminStorage.file(filePath);

    const [imageBuffer] = await file.download();
    const photoDataUri = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;

    // Call AI flow
    const generatedImageDataUri = await generatePlayerCardImage(photoDataUri);

    // Upload new image to storage
    const generatedImageBuffer = Buffer.from(generatedImageDataUri.split(',')[1], 'base64');
    const newFilePath = `profile-images/${userId}/generated_${Date.now()}.png`;
    const newFile = adminStorage.file(newFilePath);
    
    await newFile.save(generatedImageBuffer, {
      metadata: { contentType: 'image/png' },
    });
    
    await newFile.makePublic();
    const newPhotoURL = buildPublicFileURL(newFilePath);

    // Update Firestore and Auth in a batch
    const batch = adminDb.batch();
    const userRef = adminDb.doc(`users/${userId}`);
    batch.update(userRef, { photoURL: newPhotoURL });
    batch.update(playerRef, {
      photoUrl: newPhotoURL,
      cardGenerationCredits: FieldValue.increment(-1),
      cropPosition: { x: 50, y: 50 }, // Reset crop to center the new image
      cropZoom: 1, // Reset zoom
    });

    const availablePlayerRef = adminDb.doc(`availablePlayers/${userId}`);
    const availablePlayerSnap = await availablePlayerRef.get();
    if (availablePlayerSnap.exists) {
      batch.update(availablePlayerRef, { photoUrl: newPhotoURL });
    }

    await batch.commit();

    // Force update auth user profile for immediate UI change on client
    await adminAuth.updateUser(userId, { photoURL: newPhotoURL });

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
    const file = adminStorage.file(filePath);

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
