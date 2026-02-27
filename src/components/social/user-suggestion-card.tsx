'use client';

import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Trophy, UserPlus, Loader2, MoreVertical, Send, Eye } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { SuggestedUser, SuggestedUserReason, Match } from '@/lib/types';
import { followUserAction } from '@/lib/actions/social-actions';
import { useToast } from '@/hooks/use-toast';
import { InvitePlayerDialog } from '@/components/invite-player-dialog';
import {
  ResponsiveDropdownMenu as DropdownMenu,
  ResponsiveDropdownMenuContent as DropdownMenuContent,
  ResponsiveDropdownMenuItem as DropdownMenuItem,
  ResponsiveDropdownMenuTrigger as DropdownMenuTrigger,
  ResponsiveDropdownMenuSeparator as DropdownMenuSeparator,
} from '@/components/ui/responsive-dropdown-menu';

interface UserSuggestionCardProps {
  user: SuggestedUser;
  currentUserId?: string;
  onFollow?: () => void;
  userMatches?: Match[];
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
  userMatches = [],
}: UserSuggestionCardProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [isFollowing, setIsFollowing] = useState(false);
  const [hasFollowed, setHasFollowed] = useState(user.isFollowing ?? false);

  const reasonInfo = reasonConfig[user.reason];

  const handleFollow = async () => {
    if (!currentUserId || isFollowing || hasFollowed) return;

    setIsFollowing(true);
    const result = await followUserAction(currentUserId, user.uid);

    if (result.success) {
      setHasFollowed(true);
      toast({
        title: 'Siguiendo',
        description: `Ahora seguís a ${user.displayName}`,
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

  // Matches with open spots where this user isn't already
  const incompleteMatches = userMatches.filter(
    m => !m.playerUids?.includes(user.uid)
  );

  const canInvite = incompleteMatches.length > 0;

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
          {user.matchesPlayed !== undefined && user.matchesPlayed > 0 && (
            <span>{user.matchesPlayed} partidos</span>
          )}
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {user.followerCount}
          </span>
        </div>
      </div>

      {/* Actions — Invite is PRIMARY, follow is secondary */}
      <div className="flex items-center gap-1 shrink-0">
        {canInvite ? (
          <InvitePlayerDialog
            playerToInvite={{
              uid: user.uid,
              displayName: user.displayName,
              photoURL: user.photoURL || '',
              position: user.position || 'MED',
              ovr: user.ovr || 50,
              location: { lat: 0, lng: 0, geohash: '' },
              availability: {},
            }}
            userMatches={incompleteMatches}
          >
            <Button size="sm" className="shrink-0">
              <Send className="h-4 w-4 mr-1" />
              Invitar
            </Button>
          </InvitePlayerDialog>
        ) : (
          <Button
            size="sm"
            variant={hasFollowed ? 'outline' : 'default'}
            className={cn('shrink-0', hasFollowed && 'text-muted-foreground')}
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
        )}

        {/* More actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => router.push(`/players/${user.uid}`)}>
              <Eye className="h-4 w-4 mr-2" />
              Ver perfil
            </DropdownMenuItem>

            {/* Show follow in menu if invite is primary */}
            {canInvite && !hasFollowed && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleFollow} disabled={isFollowing}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Seguir
                </DropdownMenuItem>
              </>
            )}

            {/* Show invite in menu if follow is primary (no incomplete matches) */}
            {!canInvite && incompleteMatches.length === 0 && userMatches.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled className="text-muted-foreground">
                  <Send className="h-4 w-4 mr-2" />
                  Ya está en tus partidos
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export default UserSuggestionCard;
