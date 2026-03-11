
'use server';

import { getAdminDb, getAdminAuth, getAdminStorage } from '../../firebase/admin-init';
import { FieldValue } from 'firebase-admin/firestore';
// Note: generatePlayerCardImage is imported dynamically to avoid loading Genkit during build
import type { Player, Jersey } from '../../lib/types';
import { FEATURE_DISABLED_MESSAGES, isFeatureEnabled } from '../../lib/feature-availability';
import { logger } from '../../lib/logger';
import { sanitizeText } from '../../lib/validation';

export async function generatePlayerCardImageAction(userId: string, jersey?: Jersey) {
  if (!isFeatureEnabled('aiImageGeneration')) {
    return { error: FEATURE_DISABLED_MESSAGES.aiImageGeneration };
  }

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

    // Audit 2.3: Validate size before download
    const [metadata] = await file.getMetadata();
    if (metadata.size && Number(metadata.size) > 5 * 1024 * 1024) {
      return { error: 'La imagen es demasiado grande para procesar (máx 5MB).' };
    }

    const [imageBuffer] = await file.download();
    const photoDataUri = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;

    // Fetch jersey for visual branding
    let finalJersey: Jersey | undefined = jersey;

    // Fallback logic if no jersey was provided by the client
    if (!finalJersey) {
      // 1. Try player.jersey field directly
      if (player.jersey) {
        finalJersey = player.jersey;
      }
      // 2. Try group defaultJersey (legacy/fallback)
      else if (player.groupId) {
        const groupSnap = await db.doc(`groups/${player.groupId}`).get();
        if (groupSnap.exists) {
          finalJersey = (groupSnap.data() as any).defaultJersey;
        }
      }

      // 3. NEW: If still no jersey, try to find a team the player belongs to
      if (!finalJersey && player.groupId) {
        const teamsColl = db.collection('teams');
        const teamsSnap = await teamsColl.where('groupId', '==', player.groupId).get();

        for (const doc of teamsSnap.docs) {
          const teamData = doc.data();
          const isMember = teamData.members?.some((m: any) => m.playerId === sanitizedUserId);
          if (isMember && teamData.jersey) {
            finalJersey = teamData.jersey;
            break;
          }
        }
      }
    }

    // Call AI flow (dynamic import to avoid loading Genkit during build)
    const { generatePlayerCardImage } = await import('../../ai/flows/generate-player-card-image');
    const generatedImageResponse = await generatePlayerCardImage(photoDataUri, finalJersey);

    // Handle both Data URI and URL responses from Gemini
    let generatedImageBuffer: Buffer;
    if (generatedImageResponse.startsWith('data:')) {
      // Data URI format: data:image/png;base64,iVBORw0...
      const base64Data = generatedImageResponse.split(',')[1];
      if (!base64Data) {
        throw new Error('Data URI inválida recibida de la IA');
      }
      generatedImageBuffer = Buffer.from(base64Data, 'base64');
    } else {
      // URL format: https://generativelanguage.googleapis.com/...
      const response = await fetch(generatedImageResponse);
      if (!response.ok) {
        throw new Error('No se pudo descargar la imagen generada por la IA');
      }
      const arrayBuffer = await response.arrayBuffer();
      generatedImageBuffer = Buffer.from(arrayBuffer);
    }
    const newFilePath = `profile-images/${userId}/generated_${Date.now()}.png`;
    const newFile = getAdminStorage().file(newFilePath);

    await newFile.save(generatedImageBuffer, {
      metadata: { contentType: 'image/png' },
    });

    // Make the file public and get standard download URL to match client-side crop behavior
    await newFile.makePublic();

    // Get public download URL (same format as getDownloadURL from client)
    const newPhotoURL = `https://firebasestorage.googleapis.com/v0/b/${getAdminStorage().name}/o/${encodeURIComponent(newFilePath)}?alt=media`;

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

    // Audit 2.3: Validate size before download
    const [metadata] = await file.getMetadata();
    if (metadata.size && Number(metadata.size) > 5 * 1024 * 1024) {
      throw new Error('La imagen es demasiado grande para procesar (máx 5MB).');
    }

    const [imageBuffer] = await file.download();
    const contentType = metadata.contentType || 'image/jpeg';
    const dataUri = `data:${contentType};base64,${imageBuffer.toString('base64')}`;

    return { success: true, dataUri };
  } catch (error: any) {
    logger.error('Error converting storage URL to base64', error);
    return { error: error.message || 'No se pudo convertir la imagen.' };
  }
}
