'use client';

import { cn } from '@/lib/utils';

interface FormStreakProps {
    results: ('W' | 'L' | 'D')[];
    className?: string;
}

export function FormStreak({ results, className }: FormStreakProps) {
    return (
        <div className={cn('flex items-center gap-0.5', className)}>
            {results.map((result, index) => {
                const indicatorClass = {
                    W: 'form-indicator-w',
                    L: 'form-indicator-l',
                    D: 'form-indicator-d',
                }[result];

                return (
                    <div key={index} className={indicatorClass}>
                        {result}
                    </div>
                );
            })}
        </div>
    );
}
