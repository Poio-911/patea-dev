'use client';

import * as React from 'react';
import { Clock } from 'lucide-react';

interface CountdownTimerProps {
  targetDate: string; // ISO or date string
  label?: string;
}

interface TimeLeft { days: number; hours: number; minutes: number; seconds: number; }

function calcTimeLeft(target: Date): TimeLeft | null {
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

function pad(n: number) { return String(n).padStart(2, '0'); }

export function CountdownTimer({ targetDate, label = 'Inicio del torneo' }: CountdownTimerProps) {
  const target = React.useMemo(() => {
    const d = new Date(targetDate);
    return isNaN(d.getTime()) ? null : d;
  }, [targetDate]);

  const [timeLeft, setTimeLeft] = React.useState<TimeLeft | null>(
    target ? calcTimeLeft(target) : null
  );

  React.useEffect(() => {
    if (!target) return;
    const id = setInterval(() => setTimeLeft(calcTimeLeft(target)), 1000);
    return () => clearInterval(id);
  }, [target]);

  if (!target || !timeLeft) return null;

  return (
    <div className="flex flex-col items-center gap-2 py-3 px-4 rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm">
      <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-widest">
        <Clock className="h-3.5 w-3.5 text-primary" />
        {label}
      </div>
      <div className="flex items-center gap-2">
        {[
          { v: timeLeft.days, label: 'días' },
          { v: timeLeft.hours, label: 'hs' },
          { v: timeLeft.minutes, label: 'min' },
          { v: timeLeft.seconds, label: 'seg' },
        ].map((item, i) => (
          <React.Fragment key={item.label}>
            {i > 0 && <span className="text-xl font-black text-muted-foreground/50 mb-3">:</span>}
            <div className="flex flex-col items-center">
              <span className="text-2xl font-black tabular-nums leading-none">{pad(item.v)}</span>
              <span className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">{item.label}</span>
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
