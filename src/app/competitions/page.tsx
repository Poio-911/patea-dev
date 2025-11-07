
'use client';

import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Swords } from 'lucide-react';
import Link from 'next/link';

export default function CompetitionsPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Competiciones"
        description="Organizá torneos o desafiá a otros equipos a un amistoso."
      >
        <Button asChild>
            <Link href="/competitions/find-opponent">
                <Swords className="mr-2 h-4 w-4" />
                Buscar Rival
            </Link>
        </Button>
      </PageHeader>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border-2 border-dashed rounded-lg p-8 text-center flex flex-col items-center justify-center">
            <h3 className="text-lg font-semibold">Ligas y Copas</h3>
            <p className="text-sm text-muted-foreground mt-2">Próximamente podrás crear y participar en torneos de todos contra todos o eliminación directa.</p>
        </div>
        <div className="border-2 border-dashed rounded-lg p-8 text-center flex flex-col items-center justify-center">
             <h3 className="text-lg font-semibold">Amistosos</h3>
            <p className="text-sm text-muted-foreground mt-2">Desafía a otros equipos de la plataforma a partidos amistosos para medir fuerzas.</p>
        </div>
      </div>

    </div>
  );
}
