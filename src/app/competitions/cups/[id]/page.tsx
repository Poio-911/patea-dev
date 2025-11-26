'use client';

import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useDoc, useCollection, useFirestore, useUser } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import type { Cup, GroupTeam, BracketMatch, CupSeedingType } from '@/lib/types';
import { Loader2, Trophy, Settings, Trash2, Play, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CupBracket } from '@/components/competitions/cup-bracket';
import { useToast } from '@/hooks/use-toast';
import { startCupAction, updateCupStatusAction, deleteCupAction, createCupMatchAction } from '@/lib/actions/server-actions';
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
  const [seedingType, setSeedingType] = useState<CupSeedingType>('random');

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

  // Fetch organizer data
  const organizerRef = useMemo(() => {
    if (!firestore || !cup?.ownerUid) return null;
    return doc(firestore, 'users', cup.ownerUid);
  }, [firestore, cup?.ownerUid]);

  const { data: organizer } = useDoc<any>(organizerRef);

  const isOwner = user?.uid === cup?.ownerUid;
  const isCompleted = cup?.status === 'completed';

  const handleStartCup = async () => {
    if (!cup) return;

    setIsStarting(true);
    try {
      const result = await startCupAction(cup.id, seedingType);
      if (result.success) {
        toast({
          title: 'Copa iniciada',
          description: `El bracket ha sido generado con sorteo ${seedingType === 'random' ? 'aleatorio' : 'por OVR'}.`,
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

  const handleMatchClick = async (match: BracketMatch) => {
    if (!cup) return;

    // If match is already completed, view details
    if (match.winnerId) {
      if (match.matchId) {
        router.push(`/matches/${match.matchId}`);
      }
      return;
    }

    // If match is ready to play (has both teams)
    if (match.team1Id && match.team2Id) {
      // If we have a matchId, navigate to it
      if (match.matchId) {
        router.push(`/matches/${match.matchId}`);
        return;
      }

      // If not, create it and navigate (only owner)
      if (isOwner) {
        // Show loading toast
        const loadingToast = toast({
          title: 'Preparando partido...',
          description: 'Creando el encuentro en el sistema.',
        });

        try {
          const result = await createCupMatchAction(cup.id, match.id);
          if (result.success && result.matchId) {
            loadingToast.dismiss();
            router.push(`/matches/${result.matchId}`);
          } else {
            toast({
              variant: 'destructive',
              title: 'Error',
              description: result.error || 'No se pudo crear el partido.',
            });
          }
        } catch (error) {
          console.error(error);
          toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Ocurrió un error al intentar acceder al partido.',
          });
        }
      } else {
        toast({
          title: 'Partido pendiente',
          description: 'El organizador debe iniciar este partido.',
        });
      }
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
          <div className="flex flex-col md:flex-row items-start justify-between gap-4 md:gap-8">
            <div className="flex flex-col md:flex-row items-start gap-4 flex-1">
              {cup.logoUrl && (
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-lg overflow-hidden border shrink-0 bg-muted/30 mx-auto md:mx-0">
                  <img src={cup.logoUrl} alt={cup.name} className="w-full h-full object-contain" />
                </div>
              )}
              <div className="flex-1 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <h1 className="text-2xl md:text-3xl font-bold leading-tight">{cup.name}</h1>
                  {isOwner && (
                    <div className="flex items-center gap-2 shrink-0">
                      {cup.status === 'draft' && (
                        <Button onClick={() => setShowStartDialog(true)} size="sm" className="h-8">
                          <Play className="mr-2 h-3 w-3" />
                          Iniciar
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => setShowDeleteDialog(true)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant={cup.status === 'draft' ? 'secondary' : cup.status === 'completed' ? 'outline' : 'default'} className="whitespace-nowrap">
                    {cup.status === 'draft' && 'Borrador'}
                    {cup.status === 'in_progress' && 'En Curso'}
                    {cup.status === 'completed' && 'Finalizada'}
                  </Badge>
                  <span>·</span>
                  <span className="whitespace-nowrap">{cup.teams.length} equipos</span>
                  <span>·</span>
                  <span className="whitespace-nowrap">Eliminación Directa</span>
                </div>

                {organizer && (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-sm text-muted-foreground">Organizado por</span>
                    <div className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded-full">
                      {organizer.photoUrl ? (
                        <img src={organizer.photoUrl} alt={organizer.displayName} className="w-4 h-4 rounded-full object-cover" />
                      ) : (
                        <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center">
                          <span className="text-[9px] font-bold">{organizer.displayName?.charAt(0) || '?'}</span>
                        </div>
                      )}
                      <span className="text-sm font-medium truncate max-w-[120px]">{organizer.displayName || 'Usuario'}</span>
                    </div>
                  </div>
                )}

                {cup.currentRound && cup.status === 'in_progress' && (
                  <div className="flex items-center gap-2 mt-2 bg-primary/5 py-1 px-3 rounded-full w-fit">
                    <Trophy className="h-3.5 w-3.5 text-primary" />
                    <span className="text-sm font-medium text-primary">{getRoundName(cup.currentRound)}</span>
                  </div>
                )}
              </div>
            </div>


          </div>
        </div>

        {/* Champion Celebration */}
        {isCompleted && cup.championTeamId && cup.championTeamName && (
          <ChampionCelebration
            championName={cup.championTeamName}
            championJersey={teams?.find(t => t.id === cup.championTeamId)?.jersey}
            runnerUpName={cup.runnerUpTeamName || 'Subcampeón'}
            runnerUpJersey={teams?.find(t => t.id === cup.runnerUpTeamId)?.jersey}
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
              <CupBracket bracket={cup.bracket} onMatchClick={handleMatchClick} currentRound={cup.currentRound} />
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
              Se generará el bracket de eliminación directa para los {cup.teams.length} equipos.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3 py-4">
            <label className="text-sm font-medium">Tipo de sorteo:</label>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer p-3 border rounded-lg hover:bg-accent transition-colors">
                <input
                  type="radio"
                  name="seedingType"
                  value="random"
                  checked={seedingType === 'random'}
                  onChange={(e) => setSeedingType(e.target.value as CupSeedingType)}
                  className="h-4 w-4"
                />
                <div className="flex-1">
                  <div className="font-medium">Sorteo Aleatorio</div>
                  <div className="text-xs text-muted-foreground">
                    Los equipos se distribuyen al azar
                  </div>
                </div>
              </label>

              <label className="flex items-center gap-2 cursor-pointer p-3 border rounded-lg hover:bg-accent transition-colors">
                <input
                  type="radio"
                  name="seedingType"
                  value="ovr_based"
                  checked={seedingType === 'ovr_based'}
                  onChange={(e) => setSeedingType(e.target.value as CupSeedingType)}
                  className="h-4 w-4"
                />
                <div className="flex-1">
                  <div className="font-medium">Sorteo por OVR</div>
                  <div className="text-xs text-muted-foreground">
                    Los equipos más fuertes se enfrentan en rondas finales
                  </div>
                </div>
              </label>
            </div>
          </div>

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
