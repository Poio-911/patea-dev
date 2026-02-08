'use client';

import { useEffect, useCallback } from 'react';
import type { AvailablePlayer, Match } from '@/lib/types';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel';
import { PlayerCarouselCard } from './player-carousel-card';
import { InvitePlayerDialog } from '@/components/invite-player-dialog';
import { Button } from '@/components/ui/button';

type PlayerMapCarouselProps = {
  players: AvailablePlayer[];
  distanceMap: Map<string, number>;
  activePlayerId: string | null;
  onActiveChange: (uid: string | null) => void;
  userMatches: Match[];
  api: CarouselApi | undefined;
  setApi: (api: CarouselApi) => void;
};

export function PlayerMapCarousel({
  players,
  distanceMap,
  activePlayerId,
  onActiveChange,
  userMatches,
  api,
  setApi,
}: PlayerMapCarouselProps) {
  // Carousel → Map: when the user scrolls/swipes to a new card
  useEffect(() => {
    if (!api) return;

    const onSelect = () => {
      const index = api.selectedScrollSnap();
      const player = players[index];
      if (player) {
        onActiveChange(player.uid);
      }
    };

    api.on('select', onSelect);
    return () => {
      api.off('select', onSelect);
    };
  }, [api, players, onActiveChange]);

  // Map → Carousel: when a marker is tapped, scroll carousel to that card
  useEffect(() => {
    if (!api || !activePlayerId) return;
    const index = players.findIndex((p) => p.uid === activePlayerId);
    if (index >= 0 && index !== api.selectedScrollSnap()) {
      api.scrollTo(index);
    }
  }, [api, activePlayerId, players]);

  return (
    <Carousel
      setApi={setApi}
      opts={{
        align: 'center',
        loop: false,
        dragFree: false,
      }}
      className="w-full"
    >
      <CarouselContent className="px-4 pb-4">
        {players.map((player) => (
          <CarouselItem key={player.uid} className="basis-auto pl-3">
            <PlayerCarouselCard
              player={player}
              distanceKm={distanceMap.get(player.uid) ?? Infinity}
              isActive={activePlayerId === player.uid}
              onSelect={onActiveChange}
              actionSlot={
                userMatches && userMatches.length > 0 ? (
                  <InvitePlayerDialog
                    playerToInvite={player}
                    userMatches={userMatches}
                  >
                    <Button size="sm" className="w-full h-8 text-xs">
                      Invitar
                    </Button>
                  </InvitePlayerDialog>
                ) : null
              }
            />
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  );
}
