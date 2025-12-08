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
    const sessionCookie = cookies().get('session')?.value;

    if (!sessionCookie) {
      return null;
    }

    const adminAuth = getAdminAuth();
    const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);

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
    throw new Error('Authentication required. User is not logged in.');
  }

  return session.user.uid;
}
