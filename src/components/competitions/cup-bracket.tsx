'use client';

import { BracketMatch, CupRound } from '@/lib/types';
import { getRoundName, getMatchesByRound } from '@/lib/utils/cup-bracket';
import { JerseyPreview } from '@/components/team-builder/jersey-preview';
import { Trophy, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface CupBracketProps {
  bracket: BracketMatch[];
  onMatchClick?: (match: BracketMatch) => void;
  highlightedMatchId?: string;
  currentRound?: CupRound;
  canCreate?: boolean;
  userTeamId?: string;
}

export function CupBracket({ bracket, onMatchClick, highlightedMatchId, currentRound, canCreate, userTeamId }: CupBracketProps) {
  if (!bracket || bracket.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 rounded-2xl border border-dashed border-amber-500/15 bg-amber-500/3">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/15 flex items-center justify-center mb-5">
          <Trophy className="h-8 w-8 text-amber-500/50" strokeWidth={1.5} />
        </div>
        <p className="text-base font-bold sport-text text-foreground/60 uppercase tracking-wider">Bracket no generado</p>
        <p className="text-sm text-muted-foreground/50 mt-1.5">Iniciá la copa para sortear las llaves.</p>
      </div>
    );
  }

  // Constants for layout
  const CARD_WIDTH = 260;
  const CARD_HEIGHT = 112;
  const GAP_X = 110;
  const BASE_GAP_Y = 36;

  // Get rounds
  const allRounds: CupRound[] = ['round_of_32', 'round_of_16', 'round_of_8', 'semifinals', 'final'];
  const activeRounds = allRounds.filter(round => bracket.some(m => m.round === round));

  // Calculate positions
  const matchPositions = new Map<string, { x: number; y: number }>();
  const roundsMap = new Map<CupRound, BracketMatch[]>();

  activeRounds.forEach(round => {
    roundsMap.set(round, getMatchesByRound(bracket, round).sort((a, b) => a.matchNumber - b.matchNumber));
  });

  activeRounds.forEach((round, roundIndex) => {
    const matches = roundsMap.get(round) || [];
    const x = roundIndex * (CARD_WIDTH + GAP_X) + 20;

    matches.forEach((match, index) => {
      let y = 0;

      if (roundIndex === 0) {
        y = index * (CARD_HEIGHT + BASE_GAP_Y) + 60;
      } else {
        const prevRound = activeRounds[roundIndex - 1];
        const prevMatches = roundsMap.get(prevRound) || [];
        const feeders = prevMatches.filter(m => m.nextMatchNumber === match.matchNumber);

        if (feeders.length > 0) {
          const minY = Math.min(...feeders.map(m => matchPositions.get(m.id)?.y || 0));
          const maxY = Math.max(...feeders.map(m => matchPositions.get(m.id)?.y || 0));
          y = (minY + maxY) / 2;
        } else {
          y = index * (CARD_HEIGHT + BASE_GAP_Y) * Math.pow(2, roundIndex) + 60;
        }
      }

      matchPositions.set(match.id, { x, y });
    });
  });

  const totalWidth = activeRounds.length * (CARD_WIDTH + GAP_X) + 40;
  const maxHeight = Math.max(...Array.from(matchPositions.values()).map(p => p.y)) + CARD_HEIGHT + 40;

  return (
    <div
      className="w-full overflow-x-auto pb-6 scrollbar-hide"
      style={{ scrollSnapType: 'x proximity', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
    >
      <div
        className="relative mx-auto"
        style={{
          width: totalWidth,
          height: maxHeight,
          backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
        }}
      >
        {/* SVG Layer for Connectors */}
        <svg
          className="absolute inset-0 pointer-events-none"
          style={{ width: totalWidth, height: maxHeight }}
        >
          <defs>
            <linearGradient id="grad-winner" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="1" />
              <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.5" />
            </linearGradient>
            <linearGradient id="grad-user" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#fcd34d" stopOpacity="1" />
              <stop offset="100%" stopColor="#fef3c7" stopOpacity="0.7" />
            </linearGradient>
            <filter id="glow-amber" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {bracket.map(match => {
            if (!match.nextMatchNumber) return null;
            const currentPos = matchPositions.get(match.id);
            const nextMatch = bracket.find(m => m.matchNumber === match.nextMatchNumber && m.round !== match.round);
            if (!currentPos || !nextMatch) return null;
            const nextPos = matchPositions.get(nextMatch.id);
            if (!nextPos) return null;

            const startX = currentPos.x + CARD_WIDTH;
            const startY = currentPos.y + (CARD_HEIGHT / 2);
            const endX = nextPos.x;
            const endY = nextPos.y + (CARD_HEIGHT / 2);
            const cp1x = startX + (GAP_X / 2);
            const cp1y = startY;
            const cp2x = endX - (GAP_X / 2);
            const cp2y = endY;

            const path = `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;
            const isCompleted = !!match.winnerId;

            const isUserPath = !!(userTeamId &&
              (match.team1Id === userTeamId || match.team2Id === userTeamId) &&
              match.winnerId === userTeamId);

            const delay = activeRounds.indexOf(match.round) * 0.15 + 0.1;

            return (
              <motion.path
                key={`conn-${match.id}-${nextMatch.id}`}
                d={path}
                fill="none"
                stroke={isUserPath ? "url(#grad-user)" : isCompleted ? "url(#grad-winner)" : "hsl(var(--border))"}
                strokeWidth={isUserPath ? 3 : isCompleted ? 2.5 : 1}
                strokeOpacity={isUserPath ? 1 : isCompleted ? 1 : 0.35}
                strokeDasharray={isCompleted || isUserPath ? "0" : "5 7"}
                filter={isUserPath || isCompleted ? "url(#glow-amber)" : undefined}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 1.2, ease: "easeInOut", delay }}
              />
            );
          })}
        </svg>

        {/* Round Headers */}
        {activeRounds.map((round, index) => {
          const isCurrentRound = currentRound === round;
          return (
            <motion.div
              key={`header-${round}`}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              className={cn(
                "absolute top-0 text-center text-[10px] font-bold tracking-[0.18em] uppercase px-4 py-1.5 rounded-full border sport-text",
                isCurrentRound
                  ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                  : "bg-muted/40 border-border/30 text-muted-foreground/70"
              )}
              style={{
                left: index * (CARD_WIDTH + GAP_X) + 20,
                width: CARD_WIDTH,
                ...(isCurrentRound && { boxShadow: "0 0 12px rgba(245,158,11,0.25), 0 0 4px rgba(245,158,11,0.15)" })
              }}
            >
              {isCurrentRound && <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 mr-1.5 animate-pulse" />}
              {getRoundName(round)}
            </motion.div>
          );
        })}

        {/* Matches Layer */}
        {bracket.map((match, matchIndex) => {
          const pos = matchPositions.get(match.id);
          if (!pos) return null;
          const isUserMatch = Boolean(userTeamId && (match.team1Id === userTeamId || match.team2Id === userTeamId));
          const isFinal = match.round === 'final';
          const roundIndex = activeRounds.indexOf(match.round);

          return (
            <motion.div
              key={match.id}
              initial={{ opacity: 0, scale: 0.92, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut", delay: roundIndex * 0.12 + (matchIndex % 8) * 0.04 }}
              className="absolute"
              style={{
                left: pos.x,
                top: pos.y,
                width: isFinal ? CARD_WIDTH + 20 : CARD_WIDTH,
                height: isFinal ? CARD_HEIGHT + 10 : CARD_HEIGHT,
                marginLeft: isFinal ? -10 : 0,
                marginTop: isFinal ? -5 : 0,
              }}
            >
              <BracketMatchCard
                match={match}
                onClick={onMatchClick}
                isHighlighted={highlightedMatchId === match.id || isUserMatch}
                isFinal={isFinal}
                canCreate={!!canCreate}
                userTeamId={userTeamId}
              />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

interface BracketMatchCardProps {
  match: BracketMatch;
  onClick?: (match: BracketMatch) => void;
  isHighlighted?: boolean;
  isFinal?: boolean;
  canCreate?: boolean;
  userTeamId?: string;
}

function BracketMatchCard({ match, onClick, isHighlighted, isFinal, canCreate, userTeamId }: BracketMatchCardProps) {
  const hasTeams = match.team1Id && match.team2Id;
  const isCompleted = !!match.winnerId;

  const TeamRow = ({ name, jersey, isWinner, score, teamId }: {
    name?: string;
    jersey?: any;
    isWinner?: boolean;
    score?: number;
    teamId?: string;
  }) => {
    const isUser = !!(userTeamId && teamId === userTeamId);
    const isLoser = isCompleted && !isWinner && !!name;

    return (
      <div className={cn(
        "flex items-center justify-between px-2.5 py-1.5 transition-colors",
        isWinner && "bg-gradient-to-r from-amber-500/12 to-transparent border-l-[2.5px] border-amber-400",
        isLoser && "opacity-45 grayscale",
        isUser && !isWinner && "border-l-[2.5px] border-primary/60",
        !isWinner && !isLoser && !isUser && "border-l-[2.5px] border-transparent",
      )}>
        <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
          {jersey ? (
            <div className="w-6 h-6 flex-shrink-0 flex items-center justify-center">
              <JerseyPreview jersey={jersey} size="xs" className="scale-110" />
            </div>
          ) : (
            <div className="w-6 h-6 flex-shrink-0 rounded-full bg-muted/30 border border-dashed border-border/50" />
          )}
          <span className={cn(
            "text-xs truncate sport-text",
            isWinner ? "text-amber-300 font-bold" : "text-foreground/80 font-medium",
            !name && "text-muted-foreground/40 italic text-[11px]"
          )}>
            {name ?? "Por definir"}
          </span>
        </div>
        <span className={cn(
          "text-sm font-black tabular-nums sport-text ml-1.5",
          isWinner ? "text-amber-400" : "text-muted-foreground/30"
        )}>
          {name ? (score ?? "—") : ""}
        </span>
      </div>
    );
  };

  return (
    <div
      onClick={() => onClick?.(match)}
      className={cn(
        "h-full flex flex-col justify-center overflow-hidden cursor-pointer rounded-xl border transition-all duration-300",
        "bg-card/60 dark:bg-black/40 backdrop-blur-sm border-white/8 dark:border-white/6",
        "shadow-sm hover:shadow-md hover:-translate-y-0.5",
        isHighlighted && !isFinal && "ring-1 ring-amber-400/50 border-amber-500/20",
        isFinal && "ring-2 ring-amber-400/60 border-amber-500/25 shadow-[0_0_20px_rgba(245,158,11,0.18)]",
      )}
    >
      {isFinal && (
        <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
      )}
      <TeamRow
        name={match.team1Name}
        jersey={match.team1Jersey}
        isWinner={match.winnerId === match.team1Id}
        score={match.finalScore?.team1}
        teamId={match.team1Id}
      />
      <div className="h-px mx-3 bg-white/6" />
      <TeamRow
        name={match.team2Name}
        jersey={match.team2Jersey}
        isWinner={match.winnerId === match.team2Id}
        score={match.finalScore?.team2}
        teamId={match.team2Id}
      />
      {(hasTeams || isFinal) && (
        <div className="flex justify-center pb-1.5 pt-0.5">
          <StatusPill
            isCompleted={isCompleted}
            isFinal={isFinal}
            hasMatchId={!!match.matchId}
            canCreate={!!canCreate}
          />
        </div>
      )}
    </div>
  );
}

function StatusPill({ isCompleted, isFinal, hasMatchId, canCreate }: {
  isCompleted: boolean;
  isFinal?: boolean;
  hasMatchId: boolean;
  canCreate: boolean;
}) {
  if (isCompleted && isFinal) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wide sport-text bg-amber-500/15 text-amber-400 border-amber-500/20">
        <Trophy className="w-2.5 h-2.5" /> Campeón
      </span>
    );
  }
  if (isCompleted) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-medium uppercase tracking-wide sport-text text-muted-foreground/60 border-white/6">
        Finalizado
      </span>
    );
  }
  if (hasMatchId) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wide sport-text bg-primary/15 text-primary border-primary/20">
        <span className="w-1 h-1 rounded-full bg-primary animate-pulse" />
        Jugar
      </span>
    );
  }
  if (canCreate) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-medium uppercase tracking-wide sport-text text-amber-400/80 border-amber-500/15">
        <Clock className="w-2.5 h-2.5" /> Generar
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium sport-text text-muted-foreground/40">
      Pendiente
    </span>
  );
}
