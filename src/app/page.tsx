'use client';

import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Goal } from 'lucide-react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { useAuth } from '@/firebase';

export default function HomePage() {
  const { user, loading } = useUser();
  const router = useRouter();
  const auth = useAuth();

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  const handleLogin = async () => {
    if (!auth) return;
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      // The useEffect will handle the redirect
    } catch (error) {
      console.error('Error al iniciar sesión con Google', error);
    }
  };

  if (loading || user) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Goal className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="mx-auto flex w-full max-w-md flex-col items-center justify-center space-y-6">
        <div className="flex items-center gap-4">
          <Goal className="h-16 w-16 text-primary" />
          <h1 className="text-4xl font-bold font-headline">Manager de Fútbol Amateur</h1>
        </div>
        <p className="text-center text-lg text-muted-foreground">
          Organiza partidos, gestiona tus jugadores y genera equipos equilibrados con el poder de la IA.
        </p>
        <Button onClick={handleLogin} size="lg" className="w-full">
          Iniciar sesión con Google
        </Button>
      </div>
    </div>
  );
}
