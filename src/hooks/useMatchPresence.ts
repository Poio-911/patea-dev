"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, doc, onSnapshot, query, setDoc, where } from 'firebase/firestore';
import { serverTimestamp } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useUser } from '@/firebase';

export type ViewerPresence = {
  id: string; // document id (uid or anon-id)
  userId?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  lastSeenAt: number; // epoch ms for local filtering
};

type Options = {
  matchId: string;
  track: boolean; // when true, write/update a presence doc periodically
  staleMs?: number; // how long a viewer remains 'active' without heartbeat
  optimisticSelf?: boolean; // include self immediately before first snapshot
};

export function useMatchPresence({ matchId, track, staleMs = 5 * 60 * 1000, optimisticSelf = true }: Options) {
  const firestore = useFirestore();
  const { user } = useUser();
  const [viewers, setViewers] = useState<ViewerPresence[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Stable viewer id (uid or device anon)
  const viewerId = useMemo(() => {
    if (typeof window === 'undefined') return undefined;
    if (user?.uid) return user.uid;
    const key = 'anonViewerId';
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const generated = `anon_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(key, generated);
    return generated;
  }, [user?.uid]);

  // Write presence heartbeat when tracking is enabled
  useEffect(() => {
    // Only track presence if we have firestore, matchId, tracking is on, we have a viewerId, AND we have a logged-in user.
    // Unauthenticated users (guests) cannot write to 'presence' collection due to security rules.
    if (!firestore || !matchId || !track || !viewerId || !user) return;

    const ref = doc(firestore, 'matches', matchId, 'presence', viewerId);

    // Initial write
    setDoc(ref, {
      userId: user?.uid ?? null,
      displayName: user?.displayName ?? null,
      photoURL: user?.photoURL ?? null,
      lastSeen: serverTimestamp(),
      lastSeenAt: Date.now(),
    }, { merge: true }).catch(() => { });

    // Optimistic self add
    if (optimisticSelf) {
      setViewers((prev) => {
        const exists = prev.some(v => v.id === viewerId);
        if (exists) return prev;
        return [
          { id: viewerId, userId: user?.uid ?? null, displayName: user?.displayName ?? null, photoURL: user?.photoURL ?? null, lastSeenAt: Date.now() },
          ...prev,
        ];
      });
    }

    // Heartbeat every 25s
    intervalRef.current = setInterval(() => {
      setDoc(ref, {
        lastSeen: serverTimestamp(),
        lastSeenAt: Date.now(),
      }, { merge: true }).catch(() => { });
    }, 25000);

    // Update on visibility changes (minimize/back/return)
    const onVis = () => {
      setDoc(ref, { lastSeen: serverTimestamp(), lastSeenAt: Date.now() }, { merge: true }).catch(() => { });
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVis);
      window.addEventListener('focus', onVis);
      window.addEventListener('blur', onVis);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      // Final touch
      setDoc(ref, {
        lastSeen: serverTimestamp(),
        lastSeenAt: Date.now(),
      }, { merge: true }).catch(() => { });
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVis);
        window.removeEventListener('focus', onVis);
        window.removeEventListener('blur', onVis);
      }
    };
  }, [firestore, matchId, optimisticSelf, track, user, viewerId]);

  // Listen to presence list
  useEffect(() => {
    if (!firestore || !matchId) return;

    const presenceCol = collection(firestore, 'matches', matchId, 'presence');
    const unsub = onSnapshot(presenceCol, (snap) => {
      const now = Date.now();
      const fresh = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter((d) => typeof d.lastSeenAt === 'number' && now - d.lastSeenAt < staleMs)
        .map((d) => ({
          id: String(d.id),
          userId: d.userId ?? null,
          displayName: d.displayName ?? null,
          photoURL: d.photoURL ?? null,
          lastSeenAt: Number(d.lastSeenAt),
        } as ViewerPresence));
      setViewers(fresh);
    });

    return () => unsub();
  }, [firestore, matchId, staleMs]);

  return {
    viewers,
    count: viewers.length,
  };
}
