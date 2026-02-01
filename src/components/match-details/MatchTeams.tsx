
'use client';

import type { Match, Player, PlayerPosition } from '@/lib/types';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { WhatsAppIcon } from '@/components/icons/whatsapp-icon';
import { JerseyPreview } from '@/components/team-builder/jersey-preview';
import { useMemo } from 'react';
import { TeamRosterPlayer } from '../team-roster-player';


interface MatchTeamsProps {
    match: Match;
    isOwner: boolean;
}

// ... (styles remain same)

export const MatchTeams = ({ match, isOwner }: MatchTeamsProps) => {
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {(match.teams || []).map((team) => {
                    const teamMembersWithDetails: any[] = team.players
                        .map(p => {
                            const matchPlayer = match.players.find(mp => mp.uid === p.uid);
                            return {
                                id: p.uid,
                                name: p.displayName,
                                position: p.position as PlayerPosition,
                                ovr: p.ovr,
                                photoURL: matchPlayer?.photoURL || '',
                                ownerUid: p.uid,
                                groupId: match.groupId || '',
                                status: 'active' as const,
                            };
                        })
                        .sort((a, b) => b.ovr - a.ovr);

                    return (
                        <Card
                            key={team.name}
                            className="bg-card border-2 border-l-4 transition-all duration-300 hover:shadow-lg"
                            style={{
                                borderLeftColor: team.jersey?.primaryColor || 'hsl(var(--border))',
                                backgroundImage: team.jersey ? `linear-gradient(to top, ${team.jersey.primaryColor}08, transparent)` : 'none'
                            }}
                        >
                            <CardHeader className="flex flex-col items-center justify-center p-4 gap-2">
                                <JerseyPreview jersey={team.jersey} size="md" />
                                <div className="text-center">
                                    <h3 className="text-lg font-bold">{team.name}</h3>
                                    <Badge variant="secondary" className="mt-1 font-bold">OVR {team.averageOVR.toFixed(1)}</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-0 p-2">
                                <div className="grid grid-cols-2 gap-3">
                                    {teamMembersWithDetails.map((player, index) => (
                                        <TeamRosterPlayer
                                            key={player.id}
                                            player={player}
                                            match={match}
                                            isOwner={isOwner}
                                            index={index}
                                        />
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
};
