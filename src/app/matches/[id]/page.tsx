
'use client';

import { useParams } from 'next/navigation';
import MatchDetailView from '@/components/match-detail-view';
import { Loader2 } from 'lucide-react';
import { Suspense } from 'react';

export default function MatchDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  if (!id || typeof id !== 'string') {
    return <div className="text-center p-8">ID de partido no válido.</div>;
  }

  return (
    <Suspense fallback={<div className="flex justify-center items-center h-full"><Loader2 className="h-12 w-12 animate-spin"/></div>}>
        <MatchDetailView matchId={id} />
    </Suspense>
  );
}
