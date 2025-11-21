'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import type { Match } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { JerseyPreview } from '@/components/team-builder/jersey-preview';
import { Calendar, MapPin, Edit, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type LeagueFixtureProps = {
  matches: Match[];
  currentRound: number;
  isOwner: boolean;
  leagueId: string;
  onEditMatch?: (matchId: string) => void;
};

export function LeagueFixture({ matches, currentRound, isOwner, leagueId, onEditMatch }: LeagueFixtureProps) {
  // Group matches by round
  const matchesByRound = useMemo(() => {
    if (!matches) return {};
    return matches.reduce((acc, match) => {
      const round = match.leagueInfo?.round || 0;
      if (!acc[round]) {
        acc[round] = [];
      }
      acc[round].push(match);
      return acc;
    }, {} as Record<number, Match[]>);
  }, [matches]);

  const sortedRounds = Object.keys(matchesByRound).map(Number).sort((a, b) => a - b);

  if (sortedRounds.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Fixture</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No hay partidos programados.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {sortedRounds.map((round) => {
        const roundMatches = matchesByRound[round];
        const isRoundLocked = round > currentRound;
        const isCurrentRound = round === currentRound;

        return (
          <Card key={round} className={isRoundLocked ? 'opacity-60' : ''}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-3">
                  Fecha {round}
                  {isCurrentRound && (
                    <Badge variant="default" className="ml-2">
                      En Curso
                    </Badge>
                  )}
                </CardTitle>
                {isRoundLocked && (
                  <Badge variant="secondary">Bloqueada</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {roundMatches.map((match) => {
                const team1 = match.teams?.[0];
                const team2 = match.teams?.[1];
                const isCompleted = match.status === 'completed' || match.status === 'evaluated';
                const score1 = team1?.finalScore ?? 0;
                const score2 = team2?.finalScore ?? 0;

                return (
                  <Card key={match.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      {/* Teams and Score */}
                      <div className="flex justify-around items-center mb-4">
                        {/* Team 1 */}
                        <div className="flex flex-col items-center gap-2 flex-1">
                          <JerseyPreview jersey={team1?.jersey} size="sm" />
                          <p className="font-semibold text-sm text-center">{team1?.name}</p>
                          {isCompleted && (
                            <p className="text-2xl font-bold">{score1}</p>
                          )}
                        </div>

                        {/* VS or Score */}
                        <div className="flex items-center justify-center px-4">
                          {isCompleted ? (
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-xs text-muted-foreground">Final</span>
                              <Badge variant={score1 > score2 ? 'default' : score2 > score1 ? 'destructive' : 'secondary'}>
                                {score1} - {score2}
                              </Badge>
                            </div>
                          ) : (
                            <span className="text-xl font-bold text-muted-foreground">vs</span>
                          )}
                        </div>

                        {/* Team 2 */}
                        <div className="flex flex-col items-center gap-2 flex-1">
                          <JerseyPreview jersey={team2?.jersey} size="sm" />
                          <p className="font-semibold text-sm text-center">{team2?.name}</p>
                          {isCompleted && (
                            <p className="text-2xl font-bold">{score2}</p>
                          )}
                        </div>
                      </div>

                      <Separator className="my-3" />

                      {/* Match Details */}
                      <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>
                            {format(new Date(match.date), "EEEE d 'de' MMMM, HH:mm'hs'", { locale: es })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          <span>{match.location?.name || 'Sin ubicación'}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 mt-4">
                        {isOwner && !isCompleted && onEditMatch && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onEditMatch(match.id)}
                            className="flex-1"
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Editar Fecha
                          </Button>
                        )}
                        <Button asChild variant="outline" size="sm" className="flex-1">
                          <Link href={`/competitions/leagues/${leagueId}/match/${match.id}`}>
                            <ExternalLink className="h-4 w-4 mr-2" />
                            {isCompleted ? 'Ver Detalles' : 'Gestionar Partido'}
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
