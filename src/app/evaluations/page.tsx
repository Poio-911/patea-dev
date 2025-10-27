
'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where, collectionGroup, getDocs, onSnapshot, Unsubscribe } from 'firebase/firestore';
import type { Match, Player, EvaluationAssignment, EvaluationSubmission } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ShieldQuestion, Calendar, Edit, Eye, FileClock, Users, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Progress } from '@/components/ui/progress';
import { FirstTimeInfoDialog } from '@/components/first-time-info-dialog';
import { MatchTeamsDialog } from '@/components/match-teams-dialog';
import { TeamsIcon } from '@/components/icons/teams-icon';
import { ViewSubmissionDialog } from '@/components/view-submission-dialog';

type PendingItem = {
    match: Match;
    submission?: EvaluationSubmission;
    userAssignmentCount: number;
    totalAssignments: number;
    completedAssignments: number;
};

// Helper to determine if a player is a "real user"
const isRealUser = (player: Player) => player.id === player.ownerUid;

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
            const userPendingAssignments = userAssignments || [];
            const pendingMatchIds = new Set(userPendingAssignments.map(a => a.matchId));

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

            const matchesQuery = query(collection(firestore, 'matches'), where('__name__', 'in', allRelevantMatchIds));
            const matchesSnapshot = await getDocs(matchesQuery);
            const matchesMap = new Map(matchesSnapshot.docs.map(doc => [doc.id, { id: doc.id, ...doc.data() } as Match]));

            const initialItems: (PendingItem | null)[] = allRelevantMatchIds.map(matchId => {
                 const match = matchesMap.get(matchId);
                 if (!match || match.status === 'evaluated') return null;

                 const userAssignmentCount = userPendingAssignments.filter(a => a.matchId === matchId).length;
                 const isSubmitted = submissionsMap.has(matchId);

                 // Si ya se envió y no hay pendientes, no mostrar
                 if (isSubmitted && userAssignmentCount === 0) return null;

                 const item: PendingItem = {
                    match,
                    submission: submissionsMap.get(matchId),
                    userAssignmentCount,
                    totalAssignments: 0, 
                    completedAssignments: 0,
                 };
                 return item;
            });
            
            const validItems = initialItems.filter((item): item is PendingItem => item !== null);
            setPendingItems(validItems.sort((a, b) => new Date(b.match.date).getTime() - new Date(a.match.date).getTime()));
            setIsLoadingItems(false);

            const unsubscribers: Unsubscribe[] = validItems.map(item => {
                const assignmentsCollectionRef = collection(firestore, 'matches', item.match.id, 'assignments');
                return onSnapshot(assignmentsCollectionRef, (snapshot) => {
                    const total = snapshot.size;
                    const completed = snapshot.docs.filter(d => d.data().status === 'completed').length;
                    setPendingItems(currentItems => 
                        currentItems.map(currentItem => 
                            currentItem.match.id === item.match.id
                                ? { ...currentItem, totalAssignments: total, completedAssignments: completed }
                                : currentItem
                        )
                    );
                });
            });

            return () => unsubscribers.forEach(unsub => unsub());
        };

        let cleanup: (() => void) | undefined;
        processItems().then(unsubFunc => {
            cleanup = unsubFunc;
        }).catch(console.error);

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
            <FirstTimeInfoDialog
                featureKey="hasSeenEvaluationsInfo"
                title="Bandeja de Evaluaciones"
                description="Después de cada partido, acá aparecerán tus tareas de evaluación. Tenés que puntuar el rendimiento de un par de compañer@s para que el sistema pueda actualizar los OVRs de tod@s. ¡Tu opinión es clave!"
            />
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
                         <Card key={item.match.id} className="flex flex-col">
                            <CardHeader>
                                <CardTitle>{item.match.title}</CardTitle>
                                <div className="space-y-1.5 text-sm text-muted-foreground pt-1">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4"/>
                                        <span>{format(new Date(item.match.date), 'E, d MMM, yyyy', { locale: es })}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <MapPin className="h-4 w-4"/>
                                        <span>{item.match.location.name}</span>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4 flex-grow">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                                        <div className="flex items-center gap-1.5">
                                            <Users className="h-4 w-4"/>
                                            <span>Progreso General</span>
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
                            <CardContent className="flex flex-col sm:flex-row gap-2">
                                {isEvaluationSent && item.submission ? (
                                    <ViewSubmissionDialog submission={item.submission}>
                                        <Button variant="outline" className="w-full">
                                            <Eye className="mr-2 h-4 w-4" />
                                            Ver mi Evaluación
                                        </Button>
                                    </ViewSubmissionDialog>
                                ) : (
                                     <Button asChild className="w-full">
                                        <Link href={`/evaluations/${item.match.id}`}>
                                            <Edit className="mr-2 h-4 w-4"/>
                                            Ir a Evaluar
                                        </Link>
                                     </Button>
                                )}
                                {item.match.teams && item.match.teams.length > 0 && (
                                    <MatchTeamsDialog match={item.match}>
                                        <Button variant="secondary" className="w-full">
                                            <TeamsIcon className="mr-2 h-4 w-4" />
                                            Ver Equipos
                                        </Button>
                                    </MatchTeamsDialog>
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
