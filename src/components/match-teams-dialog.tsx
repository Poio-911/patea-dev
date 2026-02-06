
'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { Match } from '@/lib/types';
import { TeamsMobileStacked } from '@/components/teams-mobile-stacked';


type MatchTeamsDialogProps = {
  match: Match;
  children: React.ReactNode;
};




export function MatchTeamsDialog({ match, children }: MatchTeamsDialogProps) {
  const teams = (match.teams || []).map(team => ({
    ...team,
    players: team.players.map(p => {
      const mp = match.players.find(mp => mp.uid === p.uid || mp.displayName === p.displayName);
      return { ...p, photoUrl: mp?.photoURL || (mp as any)?.photoUrl || (p as any).photoURL || (p as any).photoUrl || '' };
    }),
  }));

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{match.title}</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <TeamsMobileStacked teams={teams} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
