
'use server';

import { getAdminAuth } from '../firebase/admin-init';
import { getAdminDb } from '../firebase/admin-init';
import { logger } from '../lib/logger';
import { cookies } from 'next/headers';
import { createError, ErrorCodes } from './errors';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { requireAuth } from './auth/get-server-session';
import type { Player } from './types';

const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days

export async function createSessionCookie(idToken: string) {
  try {


    const decodedIdToken = await getAdminAuth().verifyIdToken(idToken, true);
    const authTime = decodedIdToken.auth_time;
    const currentTime = new Date().getTime() / 1000;
    const timeDiff = currentTime - authTime;



    if (timeDiff < 5 * 60) {
      const sessionCookie = await getAdminAuth().createSessionCookie(idToken, { expiresIn });

      const isDevelopment = process.env.NODE_ENV !== 'production';
      const options = {
        name: 'session',
        value: sessionCookie,
        maxAge: expiresIn,
        httpOnly: true,
        secure: !isDevelopment, // Allow non-secure in development
        path: '/',
        sameSite: 'lax' as const,
      };



      cookies().set(options);

      // Verify cookie was set
      const setCookie = cookies().get('session');


      return { success: true };
    } else {
      logger.error('Recent sign-in required - time diff:', timeDiff);
      return { success: false, error: 'Recent sign-in required.' };
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Error creating session cookie', error);
    console.error('[createSessionCookie] Full error:', errorMessage);
    if (error instanceof Error && error.stack) console.error('[createSessionCookie] Stack:', error.stack);
    return { success: false, error: `Failed to create session cookie: ${errorMessage}` };
  }
}

export async function clearSessionCookie() {
  try {
    cookies().delete('session');
    return { success: true };
  } catch (error) {
    logger.error('Error clearing session cookie', error);
    return { success: false, error: 'Failed to clear session cookie.' };
  }
}

export async function initializeUserProfileAction(input: {
  email: string | null;
  displayName: string;
  position: Player['position'];
  photoURL?: string | null;
}) {
  try {
    const userId = await requireAuth();
    const db = getAdminDb();
    const userRef = db.collection('users').doc(userId);
    const playerRef = db.collection('players').doc(userId);

    const [userSnap, playerSnap] = await Promise.all([userRef.get(), playerRef.get()]);
    if (userSnap.exists && playerSnap.exists) {
      return { success: true, alreadyInitialized: true };
    }

    const batch = db.batch();
    const baseStat = 50;

    if (!userSnap.exists) {
      batch.set(userRef, {
        uid: userId,
        email: input.email,
        displayName: input.displayName,
        photoURL: input.photoURL || null,
        groups: [],
        activeGroupId: null,
      });
    }

    if (!playerSnap.exists) {
      const newPlayer: Omit<Player, 'id'> = {
        name: input.displayName,
        position: input.position,
        pac: baseStat,
        sho: baseStat,
        pas: baseStat,
        dri: baseStat,
        def: baseStat,
        phy: baseStat,
        ovr: baseStat,
        photoUrl: input.photoURL || '',
        stats: { matchesPlayed: 0, goals: 0, assists: 0, averageRating: 0 },
        ownerUid: userId,
        groupId: null,
        cardGenerationCredits: 3,
        lastCreditReset: new Date().toISOString(),
      };
      batch.set(playerRef, newPlayer);
    }

    await batch.commit();
    return { success: true };
  } catch (error: any) {
    logger.error('Error initializing user profile', error);
    return { success: false, error: error.message || 'No se pudo inicializar la cuenta.' };
  }
}

export async function initializeOrganizerProfileAction(input: {
  email: string | null;
  displayName: string;
}) {
  try {
    const userId = await requireAuth();
    const db = getAdminDb();
    const userRef = db.collection('users').doc(userId);

    const userSnap = await userRef.get();
    
    // If it exists, just update the role to organizer so they get the powers
    if (userSnap.exists) {
      await userRef.set({ role: 'organizer' }, { merge: true });
      return { success: true, alreadyInitialized: true };
    }

    // Create new Organizer user
    await userRef.set({
      uid: userId,
      email: input.email,
      displayName: input.displayName,
      role: 'organizer',
      groups: [],
      organizedLeagues: [],
      activeGroupId: null,
      createdAt: new Date().toISOString()
    });

    return { success: true };
  } catch (error: any) {
    logger.error('Error initializing organizer profile', error);
    return { success: false, error: error.message || 'No se pudo inicializar la cuenta de organizador.' };
  }
}

export async function ensureUserProfileDocumentAction(input: {
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
}) {
  try {
    const userId = await requireAuth();
    const db = getAdminDb();
    const userRef = db.collection('users').doc(userId);
    const userSnap = await userRef.get();

    if (userSnap.exists) {
      return { success: true, alreadyExists: true };
    }

    await userRef.set({
      uid: userId,
      email: input.email,
      displayName: input.displayName,
      photoURL: input.photoURL || null,
      createdAt: new Date().toISOString(),
      groups: [],
      activeGroupId: null,
    }, { merge: true });

    return { success: true };
  } catch (error: any) {
    logger.error('Error ensuring user profile document', error);
    return { success: false, error: error.message || 'No se pudo asegurar el perfil de usuario.' };
  }
}

export async function syncPlayerActiveGroupAction(activeGroupId: string | null) {
  try {
    const userId = await requireAuth();
    const db = getAdminDb();
    const playerRef = db.collection('players').doc(userId);
    const playerSnap = await playerRef.get();

    if (!playerSnap.exists) {
      return { success: false, error: 'Jugador no encontrado.' };
    }

    await playerRef.set({ groupId: activeGroupId }, { merge: true });
    return { success: true };
  } catch (error: any) {
    logger.error('Error syncing player active group', error);
    return { success: false, error: error.message || 'No se pudo sincronizar el grupo activo del jugador.' };
  }
}

export async function updateOrganizerProfileAction(input: {
  displayName?: string;
  phoneNumber?: string;
  organizationName?: string;
  contactEmail?: string;
  bio?: string;
}) {
  try {
    const userId = await requireAuth();
    const db = getAdminDb();
    const userRef = db.collection('users').doc(userId);

    const updates: Record<string, any> = {
      updatedAt: new Date().toISOString(),
    };

    if (input.displayName !== undefined) updates.displayName = input.displayName;
    if (input.phoneNumber !== undefined) updates.phoneNumber = input.phoneNumber;

    if (
      input.organizationName !== undefined ||
      input.contactEmail !== undefined ||
      input.bio !== undefined
    ) {
      updates.organizerProfile = {
        ...(input.organizationName !== undefined ? { organizationName: input.organizationName } : {}),
        ...(input.contactEmail !== undefined ? { contactEmail: input.contactEmail } : {}),
        ...(input.bio !== undefined ? { bio: input.bio } : {}),
      };
    }

    await userRef.set(updates, { merge: true });

    if (input.displayName !== undefined && input.displayName.trim().length > 0) {
      await getAdminAuth().updateUser(userId, { displayName: input.displayName.trim() });
    }

    return { success: true };
  } catch (error: any) {
    logger.error('Error updating organizer profile', error);
    return { success: false, error: error.message || 'No se pudo actualizar el perfil del organizador.' };
  }
}
