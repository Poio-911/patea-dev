'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, Target, Footprints, Calendar, Star, Award, Crown, Medal } from 'lucide-react';
import { getMultipleLeaderboardsAction } from '@/lib/actions/leaderboard-actions';
import type { LeaderboardCategory, LeaderboardEntry } from '@/lib/types';
import { FollowButton } from '@/components/social/follow-button';
import { cn } from '@/lib/utils';

const CATEGORIES: {
  value: LeaderboardCategory;
  label: string;
  icon: React.ReactNode;
  unit: string;
  color: string;
}[] = [
  { value: 'ovr', label: 'OVR', icon: <Trophy className="h-4 w-4" />, unit: '', color: 'text-yellow-500' },
  { value: 'goals', label: 'Goles', icon: <Target className="h-4 w-4" />, unit: '', color: 'text-green-500' },
  { value: 'assists', label: 'Asistencias', icon: <Footprints className="h-4 w-4" />, unit: '', color: 'text-blue-500' },
  { value: 'matches', label: 'Partidos', icon: <Calendar className="h-4 w-4" />, unit: ' PJ', color: 'text-purple-500' },
  { value: 'rating', label: 'Rating', icon: <Star className="h-4 w-4" />, unit: '', color: 'text-orange-500' },
  { value: 'mvp', label: 'MVPs', icon: <Award className="h-4 w-4" />, unit: '', color: 'text-rose-500' },
];

function getRankIcon(rank: number) {
  if (rank === 1) return <Crown className="h-4 w-4 text-yellow-500" />;
  if (rank === 2) return <Medal className="h-4 w-4 text-gray-400" />;
  if (rank === 3) return <Medal className="h-4 w-4 text-amber-600" />;
  return <span className="text-xs text-muted-foreground font-mono w-4 text-center">{rank}</span>;
}

function CategoryCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-24" />
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-7 w-7 rounded-full" />
            <Skeleton className="h-3 flex-1" />
            <Skeleton className="h-4 w-8" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function formatValue(value: number, category: LeaderboardCategory, unit: string): string {
  if (category === 'rating') return value.toFixed(1);
  return `${value}${unit}`;
}

type CategoryCardProps = {
  category: (typeof CATEGORIES)[number];
  entries: LeaderboardEntry[];
  currentUserId?: string;
};

function CategoryCard({ category, entries, currentUserId }: CategoryCardProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="flex items-center justify-between">
          <div className={cn('flex items-center gap-2 text-sm font-semibold', category.color)}>
            {category.icon}
            {category.label}
          </div>
          <Badge variant="secondary" className="text-xs font-normal">Top 5</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {entries.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">Sin datos</p>
        ) : (
          <div className="space-y-1.5">
            {entries.map((entry, index) => {
              const isCurrentUser = entry.userId === currentUserId;
              return (
                <div
                  key={entry.playerId}
                  className={cn(
                    'flex items-center gap-2 py-1 px-1.5 rounded-md transition-colors',
                    isCurrentUser && 'bg-primary/10',
                    entry.rank === 1 && 'bg-yellow-500/5',
                    entry.rank === 2 && !isCurrentUser && 'bg-gray-400/5',
                    entry.rank === 3 && !isCurrentUser && 'bg-amber-600/5'
                  )}
                >
                  <div className="w-4 flex justify-center shrink-0">
                    {getRankIcon(entry.rank)}
                  </div>

                  <Link
                    href={`/players/${entry.playerId}`}
                    className="flex items-center gap-2 flex-1 min-w-0 hover:opacity-80 transition-opacity"
                  >
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarImage src={entry.playerPhotoUrl} alt={entry.playerName} />
                      <AvatarFallback className="text-xs">{entry.playerName?.charAt(0) ?? '?'}</AvatarFallback>
                    </Avatar>
                    <span
                      className={cn(
                        'text-xs font-medium truncate',
                        isCurrentUser ? 'text-primary' : 'text-foreground'
                      )}
                    >
                      {entry.playerName}
                    </span>
                  </Link>

                  <span className={cn('text-xs font-bold shrink-0', category.color)}>
                    {formatValue(entry.value, category.value, category.unit)}
                  </span>

                  {entry.userId && entry.userId !== currentUserId && (
                    <FollowButton targetUserId={entry.userId} compact />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type MultiRankingsProps = {
  groupId?: string | null;
  currentUserId?: string;
};

export function MultiRankings({ groupId, currentUserId }: MultiRankingsProps) {
  const [leaderboards, setLeaderboards] = useState<Record<LeaderboardCategory, LeaderboardEntry[]> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const result = await getMultipleLeaderboardsAction(groupId, 5);
        setLeaderboards(result.leaderboards);
      } catch {
        setLeaderboards(null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [groupId]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[...Array(6)].map((_, i) => <CategoryCardSkeleton key={i} />)}
      </div>
    );
  }

  if (!leaderboards) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Trophy className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">No se pudieron cargar los rankings.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {CATEGORIES.map(cat => (
        <CategoryCard
          key={cat.value}
          category={cat}
          entries={leaderboards[cat.value]}
          currentUserId={currentUserId}
        />
      ))}
    </div>
  );
}
