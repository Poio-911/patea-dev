
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
import { JerseyIcon } from './jerseys';
import { Separator } from './ui/separator';
import type { GroupTeam, Player } from '@/lib/types';
import { Badge } from './ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { Cone, Users, Shirt } from 'lucide-react';

interface TeamDetailDialogProps {
  team: GroupTeam;
  allGroupPlayers: Player[];
  children: React.ReactNode;
}

const TeamRosterPlayer = ({ player, number, jersey }: { player: Player; number: number; jersey: GroupTeam['jersey'] }) => {
  return (
    <div className="flex items-center gap-4 rounded-lg p-2 hover:bg-muted">
        <div className="h-14 w-14 flex-shrink-0">
            <JerseyIcon {...jersey} number={number} />
        </div>
        <div className="flex-1">
            <p className="font-bold">{player.name}</p>
            <p className="text-sm text-muted-foreground">{player.position}</p>
        </div>
        <Badge variant="secondary" className="text-lg font-bold">{player.ovr}</Badge>
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
      .filter((p): p is Player & { number: number } => p !== null)
      .sort((a, b) => a.number - b.number);
  }, [team.members, allGroupPlayers]);

  const formationPlayerCount = useMemo(() => {
    // Simple logic for now, assumes standard 11-a-side logic.
    // Can be expanded later.
    return 11;
  }, [team.formation]);

  const titulares = teamPlayersWithDetails.slice(0, formationPlayerCount);
  const suplentes = teamPlayersWithDetails.slice(formationPlayerCount);


  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 flex-shrink-0">
                <JerseyIcon {...team.jersey} />
            </div>
            <div>
                <DialogTitle className="text-2xl font-bold">{team.name}</DialogTitle>
                <DialogDescription>
                    {team.members.length} miembros
                </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <Separator />
        
        <div className="flex-grow overflow-y-auto -mx-6 px-6">
            <div className="space-y-6">
                <div className="flex items-center gap-4 text-lg">
                    <Cone className="h-6 w-6 text-primary"/>
                    <span className="font-semibold">Formación:</span>
                    <Badge variant="secondary" className="text-lg">{team.formation}</Badge>
                </div>
                
                <Separator />
                
                <div>
                    <h3 className="font-bold text-xl mb-3 flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary"/>
                        Plantel ({teamPlayersWithDetails.length})
                    </h3>
                    <div className="space-y-1">
                        {teamPlayersWithDetails.map(player => (
                            <TeamRosterPlayer key={player.id} player={player} number={player.number} jersey={team.jersey} />
                        ))}
                    </div>
                </div>
            </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}
