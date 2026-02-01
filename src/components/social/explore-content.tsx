'use client';

import { useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Flame, Clock, UserPlus } from 'lucide-react';
import { useUser } from '@/firebase';
import { UserSuggestionCard } from '@/components/social/user-suggestion-card';
import { getSuggestedUsersAction } from '@/lib/actions/social-feed-actions';
import type { SuggestedUser } from '@/lib/types';
import { doc } from 'firebase/firestore';
import { db } from '@/firebase';
import { useDoc } from '@/firebase/firestore/use-doc';
import type { UserProfile } from '@/lib/types';

export function ExploreContent() {
  const { user } = useUser();
  const [suggestedUsers, setSuggestedUsers] = useState<SuggestedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Get user profile for activeGroupId
  const userRef = user ? doc(db, 'users', user.uid) : null;
  const { data: userProfile } = useDoc<UserProfile>(userRef);

  useEffect(() => {
    if (user) {
      loadSuggestions();
    }
  }, [user, userProfile?.activeGroupId]);

  const loadSuggestions = async () => {
    if (!user) return;

    setIsLoading(true);
    const result = await getSuggestedUsersAction(user.uid, userProfile?.activeGroupId || undefined);
    if (result.success && result.users) {
      setSuggestedUsers(result.users);
    }
    setIsLoading(false);
  };

  // Group users by reason
  const groupUsers = suggestedUsers.filter((u) => u.reason === 'same_group');
  const popularUsers = suggestedUsers.filter((u) => u.reason === 'most_followed');
  const activeUsers = suggestedUsers.filter((u) => u.reason === 'recently_active');

  if (!user) {
    return (
      <div className="border border-border rounded-lg p-10 text-center">
        <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
        <p className="text-muted-foreground">
          Inicia sesion para ver usuarios sugeridos
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Loading skeletons for each section */}
        {[1, 2, 3].map((section) => (
          <div key={section} className="space-y-3">
            <Skeleton className="h-6 w-40" />
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border"
                >
                  <Skeleton className="h-12 w-12 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-9 w-20" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (suggestedUsers.length === 0) {
    return (
      <div className="border border-border rounded-lg p-10 text-center">
        <UserPlus className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
        <p className="text-muted-foreground mb-1">
          No hay sugerencias disponibles
        </p>
        <p className="text-sm text-muted-foreground">
          Unite a un grupo o juega mas partidos para obtener mejores recomendaciones
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Same group section */}
      {groupUsers.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-5 w-5 text-blue-500" />
            <h2 className="font-semibold">De tu grupo</h2>
          </div>
          <div className="space-y-2">
            {groupUsers.map((suggestedUser) => (
              <UserSuggestionCard
                key={suggestedUser.uid}
                user={suggestedUser}
                currentUserId={user?.uid}
                onFollow={loadSuggestions}
              />
            ))}
          </div>
        </section>
      )}

      {/* Popular users section */}
      {popularUsers.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Flame className="h-5 w-5 text-amber-500" />
            <h2 className="font-semibold">Populares</h2>
          </div>
          <div className="space-y-2">
            {popularUsers.map((suggestedUser) => (
              <UserSuggestionCard
                key={suggestedUser.uid}
                user={suggestedUser}
                currentUserId={user?.uid}
                onFollow={loadSuggestions}
              />
            ))}
          </div>
        </section>
      )}

      {/* Recently active section */}
      {activeUsers.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-5 w-5 text-green-500" />
            <h2 className="font-semibold">Activos recientemente</h2>
          </div>
          <div className="space-y-2">
            {activeUsers.map((suggestedUser) => (
              <UserSuggestionCard
                key={suggestedUser.uid}
                user={suggestedUser}
                currentUserId={user?.uid}
                onFollow={loadSuggestions}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default ExploreContent;
