
'use client';

import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { SoccerPlayerIcon } from '@/components/icons/soccer-player-icon';
import { WhatsAppIcon } from '@/components/icons/whatsapp-icon';
import { Mail } from 'lucide-react';

export default function HomePage() {
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
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
      <div className="mx-auto flex w-full max-w-md flex-grow flex-col items-center justify-center space-y-6 text-center">
        <div className="flex items-center gap-4">
          <SoccerPlayerIcon className="h-16 w-16 text-primary" />
          <h1 className="text-6xl font-bold font-headline">Pateá</h1>
        </div>
        <p className="text-lg text-muted-foreground">
          Una app para organizar los partidos entre amigos: armás equipos, anotás los resultados y llevás la cuenta de quién juega bien y quién se hace el lesionado.
        </p>
        <div className="flex w-full flex-col gap-4 sm:flex-row">
            <Button asChild size="lg" className="w-full">
                <Link href="/login">Iniciar Sesión</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full">
                <Link href="/register">Registrarse</Link>
            </Button>
        </div>
      </div>
       <footer className="py-4 text-center text-sm text-muted-foreground">
          <p className="font-semibold">Desarrollado por Santiago López</p>
          <div className="flex items-center justify-center gap-4 mt-2">
            <a href="mailto:lopeztoma.santiago@gmail.com" className="flex items-center gap-1 hover:text-primary transition-colors">
                <Mail className="h-4 w-4"/>
                <span>lopeztoma.santiago@gmail.com</span>
            </a>
            <a href="https://wa.me/59892443585" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-primary transition-colors">
                <WhatsAppIcon className="h-4 w-4" />
                <span>+598 92 443 585</span>
            </a>
          </div>
      </footer>
    </div>
  );
}
