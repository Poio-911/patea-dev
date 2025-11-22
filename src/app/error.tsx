'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { SoccerPlayerIcon } from '@/components/icons/soccer-player-icon';
import { ArrowLeft, RefreshCw } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-center p-4">
      <div className="max-w-md">
        <SoccerPlayerIcon className="mx-auto h-20 w-20 text-destructive" />
        <h1 className="mt-8 text-5xl font-bold font-headline text-foreground">500</h1>
        <h2 className="mt-4 text-2xl font-semibold text-foreground">Algo salió mal</h2>
        <p className="mt-2 text-muted-foreground">
          Parece que metimos un gol en contra. ¡No te preocupes, vamos a arreglarlo!
        </p>
        <div className="mt-8 flex gap-4 justify-center">
          <Button onClick={() => reset()} variant="default">
            <RefreshCw className="mr-2 h-4 w-4" />
            Intentar de nuevo
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver al inicio
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
