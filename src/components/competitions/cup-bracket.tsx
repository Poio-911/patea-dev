'use client';

import { useRef, useState } from 'react';
import { BracketMatch, CupRound, Jersey } from '@/lib/types';
import { getRoundName, getMatchesByRound, getNextRound } from '@/lib/utils/cup-bracket';
import { JerseyPreview } from '@/components/team-builder/jersey-preview';
import { Trophy, PlayCircle, ExternalLink, Settings, Clock, MapPin, UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface CupBracketProps {
  bracket: BracketMatch[];
  onMatchClick?: (match: BracketMatch) => void;
  onMatchSettingsClick?: (match: BracketMatch) => void;
  highlightedMatchId?: string;
  currentRound?: CupRound;
  canCreate?: boolean;
  userTeamId?: string;
}

export function CupBracket({ bracket, onMatchClick, onMatchSettingsClick, highlightedMatchId, currentRound, canCreate, userTeamId }: CupBracketProps) {
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

  const CARD_WIDTH = 244;
  const CARD_HEIGHT = 146;
  const GAP_X = 72;
  const BASE_GAP_Y = 36;

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [selectedRound, setSelectedRound] = useState<CupRound | null>(null);

  const scrollToRound = (round: CupRound) => {
    const roundIndex = activeRounds.indexOf(round);
    if (roundIndex < 0 || !scrollContainerRef.current) return;
    const x = roundIndex * (CARD_WIDTH + GAP_X);
    scrollContainerRef.current.scrollTo({ left: Math.max(0, x - 16), behavior: 'smooth' });
    setSelectedRound(round);
  };

  const allRounds: CupRound[] = ['round_of_32', 'round_of_16', 'round_of_8', 'semifinals', 'final'];
  const activeRounds = allRounds.filter(round => bracket.some(m => m.round === round));

  const matchPositions = new Map<string, { x: number; y: number }>();
  const roundsMap = new Map<CupRound, BracketMatch[]>();

  activeRounds.forEach(round => {
    roundsMap.set(round, getMatchesByRound(bracket, round).sort((a, b) => a.matchNumber - b.matchNumber));
  });

  activeRounds.forEach((round, roundIndex) => {
    const matches = roundsMap.get(round) || [];
    const x = roundIndex * (CARD_WIDTH + GAP_X) + 24;

    matches.forEach((match, index) => {
      let y = 0;

      if (roundIndex === 0) {
        y = index * (CARD_HEIGHT + BASE_GAP_Y) + 48;
      } else {
        const prevRound = activeRounds[roundIndex - 1];
        const prevMatches = roundsMap.get(prevRound) || [];
        const feeders = prevMatches.filter(m => m.nextMatchNumber === match.matchNumber);

        if (feeders.length > 0) {
          const minY = Math.min(...feeders.map(m => matchPositions.get(m.id)?.y || 0));
          const maxY = Math.max(...feeders.map(m => matchPositions.get(m.id)?.y || 0));
          y = (minY + maxY) / 2;
        } else {
          y = index * (CARD_HEIGHT + BASE_GAP_Y) * Math.pow(2, roundIndex) + 48;
        }
      }

      matchPositions.set(match.id, { x, y });
    });
  });

  const totalWidth = activeRounds.length * (CARD_WIDTH + GAP_X) + 48;
  const maxHeight = Math.max(...Array.from(matchPositions.values()).map(p => p.y)) + CARD_HEIGHT + 60;

  return (
    <div className="w-full">
      {/* Round navigation chips */}
      {activeRounds.length > 1 && (
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide">
          {activeRounds.map((round) => (
            <button
              key={round}
              onClick={() => scrollToRound(round)}
              className={cn(
                "flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wide transition-all border",
                (selectedRound ?? currentRound) === round
                  ? "bg-foreground text-background border-foreground/80 shadow-sm"
                  : "bg-card border-border/50 text-muted-foreground/60 hover:border-foreground/30 hover:text-foreground/80"
              )}
            >
              {getRoundName(round)}
            </button>
          ))}
        </div>
      )}

      <div
        ref={scrollContainerRef}
        className="w-full overflow-x-auto pb-6"
        style={{ scrollSnapType: 'x proximity', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
    >
      <div
        className="relative mx-auto"
        style={{
          width: totalWidth,
          height: maxHeight,
        }}
      >
        {/* SVG Layer for Connectors */}
        <svg
          className="absolute inset-0 pointer-events-none"
          style={{ width: totalWidth, height: maxHeight }}
        >
          <defs>
            <linearGradient id="grad-winner" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(var(--foreground))" stopOpacity="0.7" />
              <stop offset="100%" stopColor="hsl(var(--foreground))" stopOpacity="0.2" />
            </linearGradient>
            <linearGradient id="grad-user" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(var(--foreground))" stopOpacity="0.9" />
              <stop offset="100%" stopColor="hsl(var(--foreground))" stopOpacity="0.4" />
            </linearGradient>
            <filter id="glow-amber" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {bracket.map(match => {
            if (!match.nextMatchNumber) return null;
            const currentPos = matchPositions.get(match.id);
            const nextRound = getNextRound(match.round);
            const nextMatch = nextRound 
              ? bracket.find(m => m.matchNumber === match.nextMatchNumber && m.round === nextRound)
              : null;
            
            if (!currentPos || !nextMatch) return null;
            const nextPos = matchPositions.get(nextMatch.id);
            if (!nextPos) return null;

            const isNextFinal = nextMatch.round === 'final';
            const startX = currentPos.x + CARD_WIDTH;
            const startY = currentPos.y + (CARD_HEIGHT / 2);
            // Adjust endX by -6 if the next card is the final (to match its visual offset)
            const endX = nextPos.x + (isNextFinal ? -6 : 0);
            const endY = nextPos.y + (CARD_HEIGHT / 2);
            const midX = startX + (endX - startX) * 0.5;

            const path = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
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
                strokeWidth={isUserPath ? 2 : isCompleted ? 1.5 : 1}
                strokeOpacity={isUserPath ? 1 : isCompleted ? 1 : 0.6}
                strokeDasharray={isCompleted || isUserPath ? "0" : "4 6"}
                filter={undefined}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 1.0, ease: "easeInOut", delay }}
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
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.07 }}
              className="absolute top-0 flex items-center gap-2"
              style={{
                left: index * (CARD_WIDTH + GAP_X) + 24,
                width: CARD_WIDTH,
              }}
            >
              <div className={cn("h-px flex-1", isCurrentRound ? "bg-foreground/50" : "bg-border/40")} />
              <span className={cn(
                "text-[10px] font-bold tracking-[0.18em] uppercase whitespace-nowrap",
                isCurrentRound ? "text-foreground/70" : "text-muted-foreground/35"
              )}>
                {isCurrentRound && <span className="inline-block w-1 h-1 rounded-full bg-foreground/60 mr-1.5 align-middle animate-pulse" />}
                {getRoundName(round)}
              </span>
              <div className={cn("h-px flex-1", isCurrentRound ? "bg-foreground/50" : "bg-border/40")} />
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
              initial={{ opacity: 0, scale: 0.93, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut", delay: roundIndex * 0.1 + (matchIndex % 8) * 0.04 }}
              className="absolute"
              style={{
                left: pos.x,
                top: pos.y,
                width: isFinal ? CARD_WIDTH + 12 : CARD_WIDTH,
                height: isFinal ? CARD_HEIGHT + 8 : CARD_HEIGHT,
                marginLeft: isFinal ? -6 : 0,
                marginTop: isFinal ? -4 : 0,
              }}
            >
              <BracketMatchCard
                match={match}
                onClick={onMatchClick}
                onSettingsClick={onMatchSettingsClick}
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
    </div>
  );
}

interface BracketMatchCardProps {
  match: BracketMatch;
  onClick?: (match: BracketMatch) => void;
  onSettingsClick?: (match: BracketMatch) => void;
  isHighlighted?: boolean;
  isFinal?: boolean;
  canCreate?: boolean;
  userTeamId?: string;
}

function BracketMatchCard({ match, onClick, onSettingsClick, isHighlighted, isFinal, canCreate, userTeamId }: BracketMatchCardProps) {
  const hasTeams = !!(match.team1Id && match.team2Id);
  const isCompleted = !!match.winnerId;
  const isClickable = !!onClick;
  const isEmpty = !match.team1Id && !match.team2Id;

  const TeamRow = ({ name, jersey, isWinner, score, teamId }: {
    name?: string;
    jersey?: Jersey;
    isWinner?: boolean;
    score?: number;
    teamId?: string;
  }) => {
    const isUser = !!(userTeamId && teamId === userTeamId);
    const isLoser = isCompleted && !isWinner && !!name;

    return (
      <div className={cn(
        "flex items-center gap-2.5 px-3 py-3 min-w-0 transition-colors",
        isWinner && "bg-muted/60 dark:bg-white/5",
        isLoser && "opacity-35",
        isUser && !isWinner && "bg-primary/5",
      )}>
        {/* Jersey */}
        <div className="w-7 h-7 flex-shrink-0 flex items-center justify-center">
          {jersey ? (
            <JerseyPreview jersey={jersey} size="xs" />
          ) : (
            <div className="w-5 h-5 rounded-full border border-dashed border-border/50" />
          )}
        </div>
        {/* Team name */}
        <div className="flex-1 min-w-0">
          <span className={cn(
            "text-[13px] truncate leading-none block sport-text",
            isWinner ? "font-black text-foreground" : name ? "font-semibold text-foreground/65" : "font-normal italic text-muted-foreground/30 text-xs",
          )}>
            {name ?? "Por definir"}
          </span>
        </div>
        {/* Score */}
        <span className={cn(
          "tabular-nums font-black leading-none text-right sport-text flex-shrink-0 w-8",
          isWinner ? "text-2xl text-amber-500" : "text-xl text-muted-foreground/20",
        )}>
          {name ? (score !== undefined && score !== null ? score : "–") : ""}
        </span>
      </div>
    );
  };

  return (
    <div
      onClick={() => isClickable && !isEmpty && onClick?.(match)}
      className={cn(
        "h-full flex flex-col overflow-hidden rounded-xl border transition-all duration-200 relative group",
        isEmpty
          ? "bg-muted/5 border-dashed border-border/30"
          : "bg-card border-border/70 shadow-sm",
        isClickable && !isEmpty && "cursor-pointer hover:shadow-md hover:border-foreground/20 hover:-translate-y-px active:translate-y-0",
        isFinal && !isEmpty && "border-foreground/40 shadow-md",
        isHighlighted && !isFinal && !isEmpty && "border-foreground/30",
      )}
    >
      {/* Settings button (hover) */}
      {onSettingsClick && hasTeams && !isEmpty && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSettingsClick(match);
          }}
          className="absolute right-1.5 top-1.5 h-6 w-6 rounded-md bg-background/90 border border-border/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted z-10"
          title="Configurar partido"
        >
          <Settings className="h-3 w-3 text-muted-foreground" />
        </button>
      )}

      {/* Final top bar */}
      {isFinal && !isEmpty && (
        <div className="h-[3px] w-full bg-foreground flex-shrink-0" />
      )}

      {/* Metadata Row (Date/Time/Venue/Referee) */}
      {!isEmpty && (match.date || match.time || match.venue || match.refereeName) && (
        <div className="px-2.5 pt-2 pb-1 flex flex-wrap items-center justify-center gap-1.5 text-[9px] text-muted-foreground/70 border-b border-border/20">
          {(match.date || match.time) && (
            <span className="flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5" />
              {[match.date, match.time].filter(Boolean).join(' ')}
            </span>
          )}
          {match.venue && (
            <span className="flex items-center gap-0.5">
              <MapPin className="w-2.5 h-2.5" />
              {match.venue}
            </span>
          )}
          {match.refereeName && (
            <span className="flex items-center gap-0.5 text-primary/70">
              <UserCheck className="w-2.5 h-2.5" />
              {match.refereeName}
            </span>
          )}
        </div>
      )}

      {/* Team 1 */}
      <TeamRow
        name={match.team1Name}
        jersey={match.team1Jersey}
        isWinner={match.winnerId === match.team1Id}
        score={match.finalScore?.team1}
        teamId={match.team1Id}
      />

      {/* Divider */}
      <div className={cn("mx-3 border-t flex-shrink-0", isEmpty ? "border-dashed border-border/25" : "border-border/40")} />

      {/* Team 2 */}
      <TeamRow
        name={match.team2Name}
        jersey={match.team2Jersey}
        isWinner={match.winnerId === match.team2Id}
        score={match.finalScore?.team2}
        teamId={match.team2Id}
      />

      {/* CTA / status footer */}
      {!isEmpty && (
        <>
          {hasTeams && !isCompleted && canCreate ? (
            <div className="px-2.5 pb-2.5 pt-1.5 flex-shrink-0">
              <div className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-foreground text-background text-[11px] font-bold uppercase tracking-wide">
                <PlayCircle className="w-3.5 h-3.5" />
                Cargar resultado
              </div>
            </div>
          ) : isCompleted ? (
            <div className="flex items-center justify-center pb-2 pt-1.5 flex-shrink-0">
              <StatusPill isCompleted={isCompleted} isFinal={isFinal} hasMatchId={!!match.matchId} />
            </div>
          ) : !!match.matchId ? (
            <div className="flex items-center justify-center pb-2 pt-1.5 flex-shrink-0">
              <StatusPill isCompleted={false} isFinal={isFinal} hasMatchId={true} />
            </div>
          ) : null}
        </>
      )}

      {/* Streaming button */}
      {(match as any).streamingUrl && (
        <div className="px-3 pb-2.5 flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              window.open((match as any).streamingUrl, '_blank');
            }}
            className={cn(
              "w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all",
              (match as any).isLive
                ? "bg-red-600/90 hover:bg-red-600 text-white animate-pulse"
                : "bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20"
            )}
          >
            {(match as any).isLive ? (
              <>
                <div className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                EN VIVO
              </>
            ) : (
              <>
                <ExternalLink className="w-3 h-3" />
                VER TRANSMISIÓN
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function StatusPill({ isCompleted, isFinal, hasMatchId }: {
  isCompleted: boolean;
  isFinal?: boolean;
  hasMatchId: boolean;
}) {
  if (isCompleted && isFinal) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-wide sport-text bg-amber-500/10 text-amber-500 border-amber-500/20">
        <Trophy className="w-3 h-3" /> Campeón
      </span>
    );
  }
  if (isCompleted) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[11px] font-medium uppercase tracking-wide sport-text text-muted-foreground/40 border-border/30">
        Finalizado
      </span>
    );
  }
  if (hasMatchId) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-semibold uppercase tracking-wide sport-text bg-primary/10 text-primary border-primary/20">
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        En juego
      </span>
    );
  }
  return null;
}
