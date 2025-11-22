'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="es">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center bg-background text-center p-4">
          <div className="max-w-md">
            <h1 className="mt-8 text-5xl font-bold text-foreground">Error</h1>
            <h2 className="mt-4 text-2xl font-semibold text-foreground">Algo salió mal</h2>
            <p className="mt-2 text-muted-foreground">
              Ocurrió un error inesperado. Por favor, intenta de nuevo.
            </p>
            <Button onClick={() => reset()} className="mt-8">
              Intentar de nuevo
            </Button>
          </div>
        </div>
      </body>
    </html>
  );
}
