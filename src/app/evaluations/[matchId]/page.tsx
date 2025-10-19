
import PerformEvaluationView from '@/components/perform-evaluation-view';

/**
 * This is a Server Component that wraps the client-side evaluation view.
 * Its main purpose is to correctly receive the `matchId` from the URL parameters
 * and pass it down to the client component.
 */
export default function PerformEvaluationPage({ params }: { params: { matchId: string } }) {
  // The matchId is extracted from the params object, which is passed by Next.js.
  const { matchId } = params;

  if (!matchId) {
    return <div>ID de partido no válido.</div>;
  }

  // The client component PerformEvaluationView handles all the interactive logic.
  return <PerformEvaluationView matchId={matchId} />;
}
