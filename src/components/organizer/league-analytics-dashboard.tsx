'use client';

import * as React from 'react';
import { useFirestore } from '@/firebase';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart3, Goal, Swords, ShieldAlert, Trophy, TrendingUp, Users, Activity,
} from 'lucide-react';

interface MatchObj {
  status: 'pending' | 'finished';
  homeScore?: number;
  awayScore?: number;
  homeTeamId?: string | null;
  awayTeamId?: string | null;
  scorers?: { playerId: string; playerName: string; teamId: string }[];
  cards?: { playerId: string; playerName: string; teamId: string; color: 'yellow' | 'red' }[];
  mvp?: { playerId: string; playerName: string; teamId: string };
  attendance?: number;
}
interface FixtureRound { id: string; matches: MatchObj[]; }
interface Team { id: string; name: string; }

interface LeagueAnalyticsDashboardProps { leagueId: string; }

interface StatCard { label: string; value: string | number; sub?: string; icon: React.ReactNode; color: string; }

function KpiCard({ label, value, sub, icon, color }: StatCard) {
  return (
    <Card className="border-border/40 bg-card/70 backdrop-blur-xl">
      <CardContent className="pt-5 pb-4 flex items-start gap-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
          {icon}
        </div>
        <div>
          <p className="text-2xl font-black leading-tight">{value}</p>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-0.5">{label}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export function LeagueAnalyticsDashboard({ leagueId }: LeagueAnalyticsDashboardProps) {
  const firestore = useFirestore();
  const [teams, setTeams] = React.useState<Team[]>([]);
  const [rounds, setRounds] = React.useState<FixtureRound[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!firestore) return;
    const teamsRef = collection(firestore, 'leagues', leagueId, 'teams');
    const unsubTeams = onSnapshot(query(teamsRef), snap => {
      setTeams(snap.docs.map(d => ({ id: d.id, ...d.data() } as Team)));
    });
    const fixturesRef = collection(firestore, 'leagues', leagueId, 'fixtures');
    const unsubFixtures = onSnapshot(query(fixturesRef), snap => {
      setRounds(snap.docs.map(d => ({ id: d.id, ...d.data() } as FixtureRound)));
      setLoading(false);
    });
    return () => { unsubTeams(); unsubFixtures(); };
  }, [firestore, leagueId]);

  const stats = React.useMemo(() => {
    const allMatches = rounds.flatMap(r => r.matches);
    const finished = allMatches.filter(m => m.status === 'finished');
    const totalMatches = finished.length;
    const totalRounds = rounds.length;
    const playedRounds = rounds.filter(r => r.matches.some(m => m.status === 'finished')).length;

    let totalGoals = 0;
    let draws = 0;
    let homeWins = 0;
    let awayWins = 0;
    let totalYellows = 0;
    let totalReds = 0;
    let highestScore = 0;
    let highestMatch = '';
    let totalAttendance = 0;
    let attendanceCount = 0;
    const goalsByRound: { round: number; avg: number }[] = [];

    // Per-team goals
    const teamGoals: Record<string, number> = {};
    teams.forEach(t => { teamGoals[t.id] = 0; });

    rounds.forEach((round, ri) => {
      let roundGoals = 0;
      let roundFinished = 0;
      round.matches.forEach(m => {
        if (m.status !== 'finished' || m.homeScore === undefined || m.awayScore === undefined) return;
        const total = m.homeScore + m.awayScore;
        roundGoals += total;
        roundFinished++;
        totalGoals += total;
        if (m.homeScore > m.awayScore) homeWins++;
        else if (m.awayScore > m.homeScore) awayWins++;
        else draws++;
        if (total > highestScore) {
          highestScore = total;
          highestMatch = `${m.homeScore}-${m.awayScore}`;
        }
        if (m.homeTeamId) teamGoals[m.homeTeamId] = (teamGoals[m.homeTeamId] || 0) + m.homeScore;
        if (m.awayTeamId) teamGoals[m.awayTeamId] = (teamGoals[m.awayTeamId] || 0) + m.awayScore;
        if (typeof m.attendance === 'number' && m.attendance > 0) {
          totalAttendance += m.attendance;
          attendanceCount++;
        }
      });
      if (roundFinished > 0) goalsByRound.push({ round: ri + 1, avg: Math.round((roundGoals / roundFinished) * 10) / 10 });
    });

    finished.forEach(m => {
      (m.cards || []).forEach(c => {
        if (c.color === 'yellow') totalYellows++;
        else totalReds++;
      });
    });

    const avgGoalsPerMatch = totalMatches > 0 ? Math.round((totalGoals / totalMatches) * 10) / 10 : 0;
    const avgYellowsPerMatch = totalMatches > 0 ? Math.round((totalYellows / totalMatches) * 10) / 10 : 0;
    const avgAttendance = attendanceCount > 0 ? Math.round(totalAttendance / attendanceCount) : null;

    // Most prolific team
    const sortedTeamGoals = Object.entries(teamGoals).sort((a, b) => b[1] - a[1]);
    const topScoringTeamId = sortedTeamGoals[0]?.[0];
    const topScoringTeam = teams.find(t => t.id === topScoringTeamId);
    const topScoringGoals = sortedTeamGoals[0]?.[1] || 0;

    return {
      totalMatches, totalRounds, playedRounds, totalGoals, draws, homeWins, awayWins,
      totalYellows, totalReds, highestScore, highestMatch, avgGoalsPerMatch, avgYellowsPerMatch,
      avgAttendance, topScoringTeam, topScoringGoals, goalsByRound,
      completionPct: totalRounds > 0 ? Math.round((playedRounds / totalRounds) * 100) : 0,
    };
  }, [rounds, teams]);

  if (loading) return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
    </div>
  );

  if (stats.totalMatches === 0) return (
    <Card className="border-dashed bg-card/40">
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <BarChart3 className="h-16 w-16 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">Las analíticas estarán disponibles cuando se jueguen partidos.</p>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black uppercase tracking-tight">Analíticas</h2>
        <p className="text-sm text-muted-foreground">{stats.totalMatches} partidos jugados · {stats.completionPct}% del torneo completado</p>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Goles totales"
          value={stats.totalGoals}
          sub={`${stats.avgGoalsPerMatch} por partido`}
          icon={<Goal className="h-5 w-5 text-emerald-500" />}
          color="bg-emerald-500/10"
        />
        <KpiCard
          label="Partidos jugados"
          value={stats.totalMatches}
          sub={`de ${rounds.flatMap(r => r.matches).length} programados`}
          icon={<Swords className="h-5 w-5 text-primary" />}
          color="bg-primary/10"
        />
        <KpiCard
          label="Victorias local"
          value={`${stats.homeWins}`}
          sub={`Visita: ${stats.awayWins} · Empate: ${stats.draws}`}
          icon={<Trophy className="h-5 w-5 text-yellow-500" />}
          color="bg-yellow-500/10"
        />
        <KpiCard
          label="Tarjetas amarillas"
          value={stats.totalYellows}
          sub={`${stats.avgYellowsPerMatch} por partido`}
          icon={<ShieldAlert className="h-5 w-5 text-yellow-600" />}
          color="bg-yellow-500/10"
        />
        <KpiCard
          label="Tarjetas rojas"
          value={stats.totalReds}
          icon={<ShieldAlert className="h-5 w-5 text-red-500" />}
          color="bg-red-500/10"
        />
        <KpiCard
          label="Mayor goleada"
          value={stats.highestMatch || '—'}
          sub={`${stats.highestScore} goles en el partido`}
          icon={<TrendingUp className="h-5 w-5 text-purple-500" />}
          color="bg-purple-500/10"
        />
        {stats.topScoringTeam && (
          <KpiCard
            label="Equipo más goleador"
            value={stats.topScoringTeam.name}
            sub={`${stats.topScoringGoals} goles convertidos`}
            icon={<Activity className="h-5 w-5 text-blue-500" />}
            color="bg-blue-500/10"
          />
        )}
        {stats.avgAttendance !== null && (
          <KpiCard
            label="Asistencia promedio"
            value={stats.avgAttendance.toLocaleString()}
            sub="espectadores por partido"
            icon={<Users className="h-5 w-5 text-teal-500" />}
            color="bg-teal-500/10"
          />
        )}
      </div>

      {/* Goals by round bar */}
      {stats.goalsByRound.length > 1 && (
        <Card className="border-border/40 bg-card/70 backdrop-blur-xl">
          <CardHeader className="pb-2 pt-5">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Promedio de goles por jornada
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-5">
            <div className="flex items-end gap-1.5 h-24">
              {(() => {
                const maxVal = Math.max(...stats.goalsByRound.map(r => r.avg), 1);
                return stats.goalsByRound.map(r => (
                  <div key={r.round} className="flex flex-col items-center gap-1 flex-1 min-w-0">
                    <span className="text-[10px] text-muted-foreground font-bold">{r.avg}</span>
                    <div
                      className="w-full rounded-t-md bg-primary/60 transition-all"
                      style={{ height: `${Math.max(4, (r.avg / maxVal) * 64)}px` }}
                    />
                    <span className="text-[9px] text-muted-foreground truncate w-full text-center">{r.round}</span>
                  </div>
                ));
              })()}
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">Jornada</p>
          </CardContent>
        </Card>
      )}

      {/* Result distribution */}
      <Card className="border-border/40 bg-card/70 backdrop-blur-xl">
        <CardHeader className="pb-2 pt-5">
          <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Swords className="h-4 w-4" /> Resultados
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-5">
          {(() => {
            const total = stats.homeWins + stats.awayWins + stats.draws;
            if (total === 0) return <p className="text-sm text-muted-foreground">Sin datos.</p>;
            const hwPct = Math.round((stats.homeWins / total) * 100);
            const awPct = Math.round((stats.awayWins / total) * 100);
            const dPct = 100 - hwPct - awPct;
            return (
              <div className="space-y-3">
                <div className="flex h-4 rounded-full overflow-hidden gap-0.5">
                  {hwPct > 0 && <div className="bg-primary/70 transition-all" style={{ width: `${hwPct}%` }} title={`Local: ${hwPct}%`} />}
                  {dPct > 0 && <div className="bg-muted-foreground/40 transition-all" style={{ width: `${dPct}%` }} title={`Empate: ${dPct}%`} />}
                  {awPct > 0 && <div className="bg-orange-500/70 transition-all" style={{ width: `${awPct}%` }} title={`Visita: ${awPct}%`} />}
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-primary/70 inline-block"/>{hwPct}% local ({stats.homeWins})</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-muted-foreground/40 inline-block"/>{dPct}% empate ({stats.draws})</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-orange-500/70 inline-block"/>{awPct}% visita ({stats.awayWins})</span>
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}
