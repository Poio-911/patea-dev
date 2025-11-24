
'use server';

import { getAdminAuth } from '../firebase/admin-init';
import { logger } from '../lib/logger';
import { cookies } from 'next/headers';
import { createError, ErrorCodes } from './errors';
import { signInWithEmailAndPassword } from 'firebase/auth';

const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days

export async function createSessionCookie(idToken: string) {
  try {
    const decodedIdToken = await getAdminAuth().verifyIdToken(idToken, true);
    if (new Date().getTime() / 1000 - decodedIdToken.auth_time < 5 * 60) {
      const sessionCookie = await getAdminAuth().createSessionCookie(idToken, { expiresIn });
      const options = {
        name: 'session',
        value: sessionCookie,
        maxAge: expiresIn,
        httpOnly: true,
        secure: true,
      };
      cookies().set(options);
      return { success: true };
    } else {
      logger.error('Recent sign-in required');
      return { success: false, error: 'Recent sign-in required.' };
    }
  } catch (error) {
    logger.error('Error creating session cookie', error);
    return { success: false, error: 'Failed to create session cookie.' };
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
