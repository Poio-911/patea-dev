'use client';

import type { Match } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, MapPin, Newspaper } from 'lucide-react';
import Link from 'next/link';
import { Button } from '../ui/button';
import { JerseyPreview } from '../team-builder/jersey-preview';
import { MatchWeatherForecast } from '../matches/match-weather-forecast';

interface UpcomingMatchesFeedProps {
    matches: Match[];
    teamName?: string; // Prop opcional para la vista compacta
    compact?: boolean; // Prop para layout compacto en columnas
}

export function UpcomingMatchesFeed({ matches, teamName, compact = false }: UpcomingMatchesFeedProps) {
    if (matches.length === 0) {
        return (
            <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">No hay partidos próximos</p>
            </div>
        );
    }

    if (compact) {
        // --- VISTA COMPACTA PARA LAYOUT DE COLUMNAS ---
        return (
            <div className="space-y-3">
                {matches.map(match => (
                    <Link key={match.id} href={`/matches`} passHref>
                        <Card className="hover:bg-muted/50 transition-colors">
                            <CardContent className="p-3">
                                <p className="font-semibold text-sm truncate mb-1">{match.title}</p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                                    <Calendar className="h-3 w-3" />
                                    <span>{format(new Date(match.date), "E, d MMM", { locale: es })}</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <MapPin className="h-3 w-3" />
                                    <span className="truncate">{match.location.name}</span>
                                </div>
                                {match.weather && (
                                    <div className="mt-2 border-t pt-2">
                                        <MatchWeatherForecast match={match} compact />
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>
        );
    }

    if (teamName) {
        // --- VISTA COMPACTA PARA LA PÁGINA DEL EQUIPO ---
        return (
            <div>
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                    <Newspaper className="h-6 w-6 text-primary"/>
                    En la Pizarra
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {matches.map(match => {
                        const ourTeam = match.teams?.find(t => t.name === teamName);
                        const opponentTeam = match.teams?.find(t => t.name !== teamName);

                        if (!ourTeam || !opponentTeam) {
                            // Si no es un partido entre dos equipos, mostramos la card normal
                             return (
                                <Link key={match.id} href={`/matches`} passHref>
                                    <Card className="h-full hover:bg-muted/50 transition-colors">
                                        <CardHeader>
                                            <CardTitle className="text-base">{match.title}</CardTitle>
                                            <CardDescription className="text-xs">{format(new Date(match.date), "EEEE, d MMM, yyyy", { locale: es })}</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <MapPin className="h-3 w-3" />
                                                <span>{match.location.name}</span>
                                            </div>
                                            {match.weather && (
                                                <div className="mt-2 border-t pt-2">
                                                    <MatchWeatherForecast match={match} compact />
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </Link>
                            );
                        }

                        return (
                             <Link key={match.id} href={`/matches`} passHref>
                                <Card className="h-full hover:bg-muted/50 transition-colors p-3">
                                    <div className="flex justify-around items-center text-center">
                                        <div className="flex flex-col items-center gap-1 w-2/5">
                                            <JerseyPreview jersey={ourTeam.jersey} size="sm" />
                                            <p className="text-xs font-bold truncate">{ourTeam.name}</p>
                                        </div>
                                        <p className="text-lg font-bold text-muted-foreground">vs</p>
                                        <div className="flex flex-col items-center gap-1 w-2/5">
                                            <JerseyPreview jersey={opponentTeam.jersey} size="sm" />
                                            <p className="text-xs font-bold truncate">{opponentTeam.name}</p>
                                        </div>
                                    </div>
                                    <p className="text-center text-xs text-muted-foreground mt-2">{format(new Date(match.date), "E, d MMM, HH:mm'hs'", { locale: es })}</p>
                                    {match.weather && (
                                        <div className="mt-2 border-t pt-2">
                                            <MatchWeatherForecast match={match} compact />
                                        </div>
                                    )}
                                </Card>
                            </Link>
                        );
                    })}
                </div>
            </div>
        );
    }
    
    // --- VISTA ORIGINAL PARA OTROS LUGARES (EJ: DASHBOARD DE GRUPO) ---
    return (
        <div>
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <Newspaper className="h-6 w-6 text-primary"/>
                En la Pizarra
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {matches.map(match => (
                    <Link key={match.id} href={`/matches`} passHref>
                        <Card className="h-full hover:bg-muted/50 transition-colors">
                            <CardHeader>
                                <CardTitle className="text-base">{match.title}</CardTitle>
                                <CardDescription className="text-xs">{format(new Date(match.date), "EEEE, d MMM, yyyy", { locale: es })}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <MapPin className="h-3 w-3" />
                                    <span>{match.location.name}</span>
                                </div>
                                {match.weather && (
                                    <div className="mt-2 border-t pt-2">
                                        <MatchWeatherForecast match={match} compact />
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>
        </div>
    )
}
