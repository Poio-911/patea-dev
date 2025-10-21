
'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where, collectionGroup, getDocs } from 'firebase/firestore';
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

type PendingItem = {
    matchId: string;
    matchTitle: string;
    matchDate: string;
    matchLocation: string;
    matchPlayerCount: number;
    matchSize: number;
    submission?: EvaluationSubmission;
    assignmentCount: number;
};

export default function EvaluationsPage() {
    const { user, loading: userLoading } = useUser();
    const firestore = useFirestore();

    const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
    const [isLoadingItems, setIsLoadingItems] = useState(true);

    // This query gets all pending assignments for the user across all matches.
    const assignmentsQuery = useMemo(() => {
        if (!firestore || !user?.uid) return null;
        return query(
            collectionGroup(firestore, 'assignments'),
            where('evaluatorId', '==', user.uid),
            where('status', '==', 'pending')
        );
    }, [firestore, user?.uid]);
    const { data: assignments, loading: assignmentsLoading } = useCollection<EvaluationAssignment>(assignmentsQuery);

    useEffect(() => {
        const fetchAllPendingItems = async () => {
            if (!assignments || !firestore || !user) {
                if (!assignmentsLoading) setIsLoadingItems(false);
                return;
            }

            setIsLoadingItems(true);

            // 1. Group assignments by matchId
            const assignmentsByMatch = assignments.reduce((acc, assignment) => {
                acc[assignment.matchId] = (acc[assignment.matchId] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

            const matchIds = Object.keys(assignmentsByMatch);

            if (matchIds.length === 0) {
                setPendingItems([]);
                setIsLoadingItems(false);
                return;
            }

            // 2. Fetch match details for all pending matches in one go.
            const matchesQuery = query(collection(firestore, 'matches'), where('__name__', 'in', matchIds));
            const matchesSnapshot = await getDocs(matchesQuery);
            const matchesById = new Map(matchesSnapshot.docs.map(doc => [doc.id, doc.data() as Match]));

            // 3. Fetch any pending submissions for these matches
            const submissionsQuery = query(
                collection(firestore, 'evaluationSubmissions'),
                where('matchId', 'in', matchIds),
                where('evaluatorId', '==', user.uid)
            );
            const submissionsSnapshot = await getDocs(submissionsQuery);
            const submissionsById = new Map(submissionsSnapshot.docs.map(doc => [doc.data().matchId, doc.data() as EvaluationSubmission]));

            // 4. Combine all data
            const combinedItems: PendingItem[] = matchIds.map(matchId => {
                const match = matchesById.get(matchId);
                const submission = submissionsById.get(matchId);
                const assignmentCount = assignmentsByMatch[matchId];

                // If a submission exists, we consider this item "in process"
                // If not, it's a pending evaluation task.
                if (submission) {
                     return {
                        matchId: matchId,
                        matchTitle: submission.match?.title || 'Partido',
                        matchDate: submission.match?.date || new Date().toISOString(),
                        matchLocation: submission.match?.location?.address || 'Ubicación desconocida',
                        matchPlayerCount: submission.match?.players?.length || 0,
                        matchSize: submission.match?.matchSize || 0,
                        submission: submission,
                        assignmentCount: 0,
                    };
                }
                
                // If there's no submission, but we have a match from the assignments
                if(match) {
                     return {
                        matchId: matchId,
                        matchTitle: match.title,
                        matchDate: match.date,
                        matchLocation: match.location?.address,
                        matchPlayerCount: match.players?.length,
                        matchSize: match.matchSize,
                        assignmentCount: assignmentCount,
                    };
                }

                return null;
            }).filter((item): item is PendingItem => item !== null);

            setPendingItems(combinedItems.sort((a, b) => new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime()));
            setIsLoadingItems(false);
        };

        fetchAllPendingItems();

    }, [assignments, firestore, user, assignmentsLoading]);


    const loading = userLoading || isLoadingItems;
    
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

            {pendingItems.length === 0 ? (
                <Alert>
                    <ShieldQuestion className="h-4 w-4" />
                    <AlertTitle>¡Todo al día!</AlertTitle>
                    <AlertDescription>
                        No tienes evaluaciones pendientes. ¡Buen trabajo!
                    </AlertDescription>
                </Alert>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                   {pendingItems.map((item) => {
                       const isEvaluationSent = !!item.submission;
                       
                       return (
                         <Card key={item.matchId}>
                            <CardHeader>
                                <CardTitle>{item.matchTitle}</CardTitle>
                                <CardDescription>
                                    {format(new Date(item.matchDate), 'E, d MMM, yyyy', { locale: es })} - {item.matchLocation}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                               <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                 <SoccerPlayerIcon className="h-4 w-4"/>
                                 <span>{item.matchPlayerCount} / {item.matchSize} Jugadores</span>
                               </div>
                               <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                 <Calendar className="h-4 w-4"/>
                                 <span>Finalizado</span>
                               </div>
                               <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                                 {isEvaluationSent ? <FileClock className="h-4 w-4"/> : <Edit className="h-4 w-4"/>}
                                 <span>
                                    {isEvaluationSent 
                                        ? 'Evaluación en proceso' 
                                        : `${item.assignmentCount} evaluación(es) pendiente(s)`
                                    }
                                 </span>
                               </div>
                            </CardContent>
                            <CardContent>
                                {isEvaluationSent && item.submission ? (
                                    <ViewSubmissionDialog submission={item.submission}>
                                        <Button variant="outline" className="w-full">
                                            <Eye className="mr-2 h-4 w-4" />
                                            Ver mi Evaluación
                                        </Button>
                                    </ViewSubmissionDialog>
                                ) : (
                                     <Button asChild className="w-full">
                                        <Link href={`/evaluations/${item.matchId}`}>
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