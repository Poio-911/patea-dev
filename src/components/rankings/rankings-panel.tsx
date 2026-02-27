'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Trophy,
  Target,
  Footprints,
  Calendar,
  Star,
  Award,
  Medal,
  Crown,
  TrendingUp,
} from 'lucide-react';
import {
  getLeaderboardActionV2,
  getPlayerRankAction,
} from '@/lib/actions/leaderboard-actions';
import type { LeaderboardCategory, LeaderboardEntry } from '@/lib/types';
import { PlayerPositionBadge } from '@/components/player-styles';
import { FollowButton } from '@/components/social/follow-button';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const CATEGORIES: {
  value: LeaderboardCategory;
  label: string;
  icon: React.ReactNode;
  unit: string;
}[] = [
  { value: 'ovr', label: 'OVR', icon: <Trophy className="h-4 w-4" />, unit: '' },
  { value: 'goals', label: 'Goles', icon: <Target className="h-4 w-4" />, unit: ' Goles' },
  { value: 'assists', label: 'Asistencias', icon: <Footprints className="h-4 w-4" />, unit: ' Asist.' },
  { value: 'matches', label: 'Partidos', icon: <Calendar className="h-4 w-4" />, unit: ' PJ' },
  { value: 'rating', label: 'Rating', icon: <Star className="h-4 w-4" />, unit: '' },
  { value: 'mvp', label: 'MVPs', icon: <Award className="h-4 w-4" />, unit: ' 🏆' },
];

function getRankIcon(rank: number) {
  switch (rank) {
    case 1:
      return <Crown className="h-5 w-5 text-yellow-500" />;
    case 2:
      return <Medal className="h-5 w-5 text-gray-400" />;
    case 3:
      return <Medal className="h-5 w-5 text-amber-600" />;
    default:
      return <span className="text-muted-foreground font-mono">{rank}</span>;
  }
}

function LeaderboardSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-4 w-32 mb-1" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-6 w-12" />
        </div>
      ))}
    </div>
  );
}

type LeaderboardTableProps = {
  entries: LeaderboardEntry[];
  currentUserId?: string;
  category: LeaderboardCategory;
  loading: boolean;
};

function LeaderboardTable({ entries, currentUserId, category, loading }: LeaderboardTableProps) {
  if (loading) {
    return <LeaderboardSkeleton />;
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Trophy className="h-12 w-12 mx-auto mb-4 opacity-30" />
        <p>No hay datos en esta categoría todavía.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map((entry, index) => {
        const isCurrentUser = entry.userId === currentUserId;

        return (
          <motion.div
            key={entry.playerId}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <div
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg transition-colors',
                isCurrentUser && 'bg-primary/10 border border-primary/20',
                entry.rank <= 3 && 'bg-gradient-to-r',
                entry.rank === 1 && 'from-yellow-500/10 to-transparent',
                entry.rank === 2 && 'from-gray-400/10 to-transparent',
                entry.rank === 3 && 'from-amber-600/10 to-transparent'
              )}
            >
              {/* Rank */}
              <div className="w-8 flex justify-center">{getRankIcon(entry.rank)}</div>

              {/* Avatar + Name (linked) */}
              <Link href={`/players/${entry.playerId}`} className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity">
                <Avatar className={cn('h-10 w-10 shrink-0', entry.rank <= 3 && 'ring-2 ring-primary/30')}>
                  <AvatarImage src={entry.playerPhotoUrl} alt={entry.playerName} />
                  <AvatarFallback>{entry.playerName.charAt(0)}</AvatarFallback>
                </Avatar>

                {/* Name and position */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={cn('font-semibold truncate', isCurrentUser && 'text-primary')}>
                      {entry.playerName}
                    </p>
                    {isCurrentUser && (
                      <Badge variant="outline" className="text-xs">
                        Tú
                      </Badge>
                    )}
                  </div>
                  <PlayerPositionBadge position={entry.position} size="sm" showIcon={false} />
                </div>
              </Link>

              {/* Value */}
              <div className="text-right shrink-0">
                <p
                  className={cn(
                    'text-lg font-bold',
                    entry.rank <= 3 ? 'text-primary' : 'text-foreground'
                  )}
                >
                  {category === 'rating'
                    ? entry.value.toFixed(1)
                    : `${entry.value}${CATEGORIES.find(c => c.value === category)?.unit || ''}`}
                </p>
              </div>

              {/* Follow button (only for other users) */}
              {entry.userId && entry.userId !== currentUserId && (
                <FollowButton targetUserId={entry.userId} compact />
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

type RankingsPanelProps = {
  groupId?: string | null;
  userId?: string;
};

export function RankingsPanel({ groupId, userId }: RankingsPanelProps) {
  const { user } = useUser();
  const currentUserId = userId || user?.uid;
  const activeGroupId = groupId || user?.activeGroupId || null;

  const [selectedCategory, setSelectedCategory] = useState<LeaderboardCategory>('ovr');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [playerRank, setPlayerRank] = useState<{
    rank: number | null;
    total: number;
    value: number;
  } | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setErrorMsg(null);
      try {
        const result = await getLeaderboardActionV2(selectedCategory, activeGroupId, 10);

        if (!result.error) {
          setLeaderboard(result.leaderboard);
        } else {
          setLeaderboard([]);
          setErrorMsg('Error al cargar este ranking. (Falta índice en la base de datos)');
        }

        if (currentUserId && !result.error) {
          const rankResult = await getPlayerRankAction(currentUserId, selectedCategory, activeGroupId);
          if (!rankResult.error) {
            setPlayerRank({
              rank: rankResult.rank,
              total: rankResult.total,
              value: rankResult.value,
            });
          } else {
            setPlayerRank(null);
          }
        } else {
          setPlayerRank(null);
        }
      } catch (error) {
        console.error('Error loading leaderboard:', error);
        setLeaderboard([]);
        setPlayerRank(null);
        setErrorMsg('Error de conexión.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [selectedCategory, currentUserId, activeGroupId]);

  const currentCategoryConfig = CATEGORIES.find(c => c.value === selectedCategory);

  return (
    <div className="flex flex-col gap-6">
      {/* Your position card */}
      {currentUserId && playerRank && playerRank.rank && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Tu posición en {currentCategoryConfig?.label}</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-primary">#{playerRank.rank}</span>
                  <span className="text-sm text-muted-foreground">
                    de {playerRank.total} jugadores
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">{currentCategoryConfig?.label}</p>
                <p className="text-xl font-bold">
                  {selectedCategory === 'rating'
                    ? playerRank.value.toFixed(1)
                    : playerRank.value}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Category tabs */}
      <Tabs value={selectedCategory} onValueChange={(v) => setSelectedCategory(v as LeaderboardCategory)}>
        <TabsList className="w-full justify-start overflow-x-auto flex-nowrap h-auto gap-1 bg-transparent p-0">
          {CATEGORIES.map(cat => (
            <TabsTrigger
              key={cat.value}
              value={cat.value}
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground shrink-0"
            >
              {cat.icon}
              <span className="ml-1.5">{cat.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <Card className="mt-4">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              {currentCategoryConfig?.icon}
              Top 10 - {currentCategoryConfig?.label}
            </CardTitle>
            <CardDescription>
              {activeGroupId
                ? 'Ranking de tu grupo activo'
                : 'Ranking global de todos los jugadores'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TabsContent value={selectedCategory} className="mt-0">
              {errorMsg ? (
                <div className="text-center py-8 text-destructive border border-destructive/20 rounded-lg bg-destructive/5 mt-4">
                  <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="font-semibold">{errorMsg}</p>
                </div>
              ) : (
                <LeaderboardTable
                  entries={leaderboard}
                  currentUserId={currentUserId}
                  category={selectedCategory}
                  loading={loading}
                />
              )}
            </TabsContent>
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
}
