'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { ExploreContent } from '@/components/social/explore-content';
import { PublicMatchesContent } from '@/components/social/public-matches-content';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserSearch, Calendar, Megaphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogHeader } from '@/components/ui/dialog';
import { useUser, useFirestore, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Player, UserProfile, AvailablePlayer } from '@/lib/types';
import { AvailabilityCard } from '@/components/availability/availability-card';

export default function ExplorarPage() {
  const [activeTab, setActiveTab] = useState('players');
  const { user } = useUser();
  const firestore = useFirestore();

  // Fetch Current User's Profile & Availability Data for the Opt-In Dialog
  const { data: userProfile } = useDoc<UserProfile>(
    user && firestore ? doc(firestore, 'users', user.uid) : null
  );
  const { data: currentPlayer } = useDoc<Player>(
    user && firestore ? doc(firestore, 'players', user.uid) : null
  );
  const { data: currentAvailability } = useDoc<AvailablePlayer>(
    user && firestore ? doc(firestore, 'availablePlayers', user.uid) : null
  );

  const isFreeAgent = currentAvailability !== null;

  return (
    <div className="flex flex-col gap-8 pb-12">
      <PageHeader
        title="Explorar"
        description="Reclutá agentes libres para tus partidos, o sumate a partidos abiertos."
      />

      {/* Free Agent Banner */}
      {user && (
        <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${isFreeAgent ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">
                {isFreeAgent ? 'Estás activo en el Mercado' : '¿Te falta partido?'}
              </h3>
              <p className="text-xs text-muted-foreground">
                {isFreeAgent
                  ? 'Los organizadores pueden reclutarte.'
                  : 'Ofrecete como agente libre para que te inviten.'}
              </p>
            </div>
          </div>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant={isFreeAgent ? "outline" : "default"} size="sm" className="w-full sm:w-auto">
                {isFreeAgent ? 'Ajustar Disponibilidad' : 'Ofrecerme para jugar'}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto w-[95vw]">
              <DialogHeader>
                <DialogTitle className="sr-only">Ofrecerme para jugar</DialogTitle>
              </DialogHeader>
              <AvailabilityCard
                player={currentPlayer || null}
                availablePlayerData={currentAvailability || null}
                savedLocation={userProfile?.savedLocation}
              />
            </DialogContent>
          </Dialog>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="players" className="flex items-center gap-2">
            <UserSearch className="h-4 w-4" />
            <span className="hidden sm:inline">Mercado de</span> Fichajes
          </TabsTrigger>
          <TabsTrigger value="matches" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Partidos</span> Abiertos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="players" className="mt-0">
          <ExploreContent />
        </TabsContent>

        <TabsContent value="matches" className="mt-0">
          <PublicMatchesContent />
        </TabsContent>
      </Tabs>
    </div>
  );
}
