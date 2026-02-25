'use client';

import { useState } from 'react';
import type { Match } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { InvitePlayerDialog } from './invite-player-dialog';
import { RecruitmentDialog } from './match-details/recruitment-dialog';
import { UserPlus, Users, Search } from 'lucide-react';

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
            Invitá a tus amigos o buscá jugadores libres en la zona.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <InvitePlayerDialog
              userMatches={[match]}
              match={match}
            >
              <Button size="sm" variant="outline" className="w-full sm:w-auto">
                <UserPlus className="mr-2 h-4 w-4" />
                Invitar Amigo
              </Button>
            </InvitePlayerDialog>

            <RecruitmentDialog match={match}>
              <Button size="sm" className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90">
                <Search className="mr-2 h-4 w-4" />
                Nos falta uno
              </Button>
            </RecruitmentDialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function UserSearch({ className }: { className?: string }) {
  return null;
}

