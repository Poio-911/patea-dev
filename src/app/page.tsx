'use client';

import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Goal } from 'lucide-react';
import Link from 'next/link';

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
        <Goal className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="mx-auto flex w-full max-w-md flex-col items-center justify-center space-y-6 text-center">
        <div className="flex items-center gap-4">
          <Goal className="h-16 w-16 text-primary" />
          <h1 className="text-4xl font-bold font-headline">Manager de Fútbol Amateur</h1>
        </div>
        <p className="text-lg text-muted-foreground">
          Organiza partidos, gestiona tus jugadores y genera equipos equilibrados con el poder de la IA.
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
    </div>
  );
}
