'use client';

import * as React from 'react';
import { useFirestore } from '@/firebase';
import { collection, query, onSnapshot, doc } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Trophy, Medal, Flame } from 'lucide-react';
import { JerseyPreview } from '@/components/team-builder/jersey-preview';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import type { Team, BracketMatch } from '@/lib/types';

interface CompetitionStatsTabProps {
  competitionId: string;
  competitionType?: 'leagues' | 'cups';
}

interface ScorerStat {
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  teamJersey: any;
  goals: number;
}

export function CompetitionStatsTab({ competitionId, competitionType = 'leagues' }: CompetitionStatsTabProps) {
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

  const topScorers = React.useMemo(() => {
    if (teams.length === 0 || matchesData.length === 0) return [];

    const statsMap: Record<string, ScorerStat> = {};
    const teamInfoMap: Record<string, { name: string, jersey: any }> = {};
    
    teams.forEach(t => {
      if (t.id) {
        teamInfoMap[t.id] = { name: t.name, jersey: t.jersey };
      }
    });

    matchesData.forEach(match => {
      const isFinished = competitionType === 'leagues' ? match.status === 'finished' : !!match.winnerId;
      if (!isFinished || !match.scorers) return;

      const scorers = (match.scorers || []) as any[];
      scorers.forEach(scorer => {
        if (!scorer.playerId || !scorer.teamId) return; 
        
        if (!statsMap[scorer.playerId]) {
          const teamInfo = teamInfoMap[scorer.teamId];
          statsMap[scorer.playerId] = {
            playerId: scorer.playerId,
            playerName: scorer.playerName || 'Jugador',
            teamId: scorer.teamId,
            teamName: teamInfo?.name || 'Desconocido',
            teamJersey: teamInfo?.jersey || null,
            goals: 0
          };
        }
        
        statsMap[scorer.playerId].goals += 1;
      });
    });

    const scorersList = Object.values(statsMap);
    
    // Sort logic: Goals descending, then Name ascending
    scorersList.sort((a, b) => {
      if (b.goals !== a.goals) return b.goals - a.goals;
      return a.playerName.localeCompare(b.playerName);
    });

    return scorersList;
  }, [teams, matchesData, competitionType]);

  const renderRankIcon = (index: number) => {
    if (index === 0) return <Trophy className="w-5 h-5 text-yellow-500 fill-yellow-500/20" />;
    if (index === 1) return <Medal className="w-5 h-5 text-gray-400 fill-gray-400/20" />;
    if (index === 2) return <Medal className="w-5 h-5 text-amber-700 fill-amber-700/20" />;
    return <span className="font-bold text-muted-foreground">{index + 1}</span>;
  };

  if (loading) {
    return (
      <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>
    );
  }

  if (topScorers.length === 0) {
    return (
      <Card className="border-dashed bg-card/40 backdrop-blur-sm">
        <CardContent className="p-12 text-center flex flex-col items-center gap-4">
          <Flame className="h-16 w-16 text-muted-foreground/30" />
          <div className="space-y-1">
            <h3 className="font-bold text-xl uppercase tracking-tight">Sin Goleadores</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Aún no hay goles registrados a jugadores en esta competición.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight">Tabla de Goleadores</h2>
          <p className="text-sm text-muted-foreground">Los máximos artilleros del torneo.</p>
        </div>
      </div>

      <div className="rounded-xl border border-border/40 bg-card/60 backdrop-blur-md overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-16 text-center font-black">Rank</TableHead>
              <TableHead className="font-bold">Jugador</TableHead>
              <TableHead className="font-bold hidden sm:table-cell">Equipo</TableHead>
              <TableHead className="w-24 text-center font-black text-foreground">Goles</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {topScorers.slice(0, 50).map((scorer, index) => (
              <TableRow key={`${scorer.playerId}_${scorer.teamId}`} className="hover:bg-muted/30 transition-colors">
                <TableCell className="text-center font-black">
                  <div className="flex justify-center">{renderRankIcon(index)}</div>
                </TableCell>
                <TableCell className="font-medium text-base">
                  {scorer.playerName}
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <div className="flex items-center gap-3">
                    <JerseyPreview jersey={scorer.teamJersey} size="xs" />
                    <span className="text-sm text-muted-foreground font-medium">{scorer.teamName}</span>
                  </div>
                </TableCell>
                <TableCell className="text-center font-black text-xl text-primary">
                  {scorer.goals}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
