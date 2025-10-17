'use client';

import { useDoc, useFirestore, useUser, useCollection } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import { useParams, useRouter } from 'next/navigation';
import type { Match, Player, EvaluationAssignment } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Check, BarChart, UserCheck, UserX } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useState, useEffect, useMemo } from 'react';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Helper to determine if a player is a "real user"
const isRealUser = (player: Player) => player.id === player.ownerUid;

export default function EvaluateMatchPage() {
  const { id: matchId } = useParams();
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  
  const [isPageLoading, setIsPageLoading] = useState(true);

  const allGroupPlayersQuery = useMemo(() => 
    firestore && user?.activeGroupId ? query(collection(firestore, 'players'), where('groupId', '==', user.activeGroupId)) : null
  , [firestore, user?.activeGroupId]);
  const { data: allGroupPlayers, loading: playersLoading } = useCollection<Player>(allGroupPlayersQuery);

  const matchRef = useMemo(() => firestore ? doc(firestore, 'matches', matchId as string) : null, [firestore, matchId]);
  const { data: match, loading: matchLoading } = useDoc<Match>(matchRef);

  // CORRECTED: Query the 'assignments' subcollection to get the status of evaluations
  const assignmentsQuery = useMemo(() => 
      firestore ? collection(firestore, 'matches', matchId as string, 'assignments') : null, 
  [firestore, matchId]);
  const { data: assignments, loading: assignmentsLoading } = useCollection<EvaluationAssignment>(assignmentsQuery);

  useEffect(() => {
    const loading = matchLoading || assignmentsLoading || playersLoading;
    if (!loading) {
      setIsPageLoading(false);
    }
  }, [matchLoading, assignmentsLoading, playersLoading]);

  const realPlayersInMatch = useMemo(() => {
    if (!match || !allGroupPlayers) return [];
    const playerIdsInMatch = new Set(match.players.map(p => p.uid));
    return allGroupPlayers.filter(p => playerIdsInMatch.has(p.id) && isRealUser(p));
  }, [match, allGroupPlayers]);

  const evaluatorsWhoHaveVoted = useMemo(() => {
    if (!assignments) return new Set();
    // An evaluator has "voted" if at least one of their assignments for this match is completed.
    const completedEvaluators = assignments
        .filter(a => a.status === 'completed')
        .map(a => a.evaluatorId);
    return new Set(completedEvaluators);
  }, [assignments]);

  const totalPossibleEvaluators = realPlayersInMatch.length;
  const completedEvaluatorsCount = evaluatorsWhoHaveVoted.size;
  const evaluationProgress = totalPossibleEvaluators > 0 ? (completedEvaluatorsCount / totalPossibleEvaluators) * 100 : 0;
  
  if (isPageLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!match || !user) {
    return <div>Datos no encontrados.</div>;
  }
  
  if (user.uid !== match.ownerUid) {
    return (
        <div className="flex flex-col gap-4 items-center justify-center text-center p-8">
            <PageHeader title={`Evaluación de: ${match.title}`}/>
            <Alert variant="destructive">
                <AlertTitle>Acceso Denegado</AlertTitle>
                <AlertDescription>Solo el organizador del partido puede ver esta página.</AlertDescription>
            </Alert>
            <Button onClick={() => router.push('/matches')}>Volver a Partidos</Button>
        </div>
    )
  }

  if (match.status === 'evaluated') {
    return (
        <div className="flex flex-col gap-4 items-center justify-center text-center p-8">
            <PageHeader title={`Evaluación de: ${match.title}`}/>
            <Alert>
                <Check className="h-4 w-4" />
                <AlertTitle>Evaluación Completa</AlertTitle>
                <AlertDescription>Este partido ya ha sido evaluado y los OVRs de los jugadores han sido actualizados.</AlertDescription>
            </Alert>
            <Button onClick={() => router.push('/matches')}>Volver a Partidos</Button>
        </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
        <PageHeader
            title={`Panel de Evaluación: ${match.title}`}
            description={`Supervisa el progreso de las evaluaciones de los jugadores.`}
        />
        <Card>
            <CardHeader>
                <CardTitle>Progreso de la Evaluación</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex items-center gap-4">
                    <span className="text-3xl font-bold text-primary">{completedEvaluatorsCount}</span>
                    <span className="text-muted-foreground">de</span> 
                    <span className="text-3xl font-bold text-primary">{totalPossibleEvaluators}</span>
                    <span className="text-muted-foreground">jugadores reales han evaluado</span>
                </div>
                <Progress value={evaluationProgress} />
                <Alert>
                    <BarChart className="h-4 w-4" />
                    <AlertTitle>¿Qué sigue?</AlertTitle>
                    <AlertDescription>
                        Cuando suficientes jugadores hayan completado sus evaluaciones (recomendado >80%), podrás finalizar el proceso para calcular y actualizar los nuevos OVRs.
                    </AlertDescription>
                </Alert>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {realPlayersInMatch.map(player => (
                        <div key={player.id} className="flex items-center gap-3 p-2 rounded-md border">
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={player.photoUrl} alt={player.name}/>
                                <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span className="flex-1 font-medium">{player.name}</span>
                            {evaluatorsWhoHaveVoted.has(player.id) ? (
                                <UserCheck className="h-5 w-5 text-green-500" />
                            ) : (
                                <UserX className="h-5 w-5 text-red-500" />
                            )}
                        </div>
                    ))}
                 </div>

            </CardContent>
            <CardFooter>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span tabIndex={0}>
                                <Button size="lg" disabled={true} >
                                    Finalizar y Calcular OVRs
                                </Button>
                            </span>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Esta función se habilitará en una futura actualización.</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </CardFooter>
        </Card>
    </div>
  );
}
