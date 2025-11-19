'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { UserPlus, UserCheck, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { followUserAction, unfollowUserAction, isFollowingAction, getFollowersAction, getFollowingAction } from '@/lib/actions/server-actions';
import { useUser } from '@/firebase';

interface FollowButtonProps {
  targetUserId: string; // UID of the user to follow/unfollow
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  showCounts?: boolean; // Show follower/following counts
}

export function FollowButton({
  targetUserId,
  variant = 'default',
  size = 'default',
  showCounts = false,
}: FollowButtonProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  // Check if current user is following target user
  useEffect(() => {
    const checkFollowStatus = async () => {
      if (!user || user.uid === targetUserId) {
        setIsChecking(false);
        return;
      }

      setIsChecking(true);
      try {
        const result = await isFollowingAction(user.uid, targetUserId);
        if (result.success) {
          setIsFollowing(result.isFollowing);
        }
      } catch (error) {
        console.error('Error checking follow status:', error);
      } finally {
        setIsChecking(false);
      }
    };

    checkFollowStatus();
  }, [user, targetUserId]);

  // Load follower/following counts if showCounts is true
  useEffect(() => {
    const loadCounts = async () => {
      if (!showCounts) return;

      try {
        const [followersResult, followingResult] = await Promise.all([
          getFollowersAction(targetUserId),
          getFollowingAction(targetUserId),
        ]);

        if (followersResult.success && followersResult.count !== undefined) {
          setFollowersCount(followersResult.count);
        }

        if (followingResult.success && followingResult.count !== undefined) {
          setFollowingCount(followingResult.count);
        }
      } catch (error) {
        console.error('Error loading counts:', error);
      }
    };

    loadCounts();
  }, [showCounts, targetUserId, isFollowing]); // Reload when isFollowing changes

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
        // Unfollow
        const result = await unfollowUserAction(user.uid, targetUserId);
        if (result.success) {
          setIsFollowing(false);
          setFollowersCount((prev) => Math.max(0, prev - 1));
          toast({
            title: 'Dejaste de seguir',
            description: 'Ya no seguís a este usuario.',
          });
        } else {
          toast({
            variant: 'destructive',
            title: 'Error',
            description: result.error || 'No se pudo dejar de seguir.',
          });
        }
      } else {
        // Follow
        const result = await followUserAction(user.uid, targetUserId);
        if (result.success) {
          setIsFollowing(true);
          setFollowersCount((prev) => prev + 1);
          toast({
            title: '¡Seguido!',
            description: 'Ahora seguís a este usuario.',
          });
        } else {
          toast({
            variant: 'destructive',
            title: 'Error',
            description: result.error || 'No se pudo seguir.',
          });
        }
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Ocurrió un error. Intentá de nuevo.',
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
      <Button variant={variant} size={size} disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
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
