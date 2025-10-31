'use client';

import { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription
} from '@/components/ui/dialog';
import { Button } from './ui/button';
import type { Match } from '@/lib/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, Clock, MapPin, Users } from 'lucide-react';
import { useUser } from '@/firebase';

interface MatchDetailsDialogProps {
  match: Match;
  children: React.ReactNode;
}

export function MatchDetailsDialog({ match, children }: MatchDetailsDialogProps) {
  const { user } = useUser();

  const isUserInMatch = useMemo(() => {
    if (!user) return false;
    return match.playerUids.includes(user.uid);
  }, [match.playerUids, user]);
  
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{match.title}</DialogTitle>
          <DialogDescription>
            Detalles del partido.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>{format(new Date(match.date), "EEEE, d 'de' MMMM", { locale: es })}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{match.time} hs</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span>{match.location.name}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{match.players.length} / {match.matchSize} jugadores</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
