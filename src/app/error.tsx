'use client';

import { useEffect } from 'react';

export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export const revalidate = 0;

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
    <html lang="es">
      <body>
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
              <button onClick={() => reset()} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>
                Intentar de nuevo
              </button>
              <a href="/dashboard" style={{ padding: '0.5rem 1rem', textDecoration: 'none' }}>
                Volver al inicio
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
