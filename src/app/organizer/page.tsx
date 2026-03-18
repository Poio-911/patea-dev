'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import type { League, Cup, CompetitionStatus } from '@/lib/types';

type DisplayCompetition = {
  id: string;
  name: string;
  logoUrl?: string;
  status: CompetitionStatus;
  createdAt: unknown;
  format: string;
  sportType?: 'f5' | 'f7' | 'f11';
  teams: string[];
  startDate?: string;
  competitionType: 'league' | 'cup';
  _collectionName: 'leagues' | 'cups';
};
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, Trophy, MoreVertical, Trash2, CalendarDays, Users } from 'lucide-react';
import { CreateCompetitionDialog } from '@/components/organizer/create-competition-dialog';
import { HeroImageBackground } from '@/components/organizer/hero-image-background';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { deleteDoc, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

type DashboardMatch = {
  status: 'pending' | 'finished';
  date?: string;
  time?: string;
  homeTeamName?: string;
  awayTeamName?: string;
  homeScore?: number;
  awayScore?: number;
};

type DashboardFixtureRound = {
  roundNumber?: number;
  roundName?: string;
  matches?: DashboardMatch[];
};

type CompetitionMetrics = {
  teamCount: number;
  totalMatches: number;
  finishedMatches: number;
  pendingMatches: number;
  nextMatchLabel: string | null;
  activeRoundLabel: string | null;
  lastResultLabel: string | null;
};

const defaultMetrics: CompetitionMetrics = {
  teamCount: 0,
  totalMatches: 0,
  finishedMatches: 0,
  pendingMatches: 0,
  nextMatchLabel: null,
  activeRoundLabel: null,
  lastResultLabel: null,
};

function parseMatchDate(date?: string, time?: string): number | null {
  if (!date) return null;

  const dateText = date.trim();
  if (!dateText) return null;

  let year = 0;
  let month = 0;
  let day = 0;

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    const [yyyy, mm, dd] = dateText.split('-').map(Number);
    year = yyyy;
    month = mm;
    day = dd;
  } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateText)) {
    const [dd, mm, yyyy] = dateText.split('/').map(Number);
    year = yyyy;
    month = mm;
    day = dd;
  } else {
    return null;
  }

  const hour = time && /^\d{2}:\d{2}$/.test(time) ? Number(time.slice(0, 2)) : 0;
  const minute = time && /^\d{2}:\d{2}$/.test(time) ? Number(time.slice(3, 5)) : 0;

  return new Date(year, month - 1, day, hour, minute, 0, 0).getTime();
}

function getCompetitionStatusLabel(status: League['status']) {
  if (status === 'in_progress') return 'EN JUEGO';
  if (status === 'completed') return 'FINALIZADA';
  if (status === 'open_for_applications') return 'INSCRIPCIONES';
  return 'PREVIA';
}

export default function OrganizerDashboardPage() {
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [competitionToDelete, setCompetitionToDelete] = React.useState<{ id: string; collectionName: 'leagues' | 'cups' } | null>(null);
  const [competitionMetrics, setCompetitionMetrics] = React.useState<Record<string, CompetitionMetrics>>({});

  const leaguesQuery = React.useMemo(() => {
    if (!firestore || !user?.uid) return null;
    return query(
      collection(firestore, 'leagues'),
      where('ownerUid', '==', user.uid)
    );
  }, [firestore, user?.uid]);

  const cupsQuery = React.useMemo(() => {
    if (!firestore || !user?.uid) return null;
    return query(
      collection(firestore, 'cups'),
      where('ownerUid', '==', user.uid)
    );
  }, [firestore, user?.uid]);

  const { data: leagues, loading: leaguesLoading } = useCollection<League>(leaguesQuery);
  const { data: cups, loading: cupsLoading } = useCollection<Cup>(cupsQuery);
  const loading = leaguesLoading || cupsLoading;

  const allCompetitions = React.useMemo((): DisplayCompetition[] => {
    const leagueItems: DisplayCompetition[] = (leagues || []).map((l) => ({
      id: l.id,
      name: l.name,
      logoUrl: l.logoUrl,
      status: l.status,
      createdAt: l.createdAt,
      format: l.format,
      sportType: l.sportType,
      teams: l.teams || [],
      startDate: l.startDate,
      competitionType: (l.competitionType as 'league' | 'cup') || 'league',
      _collectionName: 'leagues',
    }));
    const cupItems: DisplayCompetition[] = (cups || []).map((c) => ({
      id: c.id,
      name: c.name,
      logoUrl: c.logoUrl,
      status: c.status,
      createdAt: c.createdAt,
      format: c.format,
      sportType: (c as any).sportType,
      teams: c.teams || [],
      startDate: c.startDate,
      competitionType: 'cup',
      _collectionName: 'cups',
    }));
    return [...leagueItems, ...cupItems];
  }, [leagues, cups]);

  React.useEffect(() => {
    if (!firestore || !allCompetitions || allCompetitions.length === 0) {
      setCompetitionMetrics({});
      return;
    }

    const unsubscribers: Array<() => void> = [];

    allCompetitions.forEach((comp) => {
      const compId = comp.id;
      const collPath = comp._collectionName;

      const teamsRef = collection(firestore, collPath, compId, 'teams');
      const unsubscribeTeams = onSnapshot(teamsRef, (snapshot) => {
        setCompetitionMetrics((prev) => ({
          ...prev,
          [compId]: {
            ...(prev[compId] || defaultMetrics),
            teamCount: snapshot.size,
          },
        }));
      });
      unsubscribers.push(unsubscribeTeams);

      // Cups use bracket structure — no fixtures subcollection
      if (collPath !== 'leagues') return;

      const fixturesRef = collection(firestore, 'leagues', compId, 'fixtures');
      const unsubscribeFixtures = onSnapshot(fixturesRef, (snapshot) => {
        const leagueId = compId;
        let totalMatches = 0;
        let finishedMatches = 0;
        let pendingMatches = 0;
        let closestTimestamp: number | null = null;
        let closestLabel: string | null = null;
        let firstPendingRoundLabel: string | null = null;

        let lastFinishedTimestamp: number | null = null;
        let lastFinishedRoundNumber = -1;
        let lastFinishedResultLabel: string | null = null;

        type NormalizedRound = {
          roundNumber: number;
          roundName: string;
          matches: DashboardMatch[];
        };

        const normalizedRounds: NormalizedRound[] = snapshot.docs.map((docSnap, index) => {
          const round = docSnap.data() as DashboardFixtureRound;
          const inferredRoundNumber = Number.isFinite(round.roundNumber) ? Number(round.roundNumber) : index + 1;
          return {
            roundNumber: inferredRoundNumber,
            roundName: round.roundName || `Fecha ${inferredRoundNumber}`,
            matches: Array.isArray(round.matches) ? round.matches : [],
          };
        }).sort((a, b) => a.roundNumber - b.roundNumber);

        normalizedRounds.forEach((round) => {
          let roundHasPending = false;

          round.matches.forEach((match) => {
            totalMatches += 1;

            if (match.status === 'finished') {
              finishedMatches += 1;

              const finishedTimestamp = parseMatchDate(match.date, match.time);
              const homeScore = typeof match.homeScore === 'number' ? match.homeScore : 0;
              const awayScore = typeof match.awayScore === 'number' ? match.awayScore : 0;
              const homeName = match.homeTeamName || 'Local';
              const awayName = match.awayTeamName || 'Visita';
              const resultLabel = `${homeName} ${homeScore}-${awayScore} ${awayName}`;

              if (
                (finishedTimestamp !== null && (lastFinishedTimestamp === null || finishedTimestamp > lastFinishedTimestamp)) ||
                (finishedTimestamp === null && lastFinishedTimestamp === null && round.roundNumber >= lastFinishedRoundNumber)
              ) {
                lastFinishedTimestamp = finishedTimestamp;
                lastFinishedRoundNumber = round.roundNumber;
                lastFinishedResultLabel = resultLabel;
              }

              return;
            }

            pendingMatches += 1;
            roundHasPending = true;

            const timestamp = parseMatchDate(match.date, match.time);
            if (timestamp !== null && (closestTimestamp === null || timestamp < closestTimestamp)) {
              closestTimestamp = timestamp;
              closestLabel = [match.date, match.time].filter(Boolean).join(' · ');
            }
          });

          if (!firstPendingRoundLabel && roundHasPending) {
            firstPendingRoundLabel = round.roundName;
          }
        });

        if (!closestLabel && pendingMatches > 0) {
          closestLabel = 'Pendiente de programación';
        }

        setCompetitionMetrics((prev) => ({
          ...prev,
          [leagueId]: {
            ...(prev[leagueId] || defaultMetrics),
            totalMatches,
            finishedMatches,
            pendingMatches,
            nextMatchLabel: closestLabel,
            activeRoundLabel: firstPendingRoundLabel,
            lastResultLabel: lastFinishedResultLabel,
          },
        }));
      });

      unsubscribers.push(unsubscribeFixtures);
    });

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [firestore, allCompetitions]);

  const orderedCompetitions = React.useMemo(() => {
    const statusPriority: Record<CompetitionStatus, number> = {
      in_progress: 0,
      open_for_applications: 1,
      draft: 2,
      completed: 3,
    };

    const getDateValue = (value: unknown): number => {
      if (!value) return 0;
      if (typeof value === 'string') {
        const parsed = Date.parse(value);
        return Number.isNaN(parsed) ? 0 : parsed;
      }
      if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
        return (value as { toDate: () => Date }).toDate().getTime();
      }
      return 0;
    };

    return [...allCompetitions].sort((a, b) => {
      const byStatus = statusPriority[a.status] - statusPriority[b.status];
      if (byStatus !== 0) return byStatus;
      return getDateValue(b.createdAt) - getDateValue(a.createdAt);
    });
  }, [allCompetitions]);

  const statusSummary = React.useMemo(() => {
    return orderedCompetitions.reduce(
      (acc, comp) => {
        if (comp.status === 'in_progress') acc.inProgress += 1;
        if (comp.status === 'draft' || comp.status === 'open_for_applications') acc.planning += 1;
        if (comp.status === 'completed') acc.completed += 1;
        return acc;
      },
      { inProgress: 0, planning: 0, completed: 0 }
    );
  }, [orderedCompetitions]);

  const handleDeleteCompetition = async () => {
    if (!firestore || !competitionToDelete) return;
    try {
      await deleteDoc(doc(firestore, competitionToDelete.collectionName, competitionToDelete.id));
      toast({ title: 'Competición eliminada', description: 'La competición ha sido borrada permanentemente.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar la competición.' });
    } finally {
      setCompetitionToDelete(null);
    }
  };

  return (
    <div className="space-y-8 pb-10">
      {/* Hero Header */}
      <div className="relative -mx-4 md:-mx-6 -mt-8 md:-mt-10 mb-8 overflow-hidden bg-gradient-to-br from-background/40 via-background/60 to-background/90 pt-16 pb-12 px-6 sm:px-10 border-b border-border shadow-md rounded-b-[2.5rem] backdrop-blur-md">
        <HeroImageBackground />
        
        <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 w-full max-w-6xl mx-auto">
          <div className="space-y-3">
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 backdrop-blur-md px-3 py-1 animate-in fade-in slide-in-from-bottom-2">
              Modo Organizador
            </Badge>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black font-headline tracking-tighter text-foreground drop-shadow-lg leading-tight animate-in fade-in slide-in-from-bottom-4 delay-75">
              PANEL DE <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-green-400">CONTROL</span>
            </h1>
            <p className="text-muted-foreground sm:text-lg max-w-lg mt-2 leading-relaxed animate-in fade-in slide-in-from-bottom-6 delay-150">
              Gestioná tus ligas, copas y equipos. Armá fixtures automáticos y llevá el control absoluto de tus torneos.
            </p>
          </div>
          <Button 
            size="lg" 
            className="w-full sm:w-auto shadow-[0_0_30px_-5px] shadow-primary/40 font-bold tracking-wide uppercase group animate-in fade-in slide-in-from-bottom-6 delay-200" 
            onClick={() => setIsCreateOpen(true)}
          >
            <PlusCircle className="mr-2 h-5 w-5 group-hover:rotate-90 transition-transform duration-300" />
            Nueva Competición
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-2xl font-bold tracking-tight">Mis Torneos</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="font-mono">
              {orderedCompetitions.length} Activos
            </Badge>
            {statusSummary.inProgress > 0 && (
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                {statusSummary.inProgress} En juego
              </Badge>
            )}
            {statusSummary.planning > 0 && (
              <Badge variant="outline" className="bg-muted/40 border-border">
                {statusSummary.planning} En preparación
              </Badge>
            )}
            {statusSummary.completed > 0 && (
              <Badge variant="outline" className="bg-muted/20 border-border/70 text-muted-foreground">
                {statusSummary.completed} Finalizadas
              </Badge>
            )}
          </div>
        </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse bg-muted/20 border-border/50">
              <CardContent className="h-32" />
            </Card>
          ))}
        </div>
      ) : orderedCompetitions.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {orderedCompetitions.map((comp) => {
            const metrics = competitionMetrics[comp.id] || defaultMetrics;
            const teamCount = metrics.teamCount > 0 ? metrics.teamCount : (comp.teams?.length || 0);
            const statusLabel = getCompetitionStatusLabel(comp.status);
            const hasMatches = metrics.totalMatches > 0;

            return (
            <Card
              key={comp.id}
              className="group relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/20 cursor-pointer bg-card/40 border-border/40 backdrop-blur-xl"
              onClick={() => {
                const path = comp._collectionName === 'cups'
                  ? `/organizer/cup/${comp.id}`
                  : `/organizer/league/${comp.id}`;
                router.push(path);
              }}
            >
              {/* Subtle gradient background based on hover */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              
              <CardHeader className="pb-4 relative z-10 flex flex-row items-start justify-between">
                <div className="flex items-center gap-4">
                  <Avatar className="h-14 w-14 rounded-xl shadow-lg border-2 border-background bg-muted">
                    <AvatarImage src={comp.logoUrl || undefined} className="object-cover" />
                    <AvatarFallback className="rounded-xl bg-primary/10">
                      <Trophy className="h-6 w-6 text-primary drop-shadow-[0_0_8px_rgba(200,255,0,0.5)]" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    <CardTitle className="font-headline font-black uppercase text-xl xl:text-2xl tracking-tight leading-none group-hover:text-primary transition-colors line-clamp-2">
                      {comp.name}
                    </CardTitle>
                    <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground/80 uppercase flex-wrap">
                      <span>{comp.competitionType === 'cup' ? 'Copa' : 'Liga'}</span>
                      <span>•</span>
                      <span>{String(comp.format) === 'single_elimination' ? 'Eliminación' : 'Puntos'}</span>
                      {comp.sportType && (
                        <>
                          <span>•</span>
                          <span>{comp.sportType.toUpperCase()}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="relative z-20" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 -mr-2">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem 
                        className="text-destructive focus:text-destructive cursor-pointer"
                        onClick={() => setCompetitionToDelete({ id: comp.id, collectionName: comp._collectionName })}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar Competición
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="relative z-10 pt-0">
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="flex flex-col p-3 rounded-lg bg-background/50 border border-white/5">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground mb-1 flex items-center gap-1">
                      <Users className="w-3 h-3"/> Equipos
                    </span>
                    <span className="text-xl font-black font-mono">{teamCount}</span>
                  </div>
                  <div className="flex flex-col p-3 rounded-lg bg-background/50 border border-white/5">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground mb-1">Partidos</span>
                    <span className="text-sm font-black mt-0.5 truncate text-foreground">
                      {hasMatches ? `${metrics.finishedMatches}/${metrics.totalMatches}` : 'Sin fixture'}
                    </span>
                  </div>
                  <div className="flex flex-col p-3 rounded-lg bg-background/50 border border-white/5">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground mb-1 flex items-center gap-1">
                      <CalendarDays className="w-3 h-3"/> Estado
                    </span>
                    <span className="text-sm font-black mt-0.5 truncate text-primary">
                      {statusLabel}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-muted-foreground border-t border-border/30 pt-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="uppercase tracking-wider">Próximo partido</span>
                    <span className="font-medium text-foreground truncate max-w-[65%] text-right">
                      {metrics.nextMatchLabel || 'Sin programar'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="uppercase tracking-wider">Fecha activa</span>
                    <span className="font-medium text-foreground truncate max-w-[65%] text-right">
                      {metrics.activeRoundLabel || 'Sin fecha activa'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="uppercase tracking-wider">Último resultado</span>
                    <span className="font-medium text-foreground truncate max-w-[65%] text-right">
                      {metrics.lastResultLabel || 'Sin resultados'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="uppercase tracking-wider">Inicio torneo</span>
                    <span className="font-medium text-foreground truncate max-w-[65%] text-right">
                      {comp.startDate || 'A definir'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )})}
        </div>
      ) : (
        <Card className="border-dashed py-12 flex flex-col items-center justify-center gap-4 bg-transparent shadow-none">
          <Trophy className="h-12 w-12 text-muted-foreground/30" />
          <div className="text-center space-y-1">
            <h3 className="font-bold text-lg">No administras ninguna competición</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Empezá creando tu primera liga o torneo para invitar equipos y generar fixtures automáticos.
            </p>
          </div>
          <Button variant="outline" className="mt-2 border-primary/20 hover:bg-primary/5 hover:text-primary" onClick={() => setIsCreateOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Crear Torneo
          </Button>
        </Card>
      )}

      </div>

      <CreateCompetitionDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />

      <AlertDialog open={!!competitionToDelete} onOpenChange={(open) => !open && setCompetitionToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta competición?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se borrarán todos los equipos, fixtures, actas, tarjetas y posiciones asociadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCompetition} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar Permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
