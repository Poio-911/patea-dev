
'use client';

import type { Match, Team, Player } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { WhatsAppIcon } from '@/components/icons/whatsapp-icon';
import { SwapPlayerDialog } from '@/components/swap-player-dialog';
import { JerseyPreview } from '@/components/team-builder/jersey-preview';
import { cn } from '@/lib/utils';
import { Shuffle, Loader2 } from 'lucide-react';
import { useMemo } from 'react';

interface MatchTeamsProps {
  match: Match;
  isOwner: boolean;
  isShuffling: boolean;
  onShuffle: () => void;
}

const positionBadgeStyles: Record<Player['position'], string> = {
  DEL: 'bg-chart-1 text-white',
  MED: 'bg-chart-2 text-white',
  DEF: 'bg-chart-3 text-white',
  POR: 'bg-chart-4 text-white',
};

export const MatchTeams = ({ match, isOwner, isShuffling, onShuffle }: MatchTeamsProps) => {

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
        <Card className="bg-card/60 backdrop-blur-sm border-2">
            <CardHeader>
                <CardTitle className="text-xl font-semibold">Equipos Generados</CardTitle>
                 <div className="pt-2">
                    {isOwner && match.status === 'upcoming' && (
                        <div className="flex flex-col sm:flex-row gap-2">
                            <Button variant="outline" size="sm" onClick={onShuffle} disabled={isShuffling}>{isShuffling && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}<Shuffle className="mr-2 h-4 w-4"/>Volver a Sortear</Button>
                            <Button variant="outline" size="sm" asChild><a href={`https://wa.me/?text=${whatsAppTeamsText}`} target="_blank" rel="noopener noreferrer"><WhatsAppIcon className="mr-2 h-4 w-4"/>Compartir Equipos</a></Button>
                        </div>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(match.teams || []).map(team => (
                        <Card key={team.name} className="bg-card/60 backdrop-blur-sm border-2 border-l-4 transition-all duration-300" style={{ borderLeftColor: team.jersey?.primaryColor || 'hsl(var(--border))', backgroundImage: team.jersey ? `linear-gradient(to top, ${team.jersey.primaryColor}08, transparent)` : 'none'}}>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle className="flex items-center gap-2">{team.jersey && <div className="w-8 h-8"><JerseyPreview jersey={team.jersey} /></div>}<span>{team.name}</span></CardTitle>
                                <Badge variant="secondary">OVR {team.averageOVR.toFixed(1)}</Badge>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-1">
                                    {team.players.map(player => (
                                        <div key={player.uid} className="flex items-center justify-between p-2 border-b last:border-b-0 border-foreground/10 hover:bg-background/40 transition-all duration-300 rounded">
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-9 w-9"><AvatarImage src={match.players.find(p => p.uid === player.uid)?.photoUrl} alt={player.displayName} /><AvatarFallback>{player.displayName.charAt(0)}</AvatarFallback></Avatar>
                                                <div className="flex-1"><p className="font-semibold text-sm">{player.displayName}</p></div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {isOwner && match.status === 'upcoming' && (
                                                    <SwapPlayerDialog match={match} playerToSwap={player}>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7"><Shuffle className="h-4 w-4" /></Button>
                                                    </SwapPlayerDialog>
                                                )}
                                                <Badge className={cn("text-xs", positionBadgeStyles[player.position as keyof typeof positionBadgeStyles])}>{player.position}</Badge>
                                                <Badge variant="secondary" className="text-xs w-10 justify-center">{player.ovr}</Badge>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};
