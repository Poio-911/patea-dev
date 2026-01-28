'use client';

import { useState } from 'react';
import { Filter, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { MatchType, MatchStatus, MatchFilters as MatchFiltersType } from '@/lib/types';

const matchTypeLabels: Record<MatchType, string> = {
  manual: 'Manual',
  collaborative: 'Colaborativo',
  by_teams: 'Por Equipos',
  intergroup_friendly: 'Inter-grupos',
  league: 'Liga',
  cup: 'Copa',
  league_final: 'Final',
};

const matchStatusLabels: Record<MatchStatus, string> = {
  upcoming: 'Proximo',
  active: 'Activo',
  completed: 'Finalizado',
  evaluated: 'Evaluado',
};

// Tipos de amistosos (los que se muestran en esta pagina)
const amistososTypes: MatchType[] = ['manual', 'collaborative', 'by_teams', 'intergroup_friendly'];

interface MatchFiltersProps {
  filters: MatchFiltersType;
  onFiltersChange: (filters: MatchFiltersType) => void;
  className?: string;
}

export function MatchFilters({ filters, onFiltersChange, className }: MatchFiltersProps) {
  const [open, setOpen] = useState(false);

  const activeFilterCount =
    (filters.types?.length || 0) +
    (filters.statuses?.length || 0) +
    (filters.onlyMine ? 1 : 0);

  const handleTypeToggle = (type: MatchType) => {
    const currentTypes = filters.types || [];
    const newTypes = currentTypes.includes(type)
      ? currentTypes.filter(t => t !== type)
      : [...currentTypes, type];
    onFiltersChange({ ...filters, types: newTypes });
  };

  const handleStatusToggle = (status: MatchStatus) => {
    const currentStatuses = filters.statuses || [];
    const newStatuses = currentStatuses.includes(status)
      ? currentStatuses.filter(s => s !== status)
      : [...currentStatuses, status];
    onFiltersChange({ ...filters, statuses: newStatuses });
  };

  const handleOnlyMineToggle = (checked: boolean) => {
    onFiltersChange({ ...filters, onlyMine: checked });
  };

  const clearFilters = () => {
    onFiltersChange({ types: [], statuses: [], onlyMine: false });
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

          {/* Tipo de partido */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Por tipo</Label>
            <div className="grid grid-cols-2 gap-2">
              {amistososTypes.map(type => (
                <label
                  key={type}
                  className="flex items-center gap-2 text-sm cursor-pointer"
                >
                  <Checkbox
                    checked={filters.types?.includes(type) || false}
                    onCheckedChange={() => handleTypeToggle(type)}
                  />
                  {matchTypeLabels[type]}
                </label>
              ))}
            </div>
          </div>

          {/* Estado */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Por estado</Label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(matchStatusLabels) as MatchStatus[]).map(status => (
                <label
                  key={status}
                  className="flex items-center gap-2 text-sm cursor-pointer"
                >
                  <Checkbox
                    checked={filters.statuses?.includes(status) || false}
                    onCheckedChange={() => handleStatusToggle(status)}
                  />
                  {matchStatusLabels[status]}
                </label>
              ))}
            </div>
          </div>

          {/* Solo mis partidos */}
          <div className="flex items-center justify-between pt-2 border-t">
            <Label htmlFor="only-mine" className="text-sm font-medium cursor-pointer">
              Solo mis partidos
            </Label>
            <Switch
              id="only-mine"
              checked={filters.onlyMine || false}
              onCheckedChange={handleOnlyMineToggle}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
