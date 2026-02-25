
import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Toaster } from '@/components/ui/toaster';
import { ClientProviders } from '@/components/client-providers';
import { cn } from '@/lib/utils';
import { GlobalLiveAdminWidget } from '@/components/match/global-live-admin-widget';

// Force dynamic rendering for all pages (Firebase requires client-side context)
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Pateá',
  description: 'Pateá es una app para organizar los partidos entre amigos: armás equipos, anotás los resultados y llevás la cuenta de quién juega bien y quién se hace el lesionado.',
  manifest: '/manifest.json',
  appleWebApp: {
    title: 'Pateá',
    statusBarStyle: 'black-translucent',
    capable: true,
    startupImage: [
      // iPhone SE (4th gen) 1334x750
      { url: '/icons/icon-512x512.png', media: '(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)' },
      // iPhone 13/14 1170x2532
      { url: '/icons/icon-512x512.png', media: '(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)' },
      // iPhone 15 Pro 1179x2556
      { url: '/icons/icon-512x512.png', media: '(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)' },
      // iPhone 15 Pro Max 1290x2796
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
