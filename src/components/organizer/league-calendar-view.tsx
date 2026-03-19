'use client';

import * as React from 'react';
import { useFirestore } from '@/firebase';
import { collection, query, onSnapshot, orderBy, doc, updateDoc, getDoc } from 'firebase/firestore';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { CalendarDays, Clock, MapPin, AlertTriangle, Check, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { JerseyPreview } from '@/components/team-builder/jersey-preview';
import { format, parse, addMonths, subMonths, startOfMonth, endOfMonth, isSameDay, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface MatchObj {
  id: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeTeamName: string;
  awayTeamName: string;
  homeScore?: number;
  awayScore?: number;
  status: 'pending' | 'finished';
  date?: string;
  time?: string;
  venue?: string;
  refereeId?: string;
  refereeName?: string;
}

interface FixtureRound {
  id: string;
  roundNumber: number;
  roundName: string;
  matches: MatchObj[];
}

interface Team {
  id: string;
  name: string;
  jersey: any;
}

interface CalendarMatch extends MatchObj {
  fixtureId: string;
  roundName: string;
}

interface LeagueCalendarViewProps {
  leagueId: string;
}

export function LeagueCalendarView({ leagueId }: LeagueCalendarViewProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [rounds, setRounds] = React.useState<FixtureRound[]>([]);
  const [teams, setTeams] = React.useState<Team[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [currentMonth, setCurrentMonth] = React.useState(new Date());
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(undefined);
  const [selectedMatch, setSelectedMatch] = React.useState<CalendarMatch | null>(null);
  const [isRescheduleOpen, setIsRescheduleOpen] = React.useState(false);

  // Reschedule form state
  const [newDate, setNewDate] = React.useState('');
  const [newTime, setNewTime] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (!firestore) return;

    const teamsRef = collection(firestore, 'leagues', leagueId, 'teams');
    const unsubTeams = onSnapshot(query(teamsRef), (snap) => {
      setTeams(snap.docs.map(d => ({ id: d.id, ...d.data() } as Team)));
    });

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

  // Get all matches with dates in calendar format
  const calendarMatches: CalendarMatch[] = React.useMemo(() => {
    const matches: CalendarMatch[] = [];

    rounds.forEach(round => {
      round.matches.forEach(match => {
        if (match.date) {
          matches.push({
            ...match,
            fixtureId: round.id,
            roundName: round.roundName,
          });
        }
      });
    });

    return matches;
  }, [rounds]);

  // Get matches for selected date
  const matchesOnSelectedDate = React.useMemo(() => {
    if (!selectedDate) return [];

    return calendarMatches.filter(match => {
      if (!match.date) return false;
      try {
        const matchDate = parseMatchDate(match.date);
        return matchDate && isSameDay(matchDate, selectedDate);
      } catch {
        return false;
      }
    });
  }, [calendarMatches, selectedDate]);

  // Get dates that have matches
  const datesWithMatches = React.useMemo(() => {
    return calendarMatches
      .map(m => {
        if (!m.date) return null;
        try {
          return parseMatchDate(m.date);
        } catch {
          return null;
        }
      })
      .filter((d): d is Date => d !== null);
  }, [calendarMatches]);

  // Detect conflicts (multiple matches at same time/venue)
  const conflicts = React.useMemo(() => {
    const conflictMap = new Map<string, CalendarMatch[]>();

    calendarMatches.forEach(match => {
      if (match.date && match.time && match.venue) {
        const key = `${match.date}_${match.time}_${match.venue}`;
        if (!conflictMap.has(key)) {
          conflictMap.set(key, []);
        }
        conflictMap.get(key)!.push(match);
      }
    });

    // Filter only actual conflicts (more than 1 match)
    const conflicts: CalendarMatch[][] = [];
    conflictMap.forEach(matches => {
      if (matches.length > 1) {
        conflicts.push(matches);
      }
    });

    return conflicts;
  }, [calendarMatches]);

  const handleRescheduleMatch = (match: CalendarMatch) => {
    setSelectedMatch(match);
    setNewDate(match.date || '');
    setNewTime(match.time || '');
    setIsRescheduleOpen(true);
  };

  const handleSaveReschedule = async () => {
    if (!firestore || !selectedMatch) return;

    if (!newDate) {
      toast({ variant: 'destructive', title: 'Falta la fecha', description: 'Ingresá una fecha válida.' });
      return;
    }

    setIsSaving(true);
    try {
      const fixtureRef = doc(firestore, 'leagues', leagueId, 'fixtures', selectedMatch.fixtureId);
      const fixtureSnap = await getDoc(fixtureRef);

      if (!fixtureSnap.exists()) {
        throw new Error('Fixture not found');
      }

      const fixtureData = fixtureSnap.data();
      const matches = fixtureData.matches || [];

      // Update the specific match
      const updatedMatches = matches.map((m: MatchObj) => {
        if (m.id === selectedMatch.id) {
          return {
            ...m,
            date: newDate,
            time: newTime || m.time,
          };
        }
        return m;
      });

      await updateDoc(fixtureRef, { matches: updatedMatches });

      toast({
        title: '✅ Partido reprogramado',
        description: `${selectedMatch.homeTeamName} vs ${selectedMatch.awayTeamName}`,
      });

      setIsRescheduleOpen(false);
      setSelectedMatch(null);
    } catch (error: any) {
      console.error('[Reschedule] Error:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo reprogramar el partido.' });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <CalendarDays className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Conflicts Alert */}
      {conflicts.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-bold text-sm text-destructive">Conflictos Detectados</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Hay {conflicts.length} {conflicts.length === 1 ? 'conflicto' : 'conflictos'} de horario/cancha.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="font-headline font-black uppercase tracking-tight text-xl flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                {format(currentMonth, 'MMMM yyyy', { locale: es })}
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentMonth(new Date())}
                >
                  Hoy
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              month={currentMonth}
              onMonthChange={setCurrentMonth}
              locale={es}
              modifiers={{
                hasMatch: datesWithMatches,
              }}
              modifiersClassNames={{
                hasMatch: 'bg-primary/10 font-bold text-primary',
              }}
              className="rounded-md border w-full"
            />
          </CardContent>
        </Card>

        {/* Matches on Selected Date */}
        <Card>
          <CardHeader>
            <CardTitle className="font-bold text-lg">
              {selectedDate ? format(selectedDate, 'dd MMM', { locale: es }) : 'Seleccioná una fecha'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {matchesOnSelectedDate.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                {selectedDate ? 'No hay partidos este día' : 'Hacé click en una fecha del calendario'}
              </div>
            ) : (
              <div className="space-y-3">
                {matchesOnSelectedDate.map(match => {
                  const homeTeam = teams.find(t => t.id === match.homeTeamId);
                  const awayTeam = teams.find(t => t.id === match.awayTeamId);

                  return (
                    <Card key={`${match.fixtureId}-${match.id}`} className="bg-muted/20">
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-xs">
                            {match.roundName}
                          </Badge>
                          {match.status === 'finished' && (
                            <Badge variant="secondary" className="text-xs">
                              Finalizado
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-sm">
                          {homeTeam && <JerseyPreview jersey={homeTeam.jersey} size="xs" />}
                          <span className="font-bold truncate flex-1">{match.homeTeamName}</span>
                        </div>

                        <div className="flex items-center gap-2 text-sm">
                          {awayTeam && <JerseyPreview jersey={awayTeam.jersey} size="xs" />}
                          <span className="font-bold truncate flex-1">{match.awayTeamName}</span>
                        </div>

                        {(match.time || match.venue) && (
                          <div className="flex flex-col gap-1 text-xs text-muted-foreground pt-2 border-t border-border">
                            {match.time && (
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {match.time}
                              </div>
                            )}
                            {match.venue && (
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {match.venue}
                              </div>
                            )}
                          </div>
                        )}

                        {match.status === 'pending' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full mt-2 text-xs"
                            onClick={() => handleRescheduleMatch(match)}
                          >
                            Reprogramar
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Reschedule Dialog */}
      {selectedMatch && (
        <Dialog open={isRescheduleOpen} onOpenChange={setIsRescheduleOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-headline font-black text-xl uppercase tracking-tight">
                Reprogramar Partido
              </DialogTitle>
              <DialogDescription>
                {selectedMatch.homeTeamName} vs {selectedMatch.awayTeamName}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="newDate">Nueva Fecha</Label>
                <Input
                  id="newDate"
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newTime">Nueva Hora</Label>
                <Input
                  id="newTime"
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsRescheduleOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveReschedule} disabled={isSaving}>
                {isSaving ? <Clock className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                Guardar Cambios
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// Helper to parse date strings
function parseMatchDate(dateStr: string): Date | null {
  try {
    // Try DD/MM/YYYY format
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
      const [day, month, year] = dateStr.split('/').map(Number);
      return new Date(year, month - 1, day);
    }

    // Try YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return parseISO(dateStr);
    }

    return null;
  } catch {
    return null;
  }
}
