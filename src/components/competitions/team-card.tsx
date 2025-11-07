
'use client';

import type { GroupTeam, Player } from '@/lib/types';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { JerseyPreview } from '@/components/team-builder/jersey-preview';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Swords } from 'lucide-react';
import Link from 'next/link';

interface TeamCardProps {
  team: GroupTeam;
  players: Player[];
}

export function TeamCard({ team, players }: TeamCardProps) {
  const memberCount = team.members?.length || 0;

  return (
    <Card className="overflow-hidden h-full flex flex-col hover:bg-muted/50 transition-colors">
        <CardContent className="flex-grow flex flex-col items-center p-4 gap-3">
            <div className="w-24 h-24 mx-auto">
                <JerseyPreview jersey={team.jersey} size="lg" />
            </div>
            <h3 className="text-base font-bold text-center truncate w-full">{team.name}</h3>
            <div className="flex items-center -space-x-3">
                {players.slice(0, 5).map(player => (
                    <Avatar key={player.id} className="h-8 w-8 border-2 border-background">
                        <AvatarImage src={player.photoUrl} alt={player.name} />
                        <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                ))}
                {players.length > 5 && (
                     <Avatar className="h-8 w-8 border-2 border-background">
                        <AvatarFallback>+{players.length - 5}</AvatarFallback>
                    </Avatar>
                )}
            </div>
            <p className="text-xs text-muted-foreground">{memberCount} Jugadores</p>
        </CardContent>
        <CardFooter className="p-2 border-t bg-card">
            <Button asChild className="w-full" size="sm">
                <Link href={`/competitions/find-opponent/${team.id}`}>
                    <Swords className="mr-2 h-4 w-4" />
                    Buscar Rival
                </Link>
            </Button>
        </CardFooter>
    </Card>
  );
}
