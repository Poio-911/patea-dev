'use client';

import { useState, useMemo, useEffect } from 'react';
import { useUser } from '@/firebase';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, Target, Users, Award, Loader2 } from 'lucide-react';
import { AchievementBadge } from '@/components/achievement-badge';
import { ACHIEVEMENTS, ACHIEVEMENT_CATEGORIES, getAchievementsByCategory } from '@/lib/achievements-config';
import { getAchievementProgressAction } from '@/lib/actions/achievement-actions';
import type { Achievement } from '@/lib/types';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const categoryIcons: Record<Achievement['category'], React.ReactNode> = {
  performance: <Target className="h-4 w-4" />,
  milestones: <Award className="h-4 w-4" />,
  competition: <Trophy className="h-4 w-4" />,
  social: <Users className="h-4 w-4" />,
};

type AchievementProgress = {
  achievement: Achievement;
  current: number;
  unlocked: boolean;
  unlockedAt?: string;
};

function AchievementsSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Skeleton className="h-20 w-20 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export default function AchievementsPage() {
  const { user } = useUser();
  const [progress, setProgress] = useState<AchievementProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<Achievement['category'] | 'all'>('all');

  // Load achievements progress
  useEffect(() => {
    async function loadProgress() {
      if (!user?.uid) return;

      setLoading(true);
      try {
        const result = await getAchievementProgressAction(user.uid, user.uid);
        if (!result.error) {
          setProgress(result.progress);
        }
      } catch (error) {
        console.error('Error loading achievements:', error);
      } finally {
        setLoading(false);
      }
    }

    loadProgress();
  }, [user?.uid]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = ACHIEVEMENTS.length;
    const unlocked = progress.filter(p => p.unlocked).length;
    const percentage = total > 0 ? Math.round((unlocked / total) * 100) : 0;

    const byCategory = ACHIEVEMENT_CATEGORIES.map(cat => ({
      ...cat,
      total: getAchievementsByCategory(cat.value).length,
      unlocked: progress.filter(p => p.achievement.category === cat.value && p.unlocked).length,
    }));

    return { total, unlocked, percentage, byCategory };
  }, [progress]);

  // Filter achievements by selected category
  const filteredProgress = useMemo(() => {
    if (selectedCategory === 'all') return progress;
    return progress.filter(p => p.achievement.category === selectedCategory);
  }, [progress, selectedCategory]);

  // Sort: unlocked first, then by progress percentage
  const sortedProgress = useMemo(() => {
    return [...filteredProgress].sort((a, b) => {
      if (a.unlocked && !b.unlocked) return -1;
      if (!a.unlocked && b.unlocked) return 1;

      const aPercent = a.current / a.achievement.requirement.count;
      const bPercent = b.current / b.achievement.requirement.count;
      return bPercent - aPercent;
    });
  }, [filteredProgress]);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <Trophy className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Inicia sesión para ver tus logros.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Logros"
        description="Desbloquea logros jugando partidos, marcando goles y siendo parte de la comunidad."
      />

      {loading ? (
        <AchievementsSkeleton />
      ) : (
        <>
          {/* Overview Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                Tu Progreso
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                {/* Main progress circle */}
                <div className="relative">
                  <motion.div
                    className="h-24 w-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', damping: 10 }}
                  >
                    <div className="text-center">
                      <p className="text-3xl font-bold text-primary">{stats.unlocked}</p>
                      <p className="text-xs text-muted-foreground">de {stats.total}</p>
                    </div>
                  </motion.div>
                </div>

                {/* Progress bar and category breakdown */}
                <div className="flex-1 w-full space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">Progreso total</span>
                      <span className="text-sm text-muted-foreground">{stats.percentage}%</span>
                    </div>
                    <Progress value={stats.percentage} className="h-2" />
                  </div>

                  {/* Category breakdown */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {stats.byCategory.map(cat => (
                      <div
                        key={cat.value}
                        className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
                      >
                        {categoryIcons[cat.value]}
                        <div className="text-xs">
                          <p className="font-medium">{cat.label}</p>
                          <p className="text-muted-foreground">
                            {cat.unlocked}/{cat.total}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Achievement tabs */}
          <Tabs value={selectedCategory} onValueChange={(v) => setSelectedCategory(v as any)}>
            <TabsList className="w-full justify-start overflow-x-auto flex-wrap h-auto gap-1 bg-transparent p-0">
              <TabsTrigger
                value="all"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                Todos
                <Badge variant="secondary" className="ml-1">
                  {stats.unlocked}/{stats.total}
                </Badge>
              </TabsTrigger>
              {ACHIEVEMENT_CATEGORIES.map(cat => (
                <TabsTrigger
                  key={cat.value}
                  value={cat.value}
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  {categoryIcons[cat.value]}
                  <span className="ml-1">{cat.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value={selectedCategory} className="mt-6">
              <motion.div
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: { opacity: 0 },
                  visible: {
                    opacity: 1,
                    transition: { staggerChildren: 0.05 },
                  },
                }}
              >
                {sortedProgress.map((item, index) => (
                  <motion.div
                    key={item.achievement.id}
                    variants={{
                      hidden: { opacity: 0, y: 20 },
                      visible: { opacity: 1, y: 0 },
                    }}
                  >
                    <Card
                      className={cn(
                        'p-4 flex flex-col items-center text-center transition-all hover:shadow-md',
                        item.unlocked ? 'border-primary/30 bg-primary/5' : 'opacity-70'
                      )}
                    >
                      <AchievementBadge
                        achievement={item.achievement}
                        unlocked={item.unlocked}
                        unlockedAt={item.unlockedAt}
                        current={item.current}
                        showProgress={!item.unlocked}
                        size="lg"
                      />

                      {/* Progress text for locked achievements */}
                      {!item.unlocked && (
                        <p className="text-xs text-muted-foreground mt-2">
                          {item.current}/{item.achievement.requirement.count}
                        </p>
                      )}

                      {/* Unlocked date */}
                      {item.unlocked && item.unlockedAt && (
                        <p className="text-[10px] text-primary mt-1">
                          {new Date(item.unlockedAt).toLocaleDateString('es-AR')}
                        </p>
                      )}
                    </Card>
                  </motion.div>
                ))}
              </motion.div>

              {sortedProgress.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Trophy className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>No hay logros en esta categoría.</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
