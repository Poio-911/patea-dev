'use client';

import { useEffect, useState } from 'react';
import { Users, UserPlus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { UserSuggestionCard } from '@/components/social/user-suggestion-card';
import { getSuggestedUsersAction } from '@/lib/actions/social-feed-actions';
import type { SuggestedUser } from '@/lib/types';
import { useUser } from '@/firebase';

export function FeedSidebar() {
  const { user } = useUser();
  const [suggestions, setSuggestions] = useState<SuggestedUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;

    getSuggestedUsersAction(user.uid).then((result) => {
      if (result.success && result.users) {
        setSuggestions(result.users.slice(0, 4));
      }
      setLoading(false);
    });
  }, [user?.uid]);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <UserPlus className="h-3 w-3 text-primary" />
        </div>
        <span className="font-headline font-bold text-sm tracking-tight">Sugeridos para seguir</span>
      </div>

      <div className="p-3 flex flex-col gap-2">
        {loading ? (
          <>
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                <Skeleton className="h-12 w-12 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-8 w-16 rounded-md shrink-0" />
              </div>
            ))}
          </>
        ) : suggestions.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6 px-3">
            No hay sugerencias disponibles en este momento.
          </p>
        ) : (
          suggestions.map((suggestedUser) => (
            <UserSuggestionCard
              key={suggestedUser.uid}
              user={suggestedUser}
              currentUserId={user?.uid}
            />
          ))
        )}
      </div>
    </div>
  );
}
