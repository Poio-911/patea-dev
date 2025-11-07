
'use client';

import type { GroupTeam, Player } from '@/lib/types';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { JerseyPreview } from '@/components/team-builder/jersey-preview';
import { Users, Swords } from 'lucide-react';
import Link from 'next/link';

interface TeamCardProps {
  team: GroupTeam;
  players: Player[];
}

export function TeamCard({ team, players }: TeamCardProps) {
  const memberCount = team.members?.length || 0;

  return (
    <Link href={`/competitions/find-opponent/${team.id}`} passHref>
        <Card className="overflow-hidden h-full flex flex-col hover:bg-muted/50 transition-colors cursor-pointer group">
            <CardContent className="flex-grow flex flex-col items-center p-3 sm:p-4 gap-3 text-center">
                <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto">
                    <JerseyPreview jersey={team.jersey} size="lg" />
                </div>
                <div className="flex flex-col items-center">
                    <h3 className="text-sm sm:text-base font-bold truncate w-28 sm:w-32">{team.name}</h3>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="h-3 w-3"/>
                        <span>{memberCount} Jugadores</span>
                    </div>
                </div>
            </CardContent>
            <CardFooter className="p-0 border-t bg-card">
                <div className="w-full text-center text-primary font-semibold text-sm py-2 group-hover:bg-primary group-hover:text-primary-foreground transition-colors flex items-center justify-center gap-2">
                    <Swords className="h-4 w-4" />
                    Buscar Rival
                </div>
            </CardFooter>
        </Card>
    </Link>
  );
}
