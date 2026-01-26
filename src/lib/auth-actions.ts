
'use server';

import { getAdminAuth } from '../firebase/admin-init';
import { logger } from '../lib/logger';
import { cookies } from 'next/headers';
import { createError, ErrorCodes } from './errors';
import { signInWithEmailAndPassword } from 'firebase/auth';

const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days

export async function createSessionCookie(idToken: string) {
  try {
    console.log('[createSessionCookie] Starting session creation...');
    
    const decodedIdToken = await getAdminAuth().verifyIdToken(idToken, true);
    const authTime = decodedIdToken.auth_time;
    const currentTime = new Date().getTime() / 1000;
    const timeDiff = currentTime - authTime;
    
    console.log('[createSessionCookie] Auth time check:', { authTime, currentTime, timeDiff });
    
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
      
      console.log('[createSessionCookie] Setting cookie with options:', {
        name: options.name,
        hasValue: !!options.value,
        maxAge: options.maxAge,
        httpOnly: options.httpOnly,
        secure: options.secure,
        isDevelopment
      });
      
      cookies().set(options);
      
      // Verify cookie was set
      const setCookie = cookies().get('session');
      console.log('[createSessionCookie] Cookie verification:', { 
        wasSet: !!setCookie, 
        valueLength: setCookie?.value?.length || 0 
      });
      
      return { success: true };
    } else {
      logger.error('Recent sign-in required - time diff:', timeDiff);
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
