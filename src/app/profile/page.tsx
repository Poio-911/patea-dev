
'use client';

import { useUser } from '@/firebase';
import { PageHeader } from '@/components/page-header';
import { Loader2 } from 'lucide-react';
import PlayerProfileView from '@/components/player-profile-view';
import { SoccerPlayerIcon } from '@/components/icons/soccer-player-icon';

export default function ProfilePage() {
  const { user, loading: userLoading } = useUser();
  
  if (userLoading) {
    return <div className="flex justify-center items-center h-full"><SoccerPlayerIcon className="h-16 w-16 color-cycle-animation" /></div>;
  }

  if (!user) {
    return <div>No se encontraron datos del perfil.</div>;
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
