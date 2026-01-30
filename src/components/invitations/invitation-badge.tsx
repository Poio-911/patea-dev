'use client';

import { useMemo } from 'react';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collectionGroup, query, where } from 'firebase/firestore';
import type { Invitation } from '@/lib/types';
import { cn } from '@/lib/utils';

interface InvitationBadgeProps {
  className?: string;
  showZero?: boolean;
}

export function InvitationBadge({ className, showZero = false }: InvitationBadgeProps) {
  const { user } = useUser();
  const firestore = useFirestore();

  const invitationsQuery = useMemo(() => {
    if (!firestore || !user?.uid) return null;
    return query(
      collectionGroup(firestore, 'invitations'),
      where('playerId', '==', user.uid),
      where('status', '==', 'pending')
    );
  }, [firestore, user?.uid]);

  const { data: invitations } = useCollection<Invitation>(invitationsQuery);
  const count = invitations?.length || 0;

  if (count === 0 && !showZero) {
    return null;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full",
        count > 0
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground",
        className
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

export function useInvitationsCount(): number {
  const { user } = useUser();
  const firestore = useFirestore();

  const invitationsQuery = useMemo(() => {
    if (!firestore || !user?.uid) return null;
    return query(
      collectionGroup(firestore, 'invitations'),
      where('playerId', '==', user.uid),
      where('status', '==', 'pending')
    );
  }, [firestore, user?.uid]);

  const { data: invitations } = useCollection<Invitation>(invitationsQuery);
  return invitations?.length || 0;
}
