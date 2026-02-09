'use client';

import React, { useMemo } from 'react';
import type { LeagueStanding } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy } from 'lucide-react';

type LeagueStandingsTableProps = {
  standings: LeagueStanding[];
  highlightTeamId?: string;
};

export const LeagueStandingsTable = React.memo(function LeagueStandingsTable({ standings, highlightTeamId }: LeagueStandingsTableProps) {
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
                const isSecond = standing.position === 2;
                const isThird = standing.position === 3;
                const isRelegation = standing.position > standings.length - 2;

                return (
                  <TableRow
                    key={standing.teamId}
                    className={`
                      ${isHighlighted ? 'user-team-highlight' : ''}
                      ${isRelegation ? 'relegation-zone' : ''}
                      hover:bg-muted/50 transition-all
                    `}
                  >
                    <TableCell className="text-center font-medium">
                      <div className="flex items-center justify-center gap-1">
                        {isFirst && <Trophy className="h-4 w-4 medal-gold" />}
                        {isSecond && <Trophy className="h-4 w-4 medal-silver" />}
                        {isThird && <Trophy className="h-4 w-4 medal-bronze" />}
                        <span>{standing.position}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-6 h-6 rounded-sm flex items-center justify-center text-xs font-bold"
                          style={{
                            backgroundColor: standing.teamJersey?.primaryColor || '#1e40af',
                            color: standing.teamJersey?.secondaryColor || '#fff'
                          }}
                        >
                          {standing.teamName.charAt(0)}
                        </div>
                        <span className="font-medium">{standing.teamName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {standing.matchesPlayed}
                    </TableCell>
                    <TableCell className="text-center text-success font-medium">
                      {standing.wins}
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {standing.draws}
                    </TableCell>
                    <TableCell className="text-center text-destructive font-medium">
                      {standing.losses}
                    </TableCell>
                    <TableCell className="text-center">
                      {standing.goalsFor}
                    </TableCell>
                    <TableCell className="text-center">
                      {standing.goalsAgainst}
                    </TableCell>
                    <TableCell className={`text-center font-medium ${standing.goalDifference > 0 ? 'text-success' :
                        standing.goalDifference < 0 ? 'text-destructive' :
                          'text-muted-foreground'
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
});
