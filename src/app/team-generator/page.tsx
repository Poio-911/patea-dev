'use client';
import { PageHeader } from '@/components/page-header';
import { TeamGeneratorClient } from '@/components/team-generator-client';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { useMemo } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Users2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function TeamGeneratorPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  
  const playersQuery = useMemo(() => {
    if (!firestore || !user?.activeGroupId) return null;
    return query(collection(firestore, 'players'), where('groupId', '==', user.activeGroupId));
  }, [firestore, user?.activeGroupId]);

  const { data: players, loading } = useCollection(playersQuery);
  
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Generador de Equipos"
        description="Selecciona jugadores y deja que la IA cree equipos equilibrados para tu partido."
      />
      {loading && <p>Cargando jugadores...</p>}
      
      {!loading && !user?.activeGroupId && (
         <Alert>
            <Users2 className="h-4 w-4" />
            <AlertTitle>No hay grupo activo</AlertTitle>
            <AlertDescription>
                No tienes un grupo activo seleccionado. Por favor, crea o únete a un grupo para usar el generador de equipos.
                <Button asChild variant="link" className="p-0 h-auto ml-1">
                    <Link href="/groups">Ir a la página de grupos</Link>
                </Button>
            </AlertDescription>
         </Alert>
       )}

      {players && user?.activeGroupId && <TeamGeneratorClient allPlayers={players} />}
    </div>
  );
}
