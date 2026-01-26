'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, Clock, MapPin, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { LiveStatusBadge } from './live-status-badge';
import { JerseyPreview } from '@/components/team-builder/jersey-preview';
import type { Match, Player } from '@/lib/types';

interface HeroMatchCardProps {
  match: Match;
  allPlayers: Player[];
  className?: string;
}

interface CountdownValues {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function parseMatchDateTime(date: string, time: string): Date {
  // Clean the time string
  const cleanTime = time.replace(' hs', '').replace('hs', '').trim();

  // Try to parse as ISO string first
  let targetDate = new Date(`${date}T${cleanTime}`);

  // If invalid, try adding seconds
  if (isNaN(targetDate.getTime())) {
    targetDate = new Date(`${date}T${cleanTime}:00`);
  }

  // If still invalid, try parsing date and time separately
  if (isNaN(targetDate.getTime())) {
    const dateParts = date.split('-');
    const timeParts = cleanTime.split(':');

    if (dateParts.length >= 3 && timeParts.length >= 2) {
      targetDate = new Date(
        parseInt(dateParts[0]),
        parseInt(dateParts[1]) - 1,
        parseInt(dateParts[2]),
        parseInt(timeParts[0]),
        parseInt(timeParts[1]),
        timeParts[2] ? parseInt(timeParts[2]) : 0
      );
    }
  }

  return targetDate;
}

function calculateCountdown(matchDate: string, matchTime: string): CountdownValues | null {
  const now = new Date().getTime();
  const target = parseMatchDateTime(matchDate, matchTime).getTime();

  if (isNaN(target)) {
    return null;
  }

  const diff = target - now;

  if (diff <= 0) {
    return null;
  }

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((diff % (1000 * 60)) / 1000),
  };
}

function HeroCountdown({ matchDate, matchTime }: { matchDate: string; matchTime: string }) {
  const [countdown, setCountdown] = useState<CountdownValues | null>(() =>
    calculateCountdown(matchDate, matchTime)
  );

  useEffect(() => {
    const updateCountdown = () => {
      setCountdown(calculateCountdown(matchDate, matchTime));
    };

    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [matchDate, matchTime]);

  if (!countdown) {
    return (
      <div className="text-center text-muted-foreground text-sm">
        El partido ya comenzó o la fecha no es válida
      </div>
    );
  }

  const TimeUnit = ({ value, label }: { value: number; label: string }) => (
    <div className="flex flex-col items-center">
      <span className="text-3xl sm:text-4xl md:text-5xl font-black tabular-nums">
        {String(value).padStart(2, '0')}
      </span>
      <span className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </span>
    </div>
  );

  const Separator = () => (
    <span className="text-2xl sm:text-3xl md:text-4xl font-bold text-muted-foreground/50 self-start mt-1">
      :
    </span>
  );

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3 md:gap-4">
      {countdown.days > 0 && (
        <>
          <TimeUnit value={countdown.days} label="días" />
          <Separator />
        </>
      )}
      <TimeUnit value={countdown.hours} label="horas" />
      <Separator />
      <TimeUnit value={countdown.minutes} label="min" />
      <Separator />
      <TimeUnit value={countdown.seconds} label="seg" />
    </div>
  );
}

function getMatchStatus(match: Match): 'live' | 'today' | 'upcoming' {
  const now = new Date();
  const matchDate = new Date(match.date);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const matchDay = new Date(matchDate.getFullYear(), matchDate.getMonth(), matchDate.getDate());

  if (match.status === 'active') return 'live';
  if (matchDay.getTime() === today.getTime()) return 'today';
  return 'upcoming';
}

export function HeroMatchCard({ match, allPlayers, className }: HeroMatchCardProps) {
  const matchStatus = getMatchStatus(match);
  const hasTeams = match.teams && match.teams.length === 2;

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl',
        'bg-card border border-border',
        'p-6 md:p-8',
        'sports-card-hover',
        className
      )}
    >
      <div className="space-y-6">
        {/* Header with badge */}
        <div className="flex items-center justify-between">
          <LiveStatusBadge status={matchStatus} size="md" className="badge-glow" />
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
            Próximo partido
          </span>
        </div>

        {/* Teams vs Teams or Title */}
        {hasTeams ? (
          <div className="flex items-center justify-center gap-4 sm:gap-8">
            {/* Team 1 */}
            <div className="flex flex-col items-center gap-2 text-center">
              <JerseyPreview jersey={match.teams[0].jersey} size="lg" />
              <span className="text-sm sm:text-base font-bold truncate max-w-[100px] sm:max-w-[140px]">
                {match.teams[0].name}
              </span>
            </div>

            {/* VS */}
            <div className="flex flex-col items-center">
              <span className="text-2xl sm:text-3xl font-bold text-muted-foreground">VS</span>
            </div>

            {/* Team 2 */}
            <div className="flex flex-col items-center gap-2 text-center">
              <JerseyPreview jersey={match.teams[1].jersey} size="lg" />
              <span className="text-sm sm:text-base font-bold truncate max-w-[100px] sm:max-w-[140px]">
                {match.teams[1].name}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">
              {match.title}
            </h2>
          </div>
        )}

        {/* Countdown */}
        <div className="py-4">
          <HeroCountdown matchDate={match.date} matchTime={match.time} />
        </div>

        {/* Match info */}
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4" />
            <span className="truncate max-w-[150px]">{match.location.name || match.location.address}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            <span className="capitalize">
              {format(new Date(match.date), "d 'de' MMMM", { locale: es })}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            <span>{match.time}</span>
          </div>
        </div>

        {/* Action button */}
        <div className="flex justify-center">
          <Button asChild size="lg" className="font-bold">
            <Link href={`/matches/${match.id}`}>
              <Eye className="mr-2 h-5 w-5" />
              Ver Detalles
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
