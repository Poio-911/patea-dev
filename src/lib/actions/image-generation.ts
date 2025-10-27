
'use server';

import { adminApp, adminDb, adminAuth, adminStorage } from '@/firebase/admin';
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

    if (credits <= 0) {
      return { error: 'No te quedan créditos para generar imágenes este mes.' };
    }

    if (!player.photoUrl) {
      return { error: 'Primero debes subir una foto de perfil.' };
    }
    
    if (player.photoUrl.includes('picsum.photos')) {
      return { error: 'La generación de imágenes no funciona con fotos de marcador de posición. Por favor, sube una foto tuya real.' };
    }

    // --- ROBUST FILE HANDLING ---
    let imageBuffer: Buffer;
    let contentType: string;

    try {
      const bucket = adminStorage;
      // Extract the object path from the full gs:// or https:// URL
      // Example URL: https://storage.googleapis.com/your-bucket.appspot.com/path/to/file.jpg
      const url = new URL(player.photoUrl);
      const filePath = url.pathname.split(`/${bucket.name}/`)[1];
      
      if (!filePath) {
        throw new Error("Could not determine file path from the photo URL.");
      }

      logger.info('Attempting to download file from path:', { filePath });

      const file = bucket.file(decodeURIComponent(filePath));
      const [buffer] = await file.download();
      const [metadata] = await file.getMetadata();
      imageBuffer = buffer;
      contentType = metadata.contentType || 'image/jpeg';

      logger.info('File downloaded successfully', { size: imageBuffer.length, contentType });

    } catch (downloadError) {
      logger.error("Error downloading image from storage", downloadError, { photoUrl: player.photoUrl });
      return { error: "No se pudo acceder a tu foto de perfil actual. Intenta subirla de nuevo." };
    }
    
    const photoDataUri = `data:${contentType};base64,${imageBuffer.toString('base64')}`;
    // --- END ROBUST FILE HANDLING ---

    const generatedImageDataUri = await generatePlayerCardImage(photoDataUri);

    const generatedImageBuffer = Buffer.from(generatedImageDataUri.split(',')[1], 'base64');
    const newFilePath = `profile-images/${userId}/generated_${Date.now()}.png`;
    const newFile = adminStorage.file(newFilePath);
    
    await newFile.save(generatedImageBuffer, {
      metadata: { contentType: 'image/png' },
    });
    
    // Make the file public to get a predictable URL
    await newFile.makePublic();

    // The public URL has a predictable format
    const newPhotoURL = `https://storage.googleapis.com/${adminStorage.name}/${newFilePath}`;

    const batch = adminDb.batch();
    const userRef = adminDb.doc(`users/${userId}`);
    batch.update(userRef, { photoURL: newPhotoURL });
    batch.update(playerRef, {
      photoUrl: newPhotoURL,
      cardGenerationCredits: FieldValue.increment(-1),
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
    // Return a structured error to prevent the server from crashing
    return { error: error.message || "Un error inesperado ocurrió en el servidor." };
  }
}
