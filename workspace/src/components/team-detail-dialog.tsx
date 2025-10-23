
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
import { Separator } from '@/components/ui/separator';
import type { GroupTeam, Player, DetailedTeamPlayer } from '@/lib/types';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Users } from 'lucide-react';
import { JerseyPreview } from '@/components/team-builder/jersey-preview';
import { TeamRosterPlayer } from '@/components/team-roster-player';


interface TeamDetailDialogProps {
  team: GroupTeam;
  allGroupPlayers: Player[];
  children: React.ReactNode;
}

export function TeamDetailDialog({ team, allGroupPlayers, children }: TeamDetailDialogProps) {
  
  const teamPlayersWithDetails = useMemo(() => {
    const teamPlayerIds = team.members ? team.members.map(m => m.playerId) : [];

    return teamPlayerIds
      .map((playerId: string) => {
        const playerDetails = allGroupPlayers.find((p: Player) => p.id === playerId);
        if (!playerDetails) return null;

        const memberInfo = team.members.find(m => m.playerId === playerId);
        
        return {
          ...playerDetails,
          number: memberInfo ? memberInfo.number : 0,
          status: memberInfo ? memberInfo.status : 'suplente',
        };
      })
      .filter((p: DetailedTeamPlayer | null): p is DetailedTeamPlayer => p !== null)
      .sort((a: DetailedTeamPlayer, b: DetailedTeamPlayer) => a.number - b.number);
  }, [team, allGroupPlayers]);

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 flex-shrink-0">
                <JerseyPreview jersey={team.jersey} />
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
                <div>
                    <h3 className="font-bold text-xl mb-3 flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary"/>
                        Plantel ({teamPlayersWithDetails.length})
                    </h3>
                    <div className="space-y-1">
                        {teamPlayersWithDetails.map((player: DetailedTeamPlayer) => (
                            <TeamRosterPlayer key={player.id} player={player} team={team} onPlayerUpdate={() => {}} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
