'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Users2, Trophy, Award } from 'lucide-react';

export type MatchCategory = 'amistosos' | 'ligas' | 'copas';

interface CategoryPillNavProps {
  categories: Array<{
    id: MatchCategory;
    label: string;
    count: number;
  }>;
  activeCategory: MatchCategory;
  onCategoryChange: (id: MatchCategory) => void;
  className?: string;
}

const categoryIcons: Record<MatchCategory, React.ReactNode> = {
  amistosos: <Users2 className="h-4 w-4" />,
  ligas: <Trophy className="h-4 w-4" />,
  copas: <Award className="h-4 w-4" />,
};

export function CategoryPillNav({
  categories,
  activeCategory,
  onCategoryChange,
  className,
}: CategoryPillNavProps) {
  return (
    <div className={cn('w-full', className)}>
      <nav
        className="flex gap-2 overflow-x-auto scrollbar-hide pb-1"
        role="tablist"
        aria-label="Categorías de partidos"
      >
        {categories.map((category) => {
          const isActive = category.id === activeCategory;
          return (
            <button
              key={category.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${category.id}`}
              onClick={() => onCategoryChange(category.id)}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2.5 rounded-full font-bold text-sm uppercase tracking-wide transition-all duration-200 whitespace-nowrap',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-lg pill-active-glow'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {categoryIcons[category.id]}
              <span className="hidden sm:inline">{category.label}</span>
              <span
                className={cn(
                  'inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full text-xs font-bold',
                  isActive
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : 'bg-background text-foreground'
                )}
              >
                {category.count}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
