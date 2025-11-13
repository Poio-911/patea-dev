
'use client';

import { useParams } from 'next/navigation';
import { useMemo } from 'react';
import { useDoc, useCollection, useFirestore } from '@/firebase';
import { doc, collection, query, where, orderBy } from 'firebase/firestore';
import type { League, Match } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export default function LeagueDetailPage() {
  const { id: leagueId } = useParams();
  const firestore = useFirestore();

  const leagueRef = useMemo(() => {
    if (!firestore || !leagueId) return null;
    return doc(firestore, 'leagues', leagueId as string);
  }, [firestore, leagueId]);

  const { data: league, loading: leagueLoading } = useDoc<League>(leagueRef);

  const matchesQuery = useMemo(() => {
    if (!firestore || !leagueId) return null;
    return query(
      collection(firestore, 'matches'),
      where('leagueInfo.leagueId', '==', leagueId),
      orderBy('leagueInfo.round', 'asc'),
      orderBy('date', 'asc')
    );
  }, [firestore, leagueId]);

  const { data: matches, loading: matchesLoading } = useCollection<Match>(matchesQuery);
  
  const matchesByRound = useMemo(() => {
    if (!matches) return {};
    return matches.reduce((acc, match) => {
        const round = match.leagueInfo?.round || 0;
        if (!acc[round]) {
            acc[round] = [];
        }
        acc[round].push(match);
        return acc;
    }, {} as Record<number, Match[]>);
  }, [matches]);

  if (leagueLoading || matchesLoading) {
    return <div className="flex justify-center items-center h-full"><Loader2 className="h-12 w-12 animate-spin" /></div>;
  }

  if (!league) {
    return (
      <div className="text-center p-8">
        <h2 className="text-xl font-bold">Liga no encontrada</h2>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/competitions">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a Competiciones
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title={league.name} description="Fixture y tabla de posiciones de la liga." />
        <Button asChild variant="outline">
          <Link href="/competitions">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Link>
        </Button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
            <h2 className="text-xl font-bold">Fixture</h2>
            {Object.entries(matchesByRound).length > 0 ? (
                Object.entries(matchesByRound).map(([round, roundMatches]) => (
                    <Card key={round}>
                        <CardHeader>
                            <CardTitle>Fecha {round}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {roundMatches.map(match => (
                                <div key={match.id} className="p-3 border rounded-md">
                                    <p className="text-sm font-semibold">{match.title}</p>
                                    <p className="text-xs text-muted-foreground">{new Date(match.date).toLocaleDateString()}</p>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                ))
            ) : (
                 <Alert>
                    <AlertTitle>Fixture en Generación</AlertTitle>
                    <AlertDescription>
                        Los partidos para esta liga se están generando. Por favor, volvé a cargar en unos momentos.
                    </AlertDescription>
                </Alert>
            )}
        </div>
        <div className="lg:col-span-1">
            <h2 className="text-xl font-bold mb-4">Tabla de Posiciones</h2>
             <Card>
                <CardContent className="p-6">
                     <p className="text-center text-muted-foreground">Próximamente...</p>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
