'use client';

import { BracketMatch, CupRound } from '@/lib/types';
import { getRoundName, getMatchesByRound } from '@/lib/utils/cup-bracket';
import { JerseyPreview } from '@/components/team-builder/jersey-preview';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Clock, Medal, Calendar } from 'lucide-react';
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
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground bg-muted/10 rounded-2xl border border-dashed border-border/50">
        <Trophy className="h-16 w-16 mb-4 opacity-20" />
        <p className="text-lg font-medium">El bracket aún no ha sido generado</p>
        <p className="text-sm">Iniciá la copa para sortear las llaves.</p>
      </div>
    );
  }

  // Constants for layout
  const CARD_WIDTH = 260;
  const CARD_HEIGHT = 110;
  const GAP_X = 100;
  const BASE_GAP_Y = 32;

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
    const x = roundIndex * (CARD_WIDTH + GAP_X) + 20; // +20 padding

    matches.forEach((match, index) => {
      let y = 0;

      if (roundIndex === 0) {
        y = index * (CARD_HEIGHT + BASE_GAP_Y) + 60; // +60 for headers
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
    <div className="w-full overflow-x-auto pb-4 custom-scrollbar">
      <div
        className="relative mx-auto"
        style={{ width: totalWidth, height: maxHeight }}
      >
        {/* SVG Layer for Connectors */}
        <svg
          className="absolute inset-0 pointer-events-none"
          style={{ width: totalWidth, height: maxHeight }}
        >
          <defs>
            <linearGradient id="gradient-connector" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.8" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.4" />
            </linearGradient>
            <linearGradient id="gradient-user" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(var(--ovr-elite))" stopOpacity="1" />
              <stop offset="100%" stopColor="hsl(var(--ovr-elite))" stopOpacity="0.6" />
            </linearGradient>
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

            // Highlight logic
            const isUserPath = userTeamId &&
              (match.team1Id === userTeamId || match.team2Id === userTeamId) &&
              match.winnerId === userTeamId;

            return (
              <motion.path
                key={`conn-${match.id}-${nextMatch.id}`}
                d={path}
                fill="none"
                stroke={isUserPath ? "hsl(var(--ovr-elite))" : isCompleted ? "hsl(var(--primary))" : "hsl(var(--border))"}
                strokeWidth={isUserPath ? 3 : isCompleted ? 2 : 1.5}
                strokeOpacity={isUserPath ? 0.8 : isCompleted ? 0.6 : 0.3}
                strokeDasharray={isCompleted || isUserPath ? "0" : "6 4"}
                className="transition-colors duration-700 ease-in-out"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 1.2, ease: "easeInOut" }}
              />
            );
          })}
        </svg>

        {/* Round Headers */}
        {activeRounds.map((round, index) => {
          const isCurrentRound = currentRound === round;
          return (
            <div
              key={`header-${round}`}
              className={cn(
                "absolute top-0 text-center font-bold text-sm tracking-wider uppercase transition-all duration-300 py-2 rounded-full",
                isCurrentRound
                  ? "text-primary bg-primary/10 border border-primary/20 shadow-sm"
                  : "text-muted-foreground"
              )}
              style={{
                left: index * (CARD_WIDTH + GAP_X) + 20,
                width: CARD_WIDTH
              }}
            >
              {getRoundName(round)}
            </div>
          );
        })}

        {/* Matches Layer */}
        {bracket.map(match => {
          const pos = matchPositions.get(match.id);
          if (!pos) return null;
          const isUserMatch = Boolean(userTeamId && (match.team1Id === userTeamId || match.team2Id === userTeamId));

          return (
            <div
              key={match.id}
              className="absolute transition-all duration-500 ease-out"
              style={{
                left: pos.x,
                top: pos.y,
                width: CARD_WIDTH,
                height: CARD_HEIGHT
              }}
            >
              <BracketMatchCard
                match={match}
                onClick={onMatchClick}
                isHighlighted={highlightedMatchId === match.id || isUserMatch}
                isFinal={match.round === 'final'}
                canCreate={!!canCreate}
                userTeamId={userTeamId}
              />
            </div>
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

  const TeamRow = ({ name, jersey, isWinner, score, teamId }: { name?: string, jersey?: any, isWinner?: boolean, score?: number, teamId?: string }) => {
    const isUser = userTeamId && teamId === userTeamId;
    return (
      <div className={cn(
        "flex items-center justify-between px-3 py-2 transition-colors border-l-[3px]",
        isWinner ? "bg-primary/5 border-primary" : "border-transparent",
        isUser && "border-l-primary bg-primary/10",
        !isWinner && isCompleted && "opacity-60 grayscale",
        !name && "opacity-40"
      )}>
        <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
          {jersey ? (
            <div className="w-7 h-7 flex-shrink-0 flex items-center justify-center">
              <JerseyPreview jersey={jersey} size="xs" className="scale-125" />
            </div>
          ) : (
            <div className="w-7 h-7 flex-shrink-0 rounded-full bg-muted/30 border border-dashed border-border/50" />
          )}
          <span className={cn(
            "text-sm truncate",
            isUser ? "font-bold text-foreground" : "font-medium text-foreground/90",
            !name && "italic text-xs opacity-60"
          )}>
            {name || "Por definir..."}
          </span>
        </div>
        {name && (
          <span className={cn(
            "text-base font-bold font-variant-numeric tabular-nums w-6 text-center rounded-sm",
            isCompleted ? (isWinner ? "text-primary" : "text-muted-foreground") : "text-muted-foreground/30",
          )}>
            {score ?? "-"}
          </span>
        )}
      </div>
    );
  };

  return (
    <Card
      onClick={() => onClick?.(match)}
      className={cn(
        "h-full flex flex-col justify-center overflow-hidden cursor-pointer transition-all duration-300",
        "bg-white dark:bg-card/90 backdrop-blur-sm border-border/50 shadow-sm hover:shadow-md",
        isHighlighted && "ring-2 ring-primary ring-offset-2 dark:ring-offset-card",
        isFinal && "ring-1 ring-amber-500/50 shadow-amber-500/10",
        userTeamId && (match.team1Id === userTeamId || match.team2Id === userTeamId) && "border-purple-500/30"
      )}
    >
      <div className="flex flex-col gap-0.5 w-full">
        <TeamRow
          name={match.team1Name}
          jersey={match.team1Jersey}
          isWinner={match.winnerId === match.team1Id}
          score={match.finalScore?.team1}
          teamId={match.team1Id}
        />
        <div className="h-px bg-border/40 mx-3" />
        <TeamRow
          name={match.team2Name}
          jersey={match.team2Jersey}
          isWinner={match.winnerId === match.team2Id}
          score={match.finalScore?.team2}
          teamId={match.team2Id}
        />
      </div>

      {/* Status Footer */}
      {(hasTeams || isFinal) && (
        <div className="absolute top-1 right-2 flex gap-1">
          {isCompleted && isFinal ? (
            <Badge variant="secondary" className="h-5 px-2 text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200/50 dark:border-amber-700/30">
              <Trophy className="w-3 h-3 mr-1" /> Campeón
            </Badge>
          ) : isCompleted ? (
            <Badge variant="outline" className="h-5 px-2 text-[10px] border-border/50 bg-muted/30">Finalizado</Badge>
          ) : hasTeams ? (
            match.matchId ? (
              <Badge variant="default" className="h-5 px-2 text-[10px] shadow-sm">Jugar</Badge>
            ) : canCreate ? (
              <Badge variant="secondary" className="h-5 px-2 text-[10px] bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 transition-colors">
                <Clock className="w-3 h-3 mr-1" /> Generar Partido
              </Badge>
            ) : (
              <Badge variant="outline" className="h-5 px-2 text-[10px] border-border/50 bg-muted/30">Pendiente</Badge>
            )
          ) : null}
        </div>
      )}
    </Card>
  );
}
