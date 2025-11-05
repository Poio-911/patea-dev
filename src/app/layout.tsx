import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { ClientProviders } from '@/components/client-providers';
import { cn } from '@/lib/utils';
import { Rajdhani, Teko, Outfit } from 'next/font/google';
import { GameModeBackdrop } from '@/components/game-mode-backdrop';

// Font loading via next/font to provide CSS variables consumed by Tailwind font families.
const outfit = Outfit({ subsets: ['latin'], weight: ['400','500','600','700'], variable: '--font-body' });
const rajdhani = Rajdhani({ subsets: ['latin'], weight: ['500','600','700'], variable: '--font-headline' });
const teko = Teko({ subsets: ['latin'], weight: ['400','500','600','700'], variable: '--font-numeric' });

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
  <html lang="es" suppressHydrationWarning className={cn(outfit.variable, rajdhani.variable, teko.variable)}>
      <head>
        <title>Pateá</title>
        <meta name="description" content="Pateá es una app para organizar los partidos entre amigos: armás equipos, anotás los resultados y llevás la cuenta de quién juega bien y quién se hace el lesionado." />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#3B82F6" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        {/* Fonts handled by next/font; legacy preconnect removed */}
      </head>
      <body
        className={cn(
          'min-h-[100svh] bg-background text-foreground font-body antialiased'
        )}
      >
        <GameModeBackdrop />
        <ClientProviders>
          {children}
        </ClientProviders>
        <Toaster />
      </body>
    </html>
  );
}
