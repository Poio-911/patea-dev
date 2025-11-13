
'use client';
import { useEffect, useState, createContext, useContext } from 'react';
import type { User } from 'firebase/auth';
import { useAuth } from '@/firebase';
import { doc, setDoc, getDoc, serverTimestamp, onSnapshot, FieldValue, updateDoc, getFirestore } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import type { UserProfile, Player } from '@/lib/types';
import { logger } from '@/lib/logger';

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

             // ✅ FIX: The local firebaseUser object can be stale. Create a new object with the latest data.
             // This ensures that changes to photoURL or displayName are reflected everywhere immediately.
             const freshUserProfile: UserProfile = {
                // uid is already in userData, so we don't need to specify it again.
                email: firebaseUser.email,
                displayName: firebaseUser.displayName,
                photoURL: firebaseUser.photoURL,
                ...userData, // Firestore data has priority (e.g. activeGroupId, uid)
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

                    const now = new Date();
                    const lastReset = playerData.lastCreditReset ? new Date(playerData.lastCreditReset) : null;

                    if (!lastReset || (lastReset.getMonth() !== now.getMonth() || lastReset.getFullYear() !== now.getFullYear())) {
                        updates.cardGenerationCredits = 3;
                        updates.lastCreditReset = now.toISOString();
                    }

                    if (Object.keys(updates).length > 0) {
                        logger.info('Syncing player data', { userId: firebaseUser.uid, updates });
                        await updateDoc(playerRef, updates);
                    }
                }
             } catch (e) {
                logger.error("Failed to sync player data or reset credits:", e, { userId: firebaseUser.uid });
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
