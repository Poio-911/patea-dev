
'use client'; // Required for hooks and context providers

import './globals.css';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { useJsApiLoader } from '@react-google-maps/api';
import { libraries } from '@/lib/google-maps';
import { SoccerPlayerIcon } from '@/components/icons/soccer-player-icon';
import { MainNav } from '@/components/main-nav';
import { usePathname } from 'next/navigation';

const PUBLIC_PATHS = ['/', '/login', '/register', '/forgot-password'];

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
  const pathname = usePathname();
  const isPublicPage = PUBLIC_PATHS.includes(pathname);


  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <title>Pateá</title>
        <meta name="description" content="Pateá es una app para organizar los partidos entre amigos: armás equipos, anotás los resultados y llevás la cuenta de quién juega bien y quién se hace el lesionado." />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#3B82F6" />
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
          'min-h-[100svh] bg-background font-body antialiased'
        )}
      >
        <FirebaseClientProvider>
          <Toaster />
          {isLoaded ? (
            isPublicPage ? (
              children
            ) : (
              <MainNav>{children}</MainNav>
            )
          ) : loadError ? (
            <div>Error al cargar Google Maps. Por favor, revisa la configuración de tu API Key.</div>
          ) : (
            <div className="flex h-screen w-full items-center justify-center">
              <SoccerPlayerIcon className="h-16 w-16 color-cycle-animation" />
            </div>
          )}
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
