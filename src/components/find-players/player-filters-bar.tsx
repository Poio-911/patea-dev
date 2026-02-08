'use client';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Label } from '@/components/ui/label';
import { SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DayOfWeek, TimeOfDay, PlayerPosition } from '@/lib/types';

const positions: { id: PlayerPosition | 'all'; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'POR', label: 'POR' },
  { id: 'DEF', label: 'DEF' },
  { id: 'MED', label: 'MED' },
  { id: 'DEL', label: 'DEL' },
];

const days: { id: DayOfWeek; short: string }[] = [
  { id: 'lunes', short: 'Lun' },
  { id: 'martes', short: 'Mar' },
  { id: 'miercoles', short: 'Mie' },
  { id: 'jueves', short: 'Jue' },
  { id: 'viernes', short: 'Vie' },
  { id: 'sabado', short: 'Sáb' },
  { id: 'domingo', short: 'Dom' },
];

const timeSlots: { id: TimeOfDay; label: string }[] = [
  { id: 'mañana', label: 'Mañana' },
  { id: 'tarde', label: 'Tarde' },
  { id: 'noche', label: 'Noche' },
];

type PlayerFiltersBarProps = {
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

export function PlayerFiltersBar({
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
}: PlayerFiltersBarProps) {
  const posLabel = positionFilter === 'all' ? 'Posición' : positionFilter;
  const ovrLabel =
    ovrRange[0] === 40 && ovrRange[1] === 99
      ? 'OVR'
      : `${ovrRange[0]}-${ovrRange[1]}`;
  const radiusLabel = `${searchRadius} km`;

  const hasAvailFilters = dayFilter.length > 0 || timeFilter.length > 0;
  const availLabel = hasAvailFilters ? 'Disponibilidad*' : 'Disponibilidad';

  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
      {/* Position */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={positionFilter !== 'all' ? 'default' : 'outline'}
            size="sm"
            className="shrink-0 h-8 text-xs"
          >
            {posLabel}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-3" align="start">
          <Label className="text-xs font-medium">Posición</Label>
          <ToggleGroup
            type="single"
            value={positionFilter}
            onValueChange={(v) => v && onPositionChange(v as PlayerPosition | 'all')}
            className="flex flex-wrap gap-1 mt-2"
          >
            {positions.map((p) => (
              <ToggleGroupItem
                key={p.id}
                value={p.id}
                className="text-xs px-2.5 h-7"
              >
                {p.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </PopoverContent>
      </Popover>

      {/* OVR Range */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={ovrRange[0] !== 40 || ovrRange[1] !== 99 ? 'default' : 'outline'}
            size="sm"
            className="shrink-0 h-8 text-xs"
          >
            {ovrLabel}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-3" align="start">
          <Label className="text-xs font-medium">
            OVR: {ovrRange[0]} - {ovrRange[1]}
          </Label>
          <Slider
            value={ovrRange}
            onValueChange={(v) => onOvrChange(v as [number, number])}
            min={40}
            max={99}
            step={1}
            className="mt-3"
          />
        </PopoverContent>
      </Popover>

      {/* Radius */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="shrink-0 h-8 text-xs">
            {radiusLabel}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-3" align="start">
          <Label className="text-xs font-medium">Radio: {searchRadius} km</Label>
          <Slider
            value={[searchRadius]}
            onValueChange={(v) => onRadiusChange(v[0])}
            min={1}
            max={50}
            step={1}
            className="mt-3"
          />
        </PopoverContent>
      </Popover>

      {/* Availability */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={hasAvailFilters ? 'default' : 'outline'}
            size="sm"
            className="shrink-0 h-8 text-xs"
          >
            {availLabel}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3 space-y-3" align="start">
          <div>
            <Label className="text-xs font-medium">Días</Label>
            <ToggleGroup
              type="multiple"
              value={dayFilter}
              onValueChange={(v) => onDayChange(v as DayOfWeek[])}
              className="flex flex-wrap gap-1 mt-1.5"
            >
              {days.map((d) => (
                <ToggleGroupItem
                  key={d.id}
                  value={d.id}
                  className="text-[11px] px-2 h-7"
                >
                  {d.short}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <div>
            <Label className="text-xs font-medium">Horarios</Label>
            <ToggleGroup
              type="multiple"
              value={timeFilter}
              onValueChange={(v) => onTimeChange(v as TimeOfDay[])}
              className="flex gap-1 mt-1.5"
            >
              {timeSlots.map((t) => (
                <ToggleGroupItem
                  key={t.id}
                  value={t.id}
                  className="text-xs px-2.5 h-7 flex-1"
                >
                  {t.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
