
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
import { Loader2, ShieldQuestion, Calendar, Edit, Eye, FileClock, Users } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { SoccerPlayerIcon } from '@/components/icons/soccer-player-icon';
import { AttributesHelpDialog } from '@/components/attributes-help-dialog';
import { ViewSubmissionDialog } from '@/components/view-submission-dialog';
import { Progress } from '@/components/ui/progress';

type PendingItem = {
    matchId: string;
    matchTitle: string;
    matchDate: string;
    matchLocation: string;
    submission?: EvaluationSubmission;
    userAssignmentCount: number;
    totalAssignments: number;
    completedAssignments: number;
};

export default function EvaluationsPage() {
    const { user, loading: userLoading } = useUser();
    const firestore = useFirestore();

    const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
    const [isLoadingItems, setIsLoadingItems] = useState(true);

    const userAssignmentsQuery = useMemo(() => {
        if (!firestore || !user?.uid) return null;
        return query(
            collectionGroup(firestore, 'assignments'),
            where('evaluatorId', '==', user.uid),
            where('status', '==', 'pending')
        );
    }, [firestore, user?.uid]);
    const { data: userAssignments, loading: assignmentsLoading } = useCollection<EvaluationAssignment>(userAssignmentsQuery);

    useEffect(() => {
        const fetchAllPendingItems = async () => {
            if (!userAssignments || !firestore || !user) {
                if (!assignmentsLoading) setIsLoadingItems(false);
                return;
            }

            setIsLoadingItems(true);

            const assignmentsByMatch = userAssignments.reduce((acc, assignment) => {
                if (!acc[assignment.matchId]) {
                    acc[assignment.matchId] = 0;
                }
                acc[assignment.matchId]++;
                return acc;
            }, {} as Record<string, number>);

            const matchIds = Object.keys(assignmentsByMatch);

            if (matchIds.length === 0) {
                // Check for pending submissions even if there are no pending assignments
                const submissionsQuery = query(
                    collection(firestore, 'evaluationSubmissions'),
                    where('evaluatorId', '==', user.uid)
                );
                const submissionsSnapshot = await getDocs(submissionsQuery);
                if (submissionsSnapshot.empty) {
                    setPendingItems([]);
                    setIsLoadingItems(false);
                    return;
                }
                
                const submissionMatchIds = submissionsSnapshot.docs.map(doc => doc.data().matchId);
                 const matchesQuery = query(collection(firestore, 'matches'), where('__name__', 'in', submissionMatchIds));
                 const matchesSnapshot = await getDocs(matchesQuery);
                 const matchesById = new Map(matchesSnapshot.docs.map(doc => [doc.id, doc.data() as Match]));

                 const submissionsById = new Map(submissionsSnapshot.docs.map(doc => [doc.data().matchId, doc.data() as EvaluationSubmission]));
                 
                 const items: PendingItem[] = [];
                 for(const matchId of submissionMatchIds) {
                     const match = matchesById.get(matchId);
                     const submission = submissionsById.get(matchId);
                     if(match && submission) {
                         const allAssignmentsQuery = query(collection(firestore, 'matches', matchId, 'assignments'));
                         const allAssignmentsSnapshot = await getDocs(allAssignmentsQuery);
                         const completedCount = allAssignmentsSnapshot.docs.filter(d => d.data().status === 'completed').length;
                         items.push({
                            matchId,
                            matchTitle: match.title,
                            matchDate: match.date,
                            matchLocation: match.location?.address || 'Ubicación desconocida',
                            submission,
                            userAssignmentCount: 0,
                            totalAssignments: allAssignmentsSnapshot.size,
                            completedAssignments: completedCount
                         });
                     }
                 }
                setPendingItems(items);

            } else {
                const matchesQuery = query(collection(firestore, 'matches'), where('__name__', 'in', matchIds));
                const matchesSnapshot = await getDocs(matchesQuery);
                const matchesById = new Map(matchesSnapshot.docs.map(doc => [doc.id, doc.data() as Match]));

                const submissionsQuery = query(
                    collection(firestore, 'evaluationSubmissions'),
                    where('matchId', 'in', matchIds),
                    where('evaluatorId', '==', user.uid)
                );
                const submissionsSnapshot = await getDocs(submissionsQuery);
                const submissionsById = new Map(submissionsSnapshot.docs.map(doc => [doc.data().matchId, doc.data() as EvaluationSubmission]));

                const combinedItems: PendingItem[] = [];
                for (const matchId of matchIds) {
                     const match = matchesById.get(matchId);
                     if (!match) continue;

                     const submission = submissionsById.get(matchId);
                     const userAssignmentCount = assignmentsByMatch[matchId];

                     const allAssignmentsQuery = query(collection(firestore, 'matches', matchId, 'assignments'));
                     const allAssignmentsSnapshot = await getDocs(allAssignmentsQuery);
                     const completedCount = allAssignmentsSnapshot.docs.filter(d => d.data().status === 'completed').length;

                     combinedItems.push({
                        matchId: matchId,
                        matchTitle: match.title,
                        matchDate: match.date,
                        matchLocation: match.location?.address || 'Ubicación desconocida',
                        submission,
                        userAssignmentCount,
                        totalAssignments: allAssignmentsSnapshot.size,
                        completedAssignments: completedCount,
                     });
                }
                setPendingItems(combinedItems.sort((a, b) => new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime()));
            }
            setIsLoadingItems(false);
        };

        fetchAllPendingItems();

    }, [userAssignments, firestore, user, assignmentsLoading]);


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
                       const evaluationProgress = item.totalAssignments > 0 ? (item.completedAssignments / item.totalAssignments) * 100 : 0;
                       
                       return (
                         <Card key={item.matchId}>
                            <CardHeader>
                                <CardTitle>{item.matchTitle}</CardTitle>
                                <CardDescription>
                                    {format(new Date(item.matchDate), 'E, d MMM, yyyy', { locale: es })} - {item.matchLocation}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                                        <div className="flex items-center gap-1.5">
                                            <Users className="h-4 w-4"/>
                                            <span>Progreso de Evaluación</span>
                                        </div>
                                        <span>{item.completedAssignments} / {item.totalAssignments}</span>
                                    </div>
                                    <Progress value={evaluationProgress} />
                                </div>
                               
                               <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                                 {isEvaluationSent ? <FileClock className="h-4 w-4"/> : <Edit className="h-4 w-4"/>}
                                 <span>
                                    {isEvaluationSent 
                                        ? 'Evaluación en proceso' 
                                        : `${item.userAssignmentCount} evaluación(es) pendiente(s)`
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
