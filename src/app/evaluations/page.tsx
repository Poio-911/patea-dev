
'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where, collectionGroup, getDocs, onSnapshot, Unsubscribe } from 'firebase/firestore';
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
        if (userLoading || assignmentsLoading) return;
        if (!user || !firestore) {
            setIsLoadingItems(false);
            return;
        }

        setIsLoadingItems(true);

        const processItems = async () => {
            // 1. Get all matches where the user has PENDING assignments
            const pendingMatchIds = new Set(userAssignments?.map(a => a.matchId) || []);

            // 2. Get all matches where the user has already SUBMITTED an evaluation
            const submissionsQuery = query(collection(firestore, 'evaluationSubmissions'), where('evaluatorId', '==', user.uid));
            const submissionsSnapshot = await getDocs(submissionsQuery);
            const submissionMatchIds = new Set(submissionsSnapshot.docs.map(doc => doc.data().matchId));
            const submissionsMap = new Map(submissionsSnapshot.docs.map(doc => [doc.data().matchId, doc.data() as EvaluationSubmission]));
            
            const allRelevantMatchIds = [...new Set([...pendingMatchIds, ...submissionMatchIds])];

            if (allRelevantMatchIds.length === 0) {
                setPendingItems([]);
                setIsLoadingItems(false);
                return;
            }

            // 3. Fetch data for all relevant matches in one go
            const matchesQuery = query(collection(firestore, 'matches'), where('__name__', 'in', allRelevantMatchIds));
            const matchesSnapshot = await getDocs(matchesQuery);
            const matchesMap = new Map(matchesSnapshot.docs.map(doc => [doc.id, doc.data() as Match]));

            // Set initial state for all items
            const initialItems = allRelevantMatchIds.map(matchId => {
                 const match = matchesMap.get(matchId);
                 if (!match || match.status === 'evaluated') return null;

                 const userAssignmentCount = userAssignments?.filter(a => a.matchId === matchId).length || 0;

                 return {
                    matchId,
                    matchTitle: match.title,
                    matchDate: match.date,
                    matchLocation: match.location?.address || 'Ubicación desconocida',
                    submission: submissionsMap.get(matchId) || undefined,
                    userAssignmentCount,
                    totalAssignments: 0, // Will be updated by listener
                    completedAssignments: 0, // Will be updated by listener
                 };
            }).filter((item): item is PendingItem => item !== null);
            setPendingItems(initialItems.sort((a, b) => new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime()));
            setIsLoadingItems(false);


            // 4. Setup listeners for each match's assignments
            const unsubscribers: Unsubscribe[] = [];
            allRelevantMatchIds.forEach(matchId => {
                const assignmentsCollectionRef = collection(firestore, 'matches', matchId, 'assignments');
                const unsubscribe = onSnapshot(assignmentsCollectionRef, (snapshot) => {
                    const total = snapshot.size;
                    const completed = snapshot.docs.filter(d => d.data().status === 'completed').length;
                    
                    setPendingItems(currentItems => 
                        currentItems.map(item => 
                            item.matchId === matchId 
                                ? { ...item, totalAssignments: total, completedAssignments: completed }
                                : item
                        )
                    );
                });
                unsubscribers.push(unsubscribe);
            });

            return () => unsubscribers.forEach(unsub => unsub());
        };

        let cleanup: (() => void) | undefined;
        processItems().then(unsubFunc => {
            cleanup = unsubFunc;
        });

        return () => {
            if (cleanup) {
                cleanup();
            }
        };

    }, [userAssignments, firestore, user, assignmentsLoading, userLoading]);

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
                                        ? 'Tu evaluación fue enviada' 
                                        : `${item.userAssignmentCount} evaluaciones pendientes`
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

    