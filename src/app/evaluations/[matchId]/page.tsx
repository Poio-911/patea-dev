import { PerformEvaluationView } from '@/components/perform-evaluation-view'

export default async function PerformEvaluationPage({
  params,
}: {
  params: { matchId: string }
}) {
  const { matchId } = params

  if (!matchId) {
    return <div>ID de partido no válido.</div>
  }

  return <PerformEvaluationView matchId={matchId} />
}
