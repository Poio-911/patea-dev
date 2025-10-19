
import PerformEvaluationView from '@/components/perform-evaluation-view';

// This is now a simple, compliant Server Component.
// Its only job is to get the `matchId` from the URL and pass it to the client component.
export default function PerformEvaluationPage({ params }: { params: { matchId: string } }) {
  if (!params.matchId || typeof params.matchId !== 'string') {
    return <div>ID de partido no válido.</div>;
  }
  return <PerformEvaluationView matchId={params.matchId} />;
}
