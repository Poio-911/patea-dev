'use client';

import { useUser, useFirestore, useCollection } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import type { SocialActivity, Follow } from '@/lib/types';
import { useMemo, useState, useTransition } from 'react';
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

  // Query for social activities (always include own userId, cap to 10 IDs for 'in')
  const activitiesQuery = useMemo(() => {
    if (!firestore || !user) return null;
    const uniqueFollowing = Array.from(new Set(followingIds));
    if (uniqueFollowing.length === 0) {
      return query(
        collection(firestore, 'socialActivities'),
        where('userId', '==', user.uid),
        orderBy('timestamp', 'desc'),
        limit(50)
      );
    }
    const sliceSize = 9; // one slot reserved for current user
    const subset = uniqueFollowing.slice(0, sliceSize);
    const targetIds = [user.uid, ...subset];
    if (targetIds.length === 1) {
      return query(
        collection(firestore, 'socialActivities'),
        where('userId', '==', targetIds[0]),
        orderBy('timestamp', 'desc'),
        limit(50)
      );
    }
    return query(
      collection(firestore, 'socialActivities'),
      where('userId', 'in', targetIds),
      orderBy('timestamp', 'desc'),
      limit(50)
    );
  }, [firestore, user, followingIds]);

  const { data: activities, loading: activitiesLoading, error: activitiesError, refetch } = useCollection<SocialActivity>(activitiesQuery);
  const [seeding, startSeeding] = useTransition();
  const [seedError, setSeedError] = useState<string | null>(null);
  const [seedSuccess, setSeedSuccess] = useState<string | null>(null);

  const handleSeed = () => {
    if (!user) return;
    setSeedError(null);
    setSeedSuccess(null);
    startSeeding(async () => {
      try {
        const res = await fetch('/api/seed-activities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.uid }),
        });
        const json = await res.json();
        if (!json.success) {
          setSeedError(json.error || 'Error desconocido');
        } else {
          setSeedSuccess(`Sembradas ${json.count} actividades de prueba`);
          // Refrescar colección
          refetch();
        }
      } catch (e: any) {
        setSeedError(e?.message || 'Fallo inesperado');
      }
    });
  };

  if (!user) {
    return <div className="p-8">Inicia sesión para ver tu feed.</div>;
  }

  const isLoading = followsLoading || activitiesLoading;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Feed" description="Actividad reciente de jugadores que sigues." />
      <div className="flex justify-end">
        <button
          onClick={handleSeed}
          disabled={seeding}
          className="px-2 py-1 text-[11px] rounded border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-50"
        >
          {seeding ? 'Sembrando…' : 'Seed test'}
        </button>
      </div>
      
      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="ml-2">Cargando feed...</span>
        </div>
      )}
      
      {!isLoading && activitiesError && (
        <div className="text-center py-8 text-sm text-red-500">
          Error al cargar actividades: {activitiesError.message}
          <div className="mt-2 text-xs text-neutral-500">Prueba el botón "Seed test" o revisa índices en Firestore.</div>
        </div>
      )}
      {!isLoading && !activitiesError && (!activities || activities.length === 0) && (
        <div className="text-center py-8 text-sm text-muted-foreground">
          <p>Todavía no hay actividad en tu feed.</p>
          <p className="mt-2 text-xs">• Seguí a otros jugadores para ver sus actividades</p>
          <p className="text-xs">• Jugá partidos y evaluá para generar actividad</p>
          <p className="text-xs">• Creá jugadores nuevos para actividad</p>
          <div className="mt-4 flex justify-center">
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="px-3 py-1.5 text-xs rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50"
            >
              {seeding ? 'Sembrando...' : 'Sembrar actividades de prueba'}
            </button>
          </div>
          {seedError && <p className="mt-2 text-xs text-red-500">{seedError}</p>}
          {seedSuccess && <p className="mt-2 text-xs text-emerald-600">{seedSuccess}</p>}
        </div>
      )}

      {!isLoading && activities && activities.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="px-2 py-1 text-[11px] rounded border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-50"
          >
            {seeding ? 'Sembrando…' : 'Seed test'}
          </button>
        </div>
      )}
      
      {!isLoading && activities && activities.length > 0 && (
        <>
          <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
            {activities.map(a => <ActivityCard key={a.id} activity={a} />)}
          </div>
          
          {followingIds.length > 9 && (
            <div className="text-xs text-neutral-500 text-center">
              Mostrando actividad propia y de los primeros 9 seguidos (total: {followingIds.length}).
            </div>
          )}
        </>
      )}
    </div>
  );
}
