'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, Crown, Medal, ChevronRight } from 'lucide-react';
import { getLeaderboardActionV2 } from '@/lib/actions/leaderboard-actions';
import type { LeaderboardCategory, LeaderboardEntry } from '@/lib/types';
import { PlayerPositionBadge } from '@/components/player-styles';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import Link from 'next/link';

function getRankIcon(rank: number) {
  switch (rank) {
    case 1:
      return <Crown className="h-4 w-4 text-yellow-500" />;
    case 2:
      return <Medal className="h-4 w-4 text-gray-400" />;
    case 3:
      return <Medal className="h-4 w-4 text-amber-600" />;
    default:
      return <span className="text-xs text-muted-foreground font-mono">{rank}</span>;
  }
}

function LeaderboardWidgetSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-4 w-8" />
        </div>
      ))}
    </div>
  );
}

type LeaderboardWidgetProps = {
  groupId?: string | null;
  category?: LeaderboardCategory;
  limit?: number;
  currentUserId?: string;
  showHeader?: boolean;
  className?: string;
};

export function LeaderboardWidget({
  groupId,
  category = 'ovr',
  limit = 5,
  currentUserId,
  showHeader = true,
  className,
}: LeaderboardWidgetProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const result = await getLeaderboardActionV2(category, groupId, limit);
        if (!result.error) {
          setEntries(result.leaderboard);
        }
      } catch (error) {
        console.error('Error loading leaderboard:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [category, groupId, limit]);

  const categoryLabels: Record<LeaderboardCategory, string> = {
    ovr: 'OVR',
    goals: 'Goleadores',
    assists: 'Asistidores',
    matches: 'Más Partidos',
    rating: 'Mejor Rating',
    mvp: 'MVPs',
  };

  const categoryUnits: Record<LeaderboardCategory, string> = {
    ovr: '',
    goals: ' G',
    assists: ' A',
    matches: ' PJ',
    rating: '',
    mvp: ' 🏆',
  };

  return (
    <Card className={className}>
      {showHeader && (
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-5 w-5 text-primary" />
            Top {limit} - {categoryLabels[category]}
          </CardTitle>
          <CardDescription>Rankings del grupo</CardDescription>
        </CardHeader>
      )}
      <CardContent className={cn(!showHeader && 'pt-4')}>
        {loading ? (
          <LeaderboardWidgetSkeleton />
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No hay datos todavía.
          </p>
        ) : (
          <motion.div
            className="space-y-2"
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
            {entries.map((entry, index) => {
              const isCurrentUser = entry.userId === currentUserId;

              return (
                <motion.div
                  key={entry.playerId}
                  variants={{
                    hidden: { opacity: 0, x: -10 },
                    visible: { opacity: 1, x: 0 },
                  }}
                >
                  <Link href={`/players/${entry.playerId}`}>
                    <div
                      className={cn(
                        'flex items-center gap-2 p-2 rounded-lg transition-colors hover:bg-muted/50',
                        isCurrentUser && 'bg-primary/10'
                      )}
                    >
                      {/* Rank */}
                      <div className="w-6 flex justify-center">{getRankIcon(entry.rank)}</div>

                      {/* Avatar */}
                      <Avatar className="h-8 w-8 overflow-hidden bg-muted">
                        {entry.playerPhotoUrl ? (
                          <div className="relative w-full h-full">
                            <Image
                              src={entry.playerPhotoUrl}
                              alt={entry.playerName}
                              width={32}
                              height={32}
                              className="object-cover"
                              loading="lazy"
                            />
                          </div>
                        ) : (
                          <AvatarFallback className="text-xs">
                            {entry.playerName.charAt(0)}
                          </AvatarFallback>
                        )}
                      </Avatar>

                      {/* Name */}
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            'text-sm font-medium truncate',
                            isCurrentUser && 'text-primary'
                          )}
                        >
                          {entry.playerName}
                        </p>
                      </div>

                      {/* Value */}
                      <div className="text-right">
                        <span
                          className={cn(
                            'text-sm font-bold',
                            entry.rank <= 3 ? 'text-primary' : 'text-foreground'
                          )}
                        >
                          {category === 'rating'
                            ? entry.value.toFixed(1)
                            : `${entry.value}${categoryUnits[category]}`}
                        </span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        <div className="mt-4 pt-3 border-t">
          <Button asChild variant="ghost" className="w-full" size="sm">
            <Link href="/comunidad?tab=rankings" className="flex items-center justify-center gap-1">
              Ver todos los rankings
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
