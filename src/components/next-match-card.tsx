'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, MapPin, ArrowRight, Eye } from 'lucide-react';
import type { Match } from '@/lib/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface NextMatchCardProps {
  match: Match | null;
}

const InfoRow = ({ icon: Icon, text }: { icon: React.ElementType, text: string | undefined }) => (
    <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span>{text}</span>
    </div>
);

export function NextMatchCard({ match }: NextMatchCardProps) {
  if (!match) {
    return (
       <Card>
            <CardHeader>
                <CardTitle>Próximo Partido</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col items-center justify-center text-center border-2 border-dashed border-muted-foreground/30 rounded-xl p-12">
                    <Calendar className="h-12 w-12 text-muted-foreground/50" />
                    <h2 className="mt-4 text-xl font-semibold">No hay partidos próximos</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Programa un nuevo partido para empezar a jugar.
                    </p>
                    <Button asChild variant="default" className="mt-4">
                        <Link href="/matches">
                            <Calendar className="mr-2 h-4 w-4" />
                            Ir a Partidos
                        </Link>
                    </Button>
                </div>
            </CardContent>
       </Card>
    );
  }

  return (
    <Card className="border-primary/50 border-2">
      <CardHeader>
        <CardTitle className="text-primary">Próximo Partido: {match.title}</CardTitle>
        <CardDescription>¡Prepárate para el siguiente encuentro!</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        <div className="md:col-span-2 space-y-3">
             <InfoRow icon={Calendar} text={match.date ? format(new Date(match.date), "EEEE, d 'de' MMMM, yyyy", { locale: es }) : 'Fecha no definida'} />
             <InfoRow icon={Clock} text={match.time} />
             <InfoRow icon={MapPin} text={match.location} />
        </div>
        <div className="flex justify-center items-center">
            <Button asChild size="lg">
                <Link href="/matches">
                    Ver Detalles
                    <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
            </Button>
        </div>
      </CardContent>
    </Card>
  );
}
