'use client';

import * as React from 'react';
import { useFirestore } from '@/firebase';
import { collection, query, onSnapshot, addDoc, doc, writeBatch, getDocs, orderBy } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CalendarDays, RefreshCw, ChevronDown, Settings, MapPin, Clock, AlertTriangle, PlayCircle, ExternalLink, UserCheck, List, Calendar, Download } from 'lucide-react';
import { JerseyPreview } from '@/components/team-builder/jersey-preview';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { CompetitionMatchResultDialog } from '@/components/organizer/competition-match-result-dialog';
import { AssignRefereeDialog } from '@/components/organizer/assign-referee-dialog';
import { LeagueCalendarView } from '@/components/organizer/league-calendar-view';

interface Team {
  id: string;
  name: string;
  jersey: any;
}

interface MatchObj {
  id: string;
  homeTeamId: string | null; // null if BYE
  awayTeamId: string | null; // null if BYE
  homeTeamName: string;
  awayTeamName: string;
  homeScore?: number;
  awayScore?: number;
  status: 'pending' | 'finished';
  date?: string;
  time?: string;
  venue?: string;
  streamingUrl?: string;
  isLive?: boolean;
  refereeId?: string;
  refereeName?: string;
}

interface FixtureRound {
  id: string;
  roundNumber: number;
  roundName: string; 
  matches: MatchObj[];
  createdAt: string;
}

interface LeagueFixtureTabProps {
  leagueId: string;
  leagueName: string;
  leagueFormat: string;
  isReadOnly?: boolean;
}

export function LeagueFixtureTab({ leagueId, leagueName, leagueFormat, isReadOnly }: LeagueFixtureTabProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [teams, setTeams] = React.useState<Team[]>([]);
  const [rounds, setRounds] = React.useState<FixtureRound[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<'list' | 'calendar'>('list');

  const [selectedMatch, setSelectedMatch] = React.useState<MatchObj | null>(null);
  const [selectedFixtureId, setSelectedFixtureId] = React.useState<string>('');
  const [isResultOpen, setIsResultOpen] = React.useState(false);
  const [isRefereeDialogOpen, setIsRefereeDialogOpen] = React.useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = React.useState(false);

  // Count finished matches
  const finishedMatchesCount = React.useMemo(() => {
    let count = 0;
    rounds.forEach(round => {
      round.matches.forEach(match => {
        if (match.status === 'finished') count++;
      });
    });
    return count;
  }, [rounds]);

  React.useEffect(() => {
    if (!firestore) return;
    
    // Listen to teams
    const teamsRef = collection(firestore, 'leagues', leagueId, 'teams');
    const unsubTeams = onSnapshot(query(teamsRef), (snap) => {
      setTeams(snap.docs.map(d => ({ id: d.id, ...d.data() } as Team)));
    });

    // Listen to fixtures
    const fixturesRef = collection(firestore, 'leagues', leagueId, 'fixtures');
    const qFixtures = query(fixturesRef, orderBy('roundNumber', 'asc'));
    const unsubFixtures = onSnapshot(qFixtures, (snap) => {
      setRounds(snap.docs.map(d => ({ id: d.id, ...d.data() } as FixtureRound)));
      setLoading(false);
    });

    return () => {
      unsubTeams();
      unsubFixtures();
    };
  }, [firestore, leagueId]);

  const handleGenerateFixture = () => {
    if (teams.length < 2) {
      toast({ variant: 'destructive', title: 'Pocos Equipos', description: 'Se necesitan al menos 2 equipos para armar el fixture.' });
      return;
    }

    // If there are finished matches and rounds exist, show confirmation dialog
    if (rounds.length > 0 && finishedMatchesCount > 0) {
      setShowRegenerateConfirm(true);
    } else {
      generateRoundRobin();
    }
  };

  const generateRoundRobin = async () => {
    if (!firestore) return;
    if (teams.length < 2) {
      toast({ variant: 'destructive', title: 'Pocos Equipos', description: 'Se necesitan al menos 2 equipos para armar el fixture.' });
      return;
    }

    // Close confirmation dialog if open
    setShowRegenerateConfirm(false);

    setIsGenerating(true);

    try {
      // Delete existing fixtures first
      if (rounds.length > 0) {
        const fixturesRef = collection(firestore, 'leagues', leagueId, 'fixtures');
        const existingFixtures = await getDocs(fixturesRef);
        const deleteBatch = writeBatch(firestore);
        existingFixtures.docs.forEach(docSnap => {
          deleteBatch.delete(docSnap.ref);
        });
        await deleteBatch.commit();
      }
      const matchTeams = [...teams];
      // Si son impares, se agrega un "Bye" (Libre)
      if (matchTeams.length % 2 !== 0) {
        matchTeams.push({ id: 'BYE', name: 'Libre', jersey: null });
      }

      const numTeams = matchTeams.length;
      const numRounds = numTeams - 1;
      const matchesPerRound = numTeams / 2;

      const generatedRounds: FixtureRound[] = [];

      // Circle algorithm
      const indices = Array.from({ length: numTeams }, (_, i) => i);
      
      for (let r = 0; r < numRounds; r++) {
        const currentRoundMatches: MatchObj[] = [];
        
        for (let i = 0; i < matchesPerRound; i++) {
          const homeIdx = indices[i];
          const awayIdx = indices[numTeams - 1 - i];
          const homeTeam = matchTeams[homeIdx];
          const awayTeam = matchTeams[awayIdx];

          currentRoundMatches.push({
            id: `match_${r}_${i}`,
            homeTeamId: homeTeam.id === 'BYE' ? null : homeTeam.id,
            awayTeamId: awayTeam.id === 'BYE' ? null : awayTeam.id,
            homeTeamName: homeTeam.name,
            awayTeamName: awayTeam.name,
            status: 'pending',
          });
        }
        
        generatedRounds.push({
          id: `fake_id_${r}`,
          roundNumber: r + 1,
          roundName: `Fecha ${r + 1}`,
          matches: currentRoundMatches,
          createdAt: new Date().toISOString()
        });

        // Rotate indices for next round (keep indices[0] fixed)
        indices.splice(1, 0, indices.pop()!);
      }

      // Si es doble rueda (Ida y Vuelta) duplicamos invirtiendo localías
      if (leagueFormat === 'double_round_robin') {
        for (let r = 0; r < numRounds; r++) {
          const originalRound = generatedRounds[r];
          const invertedMatches = originalRound.matches.map(m => ({
            ...m,
            id: `match_${r + numRounds}_${Math.random()}`,
            homeTeamId: m.awayTeamId,
            awayTeamId: m.homeTeamId,
            homeTeamName: m.awayTeamName,
            awayTeamName: m.homeTeamName,
          }));
          generatedRounds.push({
            id: `fake_id_${r + numRounds}`,
            roundNumber: r + 1 + numRounds,
            roundName: `Fecha ${r + 1 + numRounds}`,
            matches: invertedMatches,
            createdAt: new Date().toISOString()
          });
        }
      }

      // Batch Write
      const batch = writeBatch(firestore);
      const fixturesRef = collection(firestore, 'leagues', leagueId, 'fixtures');
      
      generatedRounds.forEach((gr) => {
        const newDocRef = doc(fixturesRef);
        batch.set(newDocRef, {
          roundNumber: gr.roundNumber,
          roundName: gr.roundName,
          matches: gr.matches,
          createdAt: gr.createdAt
        });
      });

      await batch.commit();

      toast({ title: 'Fixture Generado', description: 'Partidos creados automáticamente.' });
    } catch (e: any) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo generar el fixture.' });
    } finally {
      setIsGenerating(false);
    }
  };

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="h-48"></CardContent>
      </Card>
    );
  }

  // Si no hay fixture generado
  if (rounds.length === 0) {
    return (
      <Card className="border-dashed bg-card/40 backdrop-blur-sm">
        <CardContent className="p-12 text-center flex flex-col items-center gap-4">
          <CalendarDays className="h-16 w-16 text-muted-foreground/30" />
          <div className="space-y-1">
            <h3 className="font-bold text-xl uppercase tracking-tight">Fixture Vacío</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Tenés {teams.length} equipos inscriptos. El algoritmo generará el cronograma de partidos.
            </p>
          </div>
          <Button
            onClick={handleGenerateFixture}
            disabled={isGenerating || teams.length < 2}
            className="mt-4"
          >
            {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Generar Fixture Automático
          </Button>
          {teams.length < 2 && (
            <p className="text-xs text-destructive mt-2 font-bold">Mínimo 2 equipos obligatorios.</p>
          )}
        </CardContent>
      </Card>
    );
  }

  // Mostrar el fixture
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight">Fixture Generado</h2>
          <p className="text-sm text-muted-foreground">{rounds.length} fechas · {rounds.reduce((acc, r) => acc + r.matches.length, 0)} partidos</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 p-1 bg-muted/30 rounded-lg border border-border/40">
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              className={cn(
                "h-8 px-3 text-xs font-bold",
                viewMode === 'list' ? 'shadow-sm' : 'hover:bg-muted/50'
              )}
              onClick={() => setViewMode('list')}
            >
              <List className="mr-1.5 h-3.5 w-3.5" />
              Lista
            </Button>
            <Button
              variant={viewMode === 'calendar' ? 'default' : 'ghost'}
              size="sm"
              className={cn(
                "h-8 px-3 text-xs font-bold",
                viewMode === 'calendar' ? 'shadow-sm' : 'hover:bg-muted/50'
              )}
              onClick={() => setViewMode('calendar')}
            >
              <Calendar className="mr-1.5 h-3.5 w-3.5" />
              Calendario
            </Button>
          </div>

          {!isReadOnly && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs font-bold border-border/50 text-muted-foreground hover:text-primary"
              onClick={handleGenerateFixture}
              disabled={isGenerating}
            >
              {isGenerating ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-2 h-3 w-3" />}
              Regenerar
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="text-xs font-bold border-border/50 text-muted-foreground hover:text-primary"
            onClick={() => exportFixtureToICS(rounds, leagueName)}
            title="Exportar fixture al calendario"
          >
            <Download className="mr-1.5 h-3 w-3" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Conditional Rendering based on viewMode */}
      {viewMode === 'calendar' ? (
        <LeagueCalendarView leagueId={leagueId} />
      ) : (
        <div className="space-y-3">
          {rounds.map((round) => {
          const finishedCount = round.matches.filter(m => m.status === 'finished').length;
          const totalMatches = round.matches.length;
          const isRoundComplete = finishedCount === totalMatches && totalMatches > 0;

          return (
            <Collapsible key={round.id} className="rounded-2xl border border-border/40 bg-card/70 backdrop-blur-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <CollapsibleTrigger className="flex justify-between items-center w-full px-5 py-4 hover:bg-muted/30 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isRoundComplete ? 'bg-green-500' : finishedCount > 0 ? 'bg-yellow-500' : 'bg-muted-foreground/30'}`}/>
                  <span className="font-headline font-black uppercase tracking-wide">{round.roundName}</span>
                  {isRoundComplete && <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-widest bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">Completa</Badge>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-mono">{finishedCount}/{totalMatches}</span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </div>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="divide-y divide-border/20 border-t border-border/20">
                  {round.matches.map((match, idx) => {
                    const homeTeam = teams.find(t => t.id === match.homeTeamId);
                    const awayTeam = teams.find(t => t.id === match.awayTeamId);

                    if (!match.homeTeamId || !match.awayTeamId) {
                      const activeTeamName = match.homeTeamId ? match.homeTeamName : match.awayTeamName;
                      const activeTeam = match.homeTeamId ? homeTeam : awayTeam;
                      return (
                        <div key={idx} className="flex justify-center items-center py-3 px-5 bg-muted/10">
                          <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            {activeTeam && <JerseyPreview jersey={activeTeam.jersey} size="xs" />}
                            <span className="font-bold text-foreground">{activeTeamName}</span> queda
                            <Badge variant="secondary" className="uppercase text-[10px] tracking-widest">Libre</Badge>
                          </span>
                        </div>
                      );
                    }

                    const isHome = (homeId: string | null) => homeId === match.homeTeamId;

                    return (
                      <div key={idx} className="relative group px-5 py-4 hover:bg-muted/10 transition-colors">
                        {/* Settings button */}
                        {!isReadOnly && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-2 top-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary z-10"
                            onClick={() => {
                              setSelectedMatch(match);
                              setSelectedFixtureId(round.id);
                              setIsSettingsOpen(true);
                            }}
                          >
                            <Settings className="h-3 w-3" />
                          </Button>
                        )}

                        {/* Metadata Row */}
                        {(match.date || match.time || match.venue || match.refereeName) && (
                          <div className="flex items-center justify-center gap-3 mb-3 text-[11px] text-muted-foreground font-medium flex-wrap">
                            {(match.date || match.time) && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3"/>
                                {[match.date, match.time].filter(Boolean).join(' · ')}
                              </span>
                            )}
                            {match.venue && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3"/>
                                {match.venue}
                              </span>
                            )}
                            {match.refereeName && (
                              <span className="flex items-center gap-1 text-primary">
                                <UserCheck className="w-3 h-3"/>
                                {match.refereeName}
                              </span>
                            )}
                            {!isReadOnly && !match.refereeName && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-[10px] px-2 text-muted-foreground hover:text-primary"
                                onClick={() => {
                                  setSelectedMatch(match);
                                  setSelectedFixtureId(round.id);
                                  setIsRefereeDialogOpen(true);
                                }}
                              >
                                <UserCheck className="w-3 h-3 mr-1" />
                                Asignar Árbitro
                              </Button>
                            )}
                          </div>
                        )}

                        {/* Match Row */}
                        <div className="flex items-center gap-3">
                          {/* Home Team */}
                          <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
                            <span className="font-bold text-sm truncate text-right">{match.homeTeamName}</span>
                            {homeTeam ? <JerseyPreview jersey={homeTeam.jersey} size="sm" /> : <div className="w-10 h-10 rounded-full bg-muted flex-shrink-0"/>}
                          </div>

                          {/* Scoreboard */}
                          <div className="flex-shrink-0 flex flex-col items-center gap-1.5">
                            {match.status === 'finished' ? (
                              <div className="flex items-center bg-background/80 border border-border/50 rounded-xl overflow-hidden shadow-inner text-xl font-black tracking-tighter">
                                <div className={`w-11 text-center py-2 ${match.homeScore! > match.awayScore! ? 'text-green-600 dark:text-green-400' : ''}`}>{match.homeScore ?? 0}</div>
                                <div className="text-muted-foreground/40 px-1 text-sm">–</div>
                                <div className={`w-11 text-center py-2 ${match.awayScore! > match.homeScore! ? 'text-green-600 dark:text-green-400' : ''}`}>{match.awayScore ?? 0}</div>
                              </div>
                            ) : isReadOnly ? (
                              <Badge variant="outline" className="font-bold uppercase tracking-widest text-[10px] h-7 px-3 rounded-lg border-muted-foreground/30 text-muted-foreground">
                                Pendiente
                              </Badge>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className="font-bold uppercase tracking-widest text-[10px] h-9 px-4 rounded-xl border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground transition-all"
                                onClick={() => {
                                  setSelectedMatch(match);
                                  setSelectedFixtureId(round.id);
                                  setIsResultOpen(true);
                                }}
                              >
                                Jugar
                              </Button>
                            )}
                          </div>

                          {/* Away Team */}
                          <div className="flex items-center gap-2 flex-1 justify-start min-w-0">
                            {awayTeam ? <JerseyPreview jersey={awayTeam.jersey} size="sm" /> : <div className="w-10 h-10 rounded-full bg-muted flex-shrink-0"/>}
                            <span className="font-bold text-sm truncate">{match.awayTeamName}</span>
                          </div>
                        </div>

                        {/* Streaming Row */}
                        {match.streamingUrl && (
                          <div className="mt-4 flex justify-center">
                            <Button
                              variant={match.isLive ? "default" : "outline"}
                              size="sm"
                              className={cn(
                                "rounded-full font-black text-[10px] tracking-widest uppercase h-8 px-4",
                                match.isLive ? "bg-red-600 hover:bg-red-700 text-white animate-pulse border-none" : "border-primary/30 text-primary hover:bg-primary/5"
                              )}
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(match.streamingUrl, '_blank');
                              }}
                            >
                              {match.isLive ? (
                                <span className="flex items-center gap-1.5">
                                  <div className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                                  EN VIVO AHORA
                                </span>
                              ) : (
                                <span className="flex items-center gap-1.5">
                                  <ExternalLink className="w-3 h-3" />
                                  VER TRANSMISIÓN
                                </span>
                              )}
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
        </div>
      )}

      <CompetitionMatchResultDialog
        competitionId={leagueId}
        competitionType="leagues"
        fixtureDocId={selectedFixtureId}
        match={selectedMatch as any}
        homeTeam={teams.find(t => t.id === selectedMatch?.homeTeamId)}
        awayTeam={teams.find(t => t.id === selectedMatch?.awayTeamId)}
        open={isResultOpen}
        onOpenChange={setIsResultOpen}
      />

      <AssignRefereeDialog
        leagueId={leagueId}
        fixtureDocId={selectedFixtureId}
        match={selectedMatch}
        open={isRefereeDialogOpen}
        onOpenChange={setIsRefereeDialogOpen}
      />

      {selectedMatch && (
        <MatchSettingsDialog
          leagueId={leagueId}
          fixtureDocId={selectedFixtureId}
          match={selectedMatch}
          open={isSettingsOpen}
          onOpenChange={setIsSettingsOpen}
        />
      )}

      {/* Regenerate Confirmation Dialog */}
      <AlertDialog open={showRegenerateConfirm} onOpenChange={setShowRegenerateConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              ¿Regenerar Fixture Completo?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Esta acción <strong className="text-destructive">eliminará permanentemente</strong> el fixture actual y creará uno nuevo desde cero.
              </p>
              <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 mt-3">
                <p className="font-bold text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Se perderán {finishedMatchesCount} {finishedMatchesCount === 1 ? 'acta cargada' : 'actas cargadas'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Todos los resultados, goleadores, tarjetas y datos de partidos se borrarán.
                </p>
              </div>
              <p className="text-sm mt-3">
                ¿Estás seguro de que querés continuar?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => generateRoundRobin()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sí, Regenerar Fixture
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MatchSettingsDialog({ leagueId, fixtureDocId, match, open, onOpenChange }: { leagueId: string, fixtureDocId: string, match: MatchObj, open: boolean, onOpenChange: (v: boolean) => void }) {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [date, setDate] = React.useState(match.date || '');
  const [time, setTime] = React.useState(match.time || '');
  const [venue, setVenue] = React.useState(match.venue || '');
  const [streamingUrl, setStreamingUrl] = React.useState(match.streamingUrl || '');
  const [isLive, setIsLive] = React.useState(match.isLive || false);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setDate(match.date || '');
      setTime(match.time || '');
      setVenue(match.venue || '');
      setStreamingUrl(match.streamingUrl || '');
      setIsLive(match.isLive || false);
    }
  }, [open, match]);

  const handleSave = async () => {
    if (!firestore) return;
    setIsSaving(true);
    try {
      const fixtureRef = doc(firestore, 'leagues', leagueId, 'fixtures', fixtureDocId);
      const { getDoc, updateDoc } = await import('firebase/firestore');
      const fixtureSnap = await getDoc(fixtureRef);
      if (fixtureSnap.exists()) {
        const fixtureData = fixtureSnap.data();
        const updatedMatches = (fixtureData.matches || []).map((m: MatchObj) => {
          if (m.id === match.id) {
            return { ...m, date, time, venue, streamingUrl, isLive };
          }
          return m;
        });
        await updateDoc(fixtureRef, { matches: updatedMatches });
        toast({ title: 'Datos actualizados', description: 'La programación del partido fue guardada.' });
        onOpenChange(false);
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo actualizar el partido.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 uppercase font-black">
            <Settings className="h-4 w-4 text-primary" />
            Programar Partido
          </DialogTitle>
          <DialogDescription>
            {match.homeTeamName} vs {match.awayTeamName}
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="date">Fecha (Ej: 12/05/2026)</Label>
            <Input id="date" value={date} onChange={(e) => setDate(e.target.value)} placeholder="DD/MM/YYYY" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="time">Hora (Ej: 20:30)</Label>
            <Input id="time" value={time} onChange={(e) => setTime(e.target.value)} placeholder="HH:MM" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="venue">Cancha / Sede</Label>
            <Input id="venue" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Sede Central - Cancha 1" />
          </div>
          <div className="grid gap-2 border-t border-border/40 pt-4 mt-2">
            <Label htmlFor="streamingUrl" className="flex items-center gap-2 text-primary font-bold">
              <PlayCircle className="w-4 h-4" /> Link de Transmisión (Streaming)
            </Label>
            <Input id="streamingUrl" value={streamingUrl} onChange={(e) => setStreamingUrl(e.target.value)} placeholder="https://youtube.com/live/..." />
          </div>
          <div className="flex items-center space-x-2 bg-primary/5 p-3 rounded-xl border border-primary/20">
             <Checkbox 
               id="isLive" 
               checked={isLive} 
               onCheckedChange={(checked) => setIsLive(checked === true)} 
             />
             <label
               htmlFor="isLive"
               className="text-sm font-bold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer text-primary"
             >
               ESTÁ TRANSMITIENDO EN VIVO AHORA
             </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Guardar Datos'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Google Calendar / ICS Export ─────────────────────────────────────────────

function formatICSDate(dateStr: string, timeStr?: string): string {
  let date: Date | null = null;

  // DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    const [day, month, year] = dateStr.split('/').map(Number);
    date = new Date(year, month - 1, day);
  }
  // YYYY-MM-DD
  else if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split('-').map(Number);
    date = new Date(year, month - 1, day);
  }

  if (!date) return '';

  if (timeStr && /^\d{2}:\d{2}$/.test(timeStr)) {
    const [hh, mm] = timeStr.split(':').map(Number);
    date.setHours(hh, mm, 0, 0);
    // Format: YYYYMMDDTHHmmss (local time)
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
  }

  // All-day event format: YYYYMMDD
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

function exportFixtureToICS(rounds: FixtureRound[], leagueName: string) {
  const events: string[] = [];

  rounds.forEach((round) => {
    round.matches.forEach((match) => {
      if (!match.date || !match.homeTeamId || !match.awayTeamId) return;

      const dtStart = formatICSDate(match.date, match.time);
      if (!dtStart) return;

      const isAllDay = !match.time;
      const uid = `patea-${match.id}-${Date.now()}@patea.app`;
      const summary = `${match.homeTeamName} vs ${match.awayTeamName}`;
      const description = `Liga: ${leagueName}\\nFecha: ${round.roundName}${match.refereeName ? `\\nÁrbitro: ${match.refereeName}` : ''}`;

      let dtEnd: string;
      if (isAllDay) {
        // All-day: end is next day
        const pad = (n: number) => String(n).padStart(2, '0');
        const parts = dtStart.split('');
        const y = parseInt(parts.slice(0, 4).join(''));
        const mo = parseInt(parts.slice(4, 6).join('')) - 1;
        const d = parseInt(parts.slice(6, 8).join(''));
        const end = new Date(y, mo, d + 1);
        dtEnd = `${end.getFullYear()}${pad(end.getMonth() + 1)}${pad(end.getDate())}`;
      } else {
        // 90 min duration
        const pad = (n: number) => String(n).padStart(2, '0');
        const y = parseInt(dtStart.slice(0, 4));
        const mo = parseInt(dtStart.slice(4, 6)) - 1;
        const d = parseInt(dtStart.slice(6, 8));
        const hh = parseInt(dtStart.slice(9, 11));
        const mm = parseInt(dtStart.slice(11, 13));
        const end = new Date(y, mo, d, hh, mm + 90);
        dtEnd = `${end.getFullYear()}${pad(end.getMonth() + 1)}${pad(end.getDate())}T${pad(end.getHours())}${pad(end.getMinutes())}00`;
      }

      const lines = [
        'BEGIN:VEVENT',
        `UID:${uid}`,
        isAllDay ? `DTSTART;VALUE=DATE:${dtStart}` : `DTSTART:${dtStart}`,
        isAllDay ? `DTEND;VALUE=DATE:${dtEnd}` : `DTEND:${dtEnd}`,
        `SUMMARY:${summary}`,
        `DESCRIPTION:${description}`,
        match.venue ? `LOCATION:${match.venue}` : '',
        'END:VEVENT',
      ].filter(Boolean).join('\r\n');

      events.push(lines);
    });
  });

  if (events.length === 0) return;

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Pateá//Fixture//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fixture-${leagueName.toLowerCase().replace(/\s+/g, '-')}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}
