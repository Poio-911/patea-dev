
'use client';

import { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { JerseyIcon } from './icons/jersey-icon';
import { TacticalBoard } from './tactical-board';
import { Separator } from './ui/separator';
import type { GroupTeam, Player } from '@/lib/types';
import { Badge } from './ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';

interface TeamDetailDialogProps {
  team: GroupTeam;
  allGroupPlayers: Player[];
  children: React.ReactNode;
}

const TeamRosterPlayer = ({ player, number }: { player: Player; number: number }) => {
  return (
    <div className="flex items-center gap-4 rounded-lg p-2 hover:bg-muted">
        <Avatar className="h-12 w-12 border-2">
            <AvatarImage src={player.photoUrl} alt={player.name} />
            <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
            <p className="font-bold">{player.name}</p>
            <p className="text-sm text-muted-foreground">{player.position}</p>
        </div>
        <Badge className="text-lg font-bold">{number}</Badge>
    </div>
  );
};

export function TeamDetailDialog({ team, allGroupPlayers, children }: TeamDetailDialogProps) {
  
  const teamPlayersWithDetails = useMemo(() => {
    return team.members
      .map(member => {
        const playerDetails = allGroupPlayers.find(p => p.id === member.playerId);
        if (!playerDetails) return null;
        return {
          ...playerDetails,
          number: member.number,
        };
      })
      .filter((p): p is Player & { number: number } => p !== null);
  }, [team.members, allGroupPlayers]);

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 flex-shrink-0">
                <JerseyIcon {...team.jersey} />
            </div>
            <div>
                <DialogTitle className="text-2xl font-bold">{team.name}</DialogTitle>
                <DialogDescription>
                    Formación: {team.formation} | {team.members.length} miembros
                </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <Separator />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-grow overflow-hidden">
            <div className="flex flex-col gap-4">
                <h3 className="font-semibold text-center">Alineación Táctica</h3>
                <div className="p-4 bg-muted/30 rounded-lg flex-grow">
                    <TacticalBoard team={team} players={teamPlayersWithDetails} />
                </div>
            </div>
            <div className="flex flex-col gap-4">
                 <h3 className="font-semibold text-center">Plantel</h3>
                 <ScrollArea className="flex-grow border rounded-lg">
                    <div className="p-2 space-y-1">
                        {teamPlayersWithDetails.map(player => (
                            <TeamRosterPlayer key={player.id} player={player} number={player.number} />
                        ))}
                    </div>
                 </ScrollArea>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
