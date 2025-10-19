import PerformEvaluationView from '@/components/perform-evaluation-view'

interface PerformEvaluationPageProps {
  params: Promise<{ matchId: string }>
}

export default async function PerformEvaluationPage({ params }: PerformEvaluationPageProps) {
  const { matchId } = await params

  if (!matchId) {
    return <div>ID de partido no válido.</div>
  }

  return <PerformEvaluationView matchId={matchId} />
}
