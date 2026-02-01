'use client';

import { Repeat2 } from 'lucide-react';
import Link from 'next/link';

interface RepostIndicatorProps {
  userName: string;
  userId: string;
}

export function RepostIndicator({ userName, userId }: RepostIndicatorProps) {
  return (
    <div className="flex items-center gap-2 px-4 pt-2 pb-1 text-xs text-muted-foreground">
      <Repeat2 className="h-3.5 w-3.5" />
      <span>
        <Link href={`/players/${userId}`} className="font-medium hover:underline">
          {userName}
        </Link>{' '}
        reposteo
      </span>
    </div>
  );
}

export default RepostIndicator;
