'use client';

import { cn } from '@/lib/utils';

export type TimeFilter = 'today' | 'tomorrow' | 'this_week' | 'upcoming' | 'history';

interface QuickTimeFilterProps {
  activeFilter: TimeFilter;
  onFilterChange: (filter: TimeFilter) => void;
  counts?: Partial<Record<TimeFilter, number>>;
  className?: string;
}

const filterConfig: Array<{ id: TimeFilter; label: string }> = [
  { id: 'today', label: 'HOY' },
  { id: 'tomorrow', label: 'MAÑANA' },
  { id: 'this_week', label: 'ESTA SEMANA' },
  { id: 'upcoming', label: 'TODOS' },
  { id: 'history', label: 'HISTORIAL' },
];

export function QuickTimeFilter({
  activeFilter,
  onFilterChange,
  counts,
  className,
}: QuickTimeFilterProps) {
  return (
    <div className={cn('w-full', className)}>
      <nav
        className="flex gap-1 overflow-x-auto scrollbar-hide pb-1"
        role="tablist"
        aria-label="Filtro de tiempo"
      >
        {filterConfig.map((filter) => {
          const isActive = filter.id === activeFilter;
          const count = counts?.[filter.id];

          return (
            <button
              key={filter.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => onFilterChange(filter.id)}
              className={cn(
                'relative px-3 py-2 text-xs sm:text-sm font-bold uppercase tracking-wider transition-all duration-200 whitespace-nowrap',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <span className="flex items-center gap-1.5">
                {filter.label}
                {count !== undefined && count > 0 && (
                  <span
                    className={cn(
                      'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {count}
                  </span>
                )}
              </span>
              {/* Active indicator */}
              <span
                className={cn(
                  'absolute bottom-0 left-0 right-0 h-0.5 bg-primary transition-transform duration-200',
                  isActive ? 'scale-x-100' : 'scale-x-0'
                )}
              />
            </button>
          );
        })}
      </nav>
      <div className="h-px bg-border -mt-px" />
    </div>
  );
}
