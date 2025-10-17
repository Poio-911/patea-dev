'use client';
import { PageHeader } from '@/components/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function TeamGeneratorPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Generador de Equipos"
        description="Esta función ahora está integrada en la creación de partidos."
      />
      <Alert variant="destructive">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Página Obsoleta</AlertTitle>
        <AlertDescription>
            El generador de equipos ahora es parte del proceso de creación de partidos. 
            Puedes programar un partido nuevo y generar equipos desde la página de Partidos.
          <Button asChild variant="link" className="p-0 h-auto ml-1">
            <Link href="/matches">Ir a Partidos</Link>
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}
