'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

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
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: '1rem'
    }}>
      <div style={{ maxWidth: '28rem' }}>
        <h1 style={{ marginTop: '2rem', fontSize: '3rem', fontWeight: 'bold' }}>500</h1>
        <h2 style={{ marginTop: '1rem', fontSize: '1.5rem', fontWeight: '600' }}>Algo salió mal</h2>
        <p style={{ marginTop: '0.5rem' }}>
          Parece que metimos un gol en contra. ¡No te preocupes, vamos a arreglarlo!
        </p>
        <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <Button onClick={() => reset()} variant="outline">
            Intentar de nuevo
          </Button>
          <Button asChild>
            <a href="/dashboard">Volver al inicio</a>
          </Button>
        </div>
      </div>
    </div>
  );
}
