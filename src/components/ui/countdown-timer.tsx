'use client';

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CountdownTimerProps {
    targetDate: Date | string;
    className?: string;
    showIcon?: boolean;
}

export function CountdownTimer({ targetDate, className, showIcon = true }: CountdownTimerProps) {
    const [timeLeft, setTimeLeft] = useState('');
    const [isUrgent, setIsUrgent] = useState(false);

    useEffect(() => {
        const updateTimer = () => {
            const now = new Date().getTime();

            let targetTime: number;
            if (typeof targetDate === 'string') {
                targetTime = new Date(targetDate).getTime();
            } else {
                targetTime = targetDate.getTime();
            }

            const difference = targetTime - now;

            if (difference <= 0) {
                setTimeLeft('');
                return;
            }

            const days = Math.floor(difference / (1000 * 60 * 60 * 24));
            const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));

            // Urgente si falta menos de 24 horas
            setIsUrgent(difference < 24 * 60 * 60 * 1000);

            if (days > 0) {
                setTimeLeft(`En ${days}d ${hours}h`);
            } else if (hours > 0) {
                setTimeLeft(`En ${hours}h ${minutes}m`);
            } else {
                setTimeLeft(`En ${minutes}m`);
            }
        };

        updateTimer();
        const interval = setInterval(updateTimer, 60000);

        return () => clearInterval(interval);
    }, [targetDate]);

    if (!timeLeft) return null;

    return (
        <div
            className={cn(
                'flex items-center gap-1.5 text-xs font-semibold',
                isUrgent ? 'text-orange-600 dark:text-orange-400' : 'text-muted-foreground',
                className
            )}
        >
            {showIcon && (
                <Clock className={cn('h-3.5 w-3.5', isUrgent && 'animate-pulse')} />
            )}
            <span>{timeLeft}</span>
        </div>
    );
}
