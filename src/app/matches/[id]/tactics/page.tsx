'use client';

import { useParams, useRouter } from 'next/navigation';
import { useDoc, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Match } from '@/lib/types';
import { Loader2, ArrowLeft } from 'lucide-react';
import { TacticalBoard } from '@/components/tactical-board';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function TacticsPage() {
  const { id: matchId } = useParams();
  const firestore = useFirestore();
  const router = useRouter();

  const matchRef = firestore && matchId ? doc(firestore, 'matches', matchId as string) : null;
  const { data: match, loading: matchLoading, error } = useDoc<Match>(matchRef);

  if (matchLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
        <Alert variant="destructive">
            <AlertTitle>Error al cargar el partido</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
        </Alert>
    );
  }

  if (!match) {
    return <Alert>No se encontró el partido.</Alert>;
  }

  return (
    <div className="flex flex-col gap-6">
       <div className="flex w-full items-center justify-between">
            <Button asChild variant="outline" className="self-start">
                <Link href={`/matches/${matchId}`}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Volver a Detalles del Partido
                </Link>
            </Button>
        </div>
      <PageHeader
        title="Pizarra Táctica"
        description={`Arrastrá y soltá jugadores para cambiar su posición o equipo para el partido: ${match.title}`}
      />
      <TacticalBoard match={match} />
    </div>
  );
}
