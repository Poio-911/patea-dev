import { Metadata } from 'next';
import { ExploreContent } from '@/components/social/explore-content';

export const metadata: Metadata = {
  title: 'Explorar | Patea',
  description: 'Descubri jugadores interesantes para seguir',
};

export const dynamic = 'force-dynamic';

export default function ExplorePage() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Explorar</h1>
        <p className="text-muted-foreground">
          Descubri jugadores interesantes para seguir
        </p>
      </div>

      <ExploreContent />
    </div>
  );
}
