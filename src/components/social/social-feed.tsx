'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Trophy,
  TrendingUp,
  TrendingDown,
  Target,
  Award,
  UserPlus,
  Users,
  RefreshCw,
  Activity,
} from 'lucide-react';
import { useUser } from '@/firebase';
import { getFeedActivitiesAction } from '@/lib/actions/server-actions';
import type { SocialActivity } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';

interface SocialFeedProps {
  limit?: number;
  showHeader?: boolean;
}

export function SocialFeed({ limit = 20, showHeader = true }: SocialFeedProps) {
  const { user } = useUser();
  const [activities, setActivities] = useState<SocialActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadActivities = async (refresh = false) => {
    if (!user) return;

    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const result = await getFeedActivitiesAction(user.uid, limit);
      if (result.success && result.activities) {
        setActivities(result.activities);
      }
    } catch (error) {
      console.error('Error loading feed activities:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadActivities();
  }, [user]);

  const getActivityIcon = (type: SocialActivity['type']) => {
    switch (type) {
      case 'match_played':
        return <Trophy className="h-5 w-5 text-blue-500" />;
      case 'match_organized':
        return <Trophy className="h-5 w-5 text-primary" />;
      case 'ovr_increased':
        return <TrendingUp className="h-5 w-5 text-green-500" />;
      case 'ovr_decreased':
        return <TrendingDown className="h-5 w-5 text-red-500" />;
      case 'goal_scored':
        return <Target className="h-5 w-5 text-orange-500" />;
      case 'achievement_unlocked':
        return <Award className="h-5 w-5 text-yellow-500" />;
      case 'player_created':
        return <UserPlus className="h-5 w-5 text-purple-500" />;
      case 'new_follower':
        return <Users className="h-5 w-5 text-pink-500" />;
      default:
        return <Activity className="h-5 w-5 text-gray-500" />;
    }
  };

  const getActivityTitle = (activity: SocialActivity) => {
    const playerName = activity.playerName || 'Un jugador';
    const metadata = activity.metadata;

    switch (activity.type) {
      case 'match_played':
        return (
          <span>
            <strong>{playerName}</strong> jugó un partido
            {metadata?.matchTitle && (
              <span className="text-muted-foreground"> - {metadata.matchTitle}</span>
            )}
          </span>
        );
      case 'match_organized':
        return (
          <span>
            <strong>{playerName}</strong> organizó un partido
            {metadata?.matchTitle && (
              <span className="text-muted-foreground"> - {metadata.matchTitle}</span>
            )}
          </span>
        );
      case 'ovr_increased':
        return (
          <span>
            <strong>{playerName}</strong> mejoró su OVR{' '}
            {metadata?.oldOvr && metadata?.newOvr && (
              <Badge variant="outline" className="ml-1 border-green-500 text-green-600">
                {metadata.oldOvr} → {metadata.newOvr}
              </Badge>
            )}
          </span>
        );
      case 'ovr_decreased':
        return (
          <span>
            <strong>{playerName}</strong> bajó su OVR{' '}
            {metadata?.oldOvr && metadata?.newOvr && (
              <Badge variant="outline" className="ml-1 border-red-500 text-red-600">
                {metadata.oldOvr} → {metadata.newOvr}
              </Badge>
            )}
          </span>
        );
      case 'goal_scored':
        return (
          <span>
            <strong>{playerName}</strong> marcó{' '}
            {metadata?.goals && metadata.goals > 1 ? `${metadata.goals} goles` : 'un gol'}
            {metadata?.matchTitle && (
              <span className="text-muted-foreground"> en {metadata.matchTitle}</span>
            )}
          </span>
        );
      case 'achievement_unlocked':
        return (
          <span>
            <strong>{playerName}</strong> desbloqueó un logro
            {metadata?.achievementName && (
              <span className="text-muted-foreground"> - {metadata.achievementName}</span>
            )}
          </span>
        );
      case 'player_created':
        return (
          <span>
            <strong>{playerName}</strong> se unió a Pateá
          </span>
        );
      case 'new_follower':
        return (
          <span>
            <strong>{playerName}</strong> tiene un nuevo seguidor
          </span>
        );
      default:
        return <span>Actividad desconocida</span>;
    }
  };

  const getActivityLink = (activity: SocialActivity) => {
    if (activity.playerId) {
      return `/players/${activity.playerId}`;
    }
    if (activity.metadata?.matchId) {
      return `/matches/${activity.metadata.matchId}`;
    }
    return null;
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="py-10">
          <div className="text-center text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Inicia sesión para ver el feed de actividad</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        {showHeader && (
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Activity className="h-5 w-5" aria-hidden="true" />
              Feed de Actividad
            </CardTitle>
          </CardHeader>
        )}
        <CardContent className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      {showHeader && (
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3">
              <Activity className="h-5 w-5" aria-hidden="true" />
              Feed de Actividad
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => loadActivities(true)}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
      )}
      <CardContent className="space-y-4">
        {activities.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="mb-1">No hay actividad reciente</p>
            <p className="text-sm">Seguí a otros jugadores para ver su actividad aquí</p>
          </div>
        ) : (
          activities.map((activity) => {
            const link = getActivityLink(activity);
            const content = (
              <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex-shrink-0 mt-1">{getActivityIcon(activity.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2">
                    {activity.playerPhotoUrl && (
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={activity.playerPhotoUrl} alt={activity.playerName} />
                        <AvatarFallback>
                          {activity.playerName?.charAt(0).toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-relaxed">{getActivityTitle(activity)}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(
                          activity.timestamp && typeof (activity as any).timestamp?.toDate === 'function'
                            ? (activity as any).timestamp.toDate()
                            : new Date(activity.timestamp as any),
                          {
                            addSuffix: true,
                            locale: es,
                          }
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );

            if (link) {
              return (
                <Link key={activity.id} href={link}>
                  {content}
                </Link>
              );
            }

            return <div key={activity.id}>{content}</div>;
          })
        )}
      </CardContent>
    </Card>
  );
}
