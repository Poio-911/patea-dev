
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { SoccerPlayerIcon } from '@/components/icons/soccer-player-icon';
import { ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-center p-4">
      <div className="max-w-md">
        <SoccerPlayerIcon className="mx-auto h-20 w-20 text-primary animate-bounce" />
        <h1 className="mt-8 text-5xl font-bold font-headline text-foreground">404</h1>
        <h2 className="mt-4 text-2xl font-semibold text-foreground">Página no encontrada</h2>
        <p className="mt-2 text-muted-foreground">
          Parece que te metiste en una cancha que no existe. ¡No pasa nada, hasta a Messi le ha pasado!
        </p>
        <Button asChild className="mt-8">
          <Link href="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al Vestuario
          </Link>
        </Button>
      </div>
    </div>
  );
}
