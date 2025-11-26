'use client';

import { BracketMatch, CupRound } from '@/lib/types';
import { getRoundName, getMatchesByRound } from '@/lib/utils/cup-bracket';
import { JerseyPreview } from '../team-builder/jersey-preview';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Trophy, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CupBracketProps {
  bracket: BracketMatch[];
  onMatchClick?: (match: BracketMatch) => void;
  highlightedMatchId?: string;
  currentRound?: CupRound;
}

export function CupBracket({ bracket, onMatchClick, highlightedMatchId, currentRound }: CupBracketProps) {
  if (!bracket || bracket.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Trophy className="h-12 w-12 mb-4 opacity-50" />
        <p>El bracket aún no ha sido generado.</p>
        <p className="text-sm">Inicia la copa para crear el bracket.</p>
      </div>
    );
  }

  // Constants for layout
  const CARD_WIDTH = 256; // w-64
  const CARD_HEIGHT = 100; // Approximate height of the new card
  const GAP_X = 80; // Horizontal gap between rounds
  const BASE_GAP_Y = 20; // Vertical gap in the first round

  // Get rounds
  const allRounds: CupRound[] = ['round_of_32', 'round_of_16', 'round_of_8', 'semifinals', 'final'];
  const activeRounds = allRounds.filter(round => bracket.some(m => m.round === round));

  // Calculate positions
  // We need to map each match to a {x, y} coordinate
  const matchPositions = new Map<string, { x: number; y: number }>();

  // Group matches by round
  const roundsMap = new Map<CupRound, BracketMatch[]>();
  activeRounds.forEach(round => {
    roundsMap.set(round, getMatchesByRound(bracket, round).sort((a, b) => a.matchNumber - b.matchNumber));
  });

  // Calculate Y positions
  // We start from the first round and propagate positions? 
  // Actually, standard bracket logic: Round 0 determines base spacing.
  // But if we have byes or uneven brackets, it's harder.
  // Assumption: Full bracket or standard powers of 2.

  activeRounds.forEach((round, roundIndex) => {
    const matches = roundsMap.get(round) || [];
    const x = roundIndex * (CARD_WIDTH + GAP_X);

    matches.forEach((match, index) => {
      let y = 0;

      if (roundIndex === 0) {
        // Base round: simple spacing
        y = index * (CARD_HEIGHT + BASE_GAP_Y);
      } else {
        // Subsequent rounds: center between children (previous round matches that feed into this one)
        // We need to find the matches in the previous round that have nextMatchNumber === match.matchNumber
        const prevRound = activeRounds[roundIndex - 1];
        const prevMatches = roundsMap.get(prevRound) || [];
        const feeders = prevMatches.filter(m => m.nextMatchNumber === match.matchNumber);

        if (feeders.length > 0) {
          const minY = Math.min(...feeders.map(m => matchPositions.get(m.id)?.y || 0));
          const maxY = Math.max(...feeders.map(m => matchPositions.get(m.id)?.y || 0));
          y = (minY + maxY) / 2;
        } else {
          // Fallback if no feeders (shouldn't happen in standard tree)
          y = index * (CARD_HEIGHT + BASE_GAP_Y) * Math.pow(2, roundIndex);
        }
      }

      matchPositions.set(match.id, { x, y });
    });
  });

  // Calculate container dimensions
  const totalWidth = activeRounds.length * (CARD_WIDTH + GAP_X) - GAP_X;
  const maxHeight = Math.max(...Array.from(matchPositions.values()).map(p => p.y)) + CARD_HEIGHT;

  return (
    <div className="w-full overflow-x-auto pb-8 pt-4 px-4 bg-muted/5 rounded-xl border border-dashed">
      <div
        className="relative mx-auto"
        style={{ width: totalWidth, height: maxHeight }}
      >
        {/* SVG Layer for Connectors */}
        <svg
          className="absolute inset-0 pointer-events-none"
          style={{ width: totalWidth, height: maxHeight }}
        >
          {bracket.map(match => {
            if (!match.nextMatchNumber) return null;

            // Find next match
            const currentPos = matchPositions.get(match.id);
            // We need to find the match in the next round with matchNumber === nextMatchNumber
            // Optimization: we could build a map of matches by round+number, but iterating is fine for small brackets
            const nextMatch = bracket.find(m => m.matchNumber === match.nextMatchNumber && m.round !== match.round); // Ensure it's a different round (next one)

            if (!currentPos || !nextMatch) return null;

            const nextPos = matchPositions.get(nextMatch.id);
            if (!nextPos) return null;

            // Draw line from Right-Center of Current to Left-Center of Next
            const startX = currentPos.x + CARD_WIDTH;
            const startY = currentPos.y + (CARD_HEIGHT / 2);
            const endX = nextPos.x;
            const endY = nextPos.y + (CARD_HEIGHT / 2);

            // Bezier curve control points
            const cp1x = startX + (GAP_X / 2);
            const cp1y = startY;
            const cp2x = endX - (GAP_X / 2);
            const cp2y = endY;

            const path = `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;

            // Determine line color/status
            const isWinner = match.winnerId && (match.winnerId === match.team1Id || match.winnerId === match.team2Id);
            // Actually, the line represents the "slot" advancing. 
            // If this match has a winner, the line to the next match is "active" for that winner?
            // No, the line connects Match A to Match B. 
            // If Match A is done, the line is "completed".
            const isCompleted = !!match.winnerId;

            return (
              <path
                key={`conn-${match.id}-${nextMatch.id}`}
                d={path}
                fill="none"
                stroke={isCompleted ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"}
                strokeWidth={isCompleted ? 2 : 1}
                strokeOpacity={isCompleted ? 0.8 : 0.3}
                className="transition-all duration-500"
              />
            );
          })}
        </svg>

        {/* Matches Layer */}
        {bracket.map(match => {
          const pos = matchPositions.get(match.id);
          if (!pos) return null;

          return (
            <div
              key={match.id}
              className="absolute transition-all duration-500"
              style={{
                left: pos.x,
                top: pos.y,
                width: CARD_WIDTH,
                height: CARD_HEIGHT
              }}
            >
              {/* Round Label (only for first match in column to act as header?) 
                  No, better to have headers separate. 
                  Let's just render the card.
              */}
              <BracketMatchCard
                match={match}
                onClick={onMatchClick}
                isHighlighted={highlightedMatchId === match.id}
                isFinal={match.round === 'final'}
              />
            </div>
          );
        })}

        {/* Round Headers */}
        {activeRounds.map((round, index) => {
          const isCurrentRound = currentRound === round;
          return (
            <div
              key={`header-${round}`}
              className={cn(
                "absolute top-[-40px] text-center font-bold text-sm uppercase tracking-wider transition-all duration-300",
                isCurrentRound
                  ? "text-primary scale-110"
                  : "text-muted-foreground"
              )}
              style={{
                left: index * (CARD_WIDTH + GAP_X),
                width: CARD_WIDTH
              }}
            >
              {isCurrentRound && (
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-2 h-2 bg-primary rounded-full animate-pulse" />
              )}
              {getRoundName(round)}
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
}

function BracketMatchCard({ match, onClick, isHighlighted, isFinal }: BracketMatchCardProps) {
  const hasTeams = match.team1Id && match.team2Id;
  const isCompleted = !!match.winnerId;
  const team1IsWinner = match.winnerId === match.team1Id;
  const team2IsWinner = match.winnerId === match.team2Id;

  // Helper to render a team row
  const TeamRow = ({
    name,
    jersey,
    isWinner,
    score,
    isPlaceholder
  }: {
    name?: string,
    jersey?: any,
    isWinner?: boolean,
    score?: number,
    isPlaceholder?: boolean
  }) => (
    <div className={cn(
      "flex items-center justify-between px-3 py-2 transition-colors",
      isWinner && "bg-primary/5 font-semibold",
      !isWinner && isCompleted && "opacity-60",
      isPlaceholder && "opacity-40"
    )}>
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {jersey ? (
          <div className="w-6 h-6 flex-shrink-0">
            <JerseyPreview jersey={jersey} size="xs" />
          </div>
        ) : (
          <div className="w-6 h-6 flex-shrink-0 rounded-full bg-muted flex items-center justify-center">
            <span className="text-[10px] text-muted-foreground">?</span>
          </div>
        )}
        <span className={cn(
          "text-sm truncate",
          isWinner ? "text-foreground" : "text-muted-foreground"
        )}>
          {name || 'TBD'}
        </span>
      </div>
      {typeof score === 'number' && (
        <span className={cn(
          "text-sm font-variant-numeric tabular-nums ml-2",
          isWinner ? "font-bold text-primary" : "text-muted-foreground"
        )}>
          {score}
        </span>
      )}
    </div>
  );

  return (
    <div
      className={cn(
        'w-64 rounded-lg border bg-card shadow-sm transition-all cursor-pointer hover:shadow-md hover:border-primary/50 overflow-hidden relative group',
        isHighlighted && 'ring-2 ring-primary',
        isFinal && 'border-amber-500/50 shadow-amber-500/10',
        !hasTeams && 'opacity-70'
      )}
      onClick={() => onClick?.(match)}
    >
      {/* Status Bar */}
      <div className={cn(
        "absolute left-0 top-0 bottom-0 w-1 transition-colors",
        isCompleted ? (match.winnerId ? "bg-primary" : "bg-muted") : "bg-transparent group-hover:bg-primary/30"
      )} />

      <div className="flex flex-col divide-y">
        {/* Header with Match Number */}
        <div className="px-3 py-1 bg-muted/30 flex justify-between items-center">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            Match {match.matchNumber}
          </span>
          {isFinal && <Trophy className="h-3 w-3 text-amber-500" />}
        </div>

        <TeamRow
          name={match.team1Name}
          jersey={match.team1Jersey}
          isWinner={team1IsWinner}
          score={match.finalScore?.team1}
          isPlaceholder={!match.team1Id}
        />
        <TeamRow
          name={match.team2Name}
          jersey={match.team2Jersey}
          isWinner={team2IsWinner}
          score={match.finalScore?.team2}
          isPlaceholder={!match.team2Id}
        />
      </div>
    </div>
  );
}
