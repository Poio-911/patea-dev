
'use client';

import type { Match, Team, Player } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { WhatsAppIcon } from '@/components/icons/whatsapp-icon';
import { JerseyPreview } from '@/components/team-builder/jersey-preview';
import { cn } from '@/lib/utils';
import { Shuffle, Loader2, Pencil } from 'lucide-react';
import { useMemo } from 'react';
import { EditableTeamsDialog } from '../editable-teams-dialog';

interface MatchTeamsProps {
  match: Match;
  isOwner: boolean;
  isShuffling: boolean;
  onShuffle: () => void;
}

const positionBadgeStyles: Record<Player['position'], string> = {
  DEL: 'bg-gradient-to-r from-red-500 to-orange-500 text-white border-red-300/50 shadow-lg shadow-red-500/25',
  MED: 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-blue-300/50 shadow-lg shadow-blue-500/25',
  DEF: 'bg-gradient-to-r from-green-500 to-emerald-500 text-white border-green-300/50 shadow-lg shadow-green-500/25',
  POR: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white border-purple-300/50 shadow-lg shadow-purple-500/25',
};

const ovrStyles = (ovr: number): string => {
  if (ovr >= 85) return 'text-yellow-400 font-black text-lg drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]';
  if (ovr >= 75) return 'text-green-400 font-bold text-lg drop-shadow-[0_0_6px_rgba(34,197,94,0.4)]';
  if (ovr >= 65) return 'text-blue-400 font-semibold text-lg drop-shadow-[0_0_4px_rgba(59,130,246,0.3)]';
  return 'text-gray-400 font-medium text-lg';
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
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                <div>
                    <h2 className="text-xl font-bold text-foreground mb-1">
                        Equipos Generados
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        {match.teams?.length || 0} equipos • {match.players.length} jugadores
                    </p>
                </div>
                {isOwner && match.status === 'upcoming' && (
                     <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                         <Button 
                             onClick={onShuffle} 
                             disabled={isShuffling} 
                             variant="outline" 
                             size="sm" 
                             className="w-full sm:w-auto bg-gradient-to-r from-primary/10 to-primary/5 border-primary/30 hover:from-primary/20 hover:to-primary/10 transition-all duration-300"
                         >
                             {isShuffling ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Shuffle className="mr-2 h-4 w-4 text-primary"/>}
                             Volver a Sortear
                         </Button>
                         <EditableTeamsDialog match={match}>
                             <Button 
                                 variant="outline" 
                                 size="sm" 
                                 className="w-full sm:w-auto bg-gradient-to-r from-amber-500/10 to-orange-500/5 border-amber-500/30 hover:from-amber-500/20 hover:to-orange-500/10 transition-all duration-300"
                             >
                                 <Pencil className="mr-2 h-4 w-4 text-amber-500" />
                                 Editar Equipos
                             </Button>
                         </EditableTeamsDialog>
                         <Button 
                             size="sm" 
                             variant="outline" 
                             asChild 
                             className="w-full sm:w-auto bg-gradient-to-r from-green-500/10 to-emerald-500/5 border-green-500/30 hover:from-green-500/20 hover:to-emerald-500/10 transition-all duration-300"
                         >
                            <a href={`https://wa.me/?text=${whatsAppTeamsText}`} target="_blank" rel="noopener noreferrer">
                              <WhatsAppIcon className="mr-2 h-4 w-4 text-green-500"/>Compartir
                            </a>
                         </Button>
                     </div>
                )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {(match.teams || []).map((team) => (
                    <Card 
                        key={team.name} 
                        className="bg-card border-2 border-l-4 transition-all duration-300 hover:shadow-lg"
                        style={{ 
                            borderLeftColor: team.jersey?.primaryColor || 'hsl(var(--border))',
                            backgroundImage: team.jersey ? `linear-gradient(to top, ${team.jersey.primaryColor}08, transparent)` : 'none'
                        }}
                    >
                       <CardHeader className="flex flex-row items-center justify-between gap-4 p-4">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                {team.jersey && (
                                    <div className="w-12 h-12 flex-shrink-0">
                                        <JerseyPreview jersey={team.jersey} />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <CardTitle className="text-base font-bold truncate">{team.name}</CardTitle>
                                </div>
                            </div>
                            <Badge 
                                variant="secondary" 
                                className={cn(
                                    "font-bold text-sm px-3 py-1 self-start",
                                    team.averageOVR >= 80 ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" :
                                    team.averageOVR >= 75 ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" :
                                    team.averageOVR >= 70 ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" : 
                                    "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                                )}
                            >
                                OVR {team.averageOVR.toFixed(1)}
                            </Badge>
                        </CardHeader>
                        <CardContent className="pt-0 p-2">
                            <div className="space-y-1">
                                {team.players.map((player) => {
                                    const playerInfo = match.players.find(p => p.uid === player.uid);
                                    return (
                                        <div 
                                            key={player.uid} 
                                            className="flex items-center justify-between p-3 border-b last:border-b-0 border-border/20 hover:bg-muted/30 transition-colors duration-200 rounded"
                                        >
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <Avatar className="h-10 w-10">
                                                    <AvatarImage 
                                                        src={playerInfo?.photoUrl} 
                                                        alt={player.displayName} 
                                                        data-ai-hint="player portrait" 
                                                    />
                                                    <AvatarFallback className="text-sm font-medium">
                                                        {player.displayName.charAt(0)}
                                                    </AvatarFallback>
                                                </Avatar>
                                                
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-sm truncate">
                                                        {player.displayName}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <Badge 
                                                            className={cn(
                                                                "text-xs px-2 py-0.5 font-medium", 
                                                                positionBadgeStyles[player.position as keyof typeof positionBadgeStyles]
                                                            )}
                                                        >
                                                            {player.position}
                                                        </Badge>
                                                        <Badge 
                                                            variant="secondary" 
                                                            className="text-xs px-2 py-0.5 font-bold"
                                                        >
                                                            {player.ovr}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
};
