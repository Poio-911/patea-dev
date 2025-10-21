
'use client';

import PerformEvaluationView from '@/components/perform-evaluation-view';

export default function PerformEvaluationPage({ params }: { params: { matchId: string } }) {
  const { matchId } = params;

  if (!matchId || typeof matchId !== 'string') {
    return <div>ID de partido no válido.</div>;
  }

  return <PerformEvaluationView matchId={matchId} />;
}
