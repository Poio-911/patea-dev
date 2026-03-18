'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
} from '@/components/ui/responsive-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageCircle } from 'lucide-react';
import { CommentItem } from './comment-item';
import { CommentInput } from './comment-input';
import type { SocialComment } from '@/lib/types';
import {
  getCommentsAction,
  addCommentAction,
} from '@/lib/actions/social-feed-actions';
import { useToast } from '@/hooks/use-toast';

interface CommentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activityId: string;
  userId?: string;
  userName?: string;
  userPhotoUrl?: string;
  onCommentCountChange?: (delta: number) => void;
}

export function CommentsDialog({
  open,
  onOpenChange,
  activityId,
  userId,
  userName,
  userPhotoUrl,
  onCommentCountChange,
}: CommentsDialogProps) {
  const { toast } = useToast();
  const [comments, setComments] = useState<SocialComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadComments = useCallback(async () => {
    setIsLoading(true);
    const result = await getCommentsAction(activityId);
    if (result.success && result.comments) {
      setComments(result.comments);
    }
    setIsLoading(false);
  }, [activityId]);

  useEffect(() => {
    if (open) {
      loadComments();
    }
  }, [loadComments, open]);

  const handleSubmitComment = async (text: string) => {
    if (!userId || !userName) {
      toast({
        title: 'Error',
        description: 'Debes iniciar sesion para comentar',
        variant: 'destructive',
      });
      return;
    }

    const result = await addCommentAction(
      activityId,
      userId,
      userName,
      userPhotoUrl,
      text
    );

    if (result.success && result.comment) {
      setComments((prev) => [...prev, result.comment!]);
      onCommentCountChange?.(1);
    } else {
      toast({
        title: 'Error',
        description: result.error || 'No se pudo agregar el comentario',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteComment = () => {
    loadComments();
    onCommentCountChange?.(-1);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 max-h-[80vh] flex flex-col">
        <DialogHeader className="p-4 border-b border-border">
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Comentarios
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="px-4 divide-y divide-border">
            {isLoading ? (
              // Loading skeleton
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-3 py-3">
                  <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                </div>
              ))
            ) : comments.length === 0 ? (
              // Empty state
              <div className="py-12 text-center text-muted-foreground">
                <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No hay comentarios aun</p>
                <p className="text-xs mt-1">Se el primero en comentar</p>
              </div>
            ) : (
              // Comments list
              comments.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  activityId={activityId}
                  currentUserId={userId}
                  onDelete={handleDeleteComment}
                />
              ))
            )}
          </div>
        </ScrollArea>

        {/* Comment input */}
        <CommentInput
          userPhotoUrl={userPhotoUrl}
          userName={userName}
          onSubmit={handleSubmitComment}
          disabled={!userId}
          autoFocus={open}
        />
      </DialogContent>
    </Dialog>
  );
}

export default CommentsDialog;
