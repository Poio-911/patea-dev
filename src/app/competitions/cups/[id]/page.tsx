'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { useDoc, useCollection, useFirestore, useUser } from '@/firebase';
import { doc, collection, query, where, FieldValue } from 'firebase/firestore';
import type { Cup, GroupTeam, BracketMatch, CupSeedingType } from '@/lib/types';
import { Loader2, Trophy, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CupBracket } from '@/components/competitions/cup-bracket';
import { CupHeader, type CupTab } from '@/components/cup/CupHeader';
import { useToast } from '@/hooks/use-toast';
import {
  startCupAction,
  updateCupStatusAction,
  deleteCupAction,
  createCupMatchAction,
  removeTeamFromCupAction
} from '@/lib/actions/server-actions';
import { isErrorResponse } from '@/lib/errors';
import {
  ResponsiveAlertDialog as AlertDialog,
  ResponsiveAlertDialogAction as AlertDialogAction,
  ResponsiveAlertDialogCancel as AlertDialogCancel,
  ResponsiveAlertDialogContent as AlertDialogContent,
  ResponsiveAlertDialogDescription as AlertDialogDescription,
  ResponsiveAlertDialogFooter as AlertDialogFooter,
  ResponsiveAlertDialogHeader as AlertDialogHeader,
  ResponsiveAlertDialogTitle as AlertDialogTitle,
} from '@/components/ui/responsive-alert-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { JerseyPreview } from '@/components/team-builder/jersey-preview';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { ChampionCelebration } from '@/components/leagues/ChampionCelebration';
import { BackButton } from '@/components/navigation/back-button';
import { ApplicationsManager } from '@/components/competitions/applications-manager';

export default function CupDetailPage() {
  const params = useParams<{ id: string }>();
  const cupId = params?.id;
  const router = useRouter();
  const searchParams = useSearchParams();
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  // 🎉 Trigger confetti if entering with ?celebrate=true
  useEffect(() => {
    if (searchParams?.get('celebrate') === 'true') {
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 }
      });
      const url = new URL(window.location.href);
      url.searchParams.delete('celebrate');
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchParams]);

  const [activeTab, setActiveTab] = useState<CupTab>('bracket');
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRemovingTeam, setIsRemovingTeam] = useState(false);
  const [teamToRemove, setTeamToRemove] = useState<{ id: string, name: string } | null>(null);
  const [seedingType, setSeedingType] = useState<CupSeedingType>('random');

  // ... Cup and Teams fetching logic ...

  const handleRemoveTeam = async () => {
    if (!cup || !teamToRemove || !user) return;

    setIsRemovingTeam(true);
    try {
      // El tercer argumento es obligatorio: la server action lo usa para
      // verificar que quien remueve es el dueño de la copa. Se estaba
      // llamando sin él, así que la verificación recibía undefined.
      const result = await removeTeamFromCupAction(cup.id, teamToRemove.id, user.uid);
      if (!isErrorResponse(result) && result.success) {
        toast({
          title: 'Equipo removido',
          description: `El equipo ${teamToRemove.name} ha sido removido de la copa.`,
        });
        setTeamToRemove(null);
      } else {
        throw new Error(isErrorResponse(result) ? result.error : (result as any).error);
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo remover el equipo.',
      });
    } finally {
      setIsRemovingTeam(false);
    }
  };

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
      where('__name__', 'in', cup.teams.slice(0, 10))
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

    const validCounts = [2, 4, 8, 16, 32];
    if (!validCounts.includes(cup.teams.length)) {
      toast({
        variant: 'destructive',
        title: 'Error de validación',
        description: `La copa tiene ${cup.teams.length} equipos. Debe tener exactamente 2, 4, 8, 16 o 32 equipos. Por favor, revoca aplicaciones excedentes o invita más equipos.`,
      });
      return;
    }

    setIsStarting(true);
    try {
      const result = await startCupAction(cup.id, seedingType);
      if (!isErrorResponse(result) && result.success) {
        toast({
          title: 'Copa iniciada',
          description: `El bracket ha sido generado con sorteo ${seedingType === 'random' ? 'aleatorio' : 'por OVR'}.`,
        });
        setShowStartDialog(false);
      } else {
        throw new Error(isErrorResponse(result) ? result.error : (result as any).error);
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
      if (!isErrorResponse(result) && result.success) {
        toast({
          title: 'Copa eliminada',
          description: 'La copa ha sido eliminada correctamente.',
        });
        router.push('/competitions/cups');
      } else {
        throw new Error(isErrorResponse(result) ? result.error : (result as any).error);
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

    if (match.winnerId) {
      if (match.matchId) {
        router.push(`/matches/${match.matchId}`);
      }
      return;
    }

    if (match.team1Id && match.team2Id) {
      if (match.matchId) {
        router.push(`/matches/${match.matchId}`);
        return;
      }

      if (isOwner) {
        const loadingToast = toast({
          title: 'Preparando partido...',
          description: 'Creando el encuentro en el sistema.',
        });

        try {
          const result = await createCupMatchAction(cup.id, match.id);
          if (!isErrorResponse(result) && result.success && result.matchId) {
            loadingToast.dismiss();
            router.push(`/matches/${result.matchId}`);
          } else {
            toast({
              variant: 'destructive',
              title: 'Error',
              description: isErrorResponse(result) ? result.error : ((result as any).error || 'No se pudo crear el partido.'),
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
      <div className="p-4">
        <BackButton href="/competitions/cups" label="Volver a Copas" />
        <Alert>
          <AlertDescription>Copa no encontrada.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <CupHeader
          cup={cup}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          isOwner={isOwner}
          organizer={organizer}
          onStartCup={() => setShowStartDialog(true)}
          onDeleteCup={() => setShowDeleteDialog(true)}
        />

        {/* Champion Celebration */}
        {isCompleted && cup.championTeamId && cup.championTeamName && (
          <ChampionCelebration
            championName={cup.championTeamName}
            championJersey={teams?.find(t => t.id === cup.championTeamId)?.jersey}
            runnerUpName={cup.runnerUpTeamName || 'Subcampeón'}
            runnerUpJersey={teams?.find(t => t.id === cup.runnerUpTeamId)?.jersey}
          />
        )}

        {/* Tab content — controlled by CupHeader tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as CupTab)}>
          <TabsContent value="bracket" className="mt-0">
            {cup.bracket && cup.bracket.length > 0 ? (
              <CupBracket
                bracket={cup.bracket}
                onMatchClick={handleMatchClick}
                currentRound={cup.currentRound}
                canCreate={isOwner}
                userTeamId={teams?.find(t => t.ownerUid === user?.uid || t.members.some(m => m.playerId === user?.uid))?.id}
              />
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

          <TabsContent value="teams" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle>Equipos Participantes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {teams?.map(team => (
                    <div key={team.id} className="group flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors relative h-[72px]">
                      <div className="flex-shrink-0">
                        <JerseyPreview jersey={team.jersey} size="sm" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate pr-8">{team.name}</p>
                        <p className="text-xs text-muted-foreground">{team.members.length} jugadores</p>
                      </div>
                      {isOwner && !cup.status.includes('completed') && !cup.bracket?.length && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            setTeamToRemove({ id: team.id, name: team.name });
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {(!teams || teams.length === 0) && (
                    <div className="col-span-full py-8 text-center text-muted-foreground italic">
                      No hay equipos inscriptos aún.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {isOwner && (
            <TabsContent value="applications" className="mt-0">
              <ApplicationsManager
                competitionId={cup.id}
                competitionType="cup"
                competitionName={cup.name}
              />
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Team Removal Dialog */}
      <AlertDialog open={!!teamToRemove} onOpenChange={(open) => !open && setTeamToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Remover equipo?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas remover a <strong>{teamToRemove?.name}</strong> de la copa?
              Su postulación volverá a estar pendiente si existía una previa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemovingTeam}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveTeam}
              disabled={isRemovingTeam}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRemovingTeam && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remover Equipo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
            <Label className="text-sm font-medium">Tipo de sorteo:</Label>
            <RadioGroup
              value={seedingType}
              onValueChange={(v) => setSeedingType(v as CupSeedingType)}
              className="grid grid-cols-1 gap-3"
            >
              <Label
                htmlFor="seeding-random"
                className="flex items-center gap-3 cursor-pointer rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary transition-colors"
              >
                <RadioGroupItem value="random" id="seeding-random" className="sr-only" />
                <div className="flex-1">
                  <div className="font-medium">Sorteo Aleatorio</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Los equipos se distribuyen al azar
                  </div>
                </div>
              </Label>

              <Label
                htmlFor="seeding-ovr"
                className="flex items-center gap-3 cursor-pointer rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary transition-colors"
              >
                <RadioGroupItem value="ovr_based" id="seeding-ovr" className="sr-only" />
                <div className="flex-1">
                  <div className="font-medium">Sorteo por OVR</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Los equipos más fuertes se enfrentan en rondas finales
                  </div>
                </div>
              </Label>
            </RadioGroup>
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
            <AlertDialogAction
              onClick={handleDeleteCup}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
