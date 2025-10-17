'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { Match, Player } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ShieldQuestion, Calendar, Users, Edit } from 'lucide-react';
import { format } from 'date-fns';

export default function EvaluationsPage() {
    const { user, loading: userLoading } = useUser();
    const firestore = useFirestore();

    const isRealUserQuery = useMemo(() => {
        if (!firestore || !user?.uid) return null;
        return query(collection(firestore, 'players'), where('__name__', '==', user.uid), where('ownerUid', '==', user.uid));
    }, [firestore, user?.uid]);
    const { data: userPlayerProfile, loading: playerProfileLoading } = useCollection<Player>(isRealUserQuery);
    const isUserARealPlayer = (userPlayerProfile?.length ?? 0) > 0;

    const matchesQuery = useMemo(() => {
        if (!firestore || !user?.activeGroupId || !user?.uid) return null;
        return query(
            collection(firestore, 'matches'),
            where('groupId', '==', user.activeGroupId),
            where('status', '==', 'completed'),
            where('players', 'array-contains', { 
                uid: user.uid,
                displayName: user.displayName || '',
                photoUrl: user.photoURL || '',
                ovr: userPlayerProfile?.[0]?.ovr || 0,
                position: userPlayerProfile?.[0]?.position || ''
             })
        );
    }, [firestore, user, userPlayerProfile]);

    const { data: matches, loading: matchesLoading } = useCollection<Match>(matchesQuery);

    const evaluationsQuery = useMemo(() => {
        if (!firestore || !matches || matches.length === 0) return null;
        const matchIds = matches.map(m => m.id);
        if (matchIds.length === 0) return null;
        // This is a workaround as we can't easily query subcollections across documents
        // A better structure might be a top-level 'evaluations' collection
        return query(
          collection(firestore, 'matches', matchIds[0], 'evaluations'),
          where('evaluatedBy', '==', user?.uid || '')
        );
    }, [firestore, matches, user?.uid]);

    const { data: myEvaluations, loading: evalsLoading } = useCollection(evaluationsQuery);

    const pendingMatches = useMemo(() => {
        if (!matches || !myEvaluations) return matches || [];
        const evaluatedMatchIds = new Set(myEvaluations.map(e => e.parent.parent.id));
        return matches.filter(m => !evaluatedMatchIds.has(m.id));
    }, [matches, myEvaluations]);

    const loading = userLoading || playerProfileLoading || matchesLoading || evalsLoading;

    if (loading) {
        return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    if (!isUserARealPlayer) {
        return (
            <div className="flex flex-col gap-8">
                <PageHeader title="Mis Evaluaciones" description="Evalúa el rendimiento de tus compañeros de equipo." />
                <Alert>
                    <AlertTitle>Función no disponible</AlertTitle>
                    <AlertDescription>
                        Solo los jugadores registrados (no manuales) pueden acceder a esta sección para evaluar a otros.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }
    
    return (
        <div className="flex flex-col gap-8">
            <PageHeader title="Mis Evaluaciones" description="Evalúa el rendimiento de tus compañeros de equipo." />
            {pendingMatches.length === 0 ? (
                <Alert>
                    <ShieldQuestion className="h-4 w-4" />
                    <AlertTitle>¡Todo al día!</AlertTitle>
                    <AlertDescription>
                        No tienes evaluaciones pendientes. ¡Buen trabajo!
                    </AlertDescription>
                </Alert>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                   {pendingMatches.map(match => (
                     <Card key={match.id}>
                        <CardHeader>
                            <CardTitle>{match.title}</CardTitle>
                            <CardDescription>
                                {format(new Date(match.date), 'E, d MMM, yyyy')} - {match.location}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                           <div className="flex items-center gap-2 text-sm text-muted-foreground">
                             <Users className="h-4 w-4"/>
                             <span>{match.players.length} / {match.matchSize} Jugadores</span>
                           </div>
                           <div className="flex items-center gap-2 text-sm text-muted-foreground">
                             <Calendar className="h-4 w-4"/>
                             <span>Finalizado</span>
                           </div>
                        </CardContent>
                        <CardContent>
                             <Button asChild className="w-full">
                                <Link href={`/evaluations/${match.id}`}>
                                    <Edit className="mr-2 h-4 w-4"/>
                                    Evaluar Partido
                                </Link>
                             </Button>
                        </CardContent>
                     </Card>
                   ))}
                </div>
            )}
        </div>
    );
}
