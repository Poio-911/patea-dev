'use client';

import type { Match } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, MapPin, Newspaper } from 'lucide-react';
import Link from 'next/link';
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
        // --- VISTA COMPACTA PARA LAYOUT DE COLUMNAS (Groups View) ---
        return (
            <div className="space-y-3">
                {matches.map(match => (
                    <Link key={match.id} href={`/matches`} passHref>
                        <div className="group relative overflow-hidden bg-card rounded-xl border border-border hover:border-primary/50 transition-all duration-300 hover:shadow-sm">
                            {/* Accent Bar */}
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/50 group-hover:bg-primary transition-colors" />

                            <div className="p-3 pl-5 flex flex-col gap-2">
                                <div className="flex justify-between items-start">
                                    <h3 className="font-headline font-bold text-sm text-card-foreground group-hover:text-primary transition-colors tracking-wide truncate pr-2">
                                        {match.title}
                                    </h3>
                                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-muted text-primary border border-border">
                                        VS
                                    </span>
                                </div>

                                <div className="flex items-center gap-3 mt-1">
                                    <div className="flex flex-col items-center justify-center bg-muted/50 rounded p-1.5 min-w-[3rem] border border-border group-hover:bg-primary/5 group-hover:border-primary/20 transition-colors">
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase">{format(new Date(match.date), "MMM", { locale: es })}</span>
                                        <span className="text-lg font-black text-card-foreground leading-none">{format(new Date(match.date), "d", { locale: es })}</span>
                                    </div>

                                    <div className="flex flex-col gap-1 min-w-0">
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                            <Calendar className="h-3 w-3 text-primary/70" />
                                            <span className="truncate capitalize">{format(new Date(match.date), "EEEE HH:mm", { locale: es })}hs</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                            <MapPin className="h-3 w-3 text-muted-foreground" />
                                            <span className="truncate">{match.location.name}</span>
                                        </div>
                                    </div>
                                </div>

                                {match.weather && (
                                    <div className="mt-1 pt-2 border-t border-border">
                                        <MatchWeatherForecast match={match} compact />
                                    </div>
                                )}
                            </div>
                        </div>
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
                    <Newspaper className="h-6 w-6 text-primary" />
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
                <Newspaper className="h-6 w-6 text-primary" />
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
