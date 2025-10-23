
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, Navigation, ArrowRight } from 'lucide-react';
import type { Match } from '@/lib/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { JerseyPreview } from './team-builder/jersey-preview';

interface NextMatchCardProps {
  match: Match | null;
}

const InfoRow = ({ icon: Icon, text, children }: { icon: React.ElementType, text?: string, children?: React.ReactNode }) => (
    <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" />
        {text && <span>{text}</span>}
        {children}
    </div>
);

export function NextMatchCard({ match }: NextMatchCardProps) {
  if (!match) {
    return (
        <div className="flex flex-col items-center justify-center text-center border-2 border-dashed border-muted-foreground/30 rounded-xl p-12 h-full">
            <Calendar className="h-12 w-12 text-muted-foreground/50" />
            <h2 className="mt-4 text-xl font-semibold">No hay fútbol a la vista</h2>
            <p className="mt-2 text-sm text-muted-foreground">
                Armá un nuevo partido para que empiece a rodar la pelota.
            </p>
            <Button asChild variant="default" className="mt-4">
                <Link href="/matches">
                    <Calendar className="mr-2 h-4 w-4" />
                    Ir a Partidos
                </Link>
            </Button>
        </div>
    );
  }
  
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(match.location.address)}&query_place_id=${match.location.placeId}`;
  
  const isTeamMatch = match.type === 'by_teams' && match.teams && match.teams.length === 2;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
      <div className="md:col-span-2 space-y-3">
           {isTeamMatch ? (
                <div className="flex flex-col gap-4">
                    <div className="flex justify-around items-center text-center">
                        <div className="flex flex-col items-center gap-2 w-2/5">
                            <JerseyPreview jersey={match.teams[0].jersey} size="lg" />
                            <h3 className="text-lg font-bold truncate">{match.teams[0].name}</h3>
                        </div>
                        <p className="text-2xl font-bold text-muted-foreground">vs</p>
                        <div className="flex flex-col items-center gap-2 w-2/5">
                            <JerseyPreview jersey={match.teams[1].jersey} size="lg" />
                            <h3 className="text-lg font-bold truncate">{match.teams[1].name}</h3>
                        </div>
                    </div>
                     <InfoRow icon={Calendar} text={match.date ? format(new Date(match.date), "EEEE, d MMM, yyyy", { locale: es }) : 'Fecha no definida'} />
                     <InfoRow icon={Clock} text={`${match.time} hs`} />
                </div>
           ) : (
                <>
                    <h3 className="text-xl font-bold">{match.title}</h3>
                    <InfoRow icon={Calendar} text={match.date ? format(new Date(match.date), "EEEE, d 'de' MMMM, yyyy", { locale: es }) : 'Fecha no definida'} />
                    <InfoRow icon={Clock} text={`${match.time} hs`} />
                    <InfoRow icon={Navigation}>
                        <Button asChild variant="link" className="p-0 h-auto -ml-1 text-sm">
                            <Link href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
                                Ir a la cancha
                            </Link>
                        </Button>
                    </InfoRow>
                </>
           )}
      </div>
      <div className="flex justify-center items-center">
          <Button asChild size="lg">
              <Link href="/matches">
                  Ver Detalles
                  <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
          </Button>
      </div>
    </div>
  );
}
