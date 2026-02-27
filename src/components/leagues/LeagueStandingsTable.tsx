'use client';

import React, { useMemo } from 'react';
import type { LeagueStanding } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

type LeagueStandingsTableProps = {
  standings: LeagueStanding[];
  highlightTeamId?: string;
};

const medals = ['🥇', '🥈', '🥉'] as const;

export const LeagueStandingsTable = React.memo(function LeagueStandingsTable({
  standings,
  highlightTeamId,
}: LeagueStandingsTableProps) {
  const sortedStandings = useMemo(() => {
    return [...standings].sort((a, b) => a.position - b.position);
  }, [standings]);

  if (standings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Trophy className="h-5 w-5 text-blue-500" aria-hidden="true" />
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
    <Card className="overflow-hidden">
      <CardHeader className="pb-3 bg-gradient-to-r from-blue-50 to-indigo-50/50 dark:from-blue-950/30 dark:to-indigo-950/20 border-b">
        <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
          <Trophy className="h-5 w-5" />
          Tabla de Posiciones
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b bg-muted/30">
                <TableHead className="w-10 text-center pl-4 pr-2">#</TableHead>
                <TableHead className="min-w-[140px]">Equipo</TableHead>
                <TableHead className="text-center hidden sm:table-cell w-10">PJ</TableHead>
                <TableHead className="text-center w-10">G</TableHead>
                <TableHead className="text-center w-10">E</TableHead>
                <TableHead className="text-center w-10">P</TableHead>
                <TableHead className="text-center hidden md:table-cell w-10">GF</TableHead>
                <TableHead className="text-center hidden md:table-cell w-10">GC</TableHead>
                <TableHead className="text-center hidden sm:table-cell w-10">DG</TableHead>
                <TableHead className="text-center font-bold w-12 pr-4">Pts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedStandings.map((standing) => {
                const pos = standing.position;
                const isHighlighted = highlightTeamId === standing.teamId;
                const isFirst = pos === 1;
                const isSecond = pos === 2;
                const isThird = pos === 3;
                const isTop3 = isFirst || isSecond || isThird;

                return (
                  <TableRow
                    key={standing.teamId}
                    className={cn(
                      'transition-colors border-b last:border-b-0',
                      isFirst && 'bg-yellow-50/60 dark:bg-yellow-900/10 game:bg-yellow-900/20 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 game:hover:bg-yellow-900/30',
                      isSecond && 'bg-slate-50/60 dark:bg-slate-800/10 game:bg-muted/10 hover:bg-slate-50 dark:hover:bg-slate-800/20 game:hover:bg-muted/20',
                      isThird && 'bg-amber-50/50 dark:bg-amber-900/10 game:bg-amber-900/15 hover:bg-amber-50 dark:hover:bg-amber-900/20 game:hover:bg-amber-900/25',
                      !isTop3 && 'hover:bg-muted/40',
                      isHighlighted && 'border-l-2 border-l-blue-500',
                    )}
                  >
                    {/* Rank */}
                    <TableCell className="text-center pl-4 pr-2 py-3">
                      <div className="flex items-center justify-center">
                        {isTop3 ? (
                          <span className="text-base leading-none">{medals[pos - 1]}</span>
                        ) : (
                          <span className="text-sm font-medium text-muted-foreground tabular-nums">
                            {pos}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Team */}
                    <TableCell className="py-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-6 h-6 rounded-sm flex items-center justify-center text-xs font-bold shrink-0 shadow-sm"
                          style={{
                            backgroundColor: standing.teamJersey?.primaryColor || '#1e40af',
                            color: standing.teamJersey?.secondaryColor || '#fff',
                          }}
                        >
                          {standing.teamName.charAt(0)}
                        </div>
                        <span
                          className={cn(
                            'font-medium text-sm leading-tight',
                            isHighlighted && 'text-blue-600 dark:text-blue-400 font-semibold',
                          )}
                        >
                          {standing.teamName}
                        </span>
                        {isHighlighted && (
                          <span className="text-[10px] font-semibold text-blue-500 bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 rounded-full">
                            Tú
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* PJ */}
                    <TableCell className="text-center text-muted-foreground text-sm hidden sm:table-cell py-3 tabular-nums">
                      {standing.matchesPlayed}
                    </TableCell>

                    {/* G */}
                    <TableCell className="text-center text-sm py-3 tabular-nums">
                      <span className={cn(standing.wins > 0 && 'text-emerald-600 dark:text-emerald-400 font-semibold')}>
                        {standing.wins}
                      </span>
                    </TableCell>

                    {/* E */}
                    <TableCell className="text-center text-muted-foreground text-sm py-3 tabular-nums">
                      {standing.draws}
                    </TableCell>

                    {/* P */}
                    <TableCell className="text-center text-sm py-3 tabular-nums">
                      <span className={cn(standing.losses > 0 && 'text-rose-500 dark:text-rose-400')}>
                        {standing.losses}
                      </span>
                    </TableCell>

                    {/* GF */}
                    <TableCell className="text-center text-sm hidden md:table-cell py-3 tabular-nums">
                      {standing.goalsFor}
                    </TableCell>

                    {/* GC */}
                    <TableCell className="text-center text-sm hidden md:table-cell py-3 tabular-nums">
                      {standing.goalsAgainst}
                    </TableCell>

                    {/* DG */}
                    <TableCell
                      className={cn(
                        'text-center text-sm font-medium hidden sm:table-cell py-3 tabular-nums',
                        standing.goalDifference > 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : standing.goalDifference < 0
                          ? 'text-rose-500 dark:text-rose-400'
                          : 'text-muted-foreground',
                      )}
                    >
                      {standing.goalDifference > 0 ? '+' : ''}
                      {standing.goalDifference}
                    </TableCell>

                    {/* Pts */}
                    <TableCell className="text-center pr-4 py-3">
                      <span
                        className={cn(
                          'text-base font-bold tabular-nums',
                          isFirst && 'text-yellow-600 dark:text-yellow-400',
                          isSecond && 'text-slate-500 dark:text-slate-300',
                          isThird && 'text-amber-600 dark:text-amber-400',
                          !isTop3 && isHighlighted && 'text-blue-600 dark:text-blue-400',
                          !isTop3 && !isHighlighted && 'text-foreground',
                        )}
                      >
                        {standing.points}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Legend */}
        <div className="px-4 py-3 border-t bg-muted/20 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span><span className="font-medium">PJ</span> Jugados</span>
          <span><span className="font-medium">G</span> Ganados</span>
          <span><span className="font-medium">E</span> Empatados</span>
          <span><span className="font-medium">P</span> Perdidos</span>
          <span className="hidden md:inline"><span className="font-medium">GF</span> Goles a Favor</span>
          <span className="hidden md:inline"><span className="font-medium">GC</span> Goles en Contra</span>
          <span><span className="font-medium">DG</span> Diferencia</span>
          <span><span className="font-medium">Pts</span> Puntos</span>
        </div>
      </CardContent>
    </Card>
  );
});
