import { SocialFeed } from '@/components/social/social-feed';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Feed Social | Pateá',
  description: 'Mirá la actividad de los jugadores que seguís',
};

export const dynamic = 'force-dynamic';

export default function SocialPage() {
  return (
    <div className="container max-w-2xl py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Feed Social</h1>
        <p className="text-muted-foreground">
          Seguí la actividad de los jugadores que te interesan
        </p>
      </div>

      <SocialFeed limit={50} showHeader={false} />
    </div>
  );
}
