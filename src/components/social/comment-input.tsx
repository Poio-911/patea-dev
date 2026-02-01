'use client';

import { useState, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CommentInputProps {
  userPhotoUrl?: string;
  userName?: string;
  onSubmit: (text: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}

export function CommentInput({
  userPhotoUrl,
  userName,
  onSubmit,
  disabled = false,
  placeholder = 'Escribe un comentario...',
  autoFocus = false,
}: CommentInputProps) {
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = async () => {
    if (!text.trim() || isSubmitting || disabled) return;

    setIsSubmitting(true);
    try {
      await onSubmit(text.trim());
      setText('');
      textareaRef.current?.focus();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const charCount = text.length;
  const maxChars = 500;
  const isOverLimit = charCount > maxChars;

  return (
    <div className="flex gap-3 p-3 border-t border-border">
      <Avatar className="h-8 w-8 shrink-0">
        {userPhotoUrl && <AvatarImage src={userPhotoUrl} alt={userName} />}
        <AvatarFallback className="text-xs">
          {(userName || 'U').charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 flex flex-col gap-2">
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isSubmitting}
          autoFocus={autoFocus}
          rows={1}
          className={cn(
            'min-h-[38px] max-h-[120px] resize-none py-2',
            isOverLimit && 'border-red-500 focus-visible:ring-red-500'
          )}
        />

        <div className="flex items-center justify-between">
          <span
            className={cn(
              'text-xs',
              isOverLimit ? 'text-red-500' : 'text-muted-foreground'
            )}
          >
            {charCount}/{maxChars}
          </span>

          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!text.trim() || isOverLimit || isSubmitting || disabled}
            className="h-8 px-3"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Send className="h-4 w-4 mr-1" />
                Enviar
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default CommentInput;
