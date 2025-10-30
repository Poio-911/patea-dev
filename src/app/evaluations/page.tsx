
'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where, collectionGroup, getDocs } from 'firebase/firestore';
import type { Match, Player, EvaluationAssignment } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ShieldQuestion, Edit } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { FirstTimeInfoDialog } from '@/components/first-time-info-dialog';
import { AttributesHelpDialog } from '@/components/attributes-help-dialog';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';

type UnifiedAssignment = EvaluationAssignment & {
  subject?: Player;
  match?: Match;
};

export default function EvaluationsPage() {
    const { user, loading: userLoading } = useUser();
    const firestore = useFirestore();

    const [unifiedAssignments, setUnifiedAssignments] = useState<UnifiedAssignment[]>([]);
    const [isLoading, setIsLoading] = useState(true);

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

            // Fetch players in chunks of 30 (Firestore 'in' query limit)
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
            
            // Fetch matches in chunks of 30
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
                .filter(item => item.subject && item.match) // Filter out items where data might be missing
                .sort((a, b) => new Date(a.match!.date).getTime() - new Date(b.match!.date).getTime()); // Oldest first

            setUnifiedAssignments(processed);
            setIsLoading(false);
        };

        processAssignments();
    }, [userAssignments, firestore, user, userLoading, assignmentsLoading]);

    const loading = userLoading || isLoading;
    
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

            {unifiedAssignments.length === 0 ? (
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
                        <CardTitle>Tareas de Evaluación Pendientes ({unifiedAssignments.length})</CardTitle>
                        <CardDescription>Esta es la lista de compañeros que te falta evaluar. Se ordena por el partido más antiguo primero.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                           {unifiedAssignments.map((assignment, index) => (
                                <div key={assignment.id}>
                                    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <Avatar className="h-12 w-12 border">
                                                <AvatarImage src={assignment.subject?.photoUrl} alt={assignment.subject?.name} />
                                                <AvatarFallback>{assignment.subject?.name.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <p className="font-semibold text-base">{assignment.subject?.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    Del partido: <strong>{assignment.match?.title}</strong> ({format(new Date(assignment.match!.date), "dd/MM")})
                                                </p>
                                            </div>
                                        </div>
                                        <Button asChild variant="secondary" size="sm">
                                            <Link href={`/evaluations/${assignment.matchId}`}>
                                                <Edit className="mr-2 h-4 w-4" />
                                                Evaluar
                                            </Link>
                                        </Button>
                                    </div>
                                    {index < unifiedAssignments.length - 1 && <Separator />}
                                </div>
                           ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
