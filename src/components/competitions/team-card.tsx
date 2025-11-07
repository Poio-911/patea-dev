'use client';

import type { GroupTeam, Player } from '@/lib/types';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { JerseyPreview } from '@/components/team-builder/jersey-preview';
import { Users, Swords } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface TeamCardProps {
  team: GroupTeam;
  players: Player[];
}

export function TeamCard({ team, players }: TeamCardProps) {
  const memberCount = team.members?.length || 0;

  return (
    <Link href={`/competitions/find-opponent/${team.id}`} passHref>
        <Card className="overflow-hidden h-full flex flex-col hover:shadow-lg transition-shadow duration-300 group cursor-pointer">
            {/* ✅ CORRECCIÓN: Contenedor relativo y z-index para el texto */}
            <CardContent className="relative flex-grow flex items-center p-3 gap-3 text-center overflow-hidden">
                <div className="absolute inset-0 -z-10 opacity-20 dark:opacity-30">
                    <JerseyPreview jersey={team.jersey} size="lg" className="w-full h-full scale-150" />
                </div>
                 <div className="relative z-10 flex-1 text-left overflow-hidden pl-2">
                   <div className="absolute inset-0 bg-gradient-to-r from-card via-card/80 to-transparent pointer-events-none" />
                    <div className="relative z-10">
                        <h3 className="text-sm sm:text-base font-bold truncate pr-2">{team.name}</h3>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Users className="h-3 w-3"/>
                            <span>{memberCount} Jugadores</span>
                        </div>
                    </div>
                </div>
            </CardContent>
            <CardFooter className="p-0 border-t bg-card">
                <div className={cn(
                    "w-full text-center font-semibold text-sm py-2 group-hover:bg-primary group-hover:text-primary-foreground transition-colors",
                    "flex items-center justify-center gap-2 text-primary"
                )}>
                    <Swords className="h-4 w-4" />
                    Buscar Rival
                </div>
            </CardFooter>
        </Card>
    </Link>
  );
}
