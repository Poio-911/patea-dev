'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useDoc, useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import type { League } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trophy, Users, CalendarDays, ShieldAlert, Loader2, PlayCircle, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { HeroImageBackground } from '@/components/organizer/hero-image-background';
import { LeagueTeamsTab } from '@/components/organizer/league-teams-tab';
import { LeagueFixtureTab } from '@/components/organizer/league-fixture-tab';
import { LeagueStandingsTab } from '@/components/organizer/league-standings-tab';
import { LeagueStatsTab } from '@/components/organizer/league-stats-tab';
import { LeagueDisciplineTab } from '@/components/organizer/league-discipline-tab';
import { LeagueNextMatchesWidget } from '@/components/organizer/league-next-matches-widget';

export default function CompetitionDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isUpdatingStatus, setIsUpdatingStatus] = React.useState(false);

  const handleStatusChange = async (newStatus: League['status']) => {
    if (!leagueRef) return;
    setIsUpdatingStatus(true);
    try {
      await updateDoc(leagueRef, { status: newStatus });
      const labels: Record<League['status'], string> = {
        draft: 'Borrador',
        open_for_applications: 'Inscripciones abiertas',
        in_progress: 'Liga iniciada',
        completed: 'Liga finalizada',
      };
      toast({ title: labels[newStatus] || 'Estado actualizado' });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo cambiar el estado.' });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const leagueRef = React.useMemo(() => {
    if (!firestore || !params.id) return null;
    return doc(firestore, 'leagues', params.id);
  }, [firestore, params.id]);

  const { data: league, loading } = useDoc<League>(leagueRef);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!league) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <Trophy className="h-16 w-16 text-muted-foreground/30 mb-4" />
        <h2 className="text-2xl font-bold">Competición no encontrada</h2>
        <Button variant="link" onClick={() => router.push('/organizer')} className="mt-4">
          Volver al panel
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      {/* Hero Header */}
      <div className="relative -mx-4 md:-mx-6 -mt-8 md:-mt-10 mb-8 overflow-hidden bg-gradient-to-br from-background/40 via-background/60 to-background/90 pt-16 pb-12 px-6 sm:px-10 border-b border-border shadow-md rounded-b-[2.5rem] backdrop-blur-md">
        <HeroImageBackground opacity="opacity-[0.25] dark:opacity-30" />
        <div className="relative z-10 max-w-6xl mx-auto flex flex-col gap-6">
          <Button variant="ghost" size="sm" className="w-fit -ml-3 text-muted-foreground hover:text-foreground hover:bg-accent/50" onClick={() => router.push('/organizer')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a Mis Torneos
          </Button>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 mt-2">
            <div className="flex items-center gap-6">
              <Avatar className="h-24 w-24 sm:h-32 sm:w-32 ring-4 ring-background/50 shadow-2xl rounded-2xl bg-muted/50 border-2 border-white/10 backdrop-blur-md">
                <AvatarImage src={league.logoUrl || undefined} className="object-cover" />
                <AvatarFallback className="bg-primary/20 text-primary font-black text-3xl sm:text-5xl rounded-2xl">
                  {league.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 backdrop-blur-md px-3 py-1 uppercase tracking-widest font-bold text-[10px]">
                    {league.competitionType === 'cup' ? 'Copa' : 'Liga'}
                  </Badge>
                  <Badge variant="secondary" className="bg-accent/50 text-accent-foreground border-none backdrop-blur-md px-3 py-1 uppercase tracking-widest font-bold text-[10px]">
                    {league.status === 'in_progress' ? 'En Juego' : league.status === 'completed' ? 'Finalizada' : league.status === 'open_for_applications' ? 'Inscripciones' : 'Borrador'}
                  </Badge>
                  {league.sportType && (
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20 backdrop-blur-md px-3 py-1 uppercase tracking-widest font-bold text-[10px]">
                      {league.sportType.toUpperCase()}
                    </Badge>
                  )}
                </div>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-black font-headline uppercase tracking-tighter text-foreground drop-shadow-lg leading-tight">
                  {league.name}
                </h1>
                
                {(league.location || league.startDate) && (
                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground/80 font-medium mt-2">
                    {league.location && <span className="flex items-center gap-1.5"><Trophy className="w-3.5 h-3.5"/> Sede: {league.location}</span>}
                    {league.startDate && <span className="flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5"/> Inicio: {league.startDate}</span>}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto shrink-0">
              {league.status === 'draft' && (
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto border-primary/30 hover:bg-primary/10 font-bold tracking-wide uppercase"
                  onClick={() => handleStatusChange('open_for_applications')}
                  disabled={isUpdatingStatus}
                >
                  {isUpdatingStatus ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <UserPlus className="mr-2 h-5 w-5" />}
                  Abrir Inscripciones
                </Button>
              )}
              {league.status === 'open_for_applications' && (
                <Button
                  size="lg"
                  className="w-full sm:w-auto shadow-[0_0_30px_-5px] shadow-primary/40 font-bold tracking-wide uppercase group"
                  onClick={() => handleStatusChange('in_progress')}
                  disabled={isUpdatingStatus}
                >
                  {isUpdatingStatus ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <PlayCircle className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" />}
                  Iniciar Liga
                </Button>
              )}
              {league.status === 'in_progress' && (
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto border-muted-foreground/30 font-bold tracking-wide uppercase"
                  onClick={() => handleStatusChange('completed')}
                  disabled={isUpdatingStatus}
                >
                  {isUpdatingStatus ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Trophy className="mr-2 h-5 w-5" />}
                  Finalizar Liga
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto space-y-8 px-4 sm:px-0">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-5 lg:w-[700px] mb-8 bg-card/70 backdrop-blur-xl border border-border/40 shadow-lg shadow-black/5 dark:shadow-black/20 h-12 p-1 rounded-xl">
            <TabsTrigger value="overview" className="rounded-lg font-bold data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-md transition-all">Resumen</TabsTrigger>
            <TabsTrigger value="teams" className="rounded-lg font-bold data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-md transition-all"><Users className="mr-2 h-4 w-4 hidden md:inline-block" /> Equipos</TabsTrigger>
            <TabsTrigger value="fixture" className="rounded-lg font-bold data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-md transition-all"><CalendarDays className="mr-2 h-4 w-4 hidden md:inline-block" /> Fixture</TabsTrigger>
            <TabsTrigger value="stats" className="rounded-lg font-bold data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-md transition-all"><Trophy className="mr-2 h-4 w-4 hidden md:inline-block" /> Goleadores</TabsTrigger>
            <TabsTrigger value="discipline" className="rounded-lg font-bold data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-md transition-all"><ShieldAlert className="mr-2 h-4 w-4 hidden md:inline-block" /> Sanciones</TabsTrigger>
          </TabsList>
        
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <LeagueStandingsTab leagueId={params.id} rules={league.rules} />
            </div>
            <div className="space-y-6">
              <LeagueNextMatchesWidget leagueId={params.id} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="teams">
          <LeagueTeamsTab leagueId={params.id} leagueName={league.name} />
        </TabsContent>

        <TabsContent value="fixture">
          <LeagueFixtureTab 
            leagueId={params.id} 
            leagueName={league.name} 
            leagueFormat={league.format} 
          />
        </TabsContent>

        <TabsContent value="stats">
          <LeagueStatsTab leagueId={params.id} />
        </TabsContent>

          <TabsContent value="discipline">
            <LeagueDisciplineTab leagueId={params.id} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
