
'use client';

import { PageHeader } from '@/components/page-header';
import { useUser } from '@/firebase';
import { Loader2, Users } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { InvitationsSheet } from '@/components/invitations-sheet';

export default function CompetitionsPage() {
  const { user, loading: userLoading } = useUser();

  if (userLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  
  if (!user) {
    return (
        <Alert>
            <Users className="h-4 w-4" />
            <AlertTitle>Sección en desarrollo</AlertTitle>
            <AlertDescription>
                Inicia sesión para ver y gestionar los desafíos de tus equipos.
            </AlertDescription>
        </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Competiciones"
        description="Gestioná los desafíos recibidos y enviados. Próximamente: Ligas y Copas."
      >
        <InvitationsSheet />
      </PageHeader>
      
      <div className="border-2 border-dashed rounded-lg p-8 text-center flex flex-col items-center justify-center min-h-[400px]">
        <h3 className="text-lg font-semibold">Próximamente...</h3>
        <p className="text-sm text-muted-foreground mt-2">
            Acá vas a poder ver las Ligas y Copas en las que participen tus equipos.
        </p>
         <Button asChild variant="link" className="mt-4">
            <Link href="/groups">Gestionar mis equipos</Link>
        </Button>
      </div>
    </div>
  );
}
