
'use server';

import { adminDb, adminAuth, adminStorage } from '@/firebase/admin-init';
import { FieldValue } from 'firebase-admin/firestore';
import { generatePlayerCardImage } from '@/ai/flows/generate-player-card-image';
import type { Player } from '@/lib/types';
import { logger } from '@/lib/logger';

// ✅ CORRECCIÓN: La función ahora acepta el Data URI de la foto directamente
// en lugar de solo el `userId`, eliminando la necesidad de descargar desde Storage.
export async function generatePlayerCardImageAction(userId: string, photoDataUri: string) {
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
    
    // El Data URI ya se pasa como argumento, no es necesario descargarlo.
    const generatedImageDataUri = await generatePlayerCardImage(photoDataUri);

    const generatedImageBuffer = Buffer.from(generatedImageDataUri.split(',')[1], 'base64');
    const newFilePath = `profile-images/${userId}/generated_${Date.now()}.png`;
    const newFile = adminStorage.file(newFilePath);
    
    await newFile.save(generatedImageBuffer, {
      metadata: { contentType: 'image/png' },
    });
    
    await newFile.makePublic();
    const newPhotoURL = `https://storage.googleapis.com/${adminStorage.name}/${newFilePath}`;

    const batch = adminDb.batch();
    const userRef = adminDb.doc(`users/${userId}`);
    batch.update(userRef, { photoURL: newPhotoURL });
    batch.update(playerRef, {
      photoUrl: newPhotoURL,
      cardGenerationCredits: FieldValue.increment(-1),
      // Reseteamos el crop ya que es una nueva imagen
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
