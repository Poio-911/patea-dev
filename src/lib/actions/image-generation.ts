
'use server';

import { adminDb, adminAuth, adminStorage } from '@/firebase/admin-init';
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
    // Extraer el path del archivo desde la URL de storage.googleapis.com
    const filePath = decodeURIComponent(url.pathname.substring(url.pathname.indexOf('/o/') + 3));
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
    
    await newFile.makePublic();
    const newPhotoURL = `https://storage.googleapis.com/${adminStorage.name}/${newFilePath}`;

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
