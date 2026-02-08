'use client';

import { useEffect, useRef } from 'react';
import type { AvailablePlayer, Match } from '@/lib/types';
import { PlayerFlipCard } from './player-flip-card';
import { InvitePlayerDialog } from '@/components/invite-player-dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

import { Skeleton } from '@/components/ui/skeleton';

type PlayerSidebarListProps = {
    players: AvailablePlayer[];
    distanceMap: Map<string, number>;
    activePlayerId: string | null;
    onActiveChange: (uid: string | null) => void;
    userMatches: Match[];
    isLoading?: boolean;
};

export function PlayerSidebarList({
    players,
    distanceMap,
    activePlayerId,
    onActiveChange,
    userMatches,
    isLoading
}: PlayerSidebarListProps) {
    const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

    // Scroll to active player when it changes (e.g. from map click)
    useEffect(() => {
        if (activePlayerId) {
            const element = itemRefs.current.get(activePlayerId);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, [activePlayerId]);

    return (
        <div className="h-full w-full bg-background/95 backdrop-blur border-r shadow-xl flex flex-col">
            <div className="p-4 border-b">
                <h2 className="font-bold text-lg">Jugadores cerca</h2>
                <p className="text-sm text-muted-foreground">
                    {isLoading ? 'Buscanado...' : `${players.length} encontrados en tu zona`}
                </p>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-4 space-y-4 pb-24">
                    {isLoading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="flex gap-3 p-3 border rounded-xl">
                                <Skeleton className="h-10 w-10 rounded-full" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-4 w-24" />
                                    <Skeleton className="h-3 w-16" />
                                </div>
                            </div>
                        ))
                    ) : (
                        players.map((player) => (
                            // ... existing map logic ...
                            <div
                                key={player.uid}
                                ref={(el) => {
                                    if (el) itemRefs.current.set(player.uid, el);
                                    else itemRefs.current.delete(player.uid);
                                }}
                                className="flex justify-center"
                                onMouseEnter={() => onActiveChange(player.uid)}
                            >
                                <PlayerFlipCard
                                    player={player}
                                    distanceKm={distanceMap.get(player.uid) ?? Infinity}
                                    isActive={activePlayerId === player.uid}
                                    actionSlot={
                                        userMatches && userMatches.length > 0 ? (
                                            <InvitePlayerDialog
                                                playerToInvite={player}
                                                userMatches={userMatches}
                                            >
                                                <Button size="sm" className="w-full h-8 text-xs">
                                                    Invitar a partido
                                                </Button>
                                            </InvitePlayerDialog>
                                        ) : null
                                    }
                                />
                            </div>
                        ))
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}
