'use client';

import * as React from 'react';
import { useFirestore } from '@/firebase';
import { collection, query, onSnapshot } from 'firebase/firestore';
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

interface Team {
  id: string;
  name: string;
  jersey: any;
}

interface MatchObj {
  status: 'pending' | 'finished';
  cards?: { playerId: string, playerName: string, teamId: string, color: 'yellow' | 'red' }[];
}

interface FixtureRound {
  id: string;
  matches: MatchObj[];
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

interface LeagueDisciplineTabProps {
  leagueId: string;
}

export function LeagueDisciplineTab({ leagueId }: LeagueDisciplineTabProps) {
  const firestore = useFirestore();

  const [teams, setTeams] = React.useState<Team[]>([]);
  const [rounds, setRounds] = React.useState<FixtureRound[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!firestore) return;
    
    const teamsRef = collection(firestore, 'leagues', leagueId, 'teams');
    const unsubTeams = onSnapshot(query(teamsRef), (snap) => {
      setTeams(snap.docs.map(d => ({ id: d.id, ...d.data() } as Team)));
    });

    const fixturesRef = collection(firestore, 'leagues', leagueId, 'fixtures');
    const unsubFixtures = onSnapshot(query(fixturesRef), (snap) => {
      setRounds(snap.docs.map(d => ({ id: d.id, ...d.data() } as FixtureRound)));
      setLoading(false);
    });

    return () => {
      unsubTeams();
      unsubFixtures();
    };
  }, [firestore, leagueId]);

  const sanctions = React.useMemo(() => {
    if (teams.length === 0 || rounds.length === 0) return [];

    const statsMap: Record<string, SanctionStat> = {};

    rounds.forEach(round => {
      round.matches.forEach(match => {
        if (match.status !== 'finished' || !match.cards) return;

        match.cards.forEach(card => {
          if (!card.playerId) return; 
          
          if (!statsMap[card.playerId]) {
            const teamInfo = teams.find(t => t.id === card.teamId);
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
          
          if (card.color === 'yellow') statsMap[card.playerId].yellows += 1;
          if (card.color === 'red') statsMap[card.playerId].reds += 1;
        });
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
  }, [teams, rounds]);

  if (loading) {
    return (
      <Card className="animate-pulse bg-muted/20">
        <CardContent className="h-64"></CardContent>
      </Card>
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
