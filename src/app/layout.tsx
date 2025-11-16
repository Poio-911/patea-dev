
import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Toaster } from '@/components/ui/toaster';
import { ClientProviders } from '@/components/client-providers';
import { cn } from '@/lib/utils';

// Force dynamic rendering for all pages (Firebase requires client-side context)
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Pateá',
  description: 'Pateá es una app para organizar los partidos entre amigos: armás equipos, anotás los resultados y llevás la cuenta de quién juega bien y quién se hace el lesionado.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'Pateá',
    statusBarStyle: 'default',
  },
  icons: {
    apple: '/icons/icon-192x192.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#3B82F6',
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
        </ClientProviders>
        <Toaster />
      </body>
    </html>
  );
}
