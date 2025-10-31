
'use client';

import { Suspense } from 'react';
import PerformEvaluationView from '@/components/perform-evaluation-view';
import { useSearchParams, useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

function EvaluationPageContent() {
  const { matchId } = useParams();
  const searchParams = useSearchParams();
  const assignmentIdsParam = searchParams.get('assignments');

  if (!matchId || typeof matchId !== 'string') {
    return <div>ID de partido no válido.</div>;
  }
  
  const assignmentIds = assignmentIdsParam ? assignmentIdsParam.split(',') : [];

  return <PerformEvaluationView matchId={matchId} assignmentIds={assignmentIds} />;
}


export default function PerformEvaluationPage() {
  return (
    <Suspense fallback={<div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <EvaluationPageContent />
    </Suspense>
  );
}
