
'use client';

import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { SoccerPlayerIcon } from '@/components/icons/soccer-player-icon';
import { Trophy } from 'lucide-react';

export default function HomePage() {
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      if (user.role === 'organizer') {
        router.push('/organizer');
      } else {
        router.push('/dashboard');
      }
    }
  }, [user, loading, router]);


  if (loading || user) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <SoccerPlayerIcon className="h-16 w-16 color-cycle-animation" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="mx-auto flex w-full max-w-3xl flex-grow flex-col items-center justify-center space-y-8 text-center">
        <div className="flex items-center gap-4">
          <SoccerPlayerIcon className="h-16 w-16 text-primary" />
          <h1 className="text-6xl font-bold font-headline">Pateá</h1>
        </div>
        <p className="text-lg text-muted-foreground">
          Elegí cómo querés usar Pateá.
        </p>

        <div className="grid w-full gap-4 md:grid-cols-2">
          <div className="rounded-2xl border bg-card p-6 text-left shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <SoccerPlayerIcon className="h-8 w-8 text-primary" />
              <h2 className="text-xl font-bold">App Clásica</h2>
            </div>
            <p className="mb-6 text-sm text-muted-foreground">
              Jugadores, grupos, partidos y estadísticas de siempre.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild className="w-full">
                <Link href="/login">Iniciar sesión</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/register">Registrarse</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-6 text-left shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <Trophy className="h-8 w-8 text-primary" />
              <h2 className="text-xl font-bold">Organizer</h2>
            </div>
            <p className="mb-6 text-sm text-muted-foreground">
              Panel para organizar ligas y copas con tu propio flujo.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild className="w-full">
                <Link href="/organizer/login">Entrar</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/organizer/login">Crear cuenta</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
