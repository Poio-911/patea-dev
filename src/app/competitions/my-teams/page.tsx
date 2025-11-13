'use client';

import { PageHeader } from '@/components/page-header';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { Loader2, Users } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InvitationsSheet } from '@/components/invitations-sheet';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MyTeamsAvailability } from '@/components/my-teams-availability';
import { collection, query, where } from 'firebase/firestore';
import { useMemo } from 'react';
import type { GroupTeam } from '@/lib/types';

export default function MyTeamsPage() {
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();

  // Query for user's teams
  const teamsQuery = useMemo(() => {
    if (!firestore || !user?.activeGroupId) return null;
    return query(
      collection(firestore, 'teams'),
      where('groupId', '==', user.activeGroupId)
    );
  }, [firestore, user?.activeGroupId]);

  const { data: teams, loading: teamsLoading } = useCollection<GroupTeam>(teamsQuery);

  // Show auth/group errors immediately
  if (userLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!user) {
    return (
      <Alert>
        <Users className="h-4 w-4" />
        <AlertDescription>
          Iniciá sesión para postular tus equipos.
        </AlertDescription>
      </Alert>
    );
  }

  if (!user.activeGroupId) {
    return (
      <Alert>
        <Users className="h-4 w-4" />
        <AlertDescription>
          Creá o unite a un grupo para postular tus equipos.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Mis Equipos"
          description="Gestioná las postulaciones de tus equipos para partidos amistosos"
        >
          <InvitationsSheet />
        </PageHeader>
        <Button asChild variant="outline" className="shrink-0">
          <Link href="/competitions">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Link>
        </Button>
      </div>

      <div>
        <div className="border-l-4 border-l-primary pl-4 mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Users className="h-6 w-6 text-primary" />
            </div>
            Postular Equipos
          </h2>
        </div>
        {teamsLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-5 w-24" />
                      <Skeleton className="h-3 w-16 mt-2" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : teams ? (
          <MyTeamsAvailability teams={teams} userId={user.uid} isActive={true} />
        ) : (
          <Alert>
            <AlertDescription>
              No hay equipos disponibles.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}
