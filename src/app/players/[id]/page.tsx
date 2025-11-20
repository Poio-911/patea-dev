'use client';

import { useParams } from 'next/navigation';
import PlayerProfileView from '@/components/player-profile-view';
import { useDoc, useFirestore, useUser } from '@/firebase';
import type { Player } from '@/lib/types';
import { doc } from 'firebase/firestore';
import { useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, UserPlus, UserX } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { followUserAction, unfollowUserAction } from '@/lib/actions/social-actions';
import { useState, useEffect } from 'react';
import { collection, query, where } from 'firebase/firestore';
import { useCollection } from '@/firebase';

export default function PlayerDetailPage() {
  const { id: playerId } = useParams();
  const firestore = useFirestore();

  const playerRef = useMemo(() => {
    if (!firestore || !playerId) return null;
    return doc(firestore, 'players', playerId as string);
  }, [firestore, playerId]);
  const { user } = useUser();
  const followsQuery = useMemo(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'follows'), where('followerId', '==', user.uid), where('followingId', '==', player?.ownerUid || '___'));
  }, [firestore, user, player?.ownerUid]);
  const { data: followDocs } = useCollection<any>(followsQuery);
  const isFollowing = (followDocs || []).length > 0;
  const [pending, setPending] = useState(false);

  const { data: player, loading: playerLoading } = useDoc<Player>(playerRef);

  if (playerLoading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!playerId || typeof playerId !== 'string') {
    return <div>ID de jugador no válido.</div>;
  }

  if (!player) {
    return (
        <div className="text-center p-8">
            <h2 className="text-xl font-bold mb-4">Jugador no encontrado</h2>
            <Button asChild variant="outline">
                <Link href="/players">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Volver al Plantel
                </Link>
            </Button>
        </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
            title={player.name}
            description="Perfil y estadísticas del jugador."
        />
        <Button asChild variant="outline" className="self-start sm:self-center">
          <Link href="/players">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al Plantel
          </Link>
        </Button>
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          {user && user.uid !== player.ownerUid && (
            <Button
              disabled={pending}
              variant={isFollowing ? 'outline' : 'default'}
              onClick={async () => {
                if (!user) return;
                setPending(true);
                try {
                  if (isFollowing) {
                    await unfollowUserAction(user.uid, player.ownerUid);
                  } else {
                    await followUserAction(user.uid, player.ownerUid);
                  }
                } finally {
                  setPending(false);
                }
              }}
              className="flex items-center gap-2"
            >
              {isFollowing ? <UserX className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
              {isFollowing ? 'Dejar de seguir' : 'Seguir'}
            </Button>
          )}
        </div>
        <PlayerProfileView playerId={playerId} player={player} />
      </div>
    </div>
  );
}
