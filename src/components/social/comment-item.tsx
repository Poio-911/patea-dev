'use client';

import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Heart, Trash2, MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { formatDistanceToNowStrict } from 'date-fns';
import { es } from 'date-fns/locale';
import type { SocialComment } from '@/lib/types';
import {
  likeCommentAction,
  unlikeCommentAction,
  deleteCommentAction,
} from '@/lib/actions/social-feed-actions';
import {
  ResponsiveAlertDialog as AlertDialog,
  ResponsiveAlertDialogAction as AlertDialogAction,
  ResponsiveAlertDialogCancel as AlertDialogCancel,
  ResponsiveAlertDialogContent as AlertDialogContent,
  ResponsiveAlertDialogDescription as AlertDialogDescription,
  ResponsiveAlertDialogFooter as AlertDialogFooter,
  ResponsiveAlertDialogHeader as AlertDialogHeader,
  ResponsiveAlertDialogTitle as AlertDialogTitle,
} from '@/components/ui/responsive-alert-dialog';

interface CommentItemProps {
  comment: SocialComment;
  activityId: string;
  currentUserId?: string;
  onDelete?: () => void;
}

export function CommentItem({
  comment,
  activityId,
  currentUserId,
  onDelete,
}: CommentItemProps) {
  const [likes, setLikes] = useState<string[]>(comment.likes || []);
  const [isLiking, setIsLiking] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isOwner = currentUserId === comment.userId;
  const hasLiked = currentUserId ? likes.includes(currentUserId) : false;
  const likeCount = likes.length;

  const rawTs: any = comment.createdAt;
  const dateObj = rawTs && typeof rawTs?.toDate === 'function' ? rawTs.toDate() : new Date(rawTs);
  const timeAgo = formatDistanceToNowStrict(dateObj, { locale: es, addSuffix: true });

  const handleLike = async () => {
    if (!currentUserId || isLiking) return;

    setIsLiking(true);

    if (hasLiked) {
      // Optimistic unlike
      setLikes((prev) => prev.filter((id) => id !== currentUserId));
      const result = await unlikeCommentAction(activityId, comment.id, currentUserId);
      if (!result.success) {
        setLikes((prev) => [...prev, currentUserId]);
      }
    } else {
      // Optimistic like
      setLikes((prev) => [...prev, currentUserId]);
      const result = await likeCommentAction(activityId, comment.id, currentUserId);
      if (!result.success) {
        setLikes((prev) => prev.filter((id) => id !== currentUserId));
      }
    }

    setIsLiking(false);
  };

  const handleDelete = async () => {
    if (!currentUserId || isDeleting) return;

    setIsDeleting(true);
    const result = await deleteCommentAction(activityId, comment.id, currentUserId);
    setIsDeleting(false);

    if (result.success) {
      setShowDeleteDialog(false);
      onDelete?.();
    }
  };

  return (
    <>
      <div className="flex gap-3 py-3">
        <Avatar className="h-8 w-8 shrink-0">
          {comment.userPhotoUrl && (
            <AvatarImage src={comment.userPhotoUrl} alt={comment.userName} />
          )}
          <AvatarFallback className="text-xs">
            {(comment.userName || 'U').charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{comment.userName}</span>
            <span className="text-xs text-muted-foreground">{timeAgo}</span>

            {isOwner && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 ml-auto text-muted-foreground hover:text-foreground"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-red-600"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          <p className="text-sm mt-1 whitespace-pre-wrap break-words">
            {comment.text}
          </p>

          <div className="flex items-center gap-2 mt-2">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'h-7 px-2 gap-1 text-xs',
                hasLiked ? 'text-pink-500' : 'text-muted-foreground'
              )}
              onClick={handleLike}
              disabled={!currentUserId || isLiking}
            >
              <Heart
                className={cn('h-3.5 w-3.5', hasLiked && 'fill-pink-500')}
              />
              {likeCount > 0 && <span>{likeCount}</span>}
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar comentario</AlertDialogTitle>
            <AlertDialogDescription>
              Esta accion no se puede deshacer. El comentario sera eliminado
              permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default CommentItem;
