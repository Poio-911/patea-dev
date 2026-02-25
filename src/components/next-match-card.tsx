'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, Navigation, ArrowRight, UserRound, Tag, UserCheck, Users, Trophy, Handshake, Shirt, Globe } from 'lucide-react';
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
    // Icons that should have white circle background in Game theme
    const iconName = (Icon as any).displayName || (Icon as any).name || '';
    const shouldHaveCircle = ['Calendar', 'Clock', 'Navigation'].includes(iconName);

    return (
        <div className={`flex items-center gap-3 ${size === 'xs' ? 'text-xs' : 'text-sm'} min-w-0`}>
            <Icon className={`h-4 w-4 shrink-0 ${shouldHaveCircle ? 'icon-with-circle' : ''}`} />
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

    return (
        <div className={cn(
            "relative overflow-hidden rounded-xl border-2 shadow-md isolate next-match-banner",
            matchTheme.border
        )}>
            {/* Background video with soft overlay */}
            <div className="absolute inset-0 z-0 rounded-lg overflow-hidden">
                <video autoPlay loop muted playsInline className="h-full w-full object-cover" aria-hidden="true">
                    <source src="/videos/match-detail-bg-2.mp4" type="video/mp4" />
                </video>
                <div
                    className={cn(
                        "absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent",
                        "after:absolute after:inset-0 after:bg-gradient-to-br after:opacity-30",
                        matchTheme.gradient.replace('from-', 'after:from-').replace('via-', 'after:via-').replace('to-', 'after:to-')
                    )}
                />
            </div>
            <div className={`relative z-10 grid grid-cols-1 ${isCompact ? 'md:grid-cols-2 gap-4 p-4' : 'md:grid-cols-3 gap-6 p-6'} items-center text-white`}>
                <div className={`${isCompact ? 'md:col-span-1' : 'md:col-span-2'} space-y-3`}>
                    {isCompact && (
                        <div className="flex items-center gap-2 mb-1">
                            <div className={cn(
                                "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border bg-white/10 backdrop-blur-sm shadow-sm",
                                matchTheme.border,
                                "text-white"
                            )}>
                                <div className={cn("p-0.5 rounded", matchTheme.badge)}>
                                    {matchTheme.icon === 'UserCheck' && <UserCheck className="h-2.5 w-2.5" />}
                                    {matchTheme.icon === 'Users' && <Users className="h-2.5 w-2.5" />}
                                    {matchTheme.icon === 'Shirt' && <Shirt className="h-2.5 w-2.5" />}
                                    {matchTheme.icon === 'Trophy' && <Trophy className="h-2.5 w-2.5" />}
                                    {matchTheme.icon === 'Handshake' && <Handshake className="h-2.5 w-2.5" />}
                                    {matchTheme.icon === 'Globe' && <Globe className="h-2.5 w-2.5" />}
                                </div>
                                <span>{typeLabels[currentMatch.type] || currentMatch.type}</span>
                            </div>
                        </div>
                    )}
                    {isTeamMatch ? (
                        <div className="flex flex-col gap-4">
                            <div className="flex justify-around items-center text-center">
                                <div className="flex flex-col items-center gap-2 w-2/5">
                                    <JerseyPreview jersey={currentMatch.teams![0].jersey} size={isCompact ? 'md' : 'lg'} />
                                    <h3 className={`${isCompact ? 'text-base' : 'text-lg'} font-bold truncate`}>{currentMatch.teams![0].name}</h3>
                                </div>
                                <p className={`${isCompact ? 'text-xl' : 'text-2xl'} font-bold`}>vs</p>
                                <div className="flex flex-col items-center gap-2 w-2/5">
                                    <JerseyPreview jersey={currentMatch.teams![1].jersey} size={isCompact ? 'md' : 'lg'} />
                                    <h3 className={`${isCompact ? 'text-base' : 'text-lg'} font-bold truncate`}>{currentMatch.teams![1].name}</h3>
                                </div>
                            </div>
                            <InfoRow size={isCompact ? 'xs' : 'sm'} icon={Calendar} text={currentMatch.date ? format(new Date(currentMatch.date), "EEEE, d MMM, yyyy", { locale: es }) : 'Fecha no definida'} />
                            <InfoRow size={isCompact ? 'xs' : 'sm'} icon={Clock} text={`${currentMatch.time} hs`} />
                            {organizerName && <InfoRow size={isCompact ? 'xs' : 'sm'} icon={UserRound} text={`Organiza: ${organizerName}`} />}
                        </div>
                    ) : (
                        <>
                            <h3 className={`${isCompact ? 'text-lg' : 'text-xl'} font-bold`}>{currentMatch.title}</h3>
                            <InfoRow size={isCompact ? 'xs' : 'sm'} icon={Calendar} text={currentMatch.date ? format(new Date(currentMatch.date), "EEEE, d 'de' MMMM, yyyy", { locale: es }) : 'Fecha no definida'} />
                            <InfoRow size={isCompact ? 'xs' : 'sm'} icon={Clock} text={`${currentMatch.time} hs`} />
                            {organizerName && <InfoRow size={isCompact ? 'xs' : 'sm'} icon={UserRound} text={`Organiza: ${organizerName}`} />}
                            <InfoRow size={isCompact ? 'xs' : 'sm'} icon={Navigation}>
                                <Button asChild variant="link" className={`p-0 h-auto -ml-1 text-white hover:text-white/80 ${isCompact ? 'text-xs' : 'text-sm'}`}>
                                    <Link href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
                                        Ir a la cancha
                                    </Link>
                                </Button>
                            </InfoRow>
                            {currentMatch.weather && (
                                <div className={`${isCompact ? 'mt-1' : 'mt-2'}`}>
                                    <MatchWeatherForecast match={currentMatch} compact />
                                </div>
                            )}
                        </>
                    )}
                </div>
                <div className={`flex justify-center items-center ${isCompact ? 'p-2' : 'p-6'}`}>
                    <Button
                        asChild
                        size={isCompact ? 'default' : 'lg'}
                        className={cn("font-bold shadow-md", matchTheme.button)}
                    >
                        <Link href={`/matches/${currentMatch.id}`}>
                            Ver Detalles
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}
