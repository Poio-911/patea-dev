'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { UserPlus, UserCheck, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore } from '@/firebase';
import { doc, getDoc, collection, getCountFromServer, writeBatch, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

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
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  // Check if current user is following target user using client SDK
  useEffect(() => {
    const checkFollowStatus = async () => {
      if (!firestore || !user || user.uid === targetUserId) {
        setIsChecking(false);
        return;
      }

      setIsChecking(true);
      try {
        const followingDoc = await getDoc(
          doc(firestore, 'users', user.uid, 'following', targetUserId)
        );
        setIsFollowing(followingDoc.exists());
      } catch (error) {
        console.error('Error checking follow status:', error);
      } finally {
        setIsChecking(false);
      }
    };

    checkFollowStatus();
  }, [firestore, user, targetUserId]);

  // Load follower/following counts if showCounts is true using client SDK
  useEffect(() => {
    const loadCounts = async () => {
      if (!firestore || !showCounts) return;

      try {
        const [followersSnapshot, followingSnapshot] = await Promise.all([
          getCountFromServer(collection(firestore, 'users', targetUserId, 'followers')),
          getCountFromServer(collection(firestore, 'users', targetUserId, 'following')),
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
    if (!firestore || !user) {
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
        // Unfollow using client SDK
        const batch = writeBatch(firestore);

        // Remove from follower's "following" subcollection
        const followingRef = doc(firestore, 'users', user.uid, 'following', targetUserId);
        batch.delete(followingRef);

        // Remove from target user's "followers" subcollection
        const followerRef = doc(firestore, 'users', targetUserId, 'followers', user.uid);
        batch.delete(followerRef);

        await batch.commit();

        setIsFollowing(false);
        setFollowersCount((prev) => Math.max(0, prev - 1));
        toast({
          title: 'Dejaste de seguir',
          description: 'Ya no seguís a este usuario.',
        });
      } else {
        // Follow using client SDK
        const batch = writeBatch(firestore);

        // Add to follower's "following" subcollection
        const followingRef = doc(firestore, 'users', user.uid, 'following', targetUserId);
        batch.set(followingRef, {
          userId: targetUserId,
          createdAt: new Date().toISOString(),
        });

        // Add to target user's "followers" subcollection
        const followerRef = doc(firestore, 'users', targetUserId, 'followers', user.uid);
        batch.set(followerRef, {
          userId: user.uid,
          createdAt: new Date().toISOString(),
        });

        await batch.commit();

        setIsFollowing(true);
        setFollowersCount((prev) => prev + 1);
        toast({
          title: '¡Seguido!',
          description: 'Ahora seguís a este usuario.',
        });
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
