'use client';

import * as React from 'react';
import { useFirestore } from '@/firebase';
import { collection, query, onSnapshot, doc } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldAlert, AlertTriangle } from 'lucide-react';
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

interface CompetitionDisciplineTabProps {
  competitionId: string;
  competitionType?: 'leagues' | 'cups';
}

interface SanctionStat {
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  teamJersey: any;
  yellows: number;
  reds: number;
}

export function CompetitionDisciplineTab({ competitionId, competitionType = 'leagues' }: CompetitionDisciplineTabProps) {
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

  const sanctions = React.useMemo(() => {
    if (teams.length === 0 || matchesData.length === 0) return [];

    const statsMap: Record<string, SanctionStat> = {};
    const teamInfoMap: Record<string, { name: string, jersey: any }> = {};
    
    teams.forEach(t => {
      const tid = t.id;
      if (tid) {
        teamInfoMap[tid] = { name: t.name, jersey: t.jersey };
      }
    });

    matchesData.forEach(match => {
      const isFinished = competitionType === 'leagues' ? match.status === 'finished' : !!match.winnerId;
      if (!isFinished || !match.cards) return;

      const cards = (match.cards || []) as any[];
      cards.forEach(card => {
        if (!card.playerId || !card.teamId) return; 
        
        if (!statsMap[card.playerId]) {
          const teamInfo = teamInfoMap[card.teamId];
          statsMap[card.playerId] = {
            playerId: card.playerId,
            playerName: card.playerName || 'Jugador',
            teamId: card.teamId,
            teamName: teamInfo?.name || 'Desconocido',
            teamJersey: teamInfo?.jersey || null,
            yellows: 0,
            reds: 0
          };
        }
        
        const type = card.cardType || card.color;
        if (type === 'yellow') statsMap[card.playerId].yellows += 1;
        if (type === 'red') statsMap[card.playerId].reds += 1;
      });
    });

    const sanctionList = Object.values(statsMap).filter(s => s.yellows > 0 || s.reds > 0);
    
    // Sort logic: Reds desc, then Yellows desc
    sanctionList.sort((a, b) => {
      if (b.reds !== a.reds) return b.reds - a.reds;
      if (b.yellows !== a.yellows) return b.yellows - a.yellows;
      return a.playerName.localeCompare(b.playerName);
    });

    return sanctionList;
  }, [teams, matchesData, competitionType]);

  if (loading) {
    return (
      <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>
    );
  }

  if (sanctions.length === 0) {
    return (
      <Card className="border-dashed bg-card/40 backdrop-blur-sm">
        <CardContent className="p-12 text-center flex flex-col items-center gap-4">
          <ShieldAlert className="h-16 w-16 text-muted-foreground/30" />
          <div className="space-y-1">
            <h3 className="font-bold text-xl uppercase tracking-tight">Fair Play Perfecto</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Aún no hay tarjetas registradas en este torneo. 
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
          <h2 className="text-xl font-black uppercase tracking-tight text-red-600 dark:text-red-500 flex items-center gap-2">
            <AlertTriangle className="h-6 w-6" /> Tribunal de Disciplina
          </h2>
          <p className="text-sm text-muted-foreground">Registro oficial de tarjetas y sanciones.</p>
        </div>
      </div>

      <div className="rounded-xl border border-red-500/20 bg-card/60 backdrop-blur-md overflow-hidden shadow-[0_0_15px_-5px_rgba(239,68,68,0.2)]">
        <Table>
          <TableHeader className="bg-red-500/10">
            <TableRow>
              <TableHead className="font-bold text-red-900 dark:text-red-300">Jugador Sancionado</TableHead>
              <TableHead className="font-bold text-red-900 dark:text-red-300 hidden sm:table-cell">Equipo</TableHead>
              <TableHead className="w-24 text-center font-black">
                <div className="w-4 h-6 bg-yellow-400 rounded-sm mx-auto shadow-sm ring-1 ring-yellow-500" title="Amarillas"></div>
              </TableHead>
              <TableHead className="w-24 text-center font-black">
                <div className="w-4 h-6 bg-red-600 rounded-sm mx-auto shadow-sm ring-1 ring-red-700" title="Rojas"></div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sanctions.map((scorer) => (
              <TableRow key={scorer.playerId} className="hover:bg-red-500/5 transition-colors">
                <TableCell className="font-bold text-base">
                  {scorer.playerName}
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <div className="flex items-center gap-3">
                    <JerseyPreview jersey={scorer.teamJersey} size="xs" />
                    <span className="text-sm text-muted-foreground font-medium">{scorer.teamName}</span>
                  </div>
                </TableCell>
                <TableCell className="text-center font-black text-xl text-yellow-500">
                  {scorer.yellows > 0 ? scorer.yellows : '-'}
                </TableCell>
                <TableCell className="text-center font-black text-xl text-red-600">
                  {scorer.reds > 0 ? scorer.reds : '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
