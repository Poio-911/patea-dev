'use client';

import { useState } from 'react';
import { SocialFeed } from '@/components/social/social-feed';
import { ExploreContent } from '@/components/social/explore-content';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity, Compass } from 'lucide-react';

export default function SocialPage() {
  const [activeTab, setActiveTab] = useState('feed');

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Feed Social</h1>
        <p className="text-muted-foreground">
          Segui la actividad de los jugadores que te interesan
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="feed" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Feed
          </TabsTrigger>
          <TabsTrigger value="explore" className="flex items-center gap-2">
            <Compass className="h-4 w-4" />
            Explorar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="feed" className="mt-0">
          <SocialFeed limit={50} showHeader={false} />
        </TabsContent>

        <TabsContent value="explore" className="mt-0">
          <ExploreContent />
        </TabsContent>
      </Tabs>
    </div>
  );
}
