'use client';

import { useState } from 'react';
import { Filter, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { PlayerPosition } from '@/lib/types';
import { Slider } from '@/components/ui/slider';

export type PlayerFilters = {
    positions?: PlayerPosition[];
    ovrRange?: [number, number];
};

const positionLabels: Record<PlayerPosition, string> = {
    POR: 'Portero',
    DEF: 'Defensa',
    MED: 'Mediocampista',
    DEL: 'Delantero',
};

interface PlayerFiltersProps {
    filters: PlayerFilters;
    onFiltersChange: (filters: PlayerFilters) => void;
    className?: string;
}

export function PlayerFiltersComponent({ filters, onFiltersChange, className }: PlayerFiltersProps) {
    const [open, setOpen] = useState(false);

    const activeFilterCount =
        (filters.positions?.length || 0) +
        (filters.ovrRange && (filters.ovrRange[0] !== 40 || filters.ovrRange[1] !== 99) ? 1 : 0);

    const handlePositionToggle = (position: PlayerPosition) => {
        const currentPositions = filters.positions || [];
        const newPositions = currentPositions.includes(position)
            ? currentPositions.filter(p => p !== position)
            : [...currentPositions, position];
        onFiltersChange({ ...filters, positions: newPositions });
    };

    const handleOvrRangeChange = (range: number[]) => {
        onFiltersChange({ ...filters, ovrRange: [range[0], range[1]] });
    };

    const clearFilters = () => {
        onFiltersChange({ positions: [], ovrRange: [40, 99] });
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className={cn('gap-2', className)}
                >
                    <Filter className="h-4 w-4" />
                    Filtros
                    {activeFilterCount > 0 && (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                            {activeFilterCount}
                        </span>
                    )}
                    <ChevronDown className="h-4 w-4" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72" align="start">
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="font-medium">Filtros</h4>
                        {activeFilterCount > 0 && (
                            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground">
                                Limpiar
                            </Button>
                        )}
                    </div>

                    {/* Posición */}
                    <div className="space-y-2">
                        <Label className="text-sm font-medium">Por posición</Label>
                        <div className="grid grid-cols-2 gap-2">
                            {(Object.keys(positionLabels) as PlayerPosition[]).map(position => (
                                <label
                                    key={position}
                                    className="flex items-center gap-2 text-sm cursor-pointer"
                                >
                                    <Checkbox
                                        checked={filters.positions?.includes(position) || false}
                                        onCheckedChange={() => handlePositionToggle(position)}
                                    />
                                    {positionLabels[position]}
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Rango de OVR */}
                    <div className="space-y-3">
                        <Label className="text-sm font-medium">Rango de OVR</Label>
                        <div className="px-2">
                            <Slider
                                min={40}
                                max={99}
                                step={1}
                                value={filters.ovrRange || [40, 99]}
                                onValueChange={handleOvrRangeChange}
                                className="w-full"
                            />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{filters.ovrRange?.[0] || 40}</span>
                            <span>{filters.ovrRange?.[1] || 99}</span>
                        </div>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
