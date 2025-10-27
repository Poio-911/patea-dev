'use client';

import { useJsApiLoader } from '@react-google-maps/api';
import { libraries } from '@/lib/google-maps';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { SoccerPlayerIcon } from '@/components/icons/soccer-player-icon';
import { MainNav } from '@/components/main-nav';

const loaderOptions = {
  id: 'google-map-script',
  googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
  libraries,
};

export function ClientProviders({ children }: { children: React.ReactNode }) {
  const { isLoaded, loadError } = useJsApiLoader(loaderOptions);

  if (loadError) {
    return <div>Error al cargar Google Maps. Por favor, revisa la configuración de tu API Key.</div>;
  }

  if (!isLoaded) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <SoccerPlayerIcon className="h-16 w-16 color-cycle-animation" />
      </div>
    );
  }

  return (
    <FirebaseClientProvider>
      <MainNav>{children}</MainNav>
    </FirebaseClientProvider>
  );
}
