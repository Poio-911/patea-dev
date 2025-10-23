
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
import { Separator } from './ui/separator';
import type { GroupTeam, Player } from '@/lib/types';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { Users } from 'lucide-react';
import { JerseyPreview } from './team-builder/jersey-preview';
import { TeamRosterPlayer } from './team-roster-player';
import type { DetailedTeamPlayer } from './team-roster-player';


interface TeamDetailDialogProps {
  team: GroupTeam;
  allGroupPlayers: Player[];
  children: React.ReactNode;
}

export function TeamDetailDialog({ team, allGroupPlayers, children }: TeamDetailDialogProps) {
  
  const teamPlayersWithDetails = useMemo(() => {
    // Defensive coding: Check for `team.members` and fallback to `team.playerIds` (old structure)
    const teamPlayerIds = team.members ? team.members.map(m => m.playerId) : (team as any).playerIds || [];

    return teamPlayerIds
      .map((playerId: string, index: number) => {
        const playerDetails = allGroupPlayers.find(p => p.id === playerId);
        if (!playerDetails) return null;

        const memberInfo = team.members ? team.members.find(m => m.playerId === playerId) : null;
        
        return {
          ...playerDetails,
          number: memberInfo ? memberInfo.number : index + 1, // Fallback to index if number not present
        };
      })
      .filter((p: (Player & { number: number; }) | null): p is Player & { number: number } => p !== null)
      .sort((a: Player & { number: number }, b: Player & { number: number }) => a.number - b.number);
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
                            <TeamRosterPlayer key={player.id} player={player} number={player.number} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
