
'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { Match, Player } from '@/lib/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, Clock, MapPin, Users, Info } from 'lucide-react';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { ScrollArea } from './ui/scroll-area';

interface MatchDetailsDialogProps {
  match: Match;
  allPlayers: Player[]; // We might need this later if we add more functionality
  children: React.ReactNode;
}

const statusConfig: Record<Match['status'], { label: string; className: string }> = {
    upcoming: { label: 'Próximo', className: 'bg-blue-100 text-blue-800' },
    active: { label: 'Activo', className: 'bg-green-100 text-green-800' },
    completed: { label: 'Finalizado', className: 'bg-gray-100 text-gray-800' },
    evaluated: { label: 'Evaluado', className: 'bg-purple-100 text-purple-800' },
};

export function MatchDetailsDialog({ match, children }: MatchDetailsDialogProps) {

  const statusInfo = statusConfig[match.status];

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">{match.title}</DialogTitle>
          <DialogDescription>Detalles completos del partido.</DialogDescription>
        </DialogHeader>
        <div className="flex-grow overflow-y-auto -mx-6 px-6 py-4 border-t">
            <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                        <Calendar className="h-5 w-5 text-primary" />
                        <span className="font-medium">{format(new Date(match.date), "EEEE, d 'de' MMMM", { locale: es })}</span>
                    </div>
                     <div className="flex items-center gap-3">
                        <Clock className="h-5 w-5 text-primary" />
                        <span className="font-medium">{match.time} hs</span>
                    </div>
                     <div className="flex items-center gap-3 sm:col-span-2">
                        <MapPin className="h-5 w-5 text-primary" />
                        <span className="font-medium">{match.location.address}</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-3 p-3 rounded-lg border">
                        <Users className="h-5 w-5 text-muted-foreground"/>
                        <div>
                            <p className="text-sm text-muted-foreground">Plazas</p>
                            <p className="font-bold">{match.players.length} / {match.matchSize}</p>
                        </div>
                    </div>
                     <div className="flex items-center gap-3 p-3 rounded-lg border">
                        <Info className="h-5 w-5 text-muted-foreground"/>
                        <div>
                            <p className="text-sm text-muted-foreground">Estado</p>
                             <Badge variant="outline" className={statusInfo.className}>{statusInfo.label}</Badge>
                        </div>
                    </div>
                </div>

                <Separator />

                <div>
                    <h3 className="font-semibold mb-3">Jugadores Apuntados</h3>
                    <ScrollArea className="h-48">
                        <div className="space-y-2 pr-4">
                            {match.players.length > 0 ? match.players.map(player => (
                                <div key={player.uid} className="flex items-center justify-between p-2 rounded-md bg-background">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={player.photoUrl} alt={player.displayName} />
                                            <AvatarFallback>{player.displayName.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <span className="font-medium text-sm">{player.displayName}</span>
                                    </div>
                                    <Badge variant="secondary">{player.ovr}</Badge>
                                </div>
                            )) : (
                                <p className="text-sm text-muted-foreground text-center py-8">
                                    Aún no hay jugadores apuntados a este partido.
                                </p>
                            )}
                        </div>
                    </ScrollArea>
                </div>

            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

