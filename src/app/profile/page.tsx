'use client';

import { useUser } from '@/firebase';
import { PageHeader } from '@/components/page-header';
import PlayerProfileView from '@/components/player-profile-view';
import { SoccerPlayerIcon } from '@/components/icons/soccer-player-icon';

export default function ProfilePage() {
  const { user, loading: userLoading } = useUser();

  if (userLoading) {
    return (
      <div className="flex h-64 w-full items-center justify-center">
        <SoccerPlayerIcon className="h-16 w-16 color-cycle-animation" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center">
        <p>Por favor, inicia sesión para ver tu perfil.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Mi Perfil"
        description="Tu información personal, estadísticas de jugador y actividad."
      />
      <PlayerProfileView playerId={user.uid} />
    </div>
  );
}
