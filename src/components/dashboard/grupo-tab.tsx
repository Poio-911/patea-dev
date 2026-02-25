'use client';

import { useState } from 'react';
import { Shield, Newspaper, PlusCircle, LogIn, Users2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { GroupHeroCard } from '@/components/groups/group-hero-card';
import { GroupStatsCards } from '@/components/groups/group-stats-cards';
import { TeamList } from '@/components/team-builder/team-list';
import { UpcomingMatchesFeed } from '@/components/groups/upcoming-matches-feed';
import { FriendlyMatchCard } from '@/components/friendly-match-card';
import { GroupSummaryCard } from '@/components/group-summary-card';
import { CreateGroupDialog, JoinGroupDialog } from '@/components/groups/group-dialogs';
import type { Group, Player, Match } from '@/lib/types';

interface GrupoTabProps {
  activeGroup?: Group | null;
  groupPlayers: Player[];
  upcomingMatches: Match[];
  friendlyMatches: Match[];
  groupId?: string;
  userId?: string;
}

export function GrupoTab({
  activeGroup,
  groupPlayers,
  upcomingMatches,
  friendlyMatches,
  groupId,
  userId,
}: GrupoTabProps) {
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [joinGroupOpen, setJoinGroupOpen] = useState(false);

  if (!groupId || !activeGroup) {
    return (
      <div className="space-y-4">
        <Alert className="text-center py-10">
          <Users2 className="h-6 w-6 mx-auto mb-2" />
          <AlertTitle>No hay un grupo activo</AlertTitle>
          <AlertDescription>Creá un grupo o unite a uno para empezar.</AlertDescription>
        </Alert>
        <div className="flex items-center justify-center gap-2">
          <Button onClick={() => setJoinGroupOpen(true)} variant="outline">
            <LogIn className="mr-2 h-4 w-4" />
            Unirse a Grupo
          </Button>
          <Button onClick={() => setCreateGroupOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Crear Grupo
          </Button>
        </div>
        <CreateGroupDialog open={createGroupOpen} onOpenChange={setCreateGroupOpen}>
          <div />
        </CreateGroupDialog>
        <JoinGroupDialog open={joinGroupOpen} onOpenChange={setJoinGroupOpen}>
          <div />
        </JoinGroupDialog>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <GroupHeroCard group={activeGroup} compact={true} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Columna 1: Estadísticas */}
        <div className="lg:col-span-1 space-y-4 sm:space-y-6">
          <GroupStatsCards players={groupPlayers} />
        </div>

        {/* Columna 2: Equipos */}
        <div className="lg:col-span-1 space-y-4 sm:space-y-6">
          <Card className="border-border shadow-sm bg-card text-card-foreground">
            <CardHeader className="pb-3 px-4 pt-4">
              <CardTitle className="flex items-center gap-2 text-base uppercase tracking-wide text-primary font-bold">
                <Shield className="h-5 w-5" />
                Equipos
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <TeamList groupId={groupId} players={groupPlayers} currentUserId={userId || ''} compact={true} />
            </CardContent>
          </Card>
        </div>

        {/* Columna 3: Próximos Partidos */}
        <div className="lg:col-span-1 space-y-4 sm:space-y-6">
          <div className="space-y-4 sm:space-y-6">
            <Card className="border-border shadow-sm bg-card text-card-foreground">
              <CardHeader className="pb-3 px-4 pt-4">
                <CardTitle className="flex items-center gap-2 text-base uppercase tracking-wide text-primary font-bold">
                  <Newspaper className="h-5 w-5" />
                  Próximos Partidos
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <UpcomingMatchesFeed matches={upcomingMatches} compact={true} />
              </CardContent>
            </Card>
          </div>

          {friendlyMatches.length > 0 && (
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 font-headline text-lg uppercase tracking-wide text-primary font-bold">
                Partidos Amistosos
              </h3>
              <div className="space-y-4">
                {friendlyMatches.map(match => (
                  <FriendlyMatchCard key={match.id} match={match} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8">
        <GroupSummaryCard groupId={groupId} />
      </div>
    </div>
  );
}
