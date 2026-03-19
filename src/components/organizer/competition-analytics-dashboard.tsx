'use client';

import * as React from 'react';
import { useFirestore } from '@/firebase';
import { collection, query, onSnapshot, doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart3, Goal, Swords, ShieldAlert, Trophy, TrendingUp, Users, Activity,
} from 'lucide-react';
import type { Team, BracketMatch } from '@/lib/types';

interface CompetitionAnalyticsDashboardProps {
  competitionId: string;
  competitionType?: 'leagues' | 'cups';
}

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

export function CompetitionAnalyticsDashboard({ competitionId, competitionType = 'leagues' }: CompetitionAnalyticsDashboardProps) {
  const firestore = useFirestore();
  const [teams, setTeams] = React.useState<Team[]>([]);
  const [matchesData, setMatchesData] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!firestore) return;
    
    // 1. Fetch Teams
    const teamsRef = collection(firestore, competitionType, competitionId, 'teams');
    const unsubTeams = onSnapshot(query(teamsRef), (snap) => {
      setTeams(snap.docs.map(d => ({ id: d.id, ...d.data() } as Team)));
    });

    // 2. Fetch Match Data
    let unsubMatches = () => {};

    if (competitionType === 'leagues') {
      const fixturesRef = collection(firestore, 'leagues', competitionId, 'fixtures');
      unsubMatches = onSnapshot(query(fixturesRef), (snap) => {
        const allMatches = snap.docs.flatMap(d => (d.data().matches || []) as any[]);
        setMatchesData(allMatches);
        setLoading(false);
      });
    } else {
      const cupRef = doc(firestore, 'cups', competitionId);
      unsubMatches = onSnapshot(cupRef, (snap) => {
        if (snap.exists()) {
          const bracket = (snap.data().bracket || []) as BracketMatch[];
          setMatchesData(bracket);
        }
        setLoading(false);
      });
    }

    return () => {
      unsubTeams();
      unsubMatches();
    };
  }, [firestore, competitionId, competitionType]);

  const stats = React.useMemo(() => {
    const finished = matchesData.filter(m => competitionType === 'leagues' ? m.status === 'finished' : !!m.winnerId);
    const totalMatches = finished.length;

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

    // Per-team goals
    const teamGoals: Record<string, number> = {};
    teams.forEach(t => { if (t.id) teamGoals[t.id] = 0; });

    finished.forEach(m => {
      const hScore = m.homeScore ?? 0;
      const aScore = m.awayScore ?? 0;
      const total = hScore + aScore;
      
      totalGoals += total;
      if (hScore > aScore) homeWins++;
      else if (aScore > hScore) awayWins++;
      else draws++;

      if (total > highestScore) {
        highestScore = total;
        highestMatch = `${hScore}-${aScore}`;
      }

      if (m.homeTeamId) teamGoals[m.homeTeamId] = (teamGoals[m.homeTeamId] || 0) + hScore;
      if (m.awayTeamId) teamGoals[m.awayTeamId] = (teamGoals[m.awayTeamId] || 0) + aScore;
      
      if (typeof m.attendance === 'number' && m.attendance > 0) {
        totalAttendance += m.attendance;
        attendanceCount++;
      }

      (m.cards || []).forEach((c: any) => {
        const type = c.cardType || c.color;
        if (type === 'yellow') totalYellows++;
        else if (type === 'red') totalReds++;
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
      totalMatches, totalGoals, draws, homeWins, awayWins,
      totalYellows, totalReds, highestScore, highestMatch, avgGoalsPerMatch, avgYellowsPerMatch,
      avgAttendance, topScoringTeam, topScoringGoals,
    };
  }, [matchesData, teams, competitionType]);

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
        <p className="text-sm text-muted-foreground">{stats.totalMatches} partidos finalizados registrados.</p>
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
          icon={<Swords className="h-5 w-5 text-primary" />}
          color="bg-primary/10"
        />
        <KpiCard
          label="Victorias"
          value={`${stats.homeWins + stats.awayWins}`}
          sub={`Empates: ${stats.draws}`}
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

      {/* Result distribution */}
      <Card className="border-border/40 bg-card/70 backdrop-blur-xl">
        <CardHeader className="pb-2 pt-5">
          <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Swords className="h-4 w-4" /> Distribución de Resultados
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
