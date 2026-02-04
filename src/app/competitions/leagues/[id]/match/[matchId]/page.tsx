'use client';

import { useParams } from 'next/navigation';
import { useMemo } from 'react';
import { useDoc, useFirestore, useUser } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Match } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { LeagueMatchView } from '@/components/league/LeagueMatchView';

export default function LeagueMatchManagePage() {
  const params = useParams<{ id: string; matchId: string }>();
  const leagueId = params?.id;
  const matchId = params?.matchId;
  const firestore = useFirestore();
  const { user } = useUser();

  const matchRef = useMemo(() => {
    if (!firestore || !matchId) return null;
    return doc(firestore, 'matches', matchId as string);
  }, [firestore, matchId]);

  const { data: match, loading: matchLoading } = useDoc<Match>(matchRef);

  if (matchLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-12 w-12 animate-spin" />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="text-center p-8">
        <h2 className="text-xl font-bold">Partido no encontrado</h2>
      </div>
    );
  }

  if (!user?.uid || !leagueId) {
    return (
      <div className="text-center p-8">
        <h2 className="text-xl font-bold">Acceso no autorizado</h2>
      </div>
    );
  }

  return (
    <LeagueMatchView
      match={match}
      leagueId={leagueId as string}
      userId={user.uid}
    />
  );
}
