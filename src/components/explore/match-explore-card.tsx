'use client';

import { Match } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, MapPin, Users, Trophy, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { formatDistance } from '@/lib/geo-utils';

type MatchExploreCardProps = {
    match: Match;
    distanceKm: number;
    isActive: boolean;
    onSelect: (id: string) => void;
};

export function MatchExploreCard({
    match,
    distanceKm,
    isActive,
    onSelect,
}: MatchExploreCardProps) {
    const date = new Date(match.date);
    const isFull = match.players.length >= match.matchSize;

    return (
        <Card
            onClick={() => onSelect(match.id)}
            className={cn(
                "relative overflow-hidden cursor-pointer transition-all duration-300 border-border/40",
                "w-[280px] sm:w-[320px] shrink-0 select-none group",
                isActive
                    ? "ring-2 ring-primary bg-primary/10 -translate-y-1 shadow-[0_0_20px_rgba(var(--primary),0.2)]"
                    : "bg-card/60 backdrop-blur-md hover:bg-card/80 shadow-sm"
            )}
        >
            {/* Glow Effect Top Left */}
            <div className="absolute -top-12 -left-12 w-24 h-24 bg-primary/20 blur-[40px] rounded-full pointer-events-none opacity-40 group-hover:opacity-60 transition-opacity" />

            <div className="p-4 space-y-3">
                {/* Header: Title + Distance */}
                <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                        <h3 className="font-bold text-base leading-tight truncate group-hover:text-primary transition-colors">
                            {match.title}
                        </h3>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                            <MapPin className="h-3 w-3" />
                            <span className="truncate">{match.location.name}</span>
                            {isFinite(distanceKm) && (
                                <>
                                    <span>•</span>
                                    <span className="text-primary font-bold">{formatDistance(distanceKm)}</span>
                                </>
                            )}
                        </div>
                    </div>
                    <Badge variant={isFull ? "secondary" : "default"} className="shrink-0 font-bold">
                        F{match.matchSize}
                    </Badge>
                </div>

                {/* Info Rows */}
                <div className="grid grid-cols-2 gap-2 pb-1">
                    <div className="flex items-center gap-2 text-sm">
                        <div className="w-8 h-8 rounded-lg bg-muted/80 flex items-center justify-center shrink-0 border border-border/20">
                            <Calendar className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider leading-none">Fecha</span>
                            <span className="font-semibold text-xs">{format(date, "d MMM", { locale: es })} • {match.time}hs</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                        <div className="w-8 h-8 rounded-lg bg-muted/80 flex items-center justify-center shrink-0 border border-border/20">
                            <Users className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider leading-none">Cupos</span>
                            <span className={cn("font-semibold text-xs", isFull ? "text-muted-foreground" : "text-primary")}>
                                {match.players.length}/{match.matchSize}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Footer Action */}
                <div className="flex items-center justify-between pt-1 border-t border-border/40">
                    <span className="text-[10px] text-muted-foreground font-bold italic truncate max-w-[150px]">
                        Organizado por {match.ownerUid.slice(0, 5)}...
                    </span>
                    <Button size="sm" variant={isActive ? "default" : "secondary"} className="h-8 text-xs font-bold rounded-full group-hover:scale-105 transition-transform">
                        {isFull ? "Ver Detalle" : "¡Sumarme!"}
                        <ChevronRight className="ml-1 h-3 w-3" />
                    </Button>
                </div>
            </div>
        </Card>
    );
}
