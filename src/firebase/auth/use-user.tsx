
'use client';
import { useEffect, useState, createContext, useContext } from 'react';
import type { User } from 'firebase/auth';
import { useAuth } from '@/firebase';
import { doc, setDoc, getDoc, serverTimestamp, onSnapshot, FieldValue } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import type { UserProfile, Player } from '@/lib/types';
import { logger } from '@/lib/logger';
import { CREDITS } from '@/lib/constants';

const UserContext = createContext<{ user: UserProfile | null; loading: boolean }>({
  user: null,
  loading: true,
});

export const useUser = () => useContext(UserContext);

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const auth = useAuth();
  const firestore = useFirestore();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth || !firestore) {
      if (loading) setLoading(false);
      return;
    };

    let unsubUser: (() => void) | null = null;

    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (unsubUser) {
          unsubUser();
          unsubUser = null;
      }
      
      if (firebaseUser) {
        const userRef = doc(firestore, 'users', firebaseUser.uid);

        unsubUser = onSnapshot(userRef, async (userDoc) => {
          if (userDoc.exists()) {
             const userData = userDoc.data() as UserProfile;

             // ✅ FIX: Start with Firestore data and overwrite with fresh auth data.
             // This prevents duplicate property errors.
             // IMPORTANT: photoURL comes from Firestore (source of truth), not from stale auth data
             const freshUserProfile: UserProfile = {
                ...userData, // Firestore data has priority (e.g. activeGroupId, uid, photoURL)
                email: firebaseUser.email,
                displayName: firebaseUser.displayName,
                photoURL: userData.photoURL || firebaseUser.photoURL, // Use Firestore photoURL (updated in real-time)
             };

             // --- DATA REPAIR & CREDIT RESET LOGIC ---
             const playerRef = doc(firestore, 'players', firebaseUser.uid);
             try {
              const playerDoc = await getDoc(playerRef);
              if (playerDoc.exists()) {
                const playerData = playerDoc.data() as Player;
                const updates: Partial<Player> = {};

                if (userData.activeGroupId && playerData.groupId !== userData.activeGroupId) {
                  updates.groupId = userData.activeGroupId;
                }

                // CLIENT-SIDE FALLBACK via API: trigger server-side monthly credit reset if needed
                // Uses a server action to ensure serverTimestamp consistency.
                const now = new Date();
                const currentMonth = `${now.getFullYear()}-${now.getMonth() + 1}`;
                const lastChecked = typeof window !== 'undefined' ? localStorage.getItem('creditResetCheck') : null;
                if (lastChecked !== currentMonth) {
                  try {
                    const res = await fetch('/api/credits/reset-monthly', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ userId: firebaseUser.uid }),
                    });
                    const json = await res.json();
                    if (!json?.success) {
                      logger.warn('[Credit Reset Fallback] API reset failed', { userId: firebaseUser.uid, error: json?.error });
                    }
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('creditResetCheck', currentMonth);
                    }
                  } catch (err) {
                    logger.error('[Credit Reset Fallback] API call error', err, { userId: firebaseUser.uid });
                  }
                }

                if (Object.keys(updates).length > 0) {
                  logger.info('Syncing player data', { userId: firebaseUser.uid, updates });
                  // Update only group-related fields client-side; credit reset happens server-side
                  await setDoc(playerRef, updates, { merge: true });
                }
              }
             } catch (e) {
              logger.error("Failed to sync player data or trigger credit reset:", e, { userId: firebaseUser.uid });
             }
             
             setUser(freshUserProfile);
             setLoading(false);

          } else {
            // This part is now primarily for brand new users after registration.
            const newUserProfile: UserProfile & { createdAt: FieldValue } = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              createdAt: serverTimestamp(),
              groups: [],
              activeGroupId: null,
            };
            setDoc(userRef, newUserProfile)
              .then(() => {
                setUser(newUserProfile);
              })
              .catch(e => {
                logger.error("[useUser] Error creating user profile:", e, { uid: firebaseUser.uid });
              })
              .finally(() => {
                setLoading(false);
              });
          }
        }, (error) => {
          logger.error("[useUser] Error listening to user document:", error, { uid: firebaseUser.uid });
          setUser(null);
          setLoading(false);
        });
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubUser) {
        unsubUser();
      }
    };
  }, [auth, firestore]);

  return (
    <UserContext.Provider value={{ user, loading }}>
      {children}
    </UserContext.Provider>
  );
};
