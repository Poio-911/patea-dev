'use client';

import { useUser, useFirestore, useCollection } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import type { SocialActivity, Follow } from '@/lib/types';
import { useMemo } from 'react';
import ActivityCard from '@/components/social/activity-card';
import { Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/page-header';

export default function FeedPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const followsQuery = useMemo(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'follows'), where('followerId', '==', user.uid));
  }, [firestore, user]);
  const { data: follows, loading: followsLoading } = useCollection<Follow>(followsQuery);

  const followingIds = useMemo(() => (follows || []).map(f => f.followingId), [follows]);

  const feedQuery = useMemo(() => {
    if (!firestore || !user) return null;
    // If user follows no one, show own activities
    if (followingIds.length === 0) {
      return query(
        collection(firestore, 'socialActivities'),
        where('userId', '==', user.uid),
        orderBy('timestamp', 'desc'),
        limit(50)
      );
    }
    // Firestore 'in' max 10; for >10 fallback to slice
    const slice = followingIds.slice(0, 10);
    return query(
      collection(firestore, 'socialActivities'),
      where('userId', 'in', slice),
      orderBy('timestamp', 'desc'),
      limit(50)
    );
  }, [firestore, user, followingIds]);

  const { data: activities, loading: feedLoading } = useCollection<SocialActivity>(feedQuery);

  if (!user) {
    return <div className="p-8">Inicia sesión para ver tu feed.</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Feed" description="Actividad reciente de jugadores que sigues." />
      {(followsLoading || feedLoading) && (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      )}
      {!feedLoading && (!activities || activities.length === 0) && (
        <div className="text-center py-8 text-sm text-muted-foreground">
          Todavía no hay actividad. Sigue jugadores o espera a que se registren partidos y cambios de OVR.
        </div>
      )}
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
        {activities?.map(a => <ActivityCard key={a.id} activity={a} />)}
      </div>
      {followingIds.length > 10 && (
        <div className="text-xs text-neutral-500">
          Mostrando primeros 10 seguidos por limitación de Firestore (in). Pronto fan-out.
        </div>
      )}
    </div>
  );
}
