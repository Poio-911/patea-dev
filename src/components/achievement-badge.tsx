'use client';

import { cn } from '@/lib/utils';
import type { Achievement } from '@/lib/types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { motion } from 'framer-motion';
import {
  Target,
  Trophy,
  Flame,
  Crown,
  Play,
  Calendar,
  Award,
  Medal,
  Star,
  TrendingUp,
  Zap,
  Gem,
  UserPlus,
  Users,
  ClipboardList,
  Lock,
  type LucideIcon,
} from 'lucide-react';

// Map icon names to Lucide components
const iconMap: Record<string, LucideIcon> = {
  target: Target,
  trophy: Trophy,
  flame: Flame,
  crown: Crown,
  play: Play,
  calendar: Calendar,
  award: Award,
  medal: Medal,
  star: Star,
  'trending-up': TrendingUp,
  zap: Zap,
  gem: Gem,
  'user-plus': UserPlus,
  users: Users,
  'clipboard-list': ClipboardList,
};

type AchievementBadgeProps = {
  achievement: Achievement;
  unlocked: boolean;
  unlockedAt?: string;
  current?: number;
  showProgress?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
};

export function AchievementBadge({
  achievement,
  unlocked,
  unlockedAt,
  current = 0,
  showProgress = false,
  size = 'md',
  onClick,
}: AchievementBadgeProps) {
  const IconComponent = iconMap[achievement.icon] || Trophy;
  const progressPercent = Math.min(100, (current / achievement.requirement.count) * 100);

  const sizeClasses = {
    sm: 'h-10 w-10',
    md: 'h-14 w-14',
    lg: 'h-20 w-20',
  };

  const iconSizes = {
    sm: 'h-5 w-5',
    md: 'h-7 w-7',
    lg: 'h-10 w-10',
  };

  const categoryColors: Record<Achievement['category'], string> = {
    performance: 'from-orange-500 to-red-500',
    milestones: 'from-blue-500 to-cyan-500',
    competition: 'from-yellow-500 to-amber-500',
    social: 'from-purple-500 to-pink-500',
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.div
            className={cn(
              'relative flex flex-col items-center gap-1 cursor-pointer',
              onClick && 'hover:scale-105 transition-transform'
            )}
            onClick={onClick}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {/* Badge circle */}
            <div
              className={cn(
                'rounded-full flex items-center justify-center border-2 transition-all',
                sizeClasses[size],
                unlocked
                  ? cn(
                      'bg-gradient-to-br border-transparent shadow-lg',
                      categoryColors[achievement.category]
                    )
                  : 'bg-muted border-muted-foreground/20 grayscale opacity-50'
              )}
            >
              {unlocked ? (
                <IconComponent
                  className={cn(iconSizes[size], 'text-white drop-shadow-md')}
                />
              ) : (
                <Lock className={cn(iconSizes[size], 'text-muted-foreground')} />
              )}
            </div>

            {/* Progress bar (optional) */}
            {showProgress && !unlocked && (
              <div className="w-full max-w-[80px]">
                <Progress value={progressPercent} className="h-1" />
                <p className="text-[10px] text-muted-foreground text-center mt-0.5">
                  {current}/{achievement.requirement.count}
                </p>
              </div>
            )}

            {/* Name (on larger sizes) */}
            {size !== 'sm' && (
              <p
                className={cn(
                  'text-xs font-medium text-center line-clamp-1 max-w-[80px]',
                  unlocked ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                {achievement.name}
              </p>
            )}
          </motion.div>
        </TooltipTrigger>

        <TooltipContent side="top" className="max-w-[200px]">
          <div className="space-y-1">
            <p className="font-semibold">{achievement.name}</p>
            <p className="text-xs text-muted-foreground">{achievement.description}</p>
            {unlocked && unlockedAt && (
              <p className="text-xs text-primary">
                Desbloqueado el {new Date(unlockedAt).toLocaleDateString('es-AR')}
              </p>
            )}
            {!unlocked && (
              <p className="text-xs text-muted-foreground">
                Progreso: {current}/{achievement.requirement.count}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Grid of multiple badges
type AchievementGridProps = {
  achievements: {
    achievement: Achievement;
    unlocked: boolean;
    unlockedAt?: string;
    current: number;
  }[];
  showProgress?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

export function AchievementGrid({
  achievements,
  showProgress = true,
  size = 'md',
  className,
}: AchievementGridProps) {
  return (
    <div
      className={cn(
        'grid gap-4',
        size === 'sm' ? 'grid-cols-6' : size === 'md' ? 'grid-cols-4' : 'grid-cols-3',
        className
      )}
    >
      {achievements.map(({ achievement, unlocked, unlockedAt, current }) => (
        <AchievementBadge
          key={achievement.id}
          achievement={achievement}
          unlocked={unlocked}
          unlockedAt={unlockedAt}
          current={current}
          showProgress={showProgress}
          size={size}
        />
      ))}
    </div>
  );
}

// Compact inline display of unlocked achievements
type AchievementInlineProps = {
  achievements: Achievement[];
  maxShow?: number;
  className?: string;
};

export function AchievementInline({
  achievements,
  maxShow = 5,
  className,
}: AchievementInlineProps) {
  const visible = achievements.slice(0, maxShow);
  const remaining = achievements.length - maxShow;

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {visible.map(achievement => {
        const IconComponent = iconMap[achievement.icon] || Trophy;
        return (
          <TooltipProvider key={achievement.id}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="h-6 w-6 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                  <IconComponent className="h-3.5 w-3.5 text-white" />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-medium">{achievement.name}</p>
                <p className="text-xs text-muted-foreground">{achievement.description}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      })}
      {remaining > 0 && (
        <span className="text-xs text-muted-foreground ml-1">+{remaining}</span>
      )}
    </div>
  );
}
