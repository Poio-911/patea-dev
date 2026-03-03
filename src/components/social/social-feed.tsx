'use client';

import { useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { RefreshCw, Users, Activity, Rss } from 'lucide-react';
import { useUser } from '@/firebase';
import { PostItem } from '@/components/social/post-item';
import { getFeedActivitiesAction } from '@/lib/actions/server-actions';
import type { SocialActivity } from '@/lib/types';
import { EmptyState } from '@/components/ui/empty-state';

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

  if (!user) {
    return (
      <div className="border border-border rounded-lg">
        <div className="py-10 px-4">
          <div className="text-center text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Inicia sesion para ver el feed de actividad</p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="border border-border rounded-lg overflow-hidden">
        {showHeader && (
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <Activity className="h-5 w-5" aria-hidden="true" />
              <span className="font-semibold">Feed de Actividad</span>
            </div>
          </div>
        )}
        <div className="divide-y divide-border">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-4">
              <div className="flex items-start gap-3">
                <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                  <div className="flex gap-4 pt-2">
                    <Skeleton className="h-8 w-16" />
                    <Skeleton className="h-8 w-16" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {showHeader && (
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Activity className="h-5 w-5" aria-hidden="true" />
              <span className="font-semibold">Feed de Actividad</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => loadActivities(true)}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      )}

      {activities.length === 0 ? (
        <EmptyState
          icon={<Rss className="h-14 w-14" />}
          title="Sin actividad reciente"
          description="Seguí a otros jugadores para ver su actividad acá."
        />
      ) : (
        <div className="flex flex-col">
          {activities.map((activity) => (
            <PostItem
              key={activity.id}
              activity={activity}
              userId={user.uid}
              userName={user.displayName || undefined}
              userPhotoUrl={user.photoURL || undefined}
              onRefresh={() => loadActivities(true)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default SocialFeed;
