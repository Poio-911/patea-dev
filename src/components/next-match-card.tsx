'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, Navigation, ArrowRight, UserRound } from 'lucide-react';
import type { Match } from '@/lib/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { JerseyPreview } from './team-builder/jersey-preview';
import { MatchWeatherForecast } from './matches/match-weather-forecast';
import { cn, formatVenueName } from '@/lib/utils';
import { getMatchTheme } from '@/lib/match-theme';

const typeLabels: Record<string, string> = {
    manual: 'Amistoso',
    collaborative: 'Colaborativo',
    by_teams: 'Por Equipos',
    intergroup_friendly: 'Intergrupos',
    league: 'Liga',
    cup: 'Copa',
    league_final: 'Final',
};

interface NextMatchCardProps {
    match: Match | null;
    organizerName?: string;
    variant?: 'default' | 'compact';
}

const InfoRow = ({ icon: Icon, text, children, size = 'sm' }: { icon: React.ElementType, text?: string, children?: React.ReactNode, size?: 'xs' | 'sm' }) => {
    return (
        <div className={`flex items-center gap-3 ${size === 'xs' ? 'text-xs' : 'text-sm'} min-w-0`}>
            <Icon className="h-3.5 w-3.5 shrink-0 text-white/65" />
            {text && <span className="truncate">{text}</span>}
            {children}
        </div>
    );
};

export function NextMatchCard({ match, organizerName, variant = 'default' }: NextMatchCardProps) {
    // Treat past matches as none
    let currentMatch = match;
    if (currentMatch) {
        const dateObj = new Date(currentMatch.date);
        const [hh, mm] = (currentMatch.time || '00:00').split(':').map(Number);
        dateObj.setHours(hh || 0, mm || 0, 0, 0);
        const now = new Date();
        if (dateObj.getTime() < now.getTime()) {
            currentMatch = null;
        }
    }

    const uniquePlayers = React.useMemo(() => {
        if (!currentMatch?.players) return [];
        return Array.from(new Map(currentMatch.players.map(p => [p.uid, p])).values());
    }, [currentMatch?.players]);

    if (!currentMatch) {
        return (
            <div className="flex flex-col items-center justify-center text-center border-2 border-dashed border-muted-foreground/30 rounded-xl p-12 h-full">
                <Calendar className="h-12 w-12 text-muted-foreground/50" />
                <h2 className="mt-4 text-xl font-semibold">No hay fútbol a la vista</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                    Armá un nuevo partido para que empiece a rodar la pelota.
                </p>
                <Button asChild variant="default" className="mt-4">
                    <Link href="/matches">
                        <Calendar className="mr-2 h-4 w-4" />
                        Ir a Partidos
                    </Link>
                </Button>
            </div>
        );
    }

    const matchTheme = getMatchTheme(currentMatch.type);
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(currentMatch.location.address)}&query_place_id=${currentMatch.location.placeId}`;
    const isTeamMatch = currentMatch.type === 'by_teams' && currentMatch.teams && currentMatch.teams.length === 2;
    const isCompact = variant === 'compact';

    // Badge — pill with color dot
    const typeBadge = (
        <div className="flex items-center gap-2 mb-1">
            <div className={cn(
                "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-widest border shadow-none",
                "bg-white/15 border-white/25 text-white"
            )}>
                <div className={cn("w-2 h-2 rounded-full shrink-0", matchTheme.badgeColor)} />
                <span>{typeLabels[currentMatch.type] || currentMatch.type}</span>
            </div>
        </div>
    );

    const detailsButton = (
        <Button
            asChild
            variant="default"
            size="lg"
            className={cn("w-full font-bold !shadow-none game-theme-button", matchTheme.button)}
        >
            <Link href={`/matches/${currentMatch.id}`}>
                Ver Detalles
                <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
        </Button>
    );

    return (
        <div className={cn(
            "relative overflow-hidden rounded-xl border-2 shadow-none isolate next-match-banner bg-transparent border-white/10",
            matchTheme.border
        )}>
            {/* Background video with soft overlay */}
            <div className="absolute inset-0 z-0 rounded-lg overflow-hidden">
                <video autoPlay loop muted playsInline className="h-full w-full object-cover" aria-hidden="true">
                    <source src="/videos/match-detail-bg-2.mp4" type="video/mp4" />
                </video>
                <div
                    className={cn(
                        "absolute inset-0 z-0 opacity-65 game-banner-overlay",
                        matchTheme.bannerOverlay
                    )}
                />
            </div>
            {/* Bottom gradient for text readability — doesn't blur/cover the video */}
            <div className="absolute inset-0 z-[1] bg-gradient-to-t from-black/65 via-black/10 to-transparent pointer-events-none" />

            {isCompact ? (
                /* Compact: 2-column grid — info left, button right */
                <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 items-center text-white">
                    <div className="space-y-3">
                        {typeBadge}
                        {isTeamMatch ? (
                            <div className="flex flex-col gap-4">
                                <div className="flex justify-around items-center text-center">
                                    <div className="flex flex-col items-center gap-2 w-2/5">
                                        <JerseyPreview jersey={currentMatch.teams![0].jersey} size="md" />
                                        <h3 className="text-base font-bold truncate">{currentMatch.teams![0].name}</h3>
                                    </div>
                                    <p className="text-xl font-bold">vs</p>
                                    <div className="flex flex-col items-center gap-2 w-2/5">
                                        <JerseyPreview jersey={currentMatch.teams![1].jersey} size="md" />
                                        <h3 className="text-base font-bold truncate">{currentMatch.teams![1].name}</h3>
                                    </div>
                                </div>
                                <InfoRow size="xs" icon={Calendar} text={currentMatch.date ? format(new Date(currentMatch.date), "EEEE, d MMM, yyyy", { locale: es }) : 'Fecha no definida'} />
                                <InfoRow size="xs" icon={Clock} text={`${currentMatch.time} hs`} />
                                {organizerName && <InfoRow size="xs" icon={UserRound} text={`Organiza: ${organizerName}`} />}
                            </div>
                        ) : (
                            <>
                                <h3 className="text-lg font-bold">{currentMatch.title}</h3>
                                <InfoRow size="xs" icon={Calendar} text={currentMatch.date ? format(new Date(currentMatch.date), "EEEE, d 'de' MMMM, yyyy", { locale: es }) : 'Fecha no definida'} />
                                <InfoRow size="xs" icon={Clock} text={`${currentMatch.time} hs`} />
                                {organizerName && <InfoRow size="xs" icon={UserRound} text={`Organiza: ${organizerName}`} />}
                                <InfoRow size="xs" icon={Navigation}>
                                    <Button asChild variant="link" className="p-0 h-auto -ml-1 text-white hover:text-white/80 text-xs">
                                        <Link href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
                                            Ir a la cancha
                                        </Link>
                                    </Button>
                                </InfoRow>
                                {currentMatch.weather && (
                                    <div className="mt-1">
                                        <MatchWeatherForecast match={currentMatch} compact />
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                    <div className="flex flex-col gap-3">
                        {detailsButton}
                    </div>
                </div>
            ) : (
                /* Default (hero): info + button at bottom */
                <div className="relative z-10 p-5 text-white space-y-4">
                    {typeBadge}
                    {isTeamMatch ? (
                        <div className="flex flex-col gap-4">
                            <div className="flex justify-around items-center text-center">
                                <div className="flex flex-col items-center gap-2 w-2/5">
                                    <JerseyPreview jersey={currentMatch.teams![0].jersey} size="lg" />
                                    <h3 className="text-lg font-bold truncate">{currentMatch.teams![0].name}</h3>
                                </div>
                                <p className="text-2xl font-bold">vs</p>
                                <div className="flex flex-col items-center gap-2 w-2/5">
                                    <JerseyPreview jersey={currentMatch.teams![1].jersey} size="lg" />
                                    <h3 className="text-lg font-bold truncate">{currentMatch.teams![1].name}</h3>
                                </div>
                            </div>
                            <InfoRow icon={Calendar} text={currentMatch.date ? format(new Date(currentMatch.date), "EEEE, d MMM, yyyy", { locale: es }) : 'Fecha no definida'} />
                            <InfoRow icon={Clock} text={`${currentMatch.time} hs`} />
                            {organizerName && <InfoRow icon={UserRound} text={`Organiza: ${organizerName}`} />}
                        </div>
                    ) : (
                        <>
                            <h3 className="text-2xl font-bold">{currentMatch.title}</h3>
                            <InfoRow icon={Calendar} text={currentMatch.date ? format(new Date(currentMatch.date), "EEEE, d 'de' MMMM, yyyy", { locale: es }) : 'Fecha no definida'} />
                            <InfoRow icon={Clock} text={`${currentMatch.time} hs`} />
                            {organizerName && <InfoRow icon={UserRound} text={`Organiza: ${organizerName}`} />}
                            <InfoRow icon={Navigation}>
                                <Button asChild variant="link" className="p-0 h-auto -ml-1 text-white hover:text-white/80 text-sm">
                                    <Link href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
                                        Ir a la cancha
                                    </Link>
                                </Button>
                            </InfoRow>
                            {currentMatch.weather && (
                                <div className="mt-2">
                                    <MatchWeatherForecast match={currentMatch} compact />
                                </div>
                            )}
                        </>
                    )}
                    <div className="pt-1">
                        {detailsButton}
                    </div>
                </div>
            )}
        </div>
    );
}
