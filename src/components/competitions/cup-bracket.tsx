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
}

export function CupBracket({ bracket, onMatchClick, highlightedMatchId }: CupBracketProps) {
  if (!bracket || bracket.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Trophy className="h-12 w-12 mb-4 opacity-50" />
        <p>El bracket aún no ha sido generado.</p>
        <p className="text-sm">Inicia la copa para crear el bracket.</p>
      </div>
    );
  }

  // Get all unique rounds from the bracket
  const allRounds: CupRound[] = ['round_of_32', 'round_of_16', 'round_of_8', 'semifinals', 'final'];
  const bracketRounds = allRounds.filter(round => {
    return bracket.some(m => m.round === round);
  });

  return (
    <div className="w-full overflow-x-auto pb-8">
      <div className="flex gap-8 min-w-max px-4">
        {bracketRounds.map((round, roundIndex) => (
          <BracketRound
            key={round}
            round={round}
            matches={getMatchesByRound(bracket, round)}
            roundIndex={roundIndex}
            totalRounds={bracketRounds.length}
            onMatchClick={onMatchClick}
            highlightedMatchId={highlightedMatchId}
          />
        ))}
      </div>
    </div>
  );
}

interface BracketRoundProps {
  round: CupRound;
  matches: BracketMatch[];
  roundIndex: number;
  totalRounds: number;
  onMatchClick?: (match: BracketMatch) => void;
  highlightedMatchId?: string;
}

function BracketRound({ round, matches, roundIndex, totalRounds, onMatchClick, highlightedMatchId }: BracketRoundProps) {
  // Calculate spacing based on round
  const spacingMultiplier = Math.pow(2, roundIndex);
  const matchSpacing = 80 * spacingMultiplier;

  return (
    <div className="flex flex-col items-center">
      <div className="mb-6 text-center">
        <h3 className="text-lg font-bold">{getRoundName(round)}</h3>
        <Badge variant="outline" className="mt-1">{matches.length} {matches.length === 1 ? 'partido' : 'partidos'}</Badge>
      </div>
      <div className="flex flex-col gap-4" style={{ gap: `${matchSpacing}px` }}>
        {matches.map((match) => (
          <BracketMatchCard
            key={match.id}
            match={match}
            onClick={onMatchClick}
            isHighlighted={highlightedMatchId === match.id}
            isFinal={round === 'final'}
          />
        ))}
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

  return (
    <Card
      className={cn(
        'w-64 transition-all cursor-pointer hover:shadow-md',
        isHighlighted && 'ring-2 ring-primary',
        isFinal && 'border-primary border-2',
        isCompleted && 'bg-muted/30'
      )}
      onClick={() => onClick?.(match)}
    >
      <div className="p-3 space-y-2">
        {/* Match header */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Partido {match.matchNumber}</span>
          {!hasTeams && <Clock className="h-3 w-3" />}
          {isFinal && <Trophy className="h-4 w-4 text-primary" />}
        </div>

        {/* Team 1 */}
        <div
          className={cn(
            'flex items-center gap-3 p-2.5 rounded transition-colors',
            team1IsWinner && 'bg-primary/10 border border-primary/20',
            !team1IsWinner && isCompleted && 'opacity-50'
          )}
        >
          {match.team1Jersey ? (
            <div className="w-10 h-10 flex-shrink-0">
              <JerseyPreview jersey={match.team1Jersey} size="sm" />
            </div>
          ) : (
            <div className="w-10 h-10 flex-shrink-0 rounded bg-muted/50 flex items-center justify-center">
              <span className="text-xs text-muted-foreground">?</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className={cn('text-sm font-medium truncate', !match.team1Name && 'text-muted-foreground italic')}>
              {match.team1Name || 'Por definir'}
            </p>
          </div>
          {team1IsWinner && <Trophy className="h-4 w-4 text-primary flex-shrink-0" />}
        </div>

        {/* VS Divider */}
        <div className="flex items-center justify-center">
          <div className="h-px bg-border flex-1" />
          <span className="px-2 text-xs text-muted-foreground font-semibold">VS</span>
          <div className="h-px bg-border flex-1" />
        </div>

        {/* Team 2 */}
        <div
          className={cn(
            'flex items-center gap-3 p-2.5 rounded transition-colors',
            team2IsWinner && 'bg-primary/10 border border-primary/20',
            !team2IsWinner && isCompleted && 'opacity-50'
          )}
        >
          {match.team2Jersey ? (
            <div className="w-10 h-10 flex-shrink-0">
              <JerseyPreview jersey={match.team2Jersey} size="sm" />
            </div>
          ) : (
            <div className="w-10 h-10 flex-shrink-0 rounded bg-muted/50 flex items-center justify-center">
              <span className="text-xs text-muted-foreground">?</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className={cn('text-sm font-medium truncate', !match.team2Name && 'text-muted-foreground italic')}>
              {match.team2Name || 'Por definir'}
            </p>
          </div>
          {team2IsWinner && <Trophy className="h-4 w-4 text-primary flex-shrink-0" />}
        </div>

        {/* Match status */}
        {!hasTeams && (
          <div className="text-center pt-1">
            <Badge variant="secondary" className="text-xs">Pendiente</Badge>
          </div>
        )}
        {hasTeams && !isCompleted && (
          <div className="text-center pt-1">
            <Badge variant="default" className="text-xs">Listo para jugar</Badge>
          </div>
        )}
        {isCompleted && (
          <div className="text-center pt-1">
            <Badge variant="outline" className="text-xs border-primary text-primary">Completado</Badge>
          </div>
        )}
      </div>
    </Card>
  );
}
