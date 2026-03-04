
'use client';

import React, { useMemo } from 'react';
import type { Match, Player, PlayerPosition } from '@/lib/types';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { WhatsAppIcon } from '@/components/icons/whatsapp-icon';
import { JerseyPreview } from '@/components/team-builder/jersey-preview';
import { ArrowLeftRight, Shirt } from 'lucide-react';
import { PlayerPhoto, PlayerPositionBadge } from '@/components/player-styles';
import { SwapPlayerDialog } from '@/components/swap-player-dialog';
import { AnimatedCardWrapper } from '@/components/animated-card-wrapper';
import { cn } from '@/lib/utils';


interface MatchTeamsProps {
    match: Match;
    isOwner: boolean;
}
const TeamMosaicPlayer = ({ player, match, isOwner, index }: { player: any, match: Match, isOwner: boolean, index: number }) => {
    const staggerDelay = index * 0.03;

    return (
        <AnimatedCardWrapper animation="slide" delay={staggerDelay}>
            <div className="flex items-center gap-4 p-2 rounded-xl hover:bg-muted/50 transition-all duration-300 group/player">
                <div className="relative">
                    <PlayerPhoto player={player} size="compact" />
                </div>

                <div className="flex-grow min-w-0">
                    <p className="font-bold text-sm truncate uppercase tracking-tight group-hover/player:text-primary transition-colors">
                        {player.name}
                    </p>
                    <div className="flex items-center gap-2">
                        <PlayerPositionBadge position={player.position} size="sm" showIcon={false} textOnly={true} showFullName={true} />
                    </div>
                </div>

                {isOwner && match.status === 'upcoming' && (
                    <div className="opacity-100 md:opacity-0 md:group-hover/player:opacity-100 transition-opacity">
                        <SwapPlayerDialog match={match} playerToSwap={player}>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-primary/10 rounded-full"
                            >
                                <ArrowLeftRight className="h-3.5 w-3.5" />
                            </Button>
                        </SwapPlayerDialog>
                    </div>
                )}
            </div>
        </AnimatedCardWrapper>
    );
};

export const MatchTeams = React.memo(function MatchTeams({ match, isOwner }: MatchTeamsProps) {
    const whatsAppTeamsText = useMemo(() => {
        if (!match || !match.teams || match.teams.length < 2) return '';
        let message = `*Equipos para el partido "${match.title}"*:\n\n`;
        match.teams.forEach(team => {
            message += `*${team.name}*\n`;
            team.players.forEach(p => {
                message += `- ${p.displayName} (OVR ${p.ovr})\n`;
            });
            message += '\n';
        });
        return encodeURIComponent(message);
    }, [match]);

    const fairnessScore = match.teams && match.teams.length > 0
        ? match.teams[0].balanceMetrics?.fairnessPercentage || 0
        : 0;

    let fairnessLabel = null;
    let fairnessColor = '';

    if (fairnessScore >= 95) {
        fairnessLabel = 'Súper Equilibrado';
        fairnessColor = 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30';
    } else if (fairnessScore >= 85) {
        fairnessLabel = 'Buen Balance';
        fairnessColor = 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30';
    } else if (fairnessScore > 0) {
        fairnessLabel = 'Desparejo';
        fairnessColor = 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30';
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 mt-6">
                <div>
                    <h2 className="text-xl font-bold text-foreground mb-1 flex items-center gap-2">
                        Equipos Generados
                        {fairnessLabel && (
                            <Badge variant="outline" className={cn("text-[10px] uppercase font-black tracking-widest h-5 px-1.5", fairnessColor)}>
                                {fairnessLabel} ({Math.round(fairnessScore)}%)
                            </Badge>
                        )}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        {match.teams?.length || 0} equipos • {match.players?.length || 0} jugadores
                    </p>
                </div>
                {isOwner && match.status === 'upcoming' && (
                    <Button
                        size="sm"
                        variant="outline"
                        asChild
                        className="w-full sm:w-auto bg-card border hover:bg-card/80 transition-all duration-300"
                    >
                        <a href={`https://wa.me/?text=${whatsAppTeamsText}`} target="_blank" rel="noopener noreferrer">
                            <WhatsAppIcon className="mr-2 h-4 w-4 text-foreground" />Compartir
                        </a>
                    </Button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-12 pt-8">
                {(match.teams || []).map((team, tIdx) => {
                    const isLegacyChaleco = team.name.toLowerCase().includes('chaleco');

                    // Lógica de nombres dinámicos
                    let displayTeamName = team.name;
                    let extraTags: string[] = [];

                    if (isLegacyChaleco) {
                        displayTeamName = tIdx === 0 ? "Equipo Azul" : "Equipo Naranja";
                        // El "Chaleco" se maneja como indicador aparte
                    }

                    const teamMembersWithDetails: any[] = team.players
                        .map((p: any) => {
                            const matchPlayer = match.players.find((mp: any) => mp.uid === p.uid);
                            return {
                                uid: p.uid,
                                id: p.uid,
                                displayName: p.displayName,
                                name: p.displayName,
                                position: p.position as PlayerPosition,
                                ovr: p.ovr,
                                photoURL: matchPlayer?.photoURL || '',
                                ownerUid: p.uid,
                                groupId: match.groupId || '',
                                status: 'active' as const,
                            };
                        })
                        .sort((a: any, b: any) => b.ovr - a.ovr);

                    return (
                        <div key={team.name} className="relative group">
                            {/* Watermark Team Name - Sólido (como estaba antes) */}
                            <div className="absolute -top-14 left-0 right-0 pointer-events-none select-none overflow-hidden z-0 opacity-[0.05] dark:opacity-[0.1]">
                                <h3 className="text-7xl sm:text-8xl font-black uppercase italic whitespace-nowrap leading-none tracking-tighter">
                                    {displayTeamName}
                                </h3>
                            </div>

                            {/* Team Header */}
                            <div className="flex items-center gap-4 mb-8 relative z-10 pl-2">
                                {/* Camiseta Liberada */}
                                <div className="p-0 transition-transform group-hover:scale-110 duration-500 drop-shadow-[0_20px_20px_rgba(0,0,0,0.15)]">
                                    <JerseyPreview jersey={team.jersey} size="md" />
                                </div>
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-3">
                                        <h3 className="text-2xl font-black uppercase tracking-tight leading-none mb-1">{displayTeamName}</h3>
                                        {isLegacyChaleco && team.name.toLowerCase().includes('con') && (
                                            <div className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400 font-black text-[10px] uppercase tracking-widest pl-1">
                                                <Shirt className="h-3.5 w-3.5" />
                                                Usa Chaleco
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-[10px] uppercase font-bold text-muted-foreground/60 tracking-widest leading-none">
                                            {team.players.length} JUGADORES
                                        </span>
                                        {team.tags && team.tags.length > 0 && (
                                            <>
                                                <span className="text-muted-foreground/30 text-[10px]">•</span>
                                                <div className="flex items-center gap-1.5 leading-none">
                                                    {team.tags.slice(0, 3).map((tag: string, i: number) => (
                                                        <span key={i} className="text-[10px] font-black uppercase text-primary/70 bg-primary/10 px-1.5 py-0.5 rounded-sm">
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Player List (Mosaic Style) */}
                            <div className="grid grid-cols-2 gap-x-6 gap-y-2 relative z-10">
                                {teamMembersWithDetails.map((player, index) => (
                                    <TeamMosaicPlayer
                                        key={player.id}
                                        player={player}
                                        match={match}
                                        isOwner={isOwner}
                                        index={index}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
});
