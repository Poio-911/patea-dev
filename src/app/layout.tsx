
'use client'; // Required for hooks and context providers

import { useMemo } from 'react';
import './globals.css';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { useJsApiLoader } from '@react-google-maps/api';
import { libraries } from '@/lib/google-maps';
import { Loader2 } from 'lucide-react';
import { MainNav } from '@/components/main-nav';

// metadata cannot be exported from a client component.
// We can define it in a separate server component if needed, or handle it differently.

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries: libraries,
  });

  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <title>Amateur Football Manager</title>
        <meta name="description" content="Organiza partidos, gestiona jugadores y genera equipos equilibrados." />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#ffffff" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&family=Space+Grotesk:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className={cn(
          'min-h-[100svh] bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 font-body antialiased'
        )}
      >
        <FirebaseClientProvider>
          <Toaster />
          {isLoaded ? (
             <MainNav>{children}</MainNav>
          ) : loadError ? (
            <div>Error al cargar Google Maps. Por favor, revisa la configuración de tu API Key.</div>
          ) : (
            <div className="flex h-screen w-full items-center justify-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
          )}
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
