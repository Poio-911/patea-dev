'use client';

import * as React from 'react';
import { useFirestore } from '@/firebase';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Shield, Star, TrendingDown } from 'lucide-react';
import { JerseyPreview } from '@/components/team-builder/jersey-preview';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Team { id: string; name: string; jersey: any; }
interface MatchObj {
  status: 'pending' | 'finished';
  cards?: { playerId: string; playerName: string; teamId: string; color: 'yellow' | 'red' }[];
}
interface FixtureRound { id: string; matches: MatchObj[]; }

interface TeamFairPlay {
  teamId: string;
  teamName: string;
  jersey: any;
  yellows: number;
  reds: number;
  pj: number;
  // lower is better
  score: number;
}

interface PlayerFairPlay {
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  jersey: any;
  yellows: number;
  reds: number;
  score: number;
}

interface LeagueFairPlayTabProps { leagueId: string; }

const YELLOW_PTS = 1;
const RED_PTS = 3;

export function LeagueFairPlayTab({ leagueId }: LeagueFairPlayTabProps) {
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

  const { teamRanking, playerRanking } = React.useMemo(() => {
    const teamMap: Record<string, TeamFairPlay> = {};
    const playerMap: Record<string, PlayerFairPlay> = {};
    const teamJersey: Record<string, any> = {};
    const teamName: Record<string, string> = {};

    teams.forEach(t => {
      teamJersey[t.id] = t.jersey;
      teamName[t.id] = t.name;
      teamMap[t.id] = { teamId: t.id, teamName: t.name, jersey: t.jersey, yellows: 0, reds: 0, pj: 0, score: 0 };
    });

    rounds.forEach(round => {
      round.matches.forEach(match => {
        if (match.status !== 'finished') return;
        const teamsInMatch = new Set<string>();
        (match.cards || []).forEach(card => {
          const team = teamMap[card.teamId];
          if (!team) return;
          if (card.color === 'yellow') { team.yellows++; team.score += YELLOW_PTS; }
          else { team.reds++; team.score += RED_PTS; }
          teamsInMatch.add(card.teamId);

          const pid = `${card.playerId}_${card.teamId}`;
          if (!playerMap[pid]) {
            playerMap[pid] = {
              playerId: card.playerId, playerName: card.playerName,
              teamId: card.teamId, teamName: teamName[card.teamId] || '',
              jersey: teamJersey[card.teamId], yellows: 0, reds: 0, score: 0,
            };
          }
          if (card.color === 'yellow') { playerMap[pid].yellows++; playerMap[pid].score += YELLOW_PTS; }
          else { playerMap[pid].reds++; playerMap[pid].score += RED_PTS; }
        });
      });
    });

    const teamRanking = Object.values(teamMap).sort((a, b) => a.score - b.score);
    const playerRanking = Object.values(playerMap).sort((a, b) => b.score - a.score).slice(0, 20);
    return { teamRanking, playerRanking };
  }, [teams, rounds]);

  const medalEmoji = (i: number) => {
    if (i === 0) return '🥇';
    if (i === 1) return '🥈';
    if (i === 2) return '🥉';
    return <span className="text-muted-foreground font-bold text-sm">{i + 1}</span>;
  };

  if (loading) return (
    <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>
  );

  if (teamRanking.length === 0) return (
    <Card className="border-dashed bg-card/40">
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <Shield className="h-16 w-16 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">Sin datos de fair play todavía.</p>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-black uppercase tracking-tight">Fair Play</h2>
        <p className="text-sm text-muted-foreground">Menor puntaje = mejor fair play. Amarilla: {YELLOW_PTS} pto · Roja: {RED_PTS} ptos.</p>
      </div>

      <Tabs defaultValue="teams">
        <TabsList className="bg-card/70 border border-border/40 rounded-xl p-1 h-auto">
          <TabsTrigger value="teams" className="rounded-lg font-bold text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <Shield className="mr-1.5 h-3.5 w-3.5" /> Equipos
          </TabsTrigger>
          <TabsTrigger value="players" className="rounded-lg font-bold text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <TrendingDown className="mr-1.5 h-3.5 w-3.5" /> Jugadores
          </TabsTrigger>
        </TabsList>

        <TabsContent value="teams" className="mt-4">
          <div className="rounded-2xl border border-border/40 bg-card/70 backdrop-blur-xl overflow-hidden shadow-lg">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border/40">
                  <TableHead className="w-12 text-center font-black text-xs uppercase tracking-widest text-muted-foreground py-3">#</TableHead>
                  <TableHead className="font-black text-xs uppercase tracking-widest text-muted-foreground">Equipo</TableHead>
                  <TableHead className="text-center w-16 font-bold text-xs uppercase tracking-widest text-yellow-500">🟨</TableHead>
                  <TableHead className="text-center w-16 font-bold text-xs uppercase tracking-widest text-red-500">🟥</TableHead>
                  <TableHead className="text-center w-20 font-black text-xs uppercase tracking-widest text-foreground">Ptos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamRanking.map((row, i) => (
                  <TableRow key={row.teamId} className={`hover:bg-muted/20 transition-colors border-b border-border/20 last:border-0 ${i === 0 && row.score === 0 ? '' : i === 0 ? 'bg-green-500/5 border-l-4 border-l-green-500/50' : ''}`}>
                    <TableCell className="text-center py-3 w-12">
                      <div className="flex items-center justify-center">{medalEmoji(i)}</div>
                    </TableCell>
                    <TableCell className="font-medium py-3">
                      <div className="flex items-center gap-3">
                        <JerseyPreview jersey={row.jersey} size="xs" />
                        <span className="font-bold truncate max-w-[160px]">{row.teamName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-yellow-600 dark:text-yellow-400 font-bold">{row.yellows}</TableCell>
                    <TableCell className="text-center text-red-500 font-bold">{row.reds}</TableCell>
                    <TableCell className="text-center py-3">
                      <span className={`inline-flex items-center justify-center w-9 h-9 rounded-lg font-black text-base ${row.score === 0 ? 'bg-green-500/10 text-green-600 dark:text-green-400' : row.score <= 3 ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' : 'bg-red-500/10 text-red-500'}`}>
                        {row.score}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="players" className="mt-4">
          {playerRanking.length === 0 ? (
            <Card className="border-dashed bg-card/40">
              <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                <Star className="h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Sin tarjetas registradas.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-2xl border border-border/40 bg-card/70 backdrop-blur-xl overflow-hidden shadow-lg">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border/40">
                    <TableHead className="w-12 text-center font-black text-xs uppercase tracking-widest text-muted-foreground py-3">#</TableHead>
                    <TableHead className="font-black text-xs uppercase tracking-widest text-muted-foreground">Jugador</TableHead>
                    <TableHead className="font-black text-xs uppercase tracking-widest text-muted-foreground hidden sm:table-cell">Equipo</TableHead>
                    <TableHead className="text-center w-16 font-bold text-xs uppercase tracking-widest text-yellow-500">🟨</TableHead>
                    <TableHead className="text-center w-16 font-bold text-xs uppercase tracking-widest text-red-500">🟥</TableHead>
                    <TableHead className="text-center w-20 font-black text-xs uppercase tracking-widest text-foreground">Ptos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {playerRanking.map((row, i) => (
                    <TableRow key={`${row.playerId}_${row.teamId}`} className="hover:bg-muted/20 transition-colors border-b border-border/20 last:border-0">
                      <TableCell className="text-center py-3 text-muted-foreground font-bold text-sm">{i + 1}</TableCell>
                      <TableCell className="font-bold py-3 truncate max-w-[120px]">{row.playerName}</TableCell>
                      <TableCell className="hidden sm:table-cell py-3">
                        <div className="flex items-center gap-2">
                          <JerseyPreview jersey={row.jersey} size="xs" />
                          <span className="text-sm text-muted-foreground truncate max-w-[100px]">{row.teamName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-yellow-600 dark:text-yellow-400 font-bold">{row.yellows}</TableCell>
                      <TableCell className="text-center text-red-500 font-bold">{row.reds}</TableCell>
                      <TableCell className="text-center">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-black text-sm ${row.score >= 6 ? 'bg-red-500/10 text-red-500' : row.score >= 3 ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' : 'bg-muted text-muted-foreground'}`}>
                          {row.score}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
