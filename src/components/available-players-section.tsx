'use client';

import { useState } from 'react';
import type { Match } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { InvitePlayerDialog } from './invite-player-dialog';
import { UserPlus, Users } from 'lucide-react';

interface AvailablePlayersSectionProps {
  match: Match;
  isOwner: boolean;
}

export function AvailablePlayersSection({ match, isOwner }: AvailablePlayersSectionProps) {
  if (!isOwner) return null;

  const spotsLeft = match.matchSize - (match.players?.length || 0);

  return (
    <Card className="overflow-hidden border-primary/20 shadow-sm">
      <CardHeader className="bg-muted/30 pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-primary/10">
            <Users className="h-4 w-4 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">Invitar Jugadores</CardTitle>
            <CardDescription className="text-xs">
              Faltan {spotsLeft} jugadores para completar el partido.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        <div className="flex flex-col items-center justify-center p-4 text-center gap-3">
          <p className="text-sm text-muted-foreground">
            Invitá a tus amigos o compañeros de grupo directamente.
          </p>
          <InvitePlayerDialog
            userMatches={[match]}
            match={match}
          >
            <Button size="sm" className="w-full sm:w-auto">
              <UserPlus className="mr-2 h-4 w-4" />
              Invitar Jugador
            </Button>
          </InvitePlayerDialog>
        </div>
      </CardContent>
    </Card>
  );
}

function UserSearch({ className }: { className?: string }) {
  return null;
}

