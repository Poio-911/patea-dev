
'use client';

import type { Match } from '@/lib/types';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { JerseyPreview } from './team-builder/jersey-preview';
import { Button } from './ui/button';
import { Calendar, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';
import { MatchWeatherForecast } from './matches/match-weather-forecast';

interface FriendlyMatchCardProps {
    match: Match;
}

export function FriendlyMatchCard({ match }: FriendlyMatchCardProps) {
    const team1 = match.teams?.[0];
    const team2 = match.teams?.[1];

    if (!team1 || !team2) return null;

    return (
        <Card className="overflow-hidden hover:shadow-lg transition-shadow">
            <CardHeader className="gradient-primary p-4">
                <div className="flex items-center justify-around gap-2 text-center">
                    {/* Team 1 */}
                    <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                        <div className="w-16 h-16">
                            <JerseyPreview jersey={team1.jersey!} size="md" />
                        </div>
                        <h3 className="font-bold text-sm truncate w-full">{team1.name}</h3>
                    </div>

                    {/* VS Divider */}
                    <div className="flex flex-col items-center px-1">
                        <p className="font-bold text-lg text-muted-foreground">VS</p>
                    </div>

                    {/* Team 2 */}
                    <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                        <div className="w-16 h-16">
                            <JerseyPreview jersey={team2.jersey!} size="md" />
                        </div>
                        <h3 className="font-bold text-sm truncate w-full">{team2.name}</h3>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="pt-4 px-4 space-y-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>{format(new Date(match.date), "EEEE, d MMM, yyyy", { locale: es })}</span>
                </div>
                <div className="flex items-start gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="font-medium text-foreground">{match.location.name}</p>
                    </div>
                </div>
                {match.weather && (
                    <div className="border-t pt-3">
                        <MatchWeatherForecast match={match} compact />
                    </div>
                )}
            </CardContent>

            <CardFooter className="flex gap-2 border-t p-2">
                <Button asChild variant="outline" className="flex-1" size="sm">
                    <Link href={`/matches/${match.id}`}>
                        Ver Detalles
                    </Link>
                </Button>
            </CardFooter>
        </Card>
    );
}
