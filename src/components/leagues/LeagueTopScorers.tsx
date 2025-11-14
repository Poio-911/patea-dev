'use client';

import { useMemo } from 'react';
import type { Match, MatchGoalScorer, MatchCard } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Trophy, Target, AlertTriangle, AlertOctagon } from 'lucide-react';

type PlayerStats = {
  playerId: string;
  playerName: string;
  teamId: string;
  goals: number;
  yellowCards: number;
  redCards: number;
};

type LeagueTopScorersProps = {
  matches: Match[];
};

export function LeagueTopScorers({ matches }: LeagueTopScorersProps) {
  // Aggregate player stats from all matches
  const playerStats = useMemo(() => {
    const statsMap = new Map<string, PlayerStats>();

    matches.forEach(match => {
      // Process goal scorers
      if (match.goalScorers) {
        match.goalScorers.forEach((scorer: MatchGoalScorer) => {
          const key = scorer.playerId;
          if (!statsMap.has(key)) {
            statsMap.set(key, {
              playerId: scorer.playerId,
              playerName: scorer.playerName,
              teamId: scorer.teamId,
              goals: 0,
              yellowCards: 0,
              redCards: 0,
            });
          }
          const stats = statsMap.get(key)!;
          stats.goals++;
        });
      }

      // Process cards
      if (match.cards) {
        match.cards.forEach((card: MatchCard) => {
          const key = card.playerId;
          if (!statsMap.has(key)) {
            statsMap.set(key, {
              playerId: card.playerId,
              playerName: card.playerName,
              teamId: card.teamId,
              goals: 0,
              yellowCards: 0,
              redCards: 0,
            });
          }
          const stats = statsMap.get(key)!;
          if (card.cardType === 'yellow') {
            stats.yellowCards++;
          } else if (card.cardType === 'red') {
            stats.redCards++;
          }
        });
      }
    });

    // Convert to array and sort by goals (descending)
    return Array.from(statsMap.values())
      .sort((a, b) => b.goals - a.goals);
  }, [matches]);

  // Get top scorer(s)
  const topScorerGoals = playerStats[0]?.goals || 0;
  const topScorers = playerStats.filter(p => p.goals === topScorerGoals && topScorerGoals > 0);

  // Filter players with at least 1 goal or card
  const playersWithStats = playerStats.filter(
    p => p.goals > 0 || p.yellowCards > 0 || p.redCards > 0
  );

  if (playersWithStats.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Estadísticas de Jugadores
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No hay estadísticas disponibles aún. Los goles y tarjetas se mostrarán aquí cuando se completen los partidos.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Scorer Highlight */}
      {topScorers.length > 0 && (
        <Card className="border-2 border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Trophy className="h-5 w-5" />
              {topScorers.length === 1 ? 'Goleador' : 'Goleadores'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topScorers.map(scorer => (
                <div key={scorer.playerId} className="flex items-center justify-between p-3 rounded-lg bg-background/80">
                  <div>
                    <p className="font-bold text-lg">{scorer.playerName}</p>
                    <p className="text-sm text-muted-foreground">Equipo #{scorer.teamId.slice(-4)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="text-lg px-4 py-2">
                      {scorer.goals} {scorer.goals === 1 ? 'gol' : 'goles'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Full Statistics Table */}
      <Card>
        <CardHeader>
          <CardTitle>Estadísticas Completas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Jugador</TableHead>
                <TableHead className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Target className="h-4 w-4" />
                    Goles
                  </div>
                </TableHead>
                <TableHead className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    Amarillas
                  </div>
                </TableHead>
                <TableHead className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <AlertOctagon className="h-4 w-4 text-red-500" />
                    Rojas
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {playersWithStats.map((player, index) => (
                <TableRow key={player.playerId}>
                  <TableCell className="font-medium text-muted-foreground">
                    {index + 1}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-semibold">{player.playerName}</p>
                      <p className="text-xs text-muted-foreground">
                        Equipo #{player.teamId.slice(-4)}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {player.goals > 0 ? (
                      <Badge variant="secondary">{player.goals}</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {player.yellowCards > 0 ? (
                      <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                        {player.yellowCards}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {player.redCards > 0 ? (
                      <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">
                        {player.redCards}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
