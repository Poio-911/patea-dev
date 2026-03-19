'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useDoc, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { League } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Shield, Users, Calendar, Share2, Info, ClipboardList } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { HeroImageBackground } from '@/components/organizer/hero-image-background';
import { LeagueStandingsTab } from '@/components/organizer/league-standings-tab';
import { LeagueFixtureTab } from '@/components/organizer/league-fixture-tab';
import { CompetitionSponsorsMarquee } from '@/components/organizer/competition-sponsors-marquee';
import { CountdownTimer } from '@/components/organizer/countdown-timer';
import { ShareQrCard } from '@/components/organizer/share-qr-card';
import { CompetitionTeamsTab } from '@/components/organizer/competition-teams-tab';

export default function PublicLeagueDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();

  const leagueRef = React.useMemo(() => {
    if (!firestore || !params.id) return null;
    return doc(firestore, 'leagues', params.id);
  }, [firestore, params.id]);

  const { data: league, loading } = useDoc<League>(leagueRef);

  const handleShare = () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({
        title: `Pateá - ${league?.name}`,
        text: `Seguí la tabla de posiciones y resultados de ${league?.name} en Pateá.`,
        url: window.location.href,
      }).catch(() => {
        navigator.clipboard.writeText(window.location.href);
        toast({ title: 'Link copiado', description: 'El enlace se guardó en el portapapeles.' });
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast({ title: 'Link copiado', description: 'El enlace se guardó en el portapapeles.' });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full rounded-3xl" />
      </div>
    );
  }

  if (!league) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-12 text-center">
        <Shield className="h-16 w-16 text-muted-foreground/20 mb-4" />
        <h2 className="text-2xl font-black uppercase tracking-tight">Liga no encontrada</h2>
        <Button variant="link" onClick={() => router.push('/competitions')} className="mt-4 font-bold">
          Explorar otras competiciones
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-32">
      {/* Public Hero Header */}
      <div className="relative -mx-4 md:-mx-6 -mt-8 md:-mt-10 mb-8 overflow-hidden bg-gradient-to-br from-background/40 via-background/60 to-background/90 pt-16 pb-12 px-6 sm:px-10 border-b border-border shadow-md rounded-b-[2.5rem] backdrop-blur-md">
        <HeroImageBackground opacity="opacity-[0.2] dark:opacity-25" />
        <div className="relative z-10 max-w-6xl mx-auto flex flex-col gap-6">
          <div className="flex justify-between items-center">
            <Button variant="ghost" size="sm" className="w-fit -ml-3 text-muted-foreground hover:text-foreground hover:bg-white/5" onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Atrás
            </Button>
            <div className="flex items-center gap-2">
              {league.allowPublicRegistration && (
                <Button
                  variant="default"
                  size="sm"
                  className="rounded-full font-bold"
                  onClick={() => router.push(`/competitions/league/${params.id}/register`)}
                >
                  <ClipboardList className="mr-2 h-4 w-4" />
                  Inscribirse
                </Button>
              )}
              <Button variant="outline" size="sm" className="rounded-full border-primary/20 bg-primary/5 text-primary font-bold" onClick={handleShare}>
                <Share2 className="mr-2 h-4 w-4" />
                Compartir
              </Button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 mt-2">
            <div className="flex items-center gap-6">
              <Avatar className="h-24 w-24 sm:h-32 sm:w-32 ring-4 ring-background/50 shadow-2xl rounded-2xl bg-muted/30 border-2 border-white/5 backdrop-blur-md">
                <AvatarImage src={league.logoUrl || undefined} className="object-cover" />
                <AvatarFallback className="bg-blue-500/20 text-blue-400 font-black text-3xl sm:text-5xl rounded-2xl">
                  <Shield className="h-12 w-12 sm:h-16 sm:w-16" />
                </AvatarFallback>
              </Avatar>
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-primary/90 text-primary-foreground border-none font-black text-[10px] tracking-widest uppercase">
                    VISTA PÚBLICA
                  </Badge>
                  <Badge variant="outline" className="bg-background/20 backdrop-blur-md border-white/10 text-foreground font-bold text-[10px] tracking-widest uppercase">
                    {league.status === 'completed' ? 'Finalizada' : league.status === 'in_progress' ? 'En Juego' : 'Previa'}
                  </Badge>
                </div>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-black font-headline uppercase tracking-tighter text-foreground leading-tight drop-shadow-md">
                  {league.name}
                </h1>
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground font-medium">
                  <span className="flex items-center gap-1.5 bg-background/30 px-2 py-1 rounded-lg">
                    <Users className="w-3.5 h-3.5 text-primary"/> 
                    <span className="font-bold text-foreground">{league.teams?.length || 0}</span> Equipos
                  </span>
                  <span className="flex items-center gap-1.5 bg-background/30 px-2 py-1 rounded-lg">
                    <Calendar className="w-3.5 h-3.5 text-primary"/> 
                    {league.startDate || 'Próximamente'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-0">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main tabs */}
          <div className="flex-1 min-w-0">
            <Tabs defaultValue="standings" className="w-full">
              <TabsList className="grid w-full grid-cols-2 lg:w-[400px] mb-8 bg-card/40 backdrop-blur-xl border border-border/40 shadow-xl p-1 rounded-2xl h-14">
                <TabsTrigger value="standings" className="rounded-xl font-black text-xs uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
                  Tabla
                </TabsTrigger>
                <TabsTrigger value="fixture" className="rounded-xl font-black text-xs uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
                  Fixture
                </TabsTrigger>
                <TabsTrigger value="teams" className="rounded-xl font-black text-xs uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
                  Equipos
                </TabsTrigger>
              </TabsList>

              <TabsContent value="standings" className="mt-0 outline-none">
                <LeagueStandingsTab leagueId={params.id} isReadOnly={true} />
              </TabsContent>

              <TabsContent value="fixture" className="mt-0 outline-none">
                <LeagueFixtureTab
                  leagueId={params.id}
                  leagueName={league.name}
                  leagueFormat={league.format || 'round_robin'}
                  isReadOnly={true}
                />
              </TabsContent>

              <TabsContent value="teams" className="mt-0 outline-none">
                <CompetitionTeamsTab competitionId={params.id} competitionType="leagues" competitionName={league.name} isReadOnly={true} />
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar: countdown + QR */}
          <div className="flex flex-col gap-4 lg:w-56 shrink-0">
            {league.startDate && league.status !== 'completed' && league.status !== 'in_progress' && (
              <CountdownTimer targetDate={league.startDate} label="Inicio del torneo" />
            )}
            <ShareQrCard
              url={`${typeof window !== 'undefined' ? window.location.origin : 'https://patea.app'}/competitions/league/${params.id}`}
              title="Compartir liga"
            />
          </div>
        </div>
      </div>

      {/* Sponsors Section */}
      <CompetitionSponsorsMarquee sponsors={league.sponsors} />
    </div>
  );
}
