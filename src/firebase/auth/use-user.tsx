
'use client';
import { useEffect, useState, createContext, useContext } from 'react';
import type { User } from 'firebase/auth';
import { useAuth } from '@/firebase';
import { doc, setDoc, getDoc, serverTimestamp, onSnapshot, FieldValue, updateDoc, getFirestore } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import type { UserProfile, Player } from '@/lib/types';

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
    
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        const userRef = doc(firestore, 'users', firebaseUser.uid);
        
        const unsubUser = onSnapshot(userRef, async (userDoc) => {
          if (userDoc.exists()) {
             const userData = userDoc.data() as UserProfile;
             
             // --- DATA REPAIR & CREDIT RESET LOGIC ---
             const playerRef = doc(firestore, 'players', firebaseUser.uid);
             try {
                const playerDoc = await getDoc(playerRef);
                if (playerDoc.exists()) {
                    const playerData = playerDoc.data() as Player;
                    const updates: Partial<Player> = {};

                    // Sync player's groupId if out of sync with user's activeGroupId
                    if (userData.activeGroupId && playerData.groupId !== userData.activeGroupId) {
                        updates.groupId = userData.activeGroupId;
                    }

                    // Monthly credit reset logic
                    const now = new Date();
                    const lastReset = playerData.lastCreditReset ? new Date(playerData.lastCreditReset) : null;

                    if (!lastReset || (lastReset.getMonth() !== now.getMonth() || lastReset.getFullYear() !== now.getFullYear())) {
                        updates.cardGenerationCredits = 3;
                        updates.lastCreditReset = now.toISOString();
                    }

                    if (Object.keys(updates).length > 0) {
                        console.log(`Syncing player data for ${userData.displayName}:`, updates);
                        await updateDoc(playerRef, updates);
                    }
                }
             } catch (e) {
                console.error("Failed to sync player data or reset credits:", e);
             }
             // --- END REPAIR & CREDIT RESET LOGIC ---

             setUser(userData);
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
                console.error("[useUser] Error creating user profile:", e);
              })
              .finally(() => {
                setLoading(false);
              });
          }
        }, (error) => {
          console.error("[useUser] Error listening to user document:", error);
          setUser(null);
          setLoading(false);
        });

        return () => {
          unsubUser();
        };
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [auth, firestore, loading]);

  return (
    <UserContext.Provider value={{ user, loading }}>
      {children}
    </UserContext.Provider>
  );
};
