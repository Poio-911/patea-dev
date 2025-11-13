
'use client';

import { useParams } from 'next/navigation';
import { useMemo } from 'react';
import { useDoc, useCollection, useFirestore } from '@/firebase';
import { doc, collection, query, where, orderBy } from 'firebase/firestore';
import type { League, Match } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Loader2, ArrowLeft, Calendar, MapPin, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { JerseyPreview } from '@/components/team-builder/jersey-preview';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

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

  // Placeholder for current round logic
  const currentRound = 1;

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
                Object.entries(matchesByRound).map(([round, roundMatches]) => {
                    const roundNumber = parseInt(round);
                    const isRoundLocked = roundNumber > currentRound;

                    return (
                        <Card key={round} className={isRoundLocked ? 'opacity-50' : ''}>
                            <CardHeader>
                                <CardTitle>Fecha {round}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {roundMatches.map(match => (
                                    <Card key={match.id} className="overflow-hidden">
                                        <CardContent className="p-4 space-y-4">
                                            <div className="flex justify-around items-center text-center">
                                                <div className="flex flex-col items-center gap-2 w-2/5">
                                                    <div className="h-16 w-16">
                                                        <JerseyPreview jersey={match.teams?.[0]?.jersey} size="md" />
                                                    </div>
                                                    <p className="text-sm font-bold truncate">{match.teams?.[0]?.name}</p>
                                                </div>
                                                <p className="text-2xl font-bold text-muted-foreground">vs</p>
                                                <div className="flex flex-col items-center gap-2 w-2/5">
                                                     <div className="h-16 w-16">
                                                        <JerseyPreview jersey={match.teams?.[1]?.jersey} size="md" />
                                                    </div>
                                                    <p className="text-sm font-bold truncate">{match.teams?.[1]?.name}</p>
                                                </div>
                                            </div>
                                            <Separator />
                                            <div className="text-xs text-muted-foreground space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <Calendar className="h-4 w-4"/>
                                                    <span>{format(new Date(match.date), "EEEE d, HH:mm'hs'", { locale: es })}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <MapPin className="h-4 w-4"/>
                                                    <span>{match.location.name}</span>
                                                </div>
                                            </div>
                                            {league.ownerUid === match.ownerUid && (
                                                <Button asChild size="sm" className="w-full mt-2" disabled={isRoundLocked}>
                                                    <Link href={`/matches/${match.id}`}>
                                                        <Edit className="mr-2 h-4 w-4" />
                                                        Gestionar Partido
                                                    </Link>
                                                </Button>
                                            )}
                                        </CardContent>
                                    </Card>
                                ))}
                            </CardContent>
                        </Card>
                    )
                })
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
