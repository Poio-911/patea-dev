
'use client';

import { PageHeader } from '@/components/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Trophy } from 'lucide-react';
import Link from 'next/link';

export default function CompetitionsPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Competiciones"
        description="Organizá torneos o desafiá a otros equipos a un amistoso."
      />
      
      <div className="text-center p-8 border-2 border-dashed rounded-lg">
          <Trophy className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold">Próximamente</h2>
          <p className="text-muted-foreground mt-2">
            Esta sección está en construcción. Pronto podrás crear y participar en ligas, copas y amistosos inter-grupales.
          </p>
          <Button asChild variant="link" className="mt-4">
              <Link href="/dashboard">Volver al Panel</Link>
          </Button>
      </div>

    </div>
  );
}
