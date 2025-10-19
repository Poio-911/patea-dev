
import PerformEvaluationView from '@/components/perform-evaluation-view';

export default function PerformEvaluationPage({ params }: { params: { matchId: string } }) {
  if (!params.matchId || typeof params.matchId !== 'string') {
    return <div>ID de partido no válido.</div>;
  }
  return <PerformEvaluationView matchId={params.matchId} />;
}
