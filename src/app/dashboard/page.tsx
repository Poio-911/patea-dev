
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
import type { Player, Match, AvailablePlayer, UserProfile } from '@/lib/types';
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

const statusConfig: Record<Match['status'], { label: string; className: string }> = {
  upcoming: { label: 'Próximo', className: 'bg-primary/10 text-foreground border border-primary/30 rounded-full backdrop-blur-sm' },
  active: { label: 'Activo', className: 'bg-foreground/10 text-foreground border border-foreground/30 rounded-full backdrop-blur-sm' },
  completed: { label: 'Finalizado', className: 'bg-muted/40 text-muted-foreground border border-muted/50 rounded-full backdrop-blur-sm' },
  evaluated: { label: 'Evaluado', className: 'bg-card/60 text-foreground border border-border rounded-full backdrop-blur-sm' },
};

const pageVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.5 } },
};

const listVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const cardVariants = {
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

  const top5PlayersQuery = useMemo(() => {
    if (!firestore || !user?.activeGroupId) return null;
    return query(
      collection(firestore, 'players'),
      where('groupId', '==', user.activeGroupId),
      orderBy('ovr', 'desc'),
      limit(5)
    );
  }, [firestore, user?.activeGroupId]);

  const groupMatchesQuery = useMemo(() => {
    if (!firestore || !user?.activeGroupId) return null;
    return query(
      collection(firestore, 'matches'),
      where('groupId', '==', user.activeGroupId),
      orderBy('date', 'desc'),
      limit(10)
    );
  }, [firestore, user?.activeGroupId]);

  const joinedMatchesQuery = useMemo(() => {
    if (!firestore || !user?.uid) return null;
    return query(
      collection(firestore, 'matches'),
      where('playerUids', 'array-contains', user.uid)
    );
  }, [firestore, user?.uid]);

  const playerRef = useMemo(() => firestore && user?.uid ? doc(firestore, 'players', user.uid) : null, [firestore, user?.uid]);
  const { data: player, loading: playerLoading } = useDoc<Player>(playerRef);

  const availablePlayerRef = useMemo(() => firestore && user?.uid ? doc(firestore, 'availablePlayers', user.uid) : null, [firestore, user?.uid]);
  const { data: availablePlayerData, loading: availablePlayerLoading } = useDoc<AvailablePlayer>(availablePlayerRef);

  // Get user profile for savedLocation
  const userProfileRef = useMemo(() => firestore && user?.uid ? doc(firestore, 'users', user.uid) : null, [firestore, user?.uid]);
  const { data: userProfile } = useDoc<UserProfile>(userProfileRef);

  const { data: top5Players, loading: top5PlayersLoading } = useCollection<Player>(top5PlayersQuery);

  const allPlayersInGroupQuery = useMemo(() => {
    if (!firestore || !user?.activeGroupId) return null;
    return query(collection(firestore, 'players'), where('groupId', '==', user.activeGroupId));
  }, [firestore, user?.activeGroupId]);
  const { data: allPlayersInGroup, loading: allPlayersLoading } = useCollection<Player>(allPlayersInGroupQuery);

  const { data: groupMatches, loading: groupMatchesLoading } = useCollection<Match>(groupMatchesQuery);
  const { data: joinedMatches, loading: joinedMatchesLoading } = useCollection<Match>(joinedMatchesQuery);

  // Live matches in group (first/second half or half_time)
  // Live matches: combine three queries to avoid composite index requirements
  const liveQ1 = useMemo(() => firestore && user?.activeGroupId ? query(
    collection(firestore, 'matches'),
    where('groupId', '==', user.activeGroupId),
    where('status', '==', 'active'),
    where('liveStatus', '==', 'first_half')
  ) : null, [firestore, user?.activeGroupId]);
  const liveQ2 = useMemo(() => firestore && user?.activeGroupId ? query(
    collection(firestore, 'matches'),
    where('groupId', '==', user.activeGroupId),
    where('status', '==', 'active'),
    where('liveStatus', '==', 'second_half')
  ) : null, [firestore, user?.activeGroupId]);
  const liveQ3 = useMemo(() => firestore && user?.activeGroupId ? query(
    collection(firestore, 'matches'),
    where('groupId', '==', user.activeGroupId),
    where('status', '==', 'active'),
    where('liveStatus', '==', 'half_time')
  ) : null, [firestore, user?.activeGroupId]);
  const { data: live1, loading: l1 } = useCollection<Match>(liveQ1);
  const { data: live2, loading: l2 } = useCollection<Match>(liveQ2);
  const { data: live3, loading: l3 } = useCollection<Match>(liveQ3);
  const liveLoading = l1 || l2 || l3;
  const liveMatches = useMemo(() => [...(live1 || []), ...(live2 || []), ...(live3 || [])], [live1, live2, live3]);

  const [showVisualizer, setShowVisualizer] = useState(false);
  const [selectedLive, setSelectedLive] = useState<Match | null>(null);

  const loading = top5PlayersLoading || allPlayersLoading || groupMatchesLoading || joinedMatchesLoading || playerLoading || availablePlayerLoading;

  const matches = useMemo(() => {
    if (!groupMatches && !joinedMatches) return null;

    const allMatchesMap = new Map<string, Match>();

    (groupMatches || []).forEach(match => allMatchesMap.set(match.id, match));

    (joinedMatches || []).forEach(match => {
      if (!allMatchesMap.has(match.id)) {
        allMatchesMap.set(match.id, match);
      }
    });

    return Array.from(allMatchesMap.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [groupMatches, joinedMatches]);

  const { nextMatch, recentMatches } = useMemo(() => {
    if (!matches) return { nextMatch: null, recentMatches: [] };

    const getMatchTimestamp = (m: Match) => {
      const d = new Date(m.date);
      const cleanTime = (m.time || '').replace(' hs', '').replace('hs', '').trim();
      const [hh, mm = '0'] = cleanTime.split(':');
      const h = parseInt(hh || '0', 10);
      const mins = parseInt(mm || '0', 10);
      d.setHours(h || 0, mins || 0, 0, 0);
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

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (!user?.activeGroupId) {
    return (
      <div className="flex flex-col gap-8">
        <div className="flex items-center gap-3">
          <MateIcon className="h-8 w-8 text-primary" />
          <PageHeader
            title="El Vestuario"
            description="Bienvenido a tu vestuario virtual."
          />
        </div>
        <Alert>
          <Users2 className="h-4 w-4" />
          <AlertTitle>¡Bienvenido, Capitán!</AlertTitle>
          <AlertDescription>
            Parece que es tu primera vez acá. Para arrancar, armá tu primer grupo o metete en uno que ya exista.
            <Button asChild variant="link" className="p-0 h-auto ml-1">
              <Link href="/groups">Ir a Grupos</Link>
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <motion.div
      className="flex flex-col gap-8"
      variants={pageVariants}
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
        top5Players={top5Players || []}
        player={player}
        recentMatches={recentMatches}
        availablePlayerData={availablePlayerData}
        savedLocation={userProfile?.savedLocation}
        onOpenLiveMatch={(match) => { setSelectedLive(match); setShowVisualizer(true); }}
        groupId={user?.activeGroupId}
        userId={user?.uid}
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
