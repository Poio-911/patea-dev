
'use client';

import React, { useMemo } from 'react';
import type { Match, Player, PlayerPosition } from '@/lib/types';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { WhatsAppIcon } from '@/components/icons/whatsapp-icon';
import { JerseyPreview } from '@/components/team-builder/jersey-preview';
import { ArrowLeftRight } from 'lucide-react';
import { PlayerPhoto, PlayerPositionBadge } from '@/components/player-styles';
import { SwapPlayerDialog } from '@/components/swap-player-dialog';
import { AnimatedCardWrapper } from '@/components/animated-card-wrapper';


interface MatchTeamsProps {
    match: Match;
    isOwner: boolean;
}
const TeamMosaicPlayer = ({ player, match, isOwner, index }: { player: any, match: Match, isOwner: boolean, index: number }) => {
    const staggerDelay = index * 0.03;

    return (
        <AnimatedCardWrapper animation="slide" delay={staggerDelay}>
            <div className="flex items-center gap-4 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 transition-all duration-300 group/player">
                <div className="relative">
                    <PlayerPhoto player={player} size="compact" />
                    <div className="absolute -bottom-1 -right-1 bg-white dark:bg-slate-950 rounded-full p-0.5 shadow-sm border border-slate-100 dark:border-slate-800">
                        <Badge variant="secondary" className="px-1 py-0 h-4 text-[9px] font-black">
                            {player.ovr}
                        </Badge>
                    </div>
                </div>

                <div className="flex-grow min-w-0">
                    <p className="font-bold text-sm truncate uppercase tracking-tight group-hover/player:text-primary transition-colors">
                        {player.name}
                    </p>
                    <div className="flex items-center gap-2">
                        <PlayerPositionBadge position={player.position} size="sm" showIcon={false} textOnly={true} />
                        <span className="text-[10px] text-muted-foreground font-mono opacity-50 uppercase">
                            #{index + 1}
                        </span>
                    </div>
                </div>

                {isOwner && match.status === 'upcoming' && (
                    <div className="opacity-0 group-hover/player:opacity-100 transition-opacity">
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

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                <div>
                    <h2 className="text-xl font-bold text-foreground mb-1">
                        Equipos Generados
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
                {(match.teams || []).map((team) => {
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
                            {/* Watermark Team Name */}
                            <div className="absolute -top-14 left-0 right-0 pointer-events-none select-none opacity-[0.03] dark:opacity-[0.07] overflow-hidden">
                                <h3 className="text-8xl font-black uppercase whitespace-nowrap leading-none tracking-tighter">
                                    {team.name}
                                </h3>
                            </div>

                            {/* Team Header */}
                            <div className="flex items-center gap-4 mb-8 relative z-10 pl-2">
                                <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm transition-transform group-hover:scale-105 duration-300">
                                    <JerseyPreview jersey={team.jersey} size="md" />
                                </div>
                                <div className="flex flex-col">
                                    <h3 className="text-2xl font-black uppercase tracking-tight leading-none mb-1">{team.name}</h3>
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                            <span className="text-[10px] font-black uppercase text-slate-500">OVR</span>
                                            <span className="text-xs font-black">{team.averageOVR.toFixed(1)}</span>
                                        </div>
                                        <span className="text-[10px] uppercase font-bold text-muted-foreground/60 tracking-widest">
                                            {team.players.length} JUGADORES
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Player List (Mosaic Style) */}
                            <div className="grid grid-cols-1 xs:grid-cols-2 gap-x-6 gap-y-2 relative z-10">
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
