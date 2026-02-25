'use client';

import { PageHeader } from '@/components/page-header';
import { SocialFeed } from '@/components/social/social-feed';
import { FeedSidebar } from '@/components/social/feed-sidebar';

export default function FeedPage() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Feed" description="Actividad reciente de jugadores que sigues." />
      <div className="flex flex-col md:grid md:grid-cols-[1fr_300px] gap-6 items-start">
        <SocialFeed limit={50} showHeader={true} />
        <div className="hidden md:block sticky top-20">
          <FeedSidebar />
        </div>
      </div>
    </div>
  );
}
