
'use client';

import PerformEvaluationView from '@/components/perform-evaluation-view';
import { useParams } from 'next/navigation';

export default function PerformEvaluationPage() {
  const { matchId } = useParams();

  if (!matchId || typeof matchId !== 'string') {
    return <div>ID de partido no válido.</div>;
  }

  return <PerformEvaluationView matchId={matchId} />;
}
