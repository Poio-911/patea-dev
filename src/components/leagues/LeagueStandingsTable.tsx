'use client';

import { useMemo } from 'react';
import type { LeagueStanding } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy } from 'lucide-react';

type LeagueStandingsTableProps = {
  standings: LeagueStanding[];
  highlightTeamId?: string;
};

export function LeagueStandingsTable({ standings, highlightTeamId }: LeagueStandingsTableProps) {
  const sortedStandings = useMemo(() => {
    return [...standings].sort((a, b) => a.position - b.position);
  }, [standings]);

  if (standings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Trophy className="h-5 w-5" aria-hidden="true" />
            Tabla de Posiciones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No hay partidos completados aún.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Tabla de Posiciones
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12 text-center">#</TableHead>
                <TableHead>Equipo</TableHead>
                <TableHead className="text-center">PJ</TableHead>
                <TableHead className="text-center">PG</TableHead>
                <TableHead className="text-center">PE</TableHead>
                <TableHead className="text-center">PP</TableHead>
                <TableHead className="text-center">GF</TableHead>
                <TableHead className="text-center">GC</TableHead>
                <TableHead className="text-center">DG</TableHead>
                <TableHead className="text-center font-bold">Pts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedStandings.map((standing) => {
                const isHighlighted = highlightTeamId === standing.teamId;
                const isFirst = standing.position === 1;

                return (
                  <TableRow
                    key={standing.teamId}
                    className={`
                      ${isHighlighted ? 'bg-muted/50' : ''}
                      ${isFirst ? 'border-l-4 border-l-green-500' : ''}
                      hover:bg-muted/50 transition-colors
                    `}
                  >
                    <TableCell className="text-center font-medium">
                      {standing.position}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{standing.teamName}</span>
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {standing.matchesPlayed}
                    </TableCell>
                    <TableCell className="text-center text-green-600">
                      {standing.wins}
                    </TableCell>
                    <TableCell className="text-center text-yellow-600">
                      {standing.draws}
                    </TableCell>
                    <TableCell className="text-center text-red-600">
                      {standing.losses}
                    </TableCell>
                    <TableCell className="text-center">
                      {standing.goalsFor}
                    </TableCell>
                    <TableCell className="text-center">
                      {standing.goalsAgainst}
                    </TableCell>
                    <TableCell className={`text-center font-medium ${standing.goalDifference > 0
                      ? 'text-green-600'
                      : standing.goalDifference < 0
                        ? 'text-red-600'
                        : 'text-muted-foreground'
                      }`}>
                      {standing.goalDifference > 0 ? '+' : ''}{standing.goalDifference}
                    </TableCell>
                    <TableCell className="text-center font-bold text-lg">
                      {standing.points}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <span className="font-medium">PJ:</span> Partidos Jugados
          </div>
          <div className="flex items-center gap-1">
            <span className="font-medium">PG:</span> Partidos Ganados
          </div>
          <div className="flex items-center gap-1">
            <span className="font-medium">PE:</span> Partidos Empatados
          </div>
          <div className="flex items-center gap-1">
            <span className="font-medium">PP:</span> Partidos Perdidos
          </div>
          <div className="flex items-center gap-1">
            <span className="font-medium">GF:</span> Goles a Favor
          </div>
          <div className="flex items-center gap-1">
            <span className="font-medium">GC:</span> Goles en Contra
          </div>
          <div className="flex items-center gap-1">
            <span className="font-medium">DG:</span> Diferencia de Gol
          </div>
          <div className="flex items-center gap-1">
            <span className="font-medium">Pts:</span> Puntos
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
