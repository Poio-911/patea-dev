
'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where, collectionGroup, getDocs } from 'firebase/firestore';
import type { Match, Player, EvaluationAssignment, EvaluationSubmission } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ShieldQuestion, Edit, FileClock, CheckCircle, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { FirstTimeInfoDialog } from '@/components/first-time-info-dialog';
import { AttributesHelpDialog } from '@/components/attributes-help-dialog';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { ViewSubmissionDialog } from '@/components/view-submission-dialog';

type UnifiedAssignment = EvaluationAssignment & {
  subject?: Player;
  match?: Match;
};

export default function EvaluationsPage() {
    const { user, loading: userLoading } = useUser();
    const firestore = useFirestore();

    const [unifiedAssignments, setUnifiedAssignments] = useState<UnifiedAssignment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [submittedMatchIds, setSubmittedMatchIds] = useState<Set<string>>(new Set());

    const userAssignmentsQuery = useMemo(() => {
        if (!firestore || !user?.uid) return null;
        return query(
            collectionGroup(firestore, 'assignments'),
            where('evaluatorId', '==', user.uid),
            where('status', '==', 'pending')
        );
    }, [firestore, user?.uid]);
    const { data: userAssignments, loading: assignmentsLoading } = useCollection<EvaluationAssignment>(userAssignmentsQuery);
    
    const userSubmissionsQuery = useMemo(() => {
        if (!firestore || !user?.uid) return null;
        return query(
            collection(firestore, 'evaluationSubmissions'),
            where('evaluatorId', '==', user.uid)
        );
    }, [firestore, user?.uid]);
    const { data: userSubmissions, loading: submissionsLoading } = useCollection<EvaluationSubmission>(userSubmissionsQuery);

    const submissionsMap = useMemo(() => {
        if (!userSubmissions) return new Map();
        return new Map(userSubmissions.map(sub => [sub.matchId, sub]));
    }, [userSubmissions]);


    useEffect(() => {
        if (userSubmissions) {
            const ids = new Set(userSubmissions.map(sub => sub.matchId));
            setSubmittedMatchIds(ids);
        }
    }, [userSubmissions]);

    useEffect(() => {
        const processAssignments = async () => {
            if (userLoading || assignmentsLoading) return;
            if (!user || !firestore || !userAssignments) {
                setIsLoading(false);
                return;
            }

            setIsLoading(true);

            if (userAssignments.length === 0) {
                setUnifiedAssignments([]);
                setIsLoading(false);
                return;
            }

            const subjectIds = [...new Set(userAssignments.map(a => a.subjectId))];
            const matchIds = [...new Set(userAssignments.map(a => a.matchId))];

            let playersMap = new Map<string, Player>();
            let matchesMap = new Map<string, Match>();

            if (subjectIds.length > 0) {
                const playerChunks: string[][] = [];
                for (let i = 0; i < subjectIds.length; i += 30) {
                    playerChunks.push(subjectIds.slice(i, i + 30));
                }
                const playerPromises = playerChunks.map(chunk =>
                    getDocs(query(collection(firestore, 'players'), where('__name__', 'in', chunk)))
                );
                const playerSnapshots = await Promise.all(playerPromises);
                playerSnapshots.forEach(snapshot => 
                    snapshot.docs.forEach(doc => playersMap.set(doc.id, { id: doc.id, ...doc.data() } as Player))
                );
            }
            
            if (matchIds.length > 0) {
                const matchChunks: string[][] = [];
                for (let i = 0; i < matchIds.length; i += 30) {
                    matchChunks.push(matchIds.slice(i, i + 30));
                }
                const matchPromises = matchChunks.map(chunk =>
                    getDocs(query(collection(firestore, 'matches'), where('__name__', 'in', chunk)))
                );
                const matchSnapshots = await Promise.all(matchPromises);
                matchSnapshots.forEach(snapshot =>
                    snapshot.docs.forEach(doc => matchesMap.set(doc.id, { id: doc.id, ...doc.data() } as Match))
                );
            }

            const processed: UnifiedAssignment[] = userAssignments
                .map(assignment => ({
                    ...assignment,
                    subject: playersMap.get(assignment.subjectId),
                    match: matchesMap.get(assignment.matchId),
                }))
                .filter(item => item.subject && item.match) 
                .sort((a, b) => new Date(a.match!.date).getTime() - new Date(b.match!.date).getTime()); 

            setUnifiedAssignments(processed);
            setIsLoading(false);
        };

        processAssignments();
    }, [userAssignments, firestore, user, userLoading, assignmentsLoading]);

    const assignmentsByMatch = useMemo(() => {
        const grouped: Record<string, { match: Match, assignments: UnifiedAssignment[] }> = {};
        unifiedAssignments.forEach(assignment => {
            if (!assignment.match) return;
            if (!grouped[assignment.matchId]) {
                grouped[assignment.matchId] = { match: assignment.match, assignments: [] };
            }
            grouped[assignment.matchId].assignments.push(assignment);
        });
        return Object.values(grouped);
    }, [unifiedAssignments]);


    const loading = userLoading || assignmentsLoading || submissionsLoading;
    
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
    
    const allMatches = [...assignmentsByMatch, ...userSubmissions?.filter(sub => !assignmentsByMatch.some(am => am.match.id === sub.matchId)).map(sub => ({ match: sub.match as Match, assignments: [] })) || []]
    .filter(item => item.match)
    .sort((a, b) => new Date(b.match.date).getTime() - new Date(a.match.date).getTime());


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

            {assignmentsByMatch.length === 0 && userSubmissions?.length === 0 ? (
                <Alert>
                    <ShieldQuestion className="h-4 w-4" />
                    <AlertTitle>¡Todo al día!</AlertTitle>
                    <AlertDescription>
                        No tienes evaluaciones pendientes. ¡Buen trabajo!
                    </AlertDescription>
                </Alert>
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle>Tareas de Evaluación ({assignmentsByMatch.length} pendiente(s))</CardTitle>
                        <CardDescription>Esta es la lista de compañeros que te falta evaluar, agrupados por partido.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                           {allMatches.map(({ match, assignments }) => {
                                const assignmentIds = assignments.map(a => a.id).join(',');
                                const isSubmitted = submittedMatchIds.has(match.id);
                                const hasPending = assignments.length > 0;
                                const submissionData = submissionsMap.get(match.id);

                                return (
                                    <div key={match.id} className="border p-4 rounded-lg">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h3 className="font-bold text-lg">{match.title}</h3>
                                                <p className="text-sm text-muted-foreground">{format(new Date(match.date), "dd/MM/yyyy", { locale: es })}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {isSubmitted ? (
                                                    <>
                                                        {submissionData && (
                                                            <ViewSubmissionDialog submission={submissionData}>
                                                                <Button variant="outline" size="sm">
                                                                    <Eye className="mr-2 h-4 w-4" />
                                                                    Ver mi Envío
                                                                </Button>
                                                            </ViewSubmissionDialog>
                                                        )}
                                                        <div className="flex items-center gap-2 text-green-600 font-semibold text-sm">
                                                            <CheckCircle className="h-5 w-5" />
                                                            Evaluado
                                                        </div>
                                                    </>
                                                ) : hasPending ? (
                                                    <>
                                                        <div className="hidden sm:flex items-center gap-2 text-yellow-600 font-semibold text-sm">
                                                            <FileClock className="h-5 w-5" />
                                                            Pendiente
                                                        </div>
                                                        <Button asChild variant="secondary">
                                                            <Link href={`/evaluations/${match.id}?assignments=${assignmentIds}`}>
                                                                <FileClock className="mr-2 h-4 w-4 text-yellow-500" />
                                                                Evaluar Jugadores
                                                            </Link>
                                                        </Button>
                                                    </>
                                                ) : (
                                                     <div className="flex items-center gap-2 text-blue-600 font-semibold text-sm">
                                                        <FileClock className="h-5 w-5" />
                                                        Enviado
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <Separator className="my-3" />
                                        <div className="flex flex-wrap gap-4">
                                            {assignments.map(assignment => (
                                                <div key={assignment.id} className="flex items-center gap-2">
                                                    <Avatar className="h-9 w-9 border">
                                                        <AvatarImage src={assignment.subject?.photoUrl} alt={assignment.subject?.name} />
                                                        <AvatarFallback>{assignment.subject?.name.charAt(0)}</AvatarFallback>
                                                    </Avatar>
                                                    <p className="text-sm font-medium">{assignment.subject?.name}</p>
                                                </div>
                                            ))}
                                            {isSubmitted && (
                                                <p className="text-sm text-muted-foreground italic">Tus evaluaciones para este partido ya fueron enviadas y están a la espera de ser procesadas por el organizador.</p>
                                            )}
                                        </div>
                                    </div>
                                );
                           })}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
