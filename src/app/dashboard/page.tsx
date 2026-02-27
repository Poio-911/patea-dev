
'use client';

import { Suspense, useState, useMemo } from 'react';
import { useCollection, useDoc, useFirestore, useUser } from '@/firebase';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Star, Users2, Calendar, User, Loader2, UserRound, Search, PlayCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { collection, query, where, orderBy, limit, doc } from 'firebase/firestore';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { Player, Match, AvailablePlayer, UserProfile, Group } from '@/lib/types';
import { MatchVisualizer } from '@/components/match/match-visualizer';
import { NextMatchCard } from '@/components/next-match-card';
import { Badge } from '@/components/ui/badge';
import { format, isToday, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Separator } from '@/components/ui/separator';
import { SoccerPlayerIcon } from '@/components/icons/soccer-player-icon';
import { MateIcon } from '@/components/icons/mate-icon';
import { FirstTimeInfoDialog } from '@/components/first-time-info-dialog';
import { motion } from 'framer-motion';
import { FindMatchIcon } from '@/components/icons/find-match-icon';
import { PlayerStatsCard } from '@/components/dashboard/player-stats-card';
import { PlayerPositionBadge } from '@/components/player-styles';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { NotificationPermissionPrompt } from '@/components/notifications/notification-permission-prompt';
import { DashboardTabs } from '@/components/dashboard/dashboard-tabs';
import { WelcomeDialog } from '@/components/welcome-dialog';

const statusConfig: Record<Match['status'], { label: string; className: string }> = {
  planning: { label: 'A Confirmar', className: 'bg-primary/5 text-primary border border-primary/20 rounded-full backdrop-blur-sm' },
  upcoming: { label: 'Próximo', className: 'bg-primary/10 text-foreground border border-primary/30 rounded-full backdrop-blur-sm' },
  active: { label: 'Activo', className: 'bg-foreground/10 text-foreground border border-foreground/30 rounded-full backdrop-blur-sm' },
  completed: { label: 'Finalizado', className: 'bg-muted/40 text-muted-foreground border border-muted/50 rounded-full backdrop-blur-sm' },
  evaluated: { label: 'Evaluado', className: 'bg-card/60 text-foreground border border-border rounded-full backdrop-blur-sm' },
};

const PAGE_VARIANTS = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.5 } },
};

const LIST_VARIANTS = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const CARD_VARIANTS = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: 'easeOut',
    },
  },
};

function DashboardContent() {
  const { user } = useUser();
  const firestore = useFirestore();

  // Queries that are actually used by the new components
  const groupMatchesQuery = useMemo(() => {
    if (!firestore || !user?.activeGroupId) return null;
    return query(
      collection(firestore, 'matches'),
      where('groupId', '==', user.activeGroupId),
      orderBy('date', 'desc'),
    );
  }, [firestore, user?.activeGroupId]);

  const playerRef = useMemo(() => firestore && user?.uid ? doc(firestore, 'players', user.uid) : null, [firestore, user?.uid]);
  const { data: player, loading: playerLoading } = useDoc<Player>(playerRef);

  const availablePlayerRef = useMemo(() => firestore && user?.uid ? doc(firestore, 'availablePlayers', user.uid) : null, [firestore, user?.uid]);
  const { data: availablePlayerData, loading: availablePlayerLoading } = useDoc<AvailablePlayer>(availablePlayerRef);

  // Get user profile for savedLocation
  const userProfileRef = useMemo(() => firestore && user?.uid ? doc(firestore, 'users', user.uid) : null, [firestore, user?.uid]);
  const { data: userProfile } = useDoc<UserProfile>(userProfileRef);

  const allPlayersInGroupQuery = useMemo(() => {
    if (!firestore || !user?.activeGroupId) return null;
    return query(collection(firestore, 'players'), where('groupId', '==', user.activeGroupId));
  }, [firestore, user?.activeGroupId]);
  const { data: allPlayersInGroup, loading: allPlayersLoading } = useCollection<Player>(allPlayersInGroupQuery);

  // Active group document for grupo tab
  const activeGroupRef = useMemo(() => {
    if (!firestore || !user?.activeGroupId) return null;
    return doc(firestore, 'groups', user.activeGroupId);
  }, [firestore, user?.activeGroupId]);
  const { data: activeGroup, loading: activeGroupLoading } = useDoc<Group>(activeGroupRef);

  // Upcoming matches for grupo tab
  const upcomingMatchesQuery = useMemo(() => {
    if (!firestore || !user?.activeGroupId) return null;
    return query(
      collection(firestore, 'matches'),
      where('groupId', '==', user.activeGroupId),
      where('status', '==', 'upcoming'),
      orderBy('date', 'asc'),
      limit(5)
    );
  }, [firestore, user?.activeGroupId]);
  const { data: upcomingMatchesData, loading: upcomingMatchesLoading } = useCollection<Match>(upcomingMatchesQuery);

  // Friendly matches for grupo tab
  const friendlyMatchesQuery = useMemo(() => {
    if (!firestore || !user?.activeGroupId) return null;
    return query(
      collection(firestore, 'matches'),
      where('type', '==', 'intergroup_friendly'),
      where('groupId', '==', user.activeGroupId)
    );
  }, [firestore, user?.activeGroupId]);
  const { data: friendlyMatchesData, loading: friendlyMatchesLoading } = useCollection<Match>(friendlyMatchesQuery);

  const { data: groupMatches, loading: groupMatchesLoading } = useCollection<Match>(groupMatchesQuery);

  // Active Matches (Status === active), filtered in memory to avoid composite index limits
  const activeMatchesQuery = useMemo(() => firestore && user?.activeGroupId ? query(
    collection(firestore, 'matches'),
    where('groupId', '==', user.activeGroupId),
    where('status', '==', 'active')
  ) : null, [firestore, user?.activeGroupId]);

  const { data: activeGroupMatches, loading: activeLoading } = useCollection<Match>(activeMatchesQuery);
  const liveLoading = activeLoading;

  const liveMatches = useMemo(() => {
    if (!activeGroupMatches) return [];
    return activeGroupMatches.filter(m => m.liveStatus === 'first_half' || m.liveStatus === 'second_half' || m.liveStatus === 'half_time');
  }, [activeGroupMatches]);

  const [showVisualizer, setShowVisualizer] = useState(false);
  const [selectedLive, setSelectedLive] = useState<Match | null>(null);

  const loading = allPlayersLoading || groupMatchesLoading || playerLoading || availablePlayerLoading || activeGroupLoading || upcomingMatchesLoading || friendlyMatchesLoading;

  const matches = useMemo(() => {
    if (!groupMatches) return null;

    return [...groupMatches].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [groupMatches]);

  const { nextMatch, recentMatches } = useMemo(() => {
    if (!matches) return { nextMatch: null, recentMatches: [] };

    const getMatchTimestamp = (m: Match) => {
      const d = new Date(m.date);
      const cleanTime = (m.time || '').replace(' hs', '').replace('hs', '').trim();
      const [hh, mm = '0'] = cleanTime.split(':');
      const h = parseInt(hh, 10);
      const mins = parseInt(mm, 10);

      if (isNaN(h) || isNaN(mins)) {
        d.setHours(23, 59, 0, 0);
      } else {
        d.setHours(h, mins, 0, 0);
      }
      return d.getTime();
    };

    const nowTs = Date.now();
    const upcoming = matches
      .filter(m => (m.status === 'active') || (m.status === 'upcoming' && getMatchTimestamp(m) >= nowTs))
      .sort((a, b) => getMatchTimestamp(a) - getMatchTimestamp(b));

    const recent = matches.filter(m => m.status !== 'upcoming').slice(0, 2);

    return {
      nextMatch: upcoming[0] || null,
      recentMatches: recent,
    };
  }, [matches]);

  const groupRecentMatches = useMemo(() => {
    if (!matches) return [];
    return matches
      .filter(m => m.status === 'evaluated')
      .slice(0, 4);
  }, [matches]);

  const totalGroupMatchesCount = useMemo(() => {
    if (!matches) return 0;
    return matches.filter(m => m.status === 'evaluated' || m.status === 'completed' || m.status === 'active').length;
  }, [matches]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (!user?.activeGroupId) {
    if (!user?.groups || user.groups.length === 0) {
      // True New User Onboarding
      return (
        <motion.div
          className="flex flex-col items-center justify-center min-h-[70vh] gap-8 text-center px-4 relative"
          variants={PAGE_VARIANTS}
          initial="initial"
          animate="animate"
        >
          {/* Subtle background glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] max-w-2xl h-[80vw] max-h-2xl bg-primary/5 blur-[100px] rounded-full -z-10 pointer-events-none"></div>

          <div className="relative mb-4">
            {/* Pulsing neon backlight behind icon */}
            <div className="absolute inset-0 bg-primary/30 blur-3xl rounded-full scale-150 animate-pulse"></div>
            <motion.div
              className="relative bg-gradient-to-br from-primary/20 to-primary/5 p-8 rounded-[2.5rem] border border-primary/20 shadow-2xl backdrop-blur-md"
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
            >
              <SoccerPlayerIcon className="h-24 w-24 text-primary drop-shadow-[0_0_20px_rgba(var(--primary),0.6)]" />
            </motion.div>
          </div>

          <div className="space-y-4 relative z-10">
            <h1 className="text-5xl md:text-6xl font-black tracking-tighter text-foreground drop-shadow-sm">
              ¡Bienvenido a <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-emerald-400 drop-shadow-md pb-1 relative">Pateá</span>!
            </h1>
            <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
              El vestuario está vacío. Para empezar a gestionar tus partidos, estadísticas y subir a la cima, primero necesitás crear o unirte a tu clan.
            </p>
          </div>

          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto mt-4 relative z-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Button asChild size="lg" className="w-full sm:w-auto h-14 px-8 text-lg font-bold shadow-[0_0_30px_rgba(var(--primary),0.4)] hover:shadow-[0_0_40px_rgba(var(--primary),0.6)] hover:-translate-y-1 transition-all rounded-xl">
              <Link href="/groups">
                <Users2 className="mr-3 h-6 w-6" />
                Crear mi Clan
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto h-14 px-8 text-lg font-bold border-2 hover:bg-muted/50 rounded-xl">
              <Link href="/groups?action=join">
                Unirme con Código
              </Link>
            </Button>
          </motion.div>
        </motion.div>
      )
    } else {
      // Veteran User with no active group (e.g., session cleared or bug)
      return (
        <motion.div
          className="flex flex-col items-center justify-center min-h-[70vh] gap-8 text-center px-4 relative"
          variants={PAGE_VARIANTS}
          initial="initial"
          animate="animate"
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] max-w-lg h-[60vw] max-h-lg bg-primary/5 blur-[80px] rounded-full -z-10 pointer-events-none"></div>

          <div className="relative mb-4">
            <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full scale-125 animate-pulse"></div>
            <motion.div
              className="relative bg-card/60 p-8 rounded-full border border-border/50 shadow-xl backdrop-blur-sm"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            >
              <Users2 className="h-20 w-20 text-primary drop-shadow-md" />
            </motion.div>
          </div>

          <div className="space-y-4 relative z-10">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
              ¿Con qué <span className="text-primary bg-clip-text text-transparent bg-gradient-to-r from-primary to-emerald-400 drop-shadow-sm pb-1 relative">equipo</span> vas a jugar hoy?
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-lg mx-auto">
              No tenés un grupo activo visible en este dispositivo en este momento. Volvé a conectarte con tu equipo.
            </p>
          </div>

          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto mt-4 relative z-10"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Button asChild size="lg" className="w-full sm:w-auto h-14 px-8 text-lg font-bold shadow-[0_0_20px_rgba(var(--primary),0.3)] hover:shadow-[0_0_30px_rgba(var(--primary),0.5)] hover:-translate-y-1 transition-all rounded-xl">
              <Link href="/groups">
                Seleccionar mi Grupo Activo
              </Link>
            </Button>
          </motion.div>
        </motion.div>
      )
    }
  }

  return (
    <motion.div
      className="flex flex-col gap-8"
      variants={PAGE_VARIANTS}
      initial="initial"
      animate="animate"
    >
      <FirstTimeInfoDialog
        featureKey="hasSeenDashboardInfo"
        title="¡Bienvenid@ a tu Vestuario!"
        description="Este es tu panel de control. Acá vas a ver un resumen de todo: tu próximo partido, los cracks de tu grupo, y una opción clave: la 'Visibilidad Pública', que te permite ser encontrado por otros organizadores."
      />

      {/* Notification Permission Banner */}
      <NotificationPermissionPrompt variant="banner" />

      <div className="flex items-center gap-3">
        <MateIcon className="h-8 w-8 text-primary" />
        <PageHeader
          title="El Vestuario"
          description="Un pantallazo de cómo está el cuadro."
        />
      </div>

      <DashboardTabs
        nextMatch={nextMatch}
        liveMatches={liveMatches}
        liveLoading={liveLoading}
        player={player}
        recentMatches={recentMatches}
        availablePlayerData={availablePlayerData}
        savedLocation={userProfile?.savedLocation}
        onOpenLiveMatch={(match) => { setSelectedLive(match); setShowVisualizer(true); }}
        groupId={user?.activeGroupId}
        userId={user?.uid}
        activeGroup={activeGroup}
        allPlayersInGroup={allPlayersInGroup || []}
        upcomingMatches={upcomingMatchesData || []}
        friendlyMatches={friendlyMatchesData || []}
        groupRecentMatches={groupRecentMatches}
        totalGroupMatchesCount={totalGroupMatchesCount}
      />

      {/* Visualizador modal desde dashboard */}
      {selectedLive && (
        <MatchVisualizer
          match={selectedLive}
          isOpen={showVisualizer}
          onClose={() => setShowVisualizer(false)}
          isAdmin={false}
          onEventLogged={undefined}
          currentMinute={selectedLive.currentMinute || 0}
          currentSecond={0}
        />
      )}
    </motion.div>
  );
}


export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  )
}
