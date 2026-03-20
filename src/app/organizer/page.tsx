'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import type { League, Cup, CompetitionStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

type DisplayCompetition = {
  id: string;
  name: string;
  logoUrl?: string;
  status: CompetitionStatus;
  createdAt: unknown;
  format: string;
  sportType?: 'f5' | 'f7' | 'f11';
  teams: (string | any)[];
  startDate?: string;
  competitionType: 'league' | 'cup';
  _collectionName: 'leagues' | 'cups';
  bracket?: any[]; // Cup bracket matches for metrics
};
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, Trophy, MoreVertical, Trash2, CalendarDays, Users, Clock, Target, Activity, Calendar, LayoutGrid, Info } from 'lucide-react';
import { CreateCompetitionDialog } from '@/components/organizer/create-competition-dialog';
import { HeroImageBackground } from '@/components/organizer/hero-image-background';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { deleteCompetitionAction } from '@/lib/actions/server-actions';

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
      bracket: c.bracket || [],
    }));
    return [...leagueItems, ...cupItems];
  }, [leagues, cups]);


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
    if (!competitionToDelete) return;
    try {
      const result = await deleteCompetitionAction(competitionToDelete.id, competitionToDelete.collectionName);
      if (!result.success) {
        toast({ variant: 'destructive', title: 'Error', description: result.error || 'No se pudo eliminar la competición.' });
        return;
      }
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
            {orderedCompetitions.map((comp) => (
              <CompetitionCard 
                key={comp.id} 
                comp={comp} 
                onDelete={(id, coll) => setCompetitionToDelete({ id, collectionName: coll })}
              />
            ))}
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
            {competitionToDelete && allCompetitions.find(c => c.id === competitionToDelete.id)?.status === 'in_progress' && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 mt-3">
                <p className="font-bold text-destructive">⚠️ Esta competición está en curso</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Tiene partidos en progreso. Se perderán todos los resultados y datos irreversiblemente.
                </p>
              </div>
            )}
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
function CompetitionCard({ comp, onDelete }: { comp: DisplayCompetition; onDelete: (id: string, coll: 'leagues' | 'cups') => void }) {
  const router = useRouter();
  const firestore = useFirestore();
  const [metrics, setMetrics] = React.useState<CompetitionMetrics>(defaultMetrics);

  React.useEffect(() => {
    if (!firestore || !comp.id) return;

    const unsubscribers: Array<() => void> = [];

    // 1. Listen for teams
    const teamsRef = collection(firestore, comp._collectionName, comp.id, 'teams');
    const unsubscribeTeams = onSnapshot(teamsRef, (snapshot) => {
      setMetrics((prev) => ({ ...prev, teamCount: snapshot.size }));
    });
    unsubscribers.push(unsubscribeTeams);

    // 2. Listen for matches (Fixtures for leagues, bracket for cups)
    if (comp._collectionName === 'cups') {
      // Cups metrics come from bracket data which is already in the comp object, 
      // but if we want live updates we should ideally listen to the cup document too.
      // However, for now, we use the bracket data passed in comp.
      const bracket: any[] = comp.bracket || [];
      if (bracket.length > 0) {
        const totalMatches = bracket.length;
        const finishedMatches = bracket.filter((m: any) => m.status === 'finished').length;
        const pendingMatches = totalMatches - finishedMatches;
        const lastFinished = [...bracket].filter((m: any) => m.status === 'finished').pop();
        const lastResultLabel = lastFinished
          ? `${lastFinished.team1Name || 'Local'} ${lastFinished.team1Score ?? 0}-${lastFinished.team2Score ?? 0} ${lastFinished.team2Name || 'Visita'}`
          : null;
        const nextPending = bracket.find((m: any) => m.status !== 'finished');
        const nextMatchLabel = nextPending?.date
          ? [nextPending.date, nextPending.time].filter(Boolean).join(' · ')
          : pendingMatches > 0 ? 'Pendiente de programación' : null;
          
        setMetrics(prev => ({
          ...prev,
          totalMatches,
          finishedMatches,
          pendingMatches,
          nextMatchLabel,
          lastResultLabel,
        }));
      }
    } else {
      // Leagues: Listen to fixtures subcollection
      const fixturesRef = collection(firestore, 'leagues', comp.id, 'fixtures');
      const unsubscribeFixtures = onSnapshot(fixturesRef, (snapshot) => {
        let totalMatches = 0;
        let finishedMatches = 0;
        let pendingMatches = 0;
        let closestTimestamp: number | null = null;
        let closestLabel: string | null = null;
        let firstPendingRoundLabel: string | null = null;
        let lastFinishedTimestamp: number | null = null;
        let lastFinishedRoundNumber = -1;
        let lastFinishedResultLabel: string | null = null;

        const normalizedRounds = snapshot.docs.map((docSnap, index) => {
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
              const resultLabel = `${match.homeTeamName || 'Local'} ${match.homeScore ?? 0}-${match.awayScore ?? 0} ${match.awayTeamName || 'Visita'}`;
              if ((finishedTimestamp !== null && (lastFinishedTimestamp === null || finishedTimestamp > lastFinishedTimestamp)) ||
                  (finishedTimestamp === null && lastFinishedTimestamp === null && round.roundNumber >= lastFinishedRoundNumber)) {
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
          if (!firstPendingRoundLabel && roundHasPending) firstPendingRoundLabel = round.roundName;
        });

        if (!closestLabel && pendingMatches > 0) closestLabel = 'Pendiente de programación';
        
        setMetrics((prev) => ({
          ...prev,
          totalMatches,
          finishedMatches,
          pendingMatches,
          nextMatchLabel: closestLabel,
          activeRoundLabel: firstPendingRoundLabel,
          lastResultLabel: lastFinishedResultLabel,
        }));
      });
      unsubscribers.push(unsubscribeFixtures);
    }

    return () => unsubscribers.forEach(unsub => unsub());
  }, [firestore, comp.id, comp._collectionName]); // Stable dependencies

  const teamsArray = comp.teams || [];
  const teamCount = metrics.teamCount > 0 ? metrics.teamCount : teamsArray.length;
  const statusLabel = getCompetitionStatusLabel(comp.status);
  const hasMatches = metrics.totalMatches > 0;
  const showCupNoBracketHint = comp._collectionName === 'cups' && !hasMatches && comp.status !== 'completed';

  return (
    <Card
      className="group relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/20 cursor-pointer bg-card/40 border-border/40 backdrop-blur-xl"
      onClick={() => {
        const path = comp._collectionName === 'cups' ? `/organizer/cup/${comp.id}` : `/organizer/league/${comp.id}`;
        router.push(path);
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      <CardHeader className="pb-4 relative z-10 flex flex-row items-start justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 rounded-2xl shadow-xl border-2 border-background bg-secondary transition-transform group-hover:scale-105 duration-500">
            <AvatarImage src={comp.logoUrl || undefined} className="object-cover" />
            <AvatarFallback className="rounded-2xl bg-primary/10">
              <Trophy className="h-7 w-7 text-primary drop-shadow-[0_0_12px_rgba(200,255,0,0.6)]" />
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <CardTitle className="font-headline font-black uppercase text-xl xl:text-2xl tracking-tight leading-none group-hover:text-primary transition-colors line-clamp-2">
              {comp.name}
            </CardTitle>
            <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.1em] text-muted-foreground/60 uppercase flex-wrap">
              <span className="bg-muted/50 px-1.5 py-0.5 rounded text-[9px] border border-border/30">{comp.competitionType === 'cup' ? 'Copa' : 'Liga'}</span>
              <span>•</span>
              <span>{String(comp.format) === 'single_elimination' ? 'Eliminación' : 'Puntos'}</span>
              {comp.sportType && (
                <>
                  <span>•</span>
                  <span className="text-foreground/70">{comp.sportType.toUpperCase()}</span>
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
                onClick={() => onDelete(comp.id, comp._collectionName)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar Competición
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="relative z-10 pt-0">
        <div className="grid grid-cols-3 gap-2.5 mb-5">
          <div className="flex flex-col p-2.5 rounded-xl bg-muted/20 border border-white/5 transition-colors group-hover:bg-muted/30">
            <span className="text-[9px] uppercase font-black tracking-[0.15em] text-muted-foreground/60 mb-1 flex items-center gap-1">
              <Users className="w-3 h-3 text-primary/70"/> Equipos
            </span>
            <span className="text-xl font-black font-mono leading-none">{teamCount}</span>
          </div>
          <div className="flex flex-col p-2.5 rounded-xl bg-muted/20 border border-white/5 transition-colors group-hover:bg-muted/30">
            <span className="text-[9px] uppercase font-black tracking-[0.15em] text-muted-foreground/60 mb-1 flex items-center gap-1">
              <LayoutGrid className="w-3 h-3 text-primary/70"/> Partidos
            </span>
            <span className="text-xl font-black font-mono leading-none">
              {hasMatches ? `${metrics.finishedMatches}/${metrics.totalMatches}` : '—'}
            </span>
          </div>
          <div className="flex flex-col p-2.5 rounded-xl bg-muted/20 border border-white/5 transition-colors group-hover:bg-muted/30">
            <span className="text-[9px] uppercase font-black tracking-[0.15em] text-muted-foreground/60 mb-1 flex items-center gap-1">
              <Activity className="w-3 h-3 text-primary/70"/> Estado
            </span>
            <span className={cn(
              "text-[10px] font-black uppercase tracking-tighter truncate",
              comp.status === 'in_progress' ? "text-primary animate-pulse" : "text-foreground/80"
            )}>
              {statusLabel}
            </span>
          </div>
        </div>
        <div className="space-y-2 text-xs text-muted-foreground border-t border-border/20 pt-4">
          {showCupNoBracketHint && <div className="text-xs text-muted-foreground italic">Generá el bracket para ver el progreso</div>}
          <div className="flex items-center justify-between gap-3 group/row">
            <div className="flex items-center gap-1.5 text-muted-foreground/50 uppercase tracking-[0.15em] font-black text-[9px]">
              <Clock className="w-3 h-3 group-hover/row:text-primary transition-colors" />
              <span>Próximo partido</span>
            </div>
            <span className="font-bold text-foreground/80 truncate max-w-[55%] text-right transition-colors group-hover/row:text-foreground">
              {showCupNoBracketHint ? 'Generar bracket' : (metrics.nextMatchLabel || 'No programado')}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 group/row">
            <div className="flex items-center gap-1.5 text-muted-foreground/50 uppercase tracking-[0.15em] font-black text-[9px]">
              <CalendarDays className="w-3 h-3 group-hover/row:text-primary transition-colors" />
              <span>Fecha activa</span>
            </div>
            <span className="font-bold text-foreground/80 truncate max-w-[55%] text-right transition-colors group-hover/row:text-foreground">
              {metrics.activeRoundLabel || 'Sin fecha activa'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 group/row">
            <div className="flex items-center gap-1.5 text-muted-foreground/50 uppercase tracking-[0.15em] font-black text-[9px]">
              <Target className="w-3 h-3 group-hover/row:text-primary transition-colors" />
              <span>Último resultado</span>
            </div>
            <span className="font-bold text-foreground/80 truncate max-w-[55%] text-right transition-colors group-hover/row:text-foreground">
              {metrics.lastResultLabel || 'Sin resultados'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 group/row">
            <div className="flex items-center gap-1.5 text-muted-foreground/50 uppercase tracking-[0.15em] font-black text-[9px]">
              <Calendar className="w-3 h-3 group-hover/row:text-primary transition-colors" />
              <span>Inicio torneo</span>
            </div>
            <span className="font-bold text-foreground/80 truncate max-w-[55%] text-right transition-colors group-hover/row:text-foreground">
              {comp.startDate ? (() => { try { return format(parseISO(comp.startDate!), "d MMM yyyy", { locale: es }); } catch { return comp.startDate; } })() : 'A definir'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
