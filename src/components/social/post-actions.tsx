'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MessageCircle, Repeat2, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ReactionPicker } from './reaction-picker';
import type { Reactions, ReactionType } from '@/lib/types';
import {
  addReactionAction,
  removeReactionAction,
  repostActivityAction,
  unrepostActivityAction,
} from '@/lib/actions/social-feed-actions';
import { useToast } from '@/hooks/use-toast';

interface PostActionsProps {
  activityId: string;
  reactions: Reactions;
  commentCount: number;
  repostCount: number;
  userId?: string;
  userName?: string;
  userPhotoUrl?: string;
  hasUserReposted?: boolean;
  isOwnPost?: boolean;
  isRepost?: boolean;
  onCommentClick: () => void;
  onRepostChange?: () => void;
}

export function PostActions({
  activityId,
  reactions,
  commentCount,
  repostCount,
  userId,
  userName,
  userPhotoUrl,
  hasUserReposted = false,
  isOwnPost = false,
  isRepost = false,
  onCommentClick,
  onRepostChange,
}: PostActionsProps) {
  const { toast } = useToast();
  const [localReactions, setLocalReactions] = useState<Reactions>(reactions);
  const [localRepostCount, setLocalRepostCount] = useState(repostCount);
  const [localHasReposted, setLocalHasReposted] = useState(hasUserReposted);
  const [isReposting, setIsReposting] = useState(false);

  const handleReact = async (type: ReactionType) => {
    if (!userId) return;

    // Optimistic update
    setLocalReactions((prev) => ({
      ...prev,
      [type]: [...(prev[type] || []), userId],
    }));

    const result = await addReactionAction(activityId, userId, type);
    if (!result.success) {
      // Revert on error
      setLocalReactions((prev) => ({
        ...prev,
        [type]: (prev[type] || []).filter((id) => id !== userId),
      }));
    }
  };

  const handleUnreact = async (type: ReactionType) => {
    if (!userId) return;

    // Optimistic update
    setLocalReactions((prev) => ({
      ...prev,
      [type]: (prev[type] || []).filter((id) => id !== userId),
    }));

    const result = await removeReactionAction(activityId, userId, type);
    if (!result.success) {
      // Revert on error
      setLocalReactions((prev) => ({
        ...prev,
        [type]: [...(prev[type] || []), userId],
      }));
    }
  };

  const handleRepost = async () => {
    if (!userId || !userName || isReposting) return;

    setIsReposting(true);

    if (localHasReposted) {
      // Unrepost
      setLocalHasReposted(false);
      setLocalRepostCount((prev) => Math.max(0, prev - 1));

      const result = await unrepostActivityAction(activityId, userId);
      if (!result.success) {
        setLocalHasReposted(true);
        setLocalRepostCount((prev) => prev + 1);
        toast({
          title: 'Error',
          description: result.error || 'No se pudo quitar el repost',
          variant: 'destructive',
        });
      } else {
        onRepostChange?.();
      }
    } else {
      // Repost
      setLocalHasReposted(true);
      setLocalRepostCount((prev) => prev + 1);

      const result = await repostActivityAction(activityId, userId, userName, userPhotoUrl);
      if (!result.success) {
        setLocalHasReposted(false);
        setLocalRepostCount((prev) => Math.max(0, prev - 1));
        toast({
          title: 'Error',
          description: result.error || 'No se pudo repostear',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Reposteado',
          description: 'El post se compartió en tu feed',
        });
        onRepostChange?.();
      }
    }

    setIsReposting(false);
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/social?post=${activityId}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Compartir actividad',
          url: shareUrl,
        });
      } catch {
        // User cancelled or share failed
      }
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: 'Link copiado',
        description: 'El link se copió al portapapeles',
      });
    }
  };

  return (
    <div className="flex items-center justify-between pt-2 -ml-2">
      <div className="flex items-center gap-1">
        {/* Comments */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 gap-1.5 text-muted-foreground hover:text-foreground hover:bg-blue-500/10"
          onClick={onCommentClick}
          aria-label="Comentar"
        >
          <MessageCircle className="h-4 w-4" />
          {commentCount > 0 && (
            <span className="text-xs tabular-nums">{commentCount}</span>
          )}
        </Button>

        {/* Repost */}
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-8 px-2 gap-1.5 text-muted-foreground hover:text-foreground hover:bg-green-500/10',
            localHasReposted && 'text-green-500'
          )}
          onClick={handleRepost}
          disabled={!userId || isOwnPost || isRepost || isReposting}
          aria-label={localHasReposted ? 'Quitar repost' : 'Repostear'}
          aria-pressed={localHasReposted}
        >
          <Repeat2 className={cn('h-4 w-4', localHasReposted && 'text-green-500')} />
          {localRepostCount > 0 && (
            <span className="text-xs tabular-nums">{localRepostCount}</span>
          )}
        </Button>

        {/* Reactions */}
        <ReactionPicker
          reactions={localReactions}
          userId={userId}
          onReact={handleReact}
          onUnreact={handleUnreact}
          disabled={!userId}
        />
      </div>

      {/* Share */}
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-2 text-muted-foreground hover:text-foreground hover:bg-muted"
        onClick={handleShare}
        aria-label="Compartir"
      >
        <Share2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default PostActions;
