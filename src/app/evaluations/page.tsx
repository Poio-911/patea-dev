
'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where, collectionGroup } from 'firebase/firestore';
import type { Match, Player, EvaluationAssignment } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ShieldQuestion, Calendar, Edit, FileClock } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { SoccerPlayerIcon } from '@/components/icons/soccer-player-icon';
import { AttributesHelpDialog } from '@/components/attributes-help-dialog';

export default function EvaluationsPage() {
    const { user, loading: userLoading } = useUser();
    const firestore = useFirestore();

    const assignmentsQuery = useMemo(() => {
        if (!firestore || !user?.uid) return null;
        return query(
            collectionGroup(firestore, 'assignments'),
            where('evaluatorId', '==', user.uid),
            where('status', '==', 'pending')
        );
    }, [firestore, user?.uid]);

    const { data: assignments, loading: assignmentsLoading } = useCollection<EvaluationAssignment>(assignmentsQuery);
    
    const matchIds = useMemo(() => {
        if (!assignments) return [];
        return [...new Set(assignments.map(a => a.matchId))];
    }, [assignments]);
    
    const matchesQuery = useMemo(() => {
        if (!firestore || matchIds.length === 0) return null;
        return query(collection(firestore, 'matches'), where('__name__', 'in', matchIds));
    }, [firestore, matchIds]);
    
    // New query to check for pending submissions by the current user
    const pendingSubmissionsQuery = useMemo(() => {
        if (!firestore || !user?.uid || matchIds.length === 0) return null;
        return query(
            collection(firestore, 'evaluationSubmissions'),
            where('evaluatorId', '==', user.uid),
            where('matchId', 'in', matchIds)
        );
    }, [firestore, user?.uid, matchIds]);
    
    const { data: pendingSubmissions, loading: submissionsLoading } = useCollection(pendingSubmissionsQuery);
    const pendingSubmissionMatchIds = useMemo(() => new Set(pendingSubmissions?.map(sub => sub.matchId)), [pendingSubmissions]);


    const { data: matches, loading: matchesLoading } = useCollection<Match>(matchesQuery);

    const pendingMatches = useMemo(() => {
        if (!matches || !assignments) return [];
        return matches.filter(match => assignments.some(a => a.matchId === match.id));
    }, [matches, assignments]);

    const loading = userLoading || assignmentsLoading || matchesLoading || submissionsLoading;

    if (loading) {
        return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    if (!user) {
        return (
             <div className="flex flex-col gap-8">
                <PageHeader title="Mis Evaluaciones" description="Evalúa el rendimiento de tus compañeros de equipo." />
                <Alert>
                    <AlertTitle>Función no disponible</AlertTitle>
                    <AlertDescription>
                       Debes iniciar sesión para ver tus evaluaciones pendientes.
                    </AlertDescription>
                </Alert>
            </div>
        )
    }
    
    return (
        <div className="flex flex-col gap-8">
            <PageHeader title="Mis Evaluaciones" description="Aquí encontrarás los partidos que tienes pendientes por evaluar." />
            
            <AttributesHelpDialog>
                <Button variant="link" className="p-0 h-auto self-start">¿Qué significan los atributos de evaluación?</Button>
            </AttributesHelpDialog>

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
                   {pendingMatches.map(match => {
                       const assignmentsForMatch = assignments?.filter(a => a.matchId === match.id).length || 0;
                       const isPending = pendingSubmissionMatchIds.has(match.id);
                       
                       return (
                         <Card key={match.id}>
                            <CardHeader>
                                <CardTitle>{match.title}</CardTitle>
                                <CardDescription>
                                    {format(new Date(match.date), 'E, d MMM, yyyy', { locale: es })} - {match.location.address}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                               <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                 <SoccerPlayerIcon className="h-4 w-4"/>
                                 <span>{match.players.length} / {match.matchSize} Jugadores</span>
                               </div>
                               <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                 <Calendar className="h-4 w-4"/>
                                 <span>Finalizado</span>
                               </div>
                               <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                                 {isPending ? <FileClock className="h-4 w-4"/> : <Edit className="h-4 w-4"/>}
                                 <span>
                                    {isPending 
                                        ? 'Evaluación en proceso' 
                                        : `${assignmentsForMatch} evaluación(es) pendiente(s)`
                                    }
                                 </span>
                               </div>
                            </CardContent>
                            <CardContent>
                                 <Button asChild className="w-full" disabled={isPending}>
                                    <Link href={`/evaluations/${match.id}`}>
                                        {isPending ? (
                                            <>
                                                <FileClock className="mr-2 h-4 w-4"/>
                                                Procesando...
                                            </>
                                        ) : (
                                            <>
                                                <Edit className="mr-2 h-4 w-4"/>
                                                Ir a Evaluar
                                            </>
                                        )}
                                    </Link>
                                 </Button>
                            </CardContent>
                         </Card>
                       )
                   })}
                </div>
            )}
        </div>
    );
}
