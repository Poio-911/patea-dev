'use client';
import { useEffect, useState, createContext, useContext } from 'react';
import type { User } from 'firebase/auth';
import { useAuth } from '@/firebase';
import { doc, setDoc, getDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { useFirestore } from '@/firebase';

export interface UserData extends User {
  groups?: string[];
  activeGroupId?: string;
}

const UserContext = createContext<{ user: UserData | null; loading: boolean }>({
  user: null,
  loading: true,
});

export const useUser = () => useContext(UserContext);

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const auth = useAuth();
  const firestore = useFirestore();
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('[useUser] useEffect triggered. Auth:', !!auth, 'Firestore:', !!firestore);
    if (!auth || !firestore) {
      if (loading) setLoading(false);
      return;
    };
    
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      console.log('[useUser] onAuthStateChanged triggered. User:', firebaseUser?.uid || 'null');
      if (firebaseUser) {
        const userRef = doc(firestore, 'users', firebaseUser.uid);
        console.log('[useUser] Setting up onSnapshot for userRef:', userRef.path);
        
        const unsubUser = onSnapshot(userRef, (userDoc) => {
          console.log('[useUser] onSnapshot received update. Doc exists:', userDoc.exists());
          if (!userDoc.exists()) {
            console.log('[useUser] User doc does not exist, creating it...');
            // Create user profile if it doesn't exist
            const newUserProfile = {
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
                console.log('[useUser] New user profile created. Setting user state.');
                setUser(newUserProfile as UserData);
              })
              .catch(e => {
                console.error("[useUser] Error creating user profile:", e);
              })
              .finally(() => {
                setLoading(false);
              });
          } else {
             const userData = userDoc.data() as UserData;
             console.log('[useUser] User doc exists. activeGroupId:', userData.activeGroupId, 'Setting user state.');
             setUser(userData);
             setLoading(false);
          }
        }, (error) => {
          console.error("[useUser] Error listening to user document:", error);
          setUser(null);
          setLoading(false);
        });

        return () => {
          console.log('[useUser] Unsubscribing from user snapshot.');
          unsubUser();
        };
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      console.log('[useUser] Unsubscribing from auth state changes.');
      unsubscribe();
    };
  }, [auth, firestore, loading]);

  return (
    <UserContext.Provider value={{ user, loading }}>
      {children}
    </UserContext.Provider>
  );
};
