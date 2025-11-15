'use client';

import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useDoc, useCollection, useFirestore, useUser } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import type { Cup, GroupTeam } from '@/lib/types';
import { Loader2, Trophy, Settings, Trash2, Play, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CupBracket } from '@/components/competitions/cup-bracket';
import { useToast } from '@/hooks/use-toast';
import { startCupAction, updateCupStatusAction, deleteCupAction } from '@/lib/actions/server-actions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { JerseyPreview } from '@/components/team-builder/jersey-preview';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getRoundName, isTournamentComplete } from '@/lib/utils/cup-bracket';
import { ChampionCelebration } from '@/components/leagues/ChampionCelebration';

type CupTab = 'bracket' | 'teams';

export default function CupDetailPage() {
  const { id: cupId } = useParams();
  const router = useRouter();
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<CupTab>('bracket');
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch cup data
  const cupRef = useMemo(() => {
    if (!firestore || !cupId) return null;
    return doc(firestore, 'cups', cupId as string);
  }, [firestore, cupId]);

  const { data: cup, loading: cupLoading } = useDoc<Cup>(cupRef);

  // Fetch teams
  const teamsQuery = useMemo(() => {
    if (!firestore || !cup?.teams || cup.teams.length === 0) return null;
    return query(
      collection(firestore, 'teams'),
      where('__name__', 'in', cup.teams.slice(0, 10)) // Firestore limit
    );
  }, [firestore, cup?.teams]);

  const { data: teams } = useCollection<GroupTeam>(teamsQuery);

  const isOwner = user?.uid === cup?.ownerUid;
  const isCompleted = cup?.status === 'completed';

  const handleStartCup = async () => {
    if (!cup) return;

    setIsStarting(true);
    try {
      const result = await startCupAction(cup.id);
      if (result.success) {
        toast({
          title: 'Copa iniciada',
          description: 'El bracket ha sido generado y la copa está lista.',
        });
        setShowStartDialog(false);
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo iniciar la copa.',
      });
    } finally {
      setIsStarting(false);
    }
  };

  const handleDeleteCup = async () => {
    if (!cup) return;

    setIsDeleting(true);
    try {
      const result = await deleteCupAction(cup.id);
      if (result.success) {
        toast({
          title: 'Copa eliminada',
          description: 'La copa ha sido eliminada correctamente.',
        });
        router.push('/competitions');
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo eliminar la copa.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (cupLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!cup) {
    return (
      <Alert>
        <AlertDescription>Copa no encontrada.</AlertDescription>
      </Alert>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              {cup.logoUrl && (
                <div className="w-20 h-20 rounded-lg overflow-hidden border shrink-0 bg-muted/30">
                  <img src={cup.logoUrl} alt={cup.name} className="w-full h-full object-contain" />
                </div>
              )}
              <div className="flex-1">
                <h1 className="text-3xl font-bold">{cup.name}</h1>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant={cup.status === 'draft' ? 'secondary' : cup.status === 'completed' ? 'outline' : 'default'}>
                    {cup.status === 'draft' && 'Borrador'}
                    {cup.status === 'in_progress' && 'En Curso'}
                    {cup.status === 'completed' && 'Finalizada'}
                  </Badge>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-sm text-muted-foreground">{cup.teams.length} equipos</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-sm text-muted-foreground">Eliminación Directa</span>
                </div>
                {cup.currentRound && cup.status === 'in_progress' && (
                  <div className="flex items-center gap-2 mt-2">
                    <Trophy className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">{getRoundName(cup.currentRound)}</span>
                  </div>
                )}
              </div>
            </div>

            {isOwner && (
              <div className="flex items-center gap-2">
                {cup.status === 'draft' && (
                  <Button onClick={() => setShowStartDialog(true)}>
                    <Play className="mr-2 h-4 w-4" />
                    Iniciar Copa
                  </Button>
                )}
                <Button variant="destructive" size="icon" onClick={() => setShowDeleteDialog(true)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Champion Celebration */}
        {isCompleted && cup.championTeamId && cup.championTeamName && (
          <ChampionCelebration
            teamName={cup.championTeamName}
            competitionName={cup.name}
            competitionType="cup"
          />
        )}

        {/* Content Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as CupTab)}>
          <TabsList>
            <TabsTrigger value="bracket">Bracket</TabsTrigger>
            <TabsTrigger value="teams">Equipos</TabsTrigger>
          </TabsList>

          <TabsContent value="bracket" className="mt-6">
            {cup.bracket && cup.bracket.length > 0 ? (
              <CupBracket bracket={cup.bracket} />
            ) : (
              <div className="text-center py-16 border-2 border-dashed rounded-xl">
                <Trophy className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">Bracket no generado</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  {isOwner
                    ? 'Iniciá la copa para generar el bracket de eliminación.'
                    : 'El organizador aún no ha iniciado la copa.'}
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="teams" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Equipos Participantes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {teams?.map(team => (
                    <div key={team.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                      <div className="w-10 h-10 flex-shrink-0">
                        <JerseyPreview jersey={team.jersey} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{team.name}</p>
                        <p className="text-xs text-muted-foreground">{team.members.length} jugadores</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Start Cup Dialog */}
      <AlertDialog open={showStartDialog} onOpenChange={setShowStartDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Iniciar la copa?</AlertDialogTitle>
            <AlertDialogDescription>
              Se generará el bracket de eliminación directa con sorteo aleatorio.
              Los {cup.teams.length} equipos serán distribuidos en el bracket.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isStarting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleStartCup} disabled={isStarting}>
              {isStarting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Iniciar Copa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Cup Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar la copa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente la copa y todos sus partidos asociados.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCup} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
