
'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where, collectionGroup } from 'firebase/firestore';
import type { Match, EvaluationAssignment, EvaluationSubmission } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ShieldQuestion, Calendar, Edit, Eye, FileClock } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { SoccerPlayerIcon } from '@/components/icons/soccer-player-icon';
import { AttributesHelpDialog } from '@/components/attributes-help-dialog';
import { ViewSubmissionDialog } from '@/components/view-submission-dialog';

export default function EvaluationsPage() {
    const { user, loading: userLoading } = useUser();
    const firestore = useFirestore();

    // Hook 1: Assignments Query
    const assignmentsQuery = useMemo(() => {
        if (!firestore || !user?.uid) return null;
        return query(
            collectionGroup(firestore, 'assignments'),
            where('evaluatorId', '==', user.uid),
            where('status', '==', 'pending')
        );
    }, [firestore, user?.uid]);
    const { data: assignments, loading: assignmentsLoading } = useCollection<EvaluationAssignment>(assignmentsQuery);
    
    // Hook 2: Pending Submissions Query
    const pendingSubmissionsQuery = useMemo(() => {
        if (!firestore || !user?.uid) return null;
        return query(
            collection(firestore, 'evaluationSubmissions'),
            where('evaluatorId', '==', user.uid)
        );
    }, [firestore, user?.uid]);
    const { data: pendingSubmissions, loading: submissionsLoading } = useCollection<EvaluationSubmission>(pendingSubmissionsQuery);
    
    // Hook 3: Matches for pending assignments Query
    const pendingMatchIds = useMemo(() => {
        if (!assignments) return [];
        return [...new Set(assignments.map(a => a.matchId))];
    }, [assignments]);
    
    const matchesQuery = useMemo(() => {
        if (!firestore || pendingMatchIds.length === 0) return null;
        return query(collection(firestore, 'matches'), where('__name__', 'in', pendingMatchIds));
    }, [firestore, pendingMatchIds]);
    const { data: matches, loading: matchesLoading } = useCollection<Match>(matchesQuery);

    const loading = userLoading || assignmentsLoading || matchesLoading || submissionsLoading;

    // This hook combines all data sources into a single list for rendering.
    const allPendingItems = useMemo(() => {
        const items = new Map<string, { match: Match; submission?: EvaluationSubmission; hasPendingAssignment: boolean }>();

        // First, add matches that have a pending submission
        pendingSubmissions?.forEach(submission => {
            if (submission.match) {
                items.set(submission.matchId, { 
                    match: submission.match as Match, 
                    submission,
                    hasPendingAssignment: false // It's submitted, so assignment is no longer pending for the UI
                });
            }
        });

        // Then, add matches with pending assignments, but only if they haven't been submitted
        matches?.forEach(match => {
            if (!items.has(match.id)) {
                items.set(match.id, { 
                    match,
                    hasPendingAssignment: true 
                });
            }
        });
        
        return Array.from(items.values()).sort((a, b) => new Date(b.match.date).getTime() - new Date(a.match.date).getTime());
    }, [matches, pendingSubmissions]);


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

            {allPendingItems.length === 0 ? (
                <Alert>
                    <ShieldQuestion className="h-4 w-4" />
                    <AlertTitle>¡Todo al día!</AlertTitle>
                    <AlertDescription>
                        No tienes evaluaciones pendientes. ¡Buen trabajo!
                    </AlertDescription>
                </Alert>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                   {allPendingItems.map(({ match, submission, hasPendingAssignment }) => {
                       const assignmentsForMatch = assignments?.filter(a => a.matchId === match.id).length || 0;
                       const isEvaluationSent = !!submission;
                       
                       return (
                         <Card key={match.id}>
                            <CardHeader>
                                <CardTitle>{match.title}</CardTitle>
                                <CardDescription>
                                    {format(new Date(match.date), 'E, d MMM, yyyy', { locale: es })} - {match.location?.address}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                               <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                 <SoccerPlayerIcon className="h-4 w-4"/>
                                 <span>{match.players?.length || 0} / {match.matchSize} Jugadores</span>
                               </div>
                               <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                 <Calendar className="h-4 w-4"/>
                                 <span>Finalizado</span>
                               </div>
                               { (hasPendingAssignment || isEvaluationSent) && (
                                <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                                 {isEvaluationSent ? <FileClock className="h-4 w-4"/> : <Edit className="h-4 w-4"/>}
                                 <span>
                                    {isEvaluationSent 
                                        ? 'Evaluación en proceso' 
                                        : `${assignmentsForMatch} evaluación(es) pendiente(s)`
                                    }
                                 </span>
                               </div>
                               )}
                            </CardContent>
                            <CardContent>
                                {isEvaluationSent && submission ? (
                                    <ViewSubmissionDialog submission={submission}>
                                        <Button variant="outline" className="w-full">
                                            <Eye className="mr-2 h-4 w-4" />
                                            Ver mi Evaluación
                                        </Button>
                                    </ViewSubmissionDialog>
                                ) : (
                                     <Button asChild className="w-full">
                                        <Link href={`/evaluations/${match.id}`}>
                                            <Edit className="mr-2 h-4 w-4"/>
                                            Ir a Evaluar
                                        </Link>
                                     </Button>
                                )}
                            </CardContent>
                         </Card>
                       )
                   })}
                </div>
            )}
        </div>
    );
}
