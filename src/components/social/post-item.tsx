'use client';

import { useState, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNowStrict } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { SocialActivity, Reactions } from '@/lib/types';
import { PostContent } from './post-content';
import { PostActions } from './post-actions';
import { RepostIndicator } from './repost-indicator';
import { CommentsDialog } from './comments-dialog';
import { getOriginalActivityAction, hasUserRepostedAction } from '@/lib/actions/social-feed-actions';

interface PostItemProps {
  activity: SocialActivity;
  userId?: string;
  userName?: string;
  userPhotoUrl?: string;
  onRefresh?: () => void;
}

export function PostItem({
  activity,
  userId,
  userName,
  userPhotoUrl,
  onRefresh,
}: PostItemProps) {
  const [showComments, setShowComments] = useState(false);
  const [localCommentCount, setLocalCommentCount] = useState(activity.commentCount || 0);
  const [originalActivity, setOriginalActivity] = useState<SocialActivity | null>(null);
  const [hasUserReposted, setHasUserReposted] = useState(false);
  const [isLoadingOriginal, setIsLoadingOriginal] = useState(false);

  const isRepost = Boolean(activity.isRepost && activity.originalActivityId);
  const displayActivity = isRepost && originalActivity ? originalActivity : activity;

  // Calculate time ago
  const rawTs: any = activity.timestamp;
  const dateObj = rawTs && typeof rawTs?.toDate === 'function' ? rawTs.toDate() : new Date(rawTs);
  const timeAgo = formatDistanceToNowStrict(dateObj, { locale: es, addSuffix: false });

  // Load original activity if this is a repost
  useEffect(() => {
    if (isRepost && activity.originalActivityId) {
      setIsLoadingOriginal(true);
      getOriginalActivityAction(activity.originalActivityId).then((result) => {
        if (result.success && result.activity) {
          setOriginalActivity(result.activity);
        }
        setIsLoadingOriginal(false);
      });
    }
  }, [isRepost, activity.originalActivityId]);

  // Check if current user has reposted this activity
  useEffect(() => {
    if (userId && !isRepost) {
      hasUserRepostedAction(activity.id, userId).then((result) => {
        if (result.success) {
          setHasUserReposted(result.hasReposted || false);
        }
      });
    }
  }, [activity.id, userId, isRepost]);

  const handleCommentCountChange = (delta: number) => {
    setLocalCommentCount((prev) => Math.max(0, prev + delta));
  };

  const playerLink = displayActivity.playerId ? `/players/${displayActivity.playerId}` : null;
  const isOwnPost = userId === displayActivity.userId;

  // Ensure reactions object has all fields
  const reactions: Reactions = {
    fire: displayActivity.reactions?.fire || [],
    clap: displayActivity.reactions?.clap || [],
    goal: displayActivity.reactions?.goal || [],
  };

  return (
    <>
      <article
        className={cn(
          'border-b border-border transition-colors hover:bg-muted/30',
          isLoadingOriginal && 'opacity-60'
        )}
      >
        {/* Repost indicator */}
        {isRepost && activity.repostedBy && (
          <RepostIndicator
            userName={activity.repostedBy.userName}
            userId={activity.repostedBy.userId}
          />
        )}

        <div className="px-4 py-3">
          <div className="flex gap-3">
            {/* Avatar */}
            <Link href={playerLink || '#'} className="shrink-0">
              <Avatar className="h-10 w-10 md:h-12 md:w-12 ring-2 ring-foreground/10 hover:ring-foreground/30 transition-all">
                {displayActivity.playerPhotoUrl && (
                  <AvatarImage
                    src={displayActivity.playerPhotoUrl}
                    alt={displayActivity.playerName}
                  />
                )}
                <AvatarFallback>
                  {(displayActivity.playerName || 'U').charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </Link>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Header: Name and time */}
              <div className="flex items-center gap-2 text-sm">
                {playerLink ? (
                  <Link
                    href={playerLink}
                    className="font-semibold hover:underline truncate"
                  >
                    {displayActivity.playerName || 'Usuario'}
                  </Link>
                ) : (
                  <span className="font-semibold truncate">
                    {displayActivity.playerName || 'Usuario'}
                  </span>
                )}
                <span className="text-muted-foreground shrink-0">·</span>
                <span className="text-muted-foreground text-xs shrink-0">
                  {timeAgo}
                </span>
              </div>

              {/* Post content */}
              <div className="mt-1">
                <PostContent
                  activity={displayActivity}
                  isRepostContent={isRepost}
                />
              </div>

              {/* Actions bar */}
              <PostActions
                activityId={isRepost ? activity.originalActivityId! : activity.id}
                reactions={reactions}
                commentCount={localCommentCount}
                repostCount={displayActivity.repostCount || 0}
                userId={userId}
                userName={userName}
                userPhotoUrl={userPhotoUrl}
                hasUserReposted={hasUserReposted}
                isOwnPost={isOwnPost}
                isRepost={isRepost}
                onCommentClick={() => setShowComments(true)}
                onRepostChange={onRefresh}
              />
            </div>
          </div>
        </div>
      </article>

      {/* Comments dialog */}
      <CommentsDialog
        open={showComments}
        onOpenChange={setShowComments}
        activityId={isRepost ? activity.originalActivityId! : activity.id}
        userId={userId}
        userName={userName}
        userPhotoUrl={userPhotoUrl}
        onCommentCountChange={handleCommentCountChange}
      />
    </>
  );
}

export default PostItem;
