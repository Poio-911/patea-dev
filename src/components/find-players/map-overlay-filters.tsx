'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, SlidersHorizontal, ChevronDown, ChevronUp } from 'lucide-react';
import { PlayerFiltersBar } from './player-filters-bar';
import { AnimatePresence, motion } from 'framer-motion';
import type { DayOfWeek, TimeOfDay, PlayerPosition } from '@/lib/types';

type MapOverlayFiltersProps = {
  playerCount: number;
  locationLabel: string;
  positionFilter: PlayerPosition | 'all';
  onPositionChange: (v: PlayerPosition | 'all') => void;
  ovrRange: [number, number];
  onOvrChange: (v: [number, number]) => void;
  searchRadius: number;
  onRadiusChange: (v: number) => void;
  dayFilter: DayOfWeek[];
  onDayChange: (v: DayOfWeek[]) => void;
  timeFilter: TimeOfDay[];
  onTimeChange: (v: TimeOfDay[]) => void;
};

export function MapOverlayFilters({
  playerCount,
  locationLabel,
  positionFilter,
  onPositionChange,
  ovrRange,
  onOvrChange,
  searchRadius,
  onRadiusChange,
  dayFilter,
  onDayChange,
  timeFilter,
  onTimeChange,
}: MapOverlayFiltersProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="absolute top-3 left-3 right-3 z-20">
      <div className="bg-card/90 backdrop-blur-md rounded-2xl border shadow-lg overflow-hidden">
        {/* Always-visible header */}
        <button
          className="w-full flex items-center gap-2 px-3 py-2.5"
          onClick={() => setExpanded(!expanded)}
        >
          <Badge variant="secondary" className="text-xs font-bold shrink-0">
            {playerCount}
          </Badge>
          <span className="text-xs text-muted-foreground truncate flex-1 text-left">
            {locationLabel ? (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3 shrink-0" />
                {locationLabel}
              </span>
            ) : (
              'Jugadores encontrados'
            )}
          </span>
          <div className="flex items-center gap-1 text-muted-foreground shrink-0">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {expanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </div>
        </button>

        {/* Expandable filters */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-3 pb-3 border-t pt-2">
                <PlayerFiltersBar
                  positionFilter={positionFilter}
                  onPositionChange={onPositionChange}
                  ovrRange={ovrRange}
                  onOvrChange={onOvrChange}
                  searchRadius={searchRadius}
                  onRadiusChange={onRadiusChange}
                  dayFilter={dayFilter}
                  onDayChange={onDayChange}
                  timeFilter={timeFilter}
                  onTimeChange={onTimeChange}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
