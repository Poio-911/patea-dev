
'use client';

import { CompetitionCard } from '@/components/competitions/CompetitionCard';
import { CompactMatchCard } from '@/components/compact-match-card';
import { Swords, Trophy, Shield, Search, LayoutGrid, ChevronRight, Calendar } from 'lucide-react';
import { useCompetitionsData } from '@/hooks/use-competitions-data';
import { InvitationsSheet } from '@/components/invitations-sheet';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } }
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 28 } }
};

export default function CompetitionsPage() {
  const { invitations, leagues, cups, myTeams, loading, user, upcomingCompetitionMatches } = useCompetitionsData();

  const invitationsCount = invitations.length;
  const activeLeagues = leagues?.filter(l => l.status === 'in_progress' || (l.status === 'draft' && l.ownerUid === user?.uid)) || [];
  const completedLeagues = leagues?.filter(l => l.status === 'completed') || [];
  const activeCups = cups?.filter(c => c.status === 'in_progress' || (c.status === 'draft' && c.ownerUid === user?.uid)) || [];
  const completedCups = cups?.filter(c => c.status === 'completed') || [];

  if (loading) {
    return (
      <div className="flex h-[60svh] items-center justify-center">
        <p className="text-muted-foreground sport-text italic animate-pulse">Iniciando sistemas...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 pb-32 max-w-5xl">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between gap-4 mb-10"
      >
        <div>
          <p className="flex items-center gap-1.5 text-[10px] font-bold sport-text tracking-[0.3em] text-primary mb-2">
            <LayoutGrid className="w-3 h-3" />
            CENTRO DE COMPETICIÓN
          </p>
          <h1 className="text-3xl md:text-4xl font-black sport-text tracking-tight leading-none">
            HUB DE PARTIDOS
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Amistosos, ligas y copas de tu grupo.
          </p>
        </div>
        <InvitationsSheet />
      </motion.div>

      {/* Upcoming competition matches */}
      {upcomingCompetitionMatches.length > 0 && (
        <div className="mb-8">
          <p className="text-[10px] font-bold sport-text tracking-[0.25em] text-muted-foreground mb-3 flex items-center gap-1.5">
            <Calendar className="w-3 h-3" />
            PRÓXIMOS PARTIDOS
          </p>
          <div className="grid grid-cols-2 md:grid-cols-1 gap-2 md:gap-3">
            {upcomingCompetitionMatches.map(match => (
              <CompactMatchCard key={match.id} match={match} />
            ))}
          </div>
        </div>
      )}

      {/* Cards */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-4"
      >
        {/* Row 1: Amistosos — full width */}
        <motion.div variants={item}>
          <Link href="/competitions/amistosos">
            <CompetitionCard
              type="friendly"
              title="AMISTOSOS"
              icon={Swords}
              notificationCount={invitationsCount}
              stats={[
                { label: 'RETOS PENDIENTES', value: invitationsCount || 0 },
                { label: 'MIS EQUIPOS', value: myTeams?.length || 0 }
              ]}
            />
          </Link>
        </motion.div>

        {/* Row 2: Ligas + Copas side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <motion.div variants={item}>
            <Link href="/competitions/leagues" className="block h-full">
              <CompetitionCard
                type="league"
                title="LIGAS"
                icon={Shield}
                stats={[
                  { label: 'ACTIVAS', value: activeLeagues.length },
                  { label: 'HISTORIAL', value: completedLeagues.length }
                ]}
                className="h-full"
              />
            </Link>
          </motion.div>
          <motion.div variants={item}>
            <Link href="/competitions/cups" className="block h-full">
              <CompetitionCard
                type="cup"
                title="COPAS"
                icon={Trophy}
                stats={[
                  { label: 'EN CURSO', value: activeCups.length },
                  { label: 'HALL DE LA FAMA', value: completedCups.length }
                ]}
                className="h-full"
              />
            </Link>
          </motion.div>
        </div>

        {/* Row 3: Explorar Públicas — horizontal row */}
        <motion.div variants={item}>
          <Link
            href="/competitions/public"
            className={cn(
              "group flex items-center justify-between gap-4 p-5 rounded-2xl",
              "border border-border bg-card hover:bg-accent",
              "transition-colors duration-200"
            )}
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                <Search className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold sport-text tracking-tight text-sm">EXPLORAR PÚBLICAS</p>
                <p className="text-xs text-muted-foreground">Descubrí torneos abiertos fuera de tu grupo</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}
