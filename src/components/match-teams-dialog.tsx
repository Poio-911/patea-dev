
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
  const teams = match.teams || [];

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
