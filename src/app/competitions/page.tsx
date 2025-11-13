'use client';

import { PageHeader } from '@/components/page-header';
import { useUser, useFirestore } from '@/firebase';
import { Loader2, Users, Bell, Search, Swords, Trophy, History } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { InvitationsSheet } from '@/components/invitations-sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CompetitionCard } from '@/components/competition-card';

export default function CompetitionsPage() {
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();

  if (userLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!user) {
    return (
      <Alert>
        <Users className="h-4 w-4" />
        <AlertTitle>Iniciar Sesión</AlertTitle>
        <AlertDescription>
          Iniciá sesión para ver y gestionar los desafíos de tus equipos.
        </AlertDescription>
      </Alert>
    );
  }
  
  if (!user.activeGroupId) {
    return (
      <Alert>
        <Users className="h-4 w-4" />
        <AlertTitle>Sin Grupo Activo</AlertTitle>
        <AlertDescription>
          Creá o unite a un grupo para acceder a las competiciones.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Competiciones"
        description="Gestioná partidos amistosos, ligas y copas con tus equipos"
      >
        <InvitationsSheet />
      </PageHeader>

      <Tabs defaultValue="friendly" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="friendly">Amistosos</TabsTrigger>
          <TabsTrigger value="leagues">Ligas</TabsTrigger>
          <TabsTrigger value="cups">Copas</TabsTrigger>
        </TabsList>
        
        <TabsContent value="friendly" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <CompetitionCard
                    title="Desafíos Recibidos"
                    description="Aceptá o rechazá los desafíos de otros equipos."
                    icon={Bell}
                    href="/competitions/challenges"
                    variant="challenges"
                    stats={[{ label: 'Pendientes', value: 0 }]}
                />
                <CompetitionCard
                    title="Mis Postulaciones"
                    description="Hacé que tus equipos estén disponibles para recibir desafíos."
                    icon={Users}
                    href="/competitions/my-teams"
                    variant="teams"
                />
                <CompetitionCard
                    title="Buscar Rivales"
                    description="Encontrá equipos disponibles y aceptá sus postulaciones."
                    icon={Search}
                    href="/competitions/search"
                    variant="search"
                />
                 <CompetitionCard
                    title="Historial de Amistosos"
                    description="Revisá todos los partidos amistosos que has jugado."
                    icon={History}
                    href="/competitions/history"
                    variant="history"
                />
            </div>
        </TabsContent>

        <TabsContent value="leagues">
           <div className="text-center py-16 border-2 border-dashed rounded-xl">
              <Trophy className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">Sistema de Ligas</h3>
              <p className="mt-2 text-sm text-muted-foreground">Próximamente podrás crear y participar en ligas personalizadas.</p>
           </div>
        </TabsContent>
        <TabsContent value="cups">
            <div className="text-center py-16 border-2 border-dashed rounded-xl">
                <Trophy className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">Copas de Eliminación</h3>
                <p className="mt-2 text-sm text-muted-foreground">Próximamente podrás armar copas de eliminación directa.</p>
            </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
