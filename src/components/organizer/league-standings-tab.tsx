'use client';

import * as React from 'react';
import { useFirestore, useDoc } from '@/firebase';
import { collection, query, onSnapshot, orderBy, doc } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Trophy, TrendingUp, Minus, TrendingDown, ArrowUp, ArrowDown } from 'lucide-react';
import { JerseyPreview } from '@/components/team-builder/jersey-preview';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useCompetitionTeams } from '@/hooks/use-competition-teams';

interface Team {
  id: string;
  name: string;
  jersey: any;
}

interface MatchObj {
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeScore?: number;
  awayScore?: number;
  status: 'pending' | 'finished';
  date?: string;
  time?: string;
}

interface FixtureRound {
  id: string;
  roundNumber?: number;
  matches: MatchObj[];
}

interface StandingRow {
  teamId: string;
  teamName: string;
  jersey: any;
  pts: number;
  pj: number;
  pg: number;
  pe: number;
  pp: number;
  gf: number;
  gc: number;
  dg: number;
  recentForm: ('W' | 'D' | 'L')[];
}

interface LeagueStandingsTabProps {
  leagueId: string;
  rules?: { pointsForWin: number; pointsForDraw: number };
  isReadOnly?: boolean;
  showRelegation?: boolean;
}

export function LeagueStandingsTab({ leagueId, rules, isReadOnly, showRelegation = false }: LeagueStandingsTabProps) {
  const firestore = useFirestore();

  const [rounds, setRounds] = React.useState<FixtureRound[]>([]);
  const [loading, setLoading] = React.useState(true);

  const compRef = React.useMemo(() => {
    if (!firestore || !leagueId) return null;
    return doc(firestore, 'leagues', leagueId);
  }, [firestore, leagueId]);

  const { data: compData } = useDoc<any>(compRef);
  const { teams } = useCompetitionTeams(leagueId, 'leagues', compData);

  // Effect 3: Fixtures listener
  React.useEffect(() => {
    if (!firestore) return;
    const fixturesRef = collection(firestore, 'leagues', leagueId, 'fixtures');
    const qFixtures = query(fixturesRef, orderBy('roundNumber', 'asc'));
    const unsub = onSnapshot(qFixtures, (snap) => {
      setRounds(snap.docs.map(d => ({ id: d.id, ...d.data() } as FixtureRound)));
      setLoading(false);
    });
    return () => unsub();
  }, [firestore, leagueId]);

  const { standings, previousRankMap } = React.useMemo(() => {
    // 1. If we have server-calculated standings, use them as primary (better performance)
    if (compData?.standings && Array.isArray(compData.standings) && compData.standings.length > 0) {
      // Map server stats to local StandingRow interface
      const serverStandings: StandingRow[] = compData.standings.map((s: any) => ({
        teamId: s.teamId,
        teamName: s.teamName,
        jersey: s.teamJersey,
        pts: s.points,
        pj: s.matchesPlayed,
        pg: s.wins,
        pe: s.draws,
        pp: s.losses,
        gf: s.goalsFor,
        gc: s.goalsAgainst,
        dg: s.goalDifference,
        recentForm: [] // We'll enrich this below
      }));

      // Enrich with recent form from rounds if available
      const allMatches = rounds.flatMap(r => r.matches.map(m => ({ ...m, __round: r.roundNumber || 0 })));
      serverStandings.forEach(row => {
          const teamMatches = allMatches
            .filter(m => (m.homeTeamId === row.teamId || m.awayTeamId === row.teamId) && m.status === 'finished')
            .sort((a, b) => (b as any).__round - (a as any).__round) // newest first
            .slice(0, 5);
          
          row.recentForm = teamMatches.map(m => {
              const IS_HOME = m.homeTeamId === row.teamId;
              const h = m.homeScore ?? 0;
              const a = m.awayScore ?? 0;
              if (h === a) return 'D';
              return (IS_HOME ? h > a : a > h) ? 'W' : 'L';
          });
      });

      // For previous rank comparison, we still need a "partial" calculation or we can just skip it for server standings
      // For now, let's keep it simple: server standings = current truth.
      return { standings: serverStandings, previousRankMap: new Map<string, number>() };
    }

    // 2. FALLBACK: Client-side calculation (for legacy leagues or in-memory updates)
    if (teams.length === 0) return { standings: [], previousRankMap: new Map<string, number>() };

    const ptsWin = rules?.pointsForWin ?? 3;
    const ptsDraw = rules?.pointsForDraw ?? 1;

    const computeFromRounds = (roundsList: FixtureRound[]): StandingRow[] => {
      const statsMap: Record<string, StandingRow> = {};
      teams.forEach(t => {
        statsMap[t.id] = {
          teamId: t.id,
          teamName: t.name,
          jersey: t.jersey,
          pts: 0, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dg: 0,
          recentForm: []
        };
      });

      const allMatches = roundsList
        .flatMap((round) => round.matches.map((match, matchIndex) => ({
          ...match,
          __roundNumber: round.roundNumber ?? 0,
          __matchIndex: matchIndex,
        })))
        .sort((a, b) => {
          const aHasDate = !!a.date;
          const bHasDate = !!b.date;
          if (aHasDate && bHasDate) {
            const aTs = Date.parse(`${a.date}${a.time ? ` ${a.time}` : ''}`);
            const bTs = Date.parse(`${b.date}${b.time ? ` ${b.time}` : ''}`);
            if (!Number.isNaN(aTs) && !Number.isNaN(bTs) && aTs !== bTs) return aTs - bTs;
          }
          if (a.__roundNumber !== b.__roundNumber) return a.__roundNumber - b.__roundNumber;
          return a.__matchIndex - b.__matchIndex;
        });

      allMatches.forEach((match) => {
          if (match.status !== 'finished' || match.homeScore === undefined || match.awayScore === undefined) return;
          if (!match.homeTeamId || !match.awayTeamId) return;

          const homeTeam = statsMap[match.homeTeamId];
          const awayTeam = statsMap[match.awayTeamId];
          if (!homeTeam || !awayTeam) return;

          const hScore = match.homeScore;
          const aScore = match.awayScore;

          homeTeam.pj += 1;
          awayTeam.pj += 1;
          homeTeam.gf += hScore;
          awayTeam.gf += aScore;
          homeTeam.gc += aScore;
          awayTeam.gc += hScore;
          homeTeam.dg = homeTeam.gf - homeTeam.gc;
          awayTeam.dg = awayTeam.gf - awayTeam.gc;

          if (hScore > aScore) {
            homeTeam.pts += ptsWin; homeTeam.pg += 1; homeTeam.recentForm.unshift('W');
            awayTeam.pp += 1; awayTeam.recentForm.unshift('L');
          } else if (hScore < aScore) {
            awayTeam.pts += ptsWin; awayTeam.pg += 1; awayTeam.recentForm.unshift('W');
            homeTeam.pp += 1; homeTeam.recentForm.unshift('L');
          } else {
            homeTeam.pts += ptsDraw; homeTeam.pe += 1; homeTeam.recentForm.unshift('D');
            awayTeam.pts += ptsDraw; awayTeam.pe += 1; awayTeam.recentForm.unshift('D');
          }

          if (homeTeam.recentForm.length > 5) homeTeam.recentForm.pop();
          if (awayTeam.recentForm.length > 5) awayTeam.recentForm.pop();
      });

      return Object.values(statsMap).sort((a, b) => {
        if (b.pts !== a.pts) return b.pts - a.pts;
        if (b.dg !== a.dg) return b.dg - a.dg;
        if (b.gf !== a.gf) return b.gf - a.gf;
        return a.teamName.localeCompare(b.teamName);
      });
    };

    const current = computeFromRounds(rounds);

    // Compute previous standings (exclude last round with any finished match)
    let lastFinishedRoundIdx = -1;
    for (let i = rounds.length - 1; i >= 0; i--) {
      if (rounds[i].matches.some(m => m.status === 'finished')) {
        lastFinishedRoundIdx = i;
        break;
      }
    }

    const prevRankMap = new Map<string, number>();
    if (lastFinishedRoundIdx > 0) {
      const prev = computeFromRounds(rounds.slice(0, lastFinishedRoundIdx));
      prev.forEach((row, i) => prevRankMap.set(row.teamId, i));
    }

    return { standings: current, previousRankMap: prevRankMap };
  }, [teams, rounds, rules, compData]);

  const renderFormBadge = (form: 'W' | 'D' | 'L', idx: number) => {
    switch (form) {
      case 'W':
        return <div key={idx} className="w-5 h-5 rounded bg-green-500/20 flex items-center justify-center border border-green-500/50" title="Victoria"><TrendingUp className="w-3 h-3 text-green-500" /></div>;
      case 'D':
        return <div key={idx} className="w-5 h-5 rounded bg-muted flex items-center justify-center border border-border" title="Empate"><Minus className="w-3 h-3 text-muted-foreground" /></div>;
      case 'L':
        return <div key={idx} className="w-5 h-5 rounded bg-red-500/20 flex items-center justify-center border border-red-500/50" title="Derrota"><TrendingDown className="w-3 h-3 text-red-500" /></div>;
    }
  };

  if (loading) {
    return (
      <Card className="animate-pulse bg-card/40 border-border/40 backdrop-blur-xl">
        <CardContent className="h-64"></CardContent>
      </Card>
    );
  }

  if (standings.length === 0) {

    return (
      <Card className="border-dashed bg-card/40 backdrop-blur-xl border-border/40">
        <CardContent className="p-12 text-center flex flex-col items-center gap-4">
          <Trophy className="h-16 w-16 text-muted-foreground/30" />
          <div className="space-y-1">
            <h3 className="font-bold text-xl uppercase tracking-tight">Sin Posiciones</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Aún no hay equipos inscritos o el torneo no ha comenzado.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const podiumStyle = (index: number) => {
    if (index === 0) return 'border-l-4 border-l-yellow-500/70 bg-yellow-500/5';
    if (index === 1) return 'border-l-4 border-l-slate-400/70 bg-slate-400/5';
    if (index === 2) return 'border-l-4 border-l-amber-700/70 bg-amber-700/5';
    return '';
  };

  const relegationStyle = (index: number, total: number): string => {
    if (!showRelegation) return '';
    if (index < 3) return ''; // handled by podium
    if (total >= 6 && index >= total - 2) return 'border-r-4 border-r-red-500/50 bg-red-500/5';
    return '';
  };

  const rankBadge = (index: number) => {
    if (index === 0) return <span className="text-yellow-400 font-black text-base">🥇</span>;
    if (index === 1) return <span className="text-slate-400 font-black text-base">🥈</span>;
    if (index === 2) return <span className="text-amber-600 font-black text-base">🥉</span>;
    return <span className="text-muted-foreground font-bold text-sm">{index + 1}</span>;
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight">Tabla de Posiciones</h2>
          <p className="text-sm text-muted-foreground">Actualización en tiempo real.</p>
        </div>
        <div className="text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full border border-border/50 font-mono">
          {standings.length} equipos
        </div>
      </div>

      <div className="rounded-2xl border border-border/40 bg-card/40 backdrop-blur-xl overflow-hidden shadow-lg shadow-black/5 dark:shadow-black/20">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border/40">
                <TableHead className="w-12 text-center font-black text-xs uppercase tracking-widest text-muted-foreground py-3">#</TableHead>
                <TableHead className="font-black text-xs uppercase tracking-widest text-muted-foreground">Club</TableHead>
                <TableHead className="text-center w-14 font-black text-xs uppercase tracking-widest text-foreground">PTS</TableHead>
                <TableHead className="text-center w-12 font-bold text-xs uppercase tracking-widest text-muted-foreground">PJ</TableHead>
                <TableHead className="text-center w-12 hidden sm:table-cell font-bold text-xs uppercase tracking-widest text-muted-foreground">PG</TableHead>
                <TableHead className="text-center w-12 hidden sm:table-cell font-bold text-xs uppercase tracking-widest text-muted-foreground">PE</TableHead>
                <TableHead className="text-center w-12 hidden sm:table-cell font-bold text-xs uppercase tracking-widest text-muted-foreground">PP</TableHead>
                <TableHead className="text-center w-12 hidden md:table-cell font-bold text-xs uppercase tracking-widest text-muted-foreground">GF</TableHead>
                <TableHead className="text-center w-12 hidden md:table-cell font-bold text-xs uppercase tracking-widest text-muted-foreground">GC</TableHead>
                <TableHead className="text-center w-12 font-black text-xs uppercase tracking-widest text-foreground">DG</TableHead>
                <TableHead className="text-center w-32 hidden lg:table-cell font-bold text-xs uppercase tracking-widest text-muted-foreground">Forma</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {standings.map((row, index) => {
                const prevRank = previousRankMap.get(row.teamId);
                const rankChange = prevRank !== undefined ? prevRank - index : null; // positive = moved up
                return (
                <TableRow
                  key={row.teamId}
                  className={`hover:bg-muted/20 transition-colors border-b border-border/20 last:border-0 ${podiumStyle(index)} ${relegationStyle(index, standings.length)}`}
                >
                  <TableCell className="text-center py-3 w-12">
                    <div className="flex flex-col items-center gap-0">
                      {rankBadge(index)}
                      {rankChange !== null && rankChange !== 0 && (
                        <span
                          className={`flex items-center text-[9px] font-black leading-none ${rankChange > 0 ? 'text-green-500' : 'text-red-400'}`}
                          title={rankChange > 0 ? `Subió ${rankChange} ${rankChange === 1 ? 'puesto' : 'puestos'}` : `Bajó ${Math.abs(rankChange)} ${Math.abs(rankChange) === 1 ? 'puesto' : 'puestos'}`}
                        >
                          {rankChange > 0 ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium py-3">
                    <div className="flex items-center gap-3">
                      <JerseyPreview jersey={row.jersey} size="xs" />
                      <span className={`font-bold truncate max-w-[140px] sm:max-w-xs ${index < 3 ? 'text-foreground' : 'text-foreground/80'}`}>
                        {row.teamName}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center py-3">
                    <span className={`inline-flex items-center justify-center w-9 h-9 rounded-lg font-black text-lg ${index === 0 ? 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400' : index < 3 ? 'bg-primary/10 text-primary' : 'text-foreground'}`}>
                      {row.pts}
                    </span>
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground font-medium">{row.pj}</TableCell>
                  <TableCell className="text-center hidden sm:table-cell text-green-600 dark:text-green-400 font-bold">{row.pg}</TableCell>
                  <TableCell className="text-center hidden sm:table-cell text-muted-foreground">{row.pe}</TableCell>
                  <TableCell className="text-center hidden sm:table-cell text-red-500 dark:text-red-400 font-medium">{row.pp}</TableCell>
                  <TableCell className="text-center hidden md:table-cell text-muted-foreground">{row.gf}</TableCell>
                  <TableCell className="text-center hidden md:table-cell text-muted-foreground">{row.gc}</TableCell>
                  <TableCell className={`text-center font-bold ${row.dg > 0 ? 'text-green-600 dark:text-green-400' : row.dg < 0 ? 'text-red-500 dark:text-red-400' : 'text-muted-foreground'}`}>
                    {row.dg > 0 ? `+${row.dg}` : row.dg}
                  </TableCell>
                  <TableCell className="text-center hidden lg:table-cell">
                    <div className="flex justify-center gap-1">
                      {row.recentForm.length > 0
                        ? row.recentForm.map((f, i) => renderFormBadge(f, i))
                        : <span className="text-xs text-muted-foreground">—</span>
                      }
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            </TableBody>
          </Table>
        </div>
      </div>

      {standings.length >= 4 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground px-1 pt-1">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-yellow-500/20 border-l-2 border-l-yellow-500/70 inline-block" />
            <span>Campeón</span>
          </span>
          {standings.length >= 6 && (
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-red-500/10 border-r-2 border-r-red-500/50 inline-block" />
              <span>Zona de descenso</span>
            </span>
          )}
          {previousRankMap.size > 0 && (
            <span className="flex items-center gap-1.5">
              <ArrowUp className="w-3 h-3 text-green-500" />
              <ArrowDown className="w-3 h-3 text-red-400" />
              <span>Cambio vs jornada anterior</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
