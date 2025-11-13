
'use client';

import type { Match, Team, Player, PlayerPosition, DetailedTeamPlayer } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { WhatsAppIcon } from '@/components/icons/whatsapp-icon';
import { JerseyPreview } from '@/components/team-builder/jersey-preview';
import { cn } from '@/lib/utils';
import { Shuffle, Loader2, Pencil } from 'lucide-react';
import { useMemo } from 'react';
import { EditableTeamsDialog } from '../editable-teams-dialog';
import { TeamRosterPlayer } from '../team-roster-player';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';


interface MatchTeamsProps {
  match: Match;
  isOwner: boolean;
  isShuffling: boolean;
  onShuffle: () => void;
  onPlayerUpdate?: () => void;
}

const positionBadgeStyles: Record<PlayerPosition, string> = {
  DEL: 'bg-gradient-to-r from-red-500 to-orange-500 text-white border-red-300/50 shadow-lg shadow-red-500/25',
  MED: 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-blue-300/50 shadow-lg shadow-blue-500/25',
  DEF: 'bg-gradient-to-r from-green-500 to-emerald-500 text-white border-green-300/50 shadow-lg shadow-green-500/25',
  POR: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white border-purple-300/50 shadow-lg shadow-purple-500/25',
};

export const MatchTeams = ({ match, isOwner, isShuffling, onShuffle, onPlayerUpdate }: MatchTeamsProps) => {
    const firestore = useFirestore();
    const teamPlayerIds = useMemo(() => match.teams?.flatMap(t => t.players.map(p => p.uid)) || [], [match.teams]);

    const playersQuery = useMemo(() => {
        if (!firestore || teamPlayerIds.length === 0) return null;
        return query(collection(firestore, 'players'), where('__name__', 'in', teamPlayerIds));
    }, [firestore, teamPlayerIds]);

    const { data: teamPlayersData } = useCollection<Player>(playersQuery);

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
                {(match.teams || []).map((team) => {
                    const teamMembersWithDetails: DetailedTeamPlayer[] = team.players
                        .map(p => {
                            const details = teamPlayersData?.find(pd => pd.id === p.uid);
                            return details ? { ...details, number: 0, status: 'titular' } : null;
                        })
                        .filter((p): p is DetailedTeamPlayer => p !== null)
                        .sort((a,b) => b.ovr - a.ovr);

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
                                    {teamMembersWithDetails.map((player) => (
                                        <TeamRosterPlayer 
                                            key={player.id}
                                            player={player}
                                            team={match as any} // Cast as team has members
                                            onPlayerUpdate={onPlayerUpdate}
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
