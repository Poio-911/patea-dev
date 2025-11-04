
'use client';

import { useParams } from 'next/navigation';
import { useDoc, useUser, useFirestore } from '@/firebase';
import { doc, collection, query, where, getDoc, addDoc } from 'firebase/firestore';
import type { Player } from '@/lib/types';
import { Loader2, ArrowLeft } from 'lucide-react';
import { CoachChatView } from '@/components/coach-chat-view';
import { PlayerInsightsPanel } from '@/components/player-insights-panel';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function AnalysisPage() {
  const { id: playerId } = useParams();
  const { user } = useUser();
  const firestore = useFirestore();

  const playerRef = firestore && playerId ? doc(firestore, 'players', playerId as string) : null;
  const { data: player, loading: playerLoading } = useDoc<Player>(playerRef);

  if (playerLoading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!player) {
    return <div className="text-center">Jugador no encontrado.</div>;
  }

  if (!user || user.uid !== playerId) {
    return <div className="text-center">Solo puedes acceder a tu propio análisis avanzado.</div>;
  }

  // ✅ CORRECCIÓN: Añadir esta comprobación para asegurar que user no es null
  if (!user) {
    return <div className="text-center">No se pudo cargar la información del usuario.</div>;
  }

  return (
    <div className="flex flex-col gap-6">
        <div className="flex w-full items-center justify-between">
             <Button asChild variant="outline" className="self-start">
                <Link href={`/players/${playerId}`}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Volver al Perfil
                </Link>
            </Button>
        </div>
        <PageHeader
            title="Análisis Avanzado con IA"
            description={`Explorá tu rendimiento y recibí consejos del DT virtual para ${player.name}.`}
        />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="flex flex-col gap-4">
            <CoachChatView playerId={playerId as string} groupId={user.activeGroupId || ''} />
        </div>
        <div className="flex flex-col gap-4">
            <PlayerInsightsPanel playerId={playerId as string} playerName={player.name} groupId={user.activeGroupId || ''} />
        </div>
      </div>
    </div>
  );
}
