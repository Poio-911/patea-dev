
import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Toaster } from '@/components/ui/toaster';
import { ClientProviders } from '@/components/client-providers';
import { cn } from '@/lib/utils';
import { GlobalLiveAdminWidget } from '@/components/match/global-live-admin-widget';

// Force dynamic rendering for all pages (Firebase requires client-side context)
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: {
    default: 'Pateá',
    template: '%s | Pateá',
  },
  description: 'Pateá es una app para organizar los partidos entre amigos: armás equipos, anotás los resultados y llevás la cuenta de quién juega bien y quién se hace el lesionado.',
  manifest: '/manifest.json',
  openGraph: {
    type: 'website',
    locale: 'es_AR',
    siteName: 'Pateá',
    title: 'Pateá — Organizá tus partidos de fútbol',
    description: 'Armá equipos, registrá resultados y seguí las estadísticas de tu grupo. La app para los que se toman el fútbol en serio.',
    images: [
      {
        url: '/icons/icon-512x512.png',
        width: 512,
        height: 512,
        alt: 'Pateá App',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'Pateá — Organizá tus partidos de fútbol',
    description: 'Armá equipos, registrá resultados y seguí las estadísticas de tu grupo.',
    images: ['/icons/icon-512x512.png'],
  },
  appleWebApp: {
    title: 'Pateá',
    statusBarStyle: 'black-translucent',
    capable: true,
    startupImage: [
      { url: '/icons/icon-512x512.png', media: '(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)' },
      { url: '/icons/icon-512x512.png', media: '(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)' },
      { url: '/icons/icon-512x512.png', media: '(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)' },
      { url: '/icons/icon-512x512.png', media: '(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)' },
    ],
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
  icons: {
    apple: '/icons/icon-192x192.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // maximumScale intentionally omitted: setting it to 1 triggers a known iOS PWA bug
  // that blocks pointer-events on position:fixed portals (Radix Select/Popover/DropdownMenu)
  viewportFit: 'cover',
  themeColor: '#3B82F6',
  interactiveWidget: 'resizes-content',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={cn(
          'min-h-[100svh] bg-background text-foreground font-body antialiased'
        )}
      >
        <ClientProviders>
          {children}
          {/* Persistent admin live timer widget */}
          <GlobalLiveAdminWidget />
        </ClientProviders>
        <Toaster />
      </body>
    </html>
  );
}
