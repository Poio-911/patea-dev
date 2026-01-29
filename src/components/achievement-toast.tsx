'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { Achievement } from '@/lib/types';
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
  X,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

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

const categoryColors: Record<Achievement['category'], string> = {
  performance: 'from-orange-500 to-red-500',
  milestones: 'from-blue-500 to-cyan-500',
  competition: 'from-yellow-500 to-amber-500',
  social: 'from-purple-500 to-pink-500',
};

type AchievementToastProps = {
  achievement: Achievement;
  isOpen: boolean;
  onClose: () => void;
  autoClose?: number; // ms to auto close, 0 for never
};

export function AchievementToast({
  achievement,
  isOpen,
  onClose,
  autoClose = 5000,
}: AchievementToastProps) {
  const IconComponent = iconMap[achievement.icon] || Trophy;

  useEffect(() => {
    if (isOpen && autoClose > 0) {
      const timer = setTimeout(onClose, autoClose);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoClose, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -100, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -50, scale: 0.8 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] pointer-events-auto"
        >
          <div className="relative bg-card border border-border rounded-xl shadow-2xl overflow-hidden min-w-[300px] max-w-[400px]">
            {/* Gradient background */}
            <div
              className={cn(
                'absolute inset-0 opacity-10 bg-gradient-to-br',
                categoryColors[achievement.category]
              )}
            />

            {/* Confetti particles animation */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {[...Array(12)].map((_, i) => (
                <motion.div
                  key={i}
                  className={cn(
                    'absolute w-2 h-2 rounded-full',
                    i % 3 === 0 ? 'bg-yellow-400' : i % 3 === 1 ? 'bg-primary' : 'bg-pink-400'
                  )}
                  initial={{
                    x: 150,
                    y: 50,
                    scale: 0,
                    opacity: 1,
                  }}
                  animate={{
                    x: 150 + (Math.random() - 0.5) * 300,
                    y: -100 + Math.random() * 200,
                    scale: [0, 1, 0.5],
                    opacity: [1, 1, 0],
                    rotate: Math.random() * 360,
                  }}
                  transition={{
                    duration: 1.5,
                    delay: i * 0.05,
                    ease: 'easeOut',
                  }}
                />
              ))}
            </div>

            {/* Content */}
            <div className="relative p-4 flex items-start gap-4">
              {/* Icon */}
              <motion.div
                className={cn(
                  'h-14 w-14 rounded-full flex items-center justify-center shrink-0',
                  'bg-gradient-to-br shadow-lg',
                  categoryColors[achievement.category]
                )}
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', delay: 0.2, damping: 10 }}
              >
                <IconComponent className="h-7 w-7 text-white drop-shadow-md" />
              </motion.div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <motion.p
                  className="text-xs font-semibold text-primary uppercase tracking-wide"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  Logro Desbloqueado
                </motion.p>
                <motion.p
                  className="text-lg font-bold text-foreground truncate"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  {achievement.name}
                </motion.p>
                <motion.p
                  className="text-sm text-muted-foreground"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  {achievement.description}
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="mt-2"
                >
                  <Button asChild size="sm" variant="outline">
                    <Link href="/achievements">Ver todos los logros</Link>
                  </Button>
                </motion.div>
              </div>

              {/* Close button */}
              <button
                onClick={onClose}
                className="shrink-0 p-1 rounded-full hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Hook to show achievement toast
import { useState, useCallback } from 'react';

export function useAchievementToast() {
  const [achievement, setAchievement] = useState<Achievement | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const showAchievement = useCallback((newAchievement: Achievement) => {
    setAchievement(newAchievement);
    setIsOpen(true);
  }, []);

  const hideAchievement = useCallback(() => {
    setIsOpen(false);
  }, []);

  const ToastComponent = achievement ? (
    <AchievementToast
      achievement={achievement}
      isOpen={isOpen}
      onClose={hideAchievement}
    />
  ) : null;

  return {
    showAchievement,
    hideAchievement,
    ToastComponent,
  };
}

// Provider component to show achievements globally
import { createContext, useContext, type ReactNode } from 'react';

type AchievementToastContextType = {
  showAchievement: (achievement: Achievement) => void;
};

const AchievementToastContext = createContext<AchievementToastContextType | null>(null);

export function AchievementToastProvider({ children }: { children: ReactNode }) {
  const { showAchievement, ToastComponent } = useAchievementToast();

  return (
    <AchievementToastContext.Provider value={{ showAchievement }}>
      {children}
      {ToastComponent}
    </AchievementToastContext.Provider>
  );
}

export function useAchievementToastContext() {
  const context = useContext(AchievementToastContext);
  if (!context) {
    throw new Error('useAchievementToastContext must be used within AchievementToastProvider');
  }
  return context;
}
