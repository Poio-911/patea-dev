'use client';
export const dynamic = 'force-dynamic';

import { useUser } from '@/firebase';
import { PageHeader } from '@/components/page-header';
import { RankingsPanel } from '@/components/rankings/rankings-panel';

export default function RankingsPage() {
  const { user } = useUser();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Rankings"
        description={
          user?.activeGroupId
            ? 'Los mejores jugadores de tu grupo en cada categoría.'
            : 'Rankings globales de todos los jugadores.'
        }
      />
      <RankingsPanel groupId={user?.activeGroupId} userId={user?.uid} />
    </div>
  );
}
