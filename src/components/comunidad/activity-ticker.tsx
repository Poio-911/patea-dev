'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, TrendingUp, TrendingDown, Swords, Trophy, Sparkles } from 'lucide-react';
import { getFeedActivitiesAction } from '@/lib/actions/server-actions';
import type { SocialActivity, ActivityType } from '@/lib/types';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

const ALLOWED_TYPES: ActivityType[] = [
  'ovr_increased',
  'ovr_decreased',
  'match_played',
  'achievement_unlocked',
  'player_created',
];

function getTimestamp(activity: SocialActivity): Date {
  const ts = activity.timestamp;
  if (!ts) return new Date();
  if (typeof ts === 'string') return new Date(ts);
  // Firestore Timestamp has .toDate()
  if (typeof (ts as any).toDate === 'function') return (ts as any).toDate();
  // Numeric seconds
  if (typeof (ts as any).seconds === 'number') return new Date((ts as any).seconds * 1000);
  return new Date();
}

function formatTime(activity: SocialActivity): string {
  try {
    return formatDistanceToNow(getTimestamp(activity), { addSuffix: true, locale: es });
  } catch {
    return '';
  }
}

type TickerItemConfig = {
  icon: React.ReactNode;
  badgeClass: string;
  getText: (activity: SocialActivity) => React.ReactNode;
};

function getConfig(activity: SocialActivity): TickerItemConfig {
  const { type, metadata } = activity;

  switch (type) {
    case 'ovr_increased': {
      const from = metadata?.oldOvr ?? '?';
      const to = metadata?.newOvr ?? '?';
      const diff = metadata?.ovrChange;
      return {
        icon: <TrendingUp className="h-3.5 w-3.5" />,
        badgeClass: 'bg-green-500/15 text-green-600 border-green-500/30',
        getText: () => (
          <>
            subió su OVR{' '}
            <span className="font-semibold text-green-600">
              {from} → {to}{diff != null ? ` (+${diff})` : ''}
            </span>
          </>
        ),
      };
    }
    case 'ovr_decreased': {
      const from = metadata?.oldOvr ?? '?';
      const to = metadata?.newOvr ?? '?';
      const diff = metadata?.ovrChange;
      return {
        icon: <TrendingDown className="h-3.5 w-3.5" />,
        badgeClass: 'bg-red-500/15 text-red-600 border-red-500/30',
        getText: () => (
          <>
            bajó su OVR{' '}
            <span className="font-semibold text-red-600">
              {from} → {to}{diff != null ? ` (${diff})` : ''}
            </span>
          </>
        ),
      };
    }
    case 'match_played': {
      const title = metadata?.matchTitle ?? 'un partido';
      return {
        icon: <Swords className="h-3.5 w-3.5" />,
        badgeClass: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
        getText: () => (
          <>
            jugó <span className="font-semibold">{title}</span>
          </>
        ),
      };
    }
    case 'achievement_unlocked': {
      const name = metadata?.achievementName ?? 'un logro';
      return {
        icon: <Trophy className="h-3.5 w-3.5" />,
        badgeClass: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30',
        getText: () => (
          <>
            desbloqueó <span className="font-semibold">{name}</span>
          </>
        ),
      };
    }
    case 'player_created': {
      const ovr = metadata?.newOvr;
      return {
        icon: <Sparkles className="h-3.5 w-3.5" />,
        badgeClass: 'bg-violet-500/15 text-violet-600 border-violet-500/30',
        getText: () => (
          <>
            creó su jugador{ovr != null ? <span className="font-semibold"> (OVR {ovr})</span> : ''}
          </>
        ),
      };
    }
    default:
      return {
        icon: <Activity className="h-3.5 w-3.5" />,
        badgeClass: 'bg-muted text-muted-foreground',
        getText: () => 'tuvo actividad',
      };
  }
}

function TickerItemSkeleton() {
  return (
    <div className="flex items-start gap-2.5 py-2">
      <Skeleton className="h-5 w-5 rounded-full shrink-0 mt-0.5" />
      <Skeleton className="h-7 w-7 rounded-full shrink-0" />
      <div className="flex-1 space-y-1">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-2.5 w-16" />
      </div>
    </div>
  );
}

type ActivityTickerProps = {
  userId?: string;
};

export function ActivityTicker({ userId }: ActivityTickerProps) {
  const [activities, setActivities] = useState<SocialActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    async function load() {
      setLoading(true);
      try {
        const result = await getFeedActivitiesAction(userId!, 40);
        if (result.success && result.activities) {
          const filtered = result.activities.filter(a => ALLOWED_TYPES.includes(a.type));
          setActivities(filtered);
        }
      } catch {
        setActivities([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [userId]);

  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Activity className="h-4 w-4 text-primary" />
          Actividad reciente
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="max-h-[600px] overflow-y-auto -mr-2 pr-2 space-y-0.5">
          {loading ? (
            <>
              {[...Array(8)].map((_, i) => <TickerItemSkeleton key={i} />)}
            </>
          ) : activities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">Sin actividad reciente.</p>
              <p className="text-xs mt-1">Seguí a jugadores para ver su actividad.</p>
            </div>
          ) : (
            activities.map(activity => {
              const config = getConfig(activity);
              const timeStr = formatTime(activity);

              return (
                <div key={activity.id} className="flex items-start gap-2.5 py-2 border-b border-border/50 last:border-0">
                  {/* Type badge icon */}
                  <div className={cn(
                    'h-5 w-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 border',
                    config.badgeClass
                  )}>
                    {config.icon}
                  </div>

                  {/* Player avatar */}
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarImage src={activity.playerPhotoUrl} alt={activity.playerName} />
                    <AvatarFallback className="text-xs">{activity.playerName?.charAt(0) ?? '?'}</AvatarFallback>
                  </Avatar>

                  {/* Text content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs leading-snug text-foreground/90">
                      {activity.playerId ? (
                        <Link
                          href={`/players/${activity.playerId}`}
                          className="font-semibold hover:underline underline-offset-2"
                        >
                          {activity.playerName ?? 'Jugador'}
                        </Link>
                      ) : (
                        <span className="font-semibold">{activity.playerName ?? 'Jugador'}</span>
                      )}{' '}
                      {config.getText(activity)}
                    </p>
                    {timeStr && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">{timeStr}</p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
