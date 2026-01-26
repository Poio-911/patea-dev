"use client";

import React, { useMemo, useEffect, useState } from 'react';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Match } from '@/lib/types';
import { Eye, Clock } from 'lucide-react';
import { usePathname } from 'next/navigation';

function useClock(baseMinute: number, periodStartMs: number | null, running: boolean) {
  const [mm, setMm] = useState(baseMinute);
  const [ss, setSs] = useState(0);
  useEffect(() => {
    let t: any;
    if (running && periodStartMs) {
      t = setInterval(() => {
        const elapsed = Math.max(0, Math.floor((Date.now() - periodStartMs) / 1000));
        setMm(baseMinute + Math.floor(elapsed / 60));
        setSs(elapsed % 60);
      }, 1000);
    } else {
      setMm(baseMinute);
      setSs(0);
    }
    return () => t && clearInterval(t);
  }, [baseMinute, periodStartMs, running]);
  return { mm, ss };
}

export function GlobalLiveAdminWidget() {
  const firestore = useFirestore();
  const { user } = useUser();
  const pathname = usePathname();

  const q1 = useMemo(() => firestore && user?.uid ? query(
    collection(firestore, 'matches'),
    where('ownerUid','==', user.uid),
    where('status','==','active'),
    where('liveStatus','==','first_half')
  ) : null, [firestore, user?.uid]);
  const q2 = useMemo(() => firestore && user?.uid ? query(
    collection(firestore, 'matches'),
    where('ownerUid','==', user.uid),
    where('status','==','active'),
    where('liveStatus','==','second_half')
  ) : null, [firestore, user?.uid]);
  const { data: m1 } = useCollection<Match>(q1);
  const { data: m2 } = useCollection<Match>(q2);
  const match = (m1 && m1[0]) || (m2 && m2[0]) || null;

  const baseMinute = match?.currentMinute || 0;
  const periodStartMs = match?.periodStartTs ? new Date((match as any).periodStartTs?.toDate?.() || match.periodStartTs).getTime() : null;
  const running = !!match && !match.timerPaused && (match.liveStatus === 'first_half' || match.liveStatus === 'second_half');
  const { mm, ss } = useClock(baseMinute, periodStartMs, running);

  // Ocultar si estamos en la página del partido
  if (!match || !running || (pathname && pathname.startsWith('/matches/'))) return null;

  const t1 = match.teams?.[0]?.name || 'Equipo 1';
  const t2 = match.teams?.[1]?.name || 'Equipo 2';

  return (
    <a
      href={`/matches/${match.id}`}
      className="fixed z-50 rounded-xl bg-card/90 text-foreground border border-border shadow-lg px-3 py-2 flex items-center gap-2 backdrop-blur supports-[backdrop-filter]:bg-card/70"
      style={{
        right: '16px',
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 88px)',
      }}
      aria-label={`Abrir partido ${t1} vs ${t2}`}
    >
      <div className="flex flex-col">
        <span className="text-[11px] font-medium leading-none max-w-[180px] truncate">{t1} vs {t2}</span>
        <span className="text-[11px] font-mono flex items-center gap-1 mt-1"><Clock className="h-3 w-3" />{mm}:{String(ss).padStart(2, '0')}</span>
      </div>
    </a>
  );
}
