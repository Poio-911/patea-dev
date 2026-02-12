'use client';

import { useState } from 'react';
import { SocialFeed } from '@/components/social/social-feed';
import { ExploreContent } from '@/components/social/explore-content';
import { PublicMatchesContent } from '@/components/social/public-matches-content';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity, UserSearch, Calendar } from 'lucide-react';

export default function SocialPage() {
  const [activeTab, setActiveTab] = useState('players');

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Explorar</h1>
        <p className="text-muted-foreground">
          Buscá jugadores para tus partidos o encontrá partidos abiertos
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="players" className="flex items-center gap-2">
            <UserSearch className="h-4 w-4" />
            <span className="hidden sm:inline">Buscar</span> Jugadores
          </TabsTrigger>
          <TabsTrigger value="matches" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Partidos</span> Abiertos
          </TabsTrigger>
          <TabsTrigger value="feed" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Feed
          </TabsTrigger>
        </TabsList>

        <TabsContent value="players" className="mt-0">
          <ExploreContent />
        </TabsContent>

        <TabsContent value="matches" className="mt-0">
          <PublicMatchesContent />
        </TabsContent>

        <TabsContent value="feed" className="mt-0">
          <SocialFeed limit={50} showHeader={false} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
