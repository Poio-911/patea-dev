import { cookies } from 'next/headers';
import { getAdminAuth } from '@/firebase/admin-init';

/**
 * Get the current user session in server-side context
 * This replaces the use of auth.currentUser from Client SDK
 * which doesn't work reliably in server actions.
 *
 * @returns User session with uid and email, or null if not authenticated
 */
export async function getServerSession() {
  try {
    const allCookies = cookies();
    const sessionCookie = allCookies.get('session')?.value;

    console.log('[getServerSession] Debug info:', {
      hasSessionCookie: !!sessionCookie,
      cookieNames: Array.from(allCookies.getAll().map(c => c.name)),
      sessionCookieLength: sessionCookie?.length || 0
    });

    if (!sessionCookie) {
      console.log('[getServerSession] No session cookie found');
      return null;
    }

    const adminAuth = getAdminAuth();
    const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);

    console.log('[getServerSession] Session verified for user:', decodedClaims.uid);
    
    return {
      user: {
        uid: decodedClaims.uid,
        email: decodedClaims.email || null,
        emailVerified: decodedClaims.email_verified || false,
      },
    };
  } catch (error) {
    console.error('[getServerSession] Error verifying session:', error);
    return null;
  }
}

/**
 * Helper to get user ID from server session or throw error
 * Use this when authentication is required
 */
export async function requireAuth() {
  const session = await getServerSession();

  if (!session?.user?.uid) {
    console.error('[requireAuth] Authentication failed - no valid session found');
    throw new Error('Authentication required. User is not logged in. Please log in again and ensure cookies are enabled.');
  }

  return session.user.uid;
}
