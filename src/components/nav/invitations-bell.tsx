'use client';

import Link from 'next/link';
import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useInvitationsCount } from '@/components/invitations/invitation-badge';
import { cn } from '@/lib/utils';

export function InvitationsBell() {
  const count = useInvitationsCount();

  return (
    <Button variant="ghost" size="icon" asChild className="relative">
      <Link href="/invitations">
        <Mail className="h-5 w-5" />
        {count > 0 && (
          <span
            className={cn(
              "absolute -top-0.5 -right-0.5 flex items-center justify-center",
              "min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full",
              "bg-primary text-primary-foreground"
            )}
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
        <span className="sr-only">
          Invitaciones {count > 0 ? `(${count} pendientes)` : ''}
        </span>
      </Link>
    </Button>
  );
}
