'use client';

import { Trophy, BarChart3, Swords } from 'lucide-react';
import { cn } from '@/lib/utils';

type SectionBannerProps = {
  type: 'cup' | 'league' | 'friendly';
  title: string;
  subtitle: string;
  action?: React.ReactNode;
};

const bannerConfig = {
  cup: {
    icon: Trophy,
    bannerClass: 'fifa-banner-cup',
    iconClass: 'fifa-cup-icon fifa-cup-icon-animated',
    accentColor: 'text-warning',
  },
  league: {
    icon: BarChart3,
    bannerClass: 'fifa-banner-league',
    iconClass: 'fifa-league-icon fifa-league-icon-animated',
    accentColor: 'text-primary',
  },
  friendly: {
    icon: Swords,
    bannerClass: 'fifa-banner-friendly',
    iconClass: 'fifa-friendly-icon fifa-friendly-icon-animated',
    accentColor: 'text-success',
  },
};

export function SectionBanner({ type, title, subtitle, action }: SectionBannerProps) {
  const config = bannerConfig[type];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'relative rounded-xl p-4 md:p-6 overflow-hidden hidden md:block',
        config.bannerClass
      )}
    >
      {/* Pattern overlay */}
      <div className="absolute inset-0 fifa-banner-pattern pointer-events-none" />

      {/* Content */}
      <div className="relative flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={cn('p-3 rounded-xl bg-background/50 backdrop-blur-sm')}>
            <Icon className={cn('h-6 w-6 md:h-8 md:w-8', config.iconClass)} />
          </div>
          <div>
            <h2 className={cn('text-xl md:text-2xl font-bold uppercase tracking-tight', config.accentColor)}>
              {title}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {subtitle}
            </p>
          </div>
        </div>
        {action && <div>{action}</div>}
      </div>
    </div>
  );
}
