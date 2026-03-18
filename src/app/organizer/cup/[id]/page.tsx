'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useDoc, useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import type { Cup } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trophy, Users, Grid3x3, Loader2, PlayCircle, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { HeroImageBackground } from '@/components/organizer/hero-image-background';
import { CupBracketTab } from '@/components/organizer/cup-bracket-tab';
import { CupTeamsTab } from '@/components/organizer/cup-teams-tab-v2';

export default function CupDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isUpdatingStatus, setIsUpdatingStatus] = React.useState(false);

  const handleStatusChange = async (newStatus: Cup['status']) => {
    if (!cupRef) return;
    setIsUpdatingStatus(true);
    try {
      await updateDoc(cupRef, { status: newStatus });
      const labels: Record<Cup['status'], string> = {
        draft: 'Borrador',
        open_for_applications: 'Inscripciones abiertas',
        in_progress: 'Copa iniciada',
        completed: 'Copa finalizada',
      };
      toast({ title: labels[newStatus] || 'Estado actualizado' });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo cambiar el estado.' });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const cupRef = React.useMemo(() => {
    if (!firestore || !params.id) return null;
    return doc(firestore, 'cups', params.id);
  }, [firestore, params.id]);

  const { data: cup, loading } = useDoc<Cup>(cupRef);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!cup) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <Trophy className="h-16 w-16 text-muted-foreground/30 mb-4" />
        <h2 className="text-2xl font-bold">Copa no encontrada</h2>
        <Button variant="link" onClick={() => router.push('/organizer')} className="mt-4">
          Volver al panel
        </Button>
      </div>
    );
  }

  const completedMatches = cup.bracket?.filter(m => m.winnerId).length || 0;
  const totalMatches = cup.bracket?.length || 0;

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
                <AvatarImage src={cup.logoUrl || undefined} className="object-cover" />
                <AvatarFallback className="bg-amber-500/20 text-amber-400 font-black text-3xl sm:text-5xl rounded-2xl">
                  <Trophy className="h-12 w-12 sm:h-16 sm:w-16" />
                </AvatarFallback>
              </Avatar>
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 backdrop-blur-md px-3 py-1 uppercase tracking-widest font-bold text-[10px]">
                    Copa
                  </Badge>
                  <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20 backdrop-blur-md px-3 py-1 uppercase tracking-widest font-bold text-[10px]">
                    Eliminación Directa
                  </Badge>
                  <Badge variant="secondary" className="bg-accent/50 text-accent-foreground border-none backdrop-blur-md px-3 py-1 uppercase tracking-widest font-bold text-[10px]">
                    {cup.status === 'in_progress' ? 'En Juego' : cup.status === 'completed' ? 'Finalizada' : cup.status === 'open_for_applications' ? 'Inscripciones' : 'Borrador'}
                  </Badge>
                </div>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-black font-headline uppercase tracking-tighter text-foreground drop-shadow-lg leading-tight">
                  {cup.name}
                </h1>

                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground/80 font-medium mt-2">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5"/> {cup.teams?.length || 0} Equipos
                  </span>
                  {cup.bracket && cup.bracket.length > 0 && (
                    <span className="flex items-center gap-1.5">
                      <Grid3x3 className="w-3.5 h-3.5"/> {completedMatches}/{totalMatches} Partidos
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto shrink-0">
              {cup.status === 'draft' && (
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto border-amber-500/30 hover:bg-amber-500/10 text-amber-400 font-bold tracking-wide uppercase"
                  onClick={() => handleStatusChange('open_for_applications')}
                  disabled={isUpdatingStatus}
                >
                  {isUpdatingStatus ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <UserPlus className="mr-2 h-5 w-5" />}
                  Abrir Inscripciones
                </Button>
              )}
              {cup.status === 'open_for_applications' && (
                <Button
                  size="lg"
                  className="w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-black shadow-[0_0_30px_-5px] shadow-amber-500/40 font-bold tracking-wide uppercase group"
                  onClick={() => handleStatusChange('in_progress')}
                  disabled={isUpdatingStatus}
                >
                  {isUpdatingStatus ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <PlayCircle className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" />}
                  Iniciar Copa
                </Button>
              )}
              {cup.status === 'in_progress' && (
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto border-amber-500/30 text-amber-400 font-bold tracking-wide uppercase"
                  onClick={() => handleStatusChange('completed')}
                  disabled={isUpdatingStatus}
                >
                  {isUpdatingStatus ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Trophy className="mr-2 h-5 w-5" />}
                  Finalizar Copa
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto space-y-8 px-4 sm:px-0">
        <Tabs defaultValue="bracket" className="w-full">
          <TabsList className="grid w-full grid-cols-2 lg:w-[400px] mb-8 bg-card/70 backdrop-blur-xl border border-border/40 shadow-lg shadow-black/5 dark:shadow-black/20 h-12 p-1 rounded-xl">
            <TabsTrigger value="bracket" className="rounded-lg font-bold data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-400 data-[state=active]:shadow-md transition-all">
              <Grid3x3 className="mr-2 h-4 w-4 hidden md:inline-block" /> Bracket
            </TabsTrigger>
            <TabsTrigger value="teams" className="rounded-lg font-bold data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-md transition-all">
              <Users className="mr-2 h-4 w-4 hidden md:inline-block" /> Equipos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="bracket">
            <CupBracketTab cupId={params.id} />
          </TabsContent>

          <TabsContent value="teams">
            <CupTeamsTab cupId={params.id} cupName={cup.name} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
