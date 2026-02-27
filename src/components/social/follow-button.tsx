'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { UserPlus, UserCheck, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore } from '@/firebase';
import { doc, getDoc, collection, getCountFromServer, query, where, getDocs } from 'firebase/firestore';
import { followUserAction, unfollowUserAction } from '@/lib/actions/social-actions';

interface FollowButtonProps {
  targetUserId: string; // UID of the user to follow/unfollow
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  showCounts?: boolean; // Show follower/following counts
  compact?: boolean; // Icon-only, ghost, small — for use in leaderboard rows
}

export function FollowButton({
  targetUserId,
  variant = 'default',
  size = 'default',
  showCounts = false,
  compact = false,
}: FollowButtonProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  // Check if current user is following target user using top-level /follows/ collection
  useEffect(() => {
    const checkFollowStatus = async () => {
      if (!firestore || !user || user.uid === targetUserId) {
        setIsChecking(false);
        return;
      }

      setIsChecking(true);
      try {
        // Query /follows/ collection for this specific follow relationship
        const followsQuery = query(
          collection(firestore, 'follows'),
          where('followerId', '==', user.uid),
          where('followingId', '==', targetUserId)
        );
        const followsSnapshot = await getDocs(followsQuery);
        setIsFollowing(!followsSnapshot.empty);
      } catch (error) {
        console.error('Error checking follow status:', error);
      } finally {
        setIsChecking(false);
      }
    };

    checkFollowStatus();
  }, [firestore, user, targetUserId]);

  // Load follower/following counts if showCounts is true using top-level /follows/ collection
  useEffect(() => {
    const loadCounts = async () => {
      if (!firestore || !showCounts) return;

      try {
        // Count followers: where followingId == targetUserId
        const followersQuery = query(
          collection(firestore, 'follows'),
          where('followingId', '==', targetUserId)
        );
        // Count following: where followerId == target userId
        const followingQuery = query(
          collection(firestore, 'follows'),
          where('followerId', '==', targetUserId)
        );

        const [followersSnapshot, followingSnapshot] = await Promise.all([
          getCountFromServer(followersQuery),
          getCountFromServer(followingQuery),
        ]);

        setFollowersCount(followersSnapshot.data().count);
        setFollowingCount(followingSnapshot.data().count);
      } catch (error) {
        console.error('Error loading counts:', error);
      }
    };

    loadCounts();
  }, [firestore, showCounts, targetUserId, isFollowing]); // Reload when isFollowing changes

  const handleFollow = async () => {
    if (!user) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Debes iniciar sesión para seguir usuarios.',
      });
      return;
    }

    if (user.uid === targetUserId) {
      return; // Can't follow yourself
    }

    setIsLoading(true);

    try {
      if (isFollowing) {
        // Unfollow using Server Action
        const result = await unfollowUserAction(user.uid, targetUserId);

        if (result.success) {
          setIsFollowing(false);
          setFollowersCount((prev) => Math.max(0, prev - 1));
          toast({
            title: 'Dejaste de seguir',
            description: 'Ya no seguís a este usuario.',
          });
        } else {
          throw new Error(result.error || 'Error al dejar de seguir.');
        }

      } else {
        // Follow using Server Action
        const result = await followUserAction(user.uid, targetUserId);

        if (result.success) {
          setIsFollowing(true);
          setFollowersCount((prev) => prev + 1);
          toast({
            title: '¡Seguido!',
            description: 'Ahora seguís a este usuario.',
          });
        } else {
          throw new Error(result.error || 'Error al seguir.');
        }
      }
    } catch (error: any) {
      console.error('Error toggling follow:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Ocurrió un error. Intentá de nuevo.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Don't show button if user is viewing their own profile
  if (!user || user.uid === targetUserId) {
    return showCounts ? (
      <div className="flex gap-4 text-sm text-muted-foreground">
        <div>
          <span className="font-semibold text-foreground">{followersCount}</span> seguidores
        </div>
        <div>
          <span className="font-semibold text-foreground">{followingCount}</span> siguiendo
        </div>
      </div>
    ) : null;
  }

  if (isChecking) {
    return (
      <Button variant={compact ? 'ghost' : variant} size={compact ? 'icon' : size} disabled className={compact ? 'h-7 w-7 shrink-0' : ''}>
        <Loader2 className={compact ? 'h-3.5 w-3.5 animate-spin' : 'h-4 w-4 animate-spin'} />
      </Button>
    );
  }

  if (compact) {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={handleFollow}
        disabled={isLoading}
        className="h-7 w-7 shrink-0"
        title={isFollowing ? 'Dejando de seguir...' : isLoading ? 'Siguiendo...' : isFollowing ? 'Siguiendo' : 'Seguir'}
      >
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : isFollowing ? (
          <UserCheck className="h-3.5 w-3.5 text-primary" />
        ) : (
          <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-4">
      {showCounts && (
        <div className="flex gap-4 text-sm text-muted-foreground">
          <div>
            <span className="font-semibold text-foreground">{followersCount}</span> seguidores
          </div>
          <div>
            <span className="font-semibold text-foreground">{followingCount}</span> siguiendo
          </div>
        </div>
      )}
      <Button
        variant={isFollowing ? 'outline' : variant}
        size={size}
        onClick={handleFollow}
        disabled={isLoading}
        className={isFollowing ? 'border-primary' : ''}
      >
        {isLoading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : isFollowing ? (
          <UserCheck className="mr-2 h-4 w-4" />
        ) : (
          <UserPlus className="mr-2 h-4 w-4" />
        )}
        {isFollowing ? 'Siguiendo' : 'Seguir'}
      </Button>
    </div>
  );
}
