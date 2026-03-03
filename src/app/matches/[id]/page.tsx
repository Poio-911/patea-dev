'use client';

import { useParams } from 'next/navigation';
import MatchDetailView from '@/components/match-detail-view';
import { BackButton } from '@/components/navigation/back-button';
import { Suspense } from 'react';
import { MatchDetailSkeleton } from '@/components/match-details/MatchDetailSkeleton';

export default function MatchDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  if (!id || typeof id !== 'string') {
    return <div className="text-center p-8">ID de partido no válido.</div>;
  }

  return (
    <Suspense fallback={<MatchDetailSkeleton />}>
      <div className="space-y-4">
        <BackButton href="/matches" label="Volver a Partidos" />
        <MatchDetailView matchId={id} />
      </div>
    </Suspense>
  );
}
