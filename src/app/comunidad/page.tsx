'use client';
export const dynamic = 'force-dynamic';

import { useUser } from '@/firebase';
import { PageHeader } from '@/components/page-header';
import { MultiRankings } from '@/components/comunidad/multi-rankings';
import { ActivityTicker } from '@/components/comunidad/activity-ticker';

import { Trophy } from 'lucide-react';

export default function ComunidadPage() {
  const { user } = useUser();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Comunidad"
        description="Rankings internos, actividad reciente y métricas de tu grupo."
        icon={<Trophy className="h-7 w-7" />}
      />

      <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-6 items-start">
        {/* Left: all 6 ranking categories simultaneously */}
        <MultiRankings groupId={user?.activeGroupId} currentUserId={user?.uid} />

        {/* Right: activity ticker (sticky on desktop) */}
        <div className="md:sticky md:top-20">
          <ActivityTicker userId={user?.uid} />
        </div>
      </div>
    </div>
  );
}
