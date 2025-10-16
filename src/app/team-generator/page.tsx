'use client';
import { PageHeader } from '@/components/page-header';
import { TeamGeneratorClient } from '@/components/team-generator-client';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { useMemo } from 'react';

export default function TeamGeneratorPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const playersQuery = useMemo(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'players'), where('ownerUid', '==', user.uid));
  }, [firestore, user]);
  const { data: players, loading } = useCollection(playersQuery);
  
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Generador de Equipos"
        description="Selecciona jugadores y deja que la IA cree equipos equilibrados para tu partido."
      />
      {loading && <p>Cargando jugadores...</p>}
      {players && <TeamGeneratorClient allPlayers={players} />}
    </div>
  );
}
