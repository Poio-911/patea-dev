'use client';

import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Trophy, UserPlus, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { SuggestedUser, SuggestedUserReason } from '@/lib/types';
import { followUserAction } from '@/lib/actions/social-actions';
import { useToast } from '@/hooks/use-toast';

interface UserSuggestionCardProps {
  user: SuggestedUser;
  currentUserId?: string;
  onFollow?: () => void;
}

const reasonConfig: Record<SuggestedUserReason, { label: string; className: string }> = {
  same_group: {
    label: 'De tu grupo',
    className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
  },
  most_followed: {
    label: 'Popular',
    className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
  },
  recently_active: {
    label: 'Activo',
    className: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30',
  },
};

export function UserSuggestionCard({
  user,
  currentUserId,
  onFollow,
}: UserSuggestionCardProps) {
  const { toast } = useToast();
  const [isFollowing, setIsFollowing] = useState(false);
  const [hasFollowed, setHasFollowed] = useState(false);

  const reasonInfo = reasonConfig[user.reason];

  const handleFollow = async () => {
    if (!currentUserId || isFollowing || hasFollowed) return;

    setIsFollowing(true);

    const result = await followUserAction(currentUserId, user.uid);

    if (result.success) {
      setHasFollowed(true);
      toast({
        title: 'Siguiendo',
        description: `Ahora sigues a ${user.displayName}`,
      });
      onFollow?.();
    } else {
      toast({
        title: 'Error',
        description: result.error || 'No se pudo seguir al usuario',
        variant: 'destructive',
      });
    }

    setIsFollowing(false);
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors">
      {/* Avatar */}
      <Link href={`/players/${user.uid}`}>
        <Avatar className="h-12 w-12 ring-2 ring-foreground/10 hover:ring-foreground/30 transition-all">
          {user.photoURL && (
            <AvatarImage src={user.photoURL} alt={user.displayName} />
          )}
          <AvatarFallback>
            {(user.displayName || 'U').charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </Link>

      {/* User info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Link
            href={`/players/${user.uid}`}
            className="font-semibold text-sm hover:underline truncate"
          >
            {user.displayName}
          </Link>
          <Badge variant="outline" className={cn('text-xs shrink-0', reasonInfo.className)}>
            {reasonInfo.label}
          </Badge>
        </div>

        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          {user.position && user.ovr && (
            <span className="flex items-center gap-1">
              <Trophy className="h-3 w-3" />
              {user.position} · {user.ovr} OVR
            </span>
          )}
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {user.followerCount} seguidores
          </span>
          {user.matchesPlayed !== undefined && (
            <span>{user.matchesPlayed} partidos</span>
          )}
        </div>
      </div>

      {/* Follow button */}
      <Button
        size="sm"
        variant={hasFollowed ? 'outline' : 'default'}
        className={cn(
          'shrink-0',
          hasFollowed && 'text-muted-foreground'
        )}
        onClick={handleFollow}
        disabled={!currentUserId || isFollowing || hasFollowed}
      >
        {isFollowing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : hasFollowed ? (
          'Siguiendo'
        ) : (
          <>
            <UserPlus className="h-4 w-4 mr-1" />
            Seguir
          </>
        )}
      </Button>
    </div>
  );
}

export default UserSuggestionCard;
