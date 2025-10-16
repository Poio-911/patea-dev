'use client';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { PageHeader } from '@/components/page-header';
import { PlayerCard } from '@/components/player-card';
import { AddPlayerDialog } from '@/components/add-player-dialog';
import { collection, query, where } from 'firebase/firestore';
import { useMemo } from 'react';

export default function PlayersPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const playersQuery = useMemo(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'players'), where('ownerUid', '==', user.uid));
  }, [firestore, user]);

  const { data: players, loading } = useCollection(playersQuery);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Players"
        description="Manage your team roster and player stats."
      >
        <AddPlayerDialog />
      </PageHeader>
       {loading && <p>Loading players...</p>}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {players?.map((player) => (
          <PlayerCard key={player.id} player={player} />
        ))}
      </div>
    </div>
  );
}
