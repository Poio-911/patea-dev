'use client';

import { type LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type CompetitionType = 'friendly' | 'league' | 'cup';

interface CompetitionCardProps {
    type: CompetitionType;
    title: string;
    icon: LucideIcon;
    stats?: { label: string; value: string | number }[];
    notificationCount?: number;
    onClick?: () => void;
    className?: string;
}

export function CompetitionCard({
    type,
    title,
    icon: Icon,
    stats = [],
    notificationCount,
    onClick,
    className,
}: CompetitionCardProps) {
    const config = {
        friendly: {
            gradient: 'linear-gradient(135deg, hsl(168, 76%, 50%), hsl(158, 64%, 58%))',
            shadow: '0 8px 32px rgba(16, 185, 129, 0.3)',
            hoverShadow: '0 12px 48px rgba(16, 185, 129, 0.4)',
        },
        league: {
            gradient: 'linear-gradient(135deg, hsl(142, 76%, 45%), hsl(199, 89%, 55%))',
            shadow: '0 8px 32px rgba(34, 197, 94, 0.3)',
            hoverShadow: '0 12px 48px rgba(34, 197, 94, 0.4)',
        },
        cup: {
            gradient: 'linear-gradient(135deg, hsl(38, 92%, 60%), hsl(25, 95%, 63%))',
            shadow: '0 8px 32px rgba(251, 146, 60, 0.3)',
            hoverShadow: '0 12px 48px rgba(251, 146, 60, 0.4)',
        },
    };

    const { gradient, shadow, hoverShadow } = config[type];

    return (
        <Card
            className={cn(
                'relative overflow-hidden cursor-pointer',
                'border-0 rounded-2xl',
                'p-8 flex flex-col gap-5 min-h-[320px]',
                'transition-all duration-300 ease-out',
                'hover:scale-[1.02] hover:-translate-y-1',
                className
            )}
            style={{
                background: gradient,
                boxShadow: shadow,
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = hoverShadow;
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = shadow;
            }}
            onClick={onClick}
        >
            {/* Decorative overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />

            {/* Notification Badge */}
            {(notificationCount ?? 0) > 0 && (
                <Badge
                    className="absolute top-4 right-4 bg-white text-gray-900 font-bold px-3 py-1 shadow-lg z-10"
                    variant="default"
                >
                    {notificationCount}
                </Badge>
            )}

            {/* Icon */}
            <div className="flex items-center justify-center relative z-10">
                <div className="relative">
                    <Icon className="w-20 h-20 text-white drop-shadow-2xl" strokeWidth={2.5} />
                    <div className="absolute inset-0 blur-xl opacity-50 bg-white/30" />
                </div>
            </div>

            {/* Title */}
            <h3 className="text-3xl font-black text-white text-center drop-shadow-lg tracking-tight relative z-10">
                {title}
            </h3>

            {/* Quick Stats */}
            {stats.length > 0 && (
                <div className="flex flex-col gap-2.5 mt-auto relative z-10">
                    {stats.map((stat, index) => (
                        <div
                            key={index}
                            className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 shadow-lg"
                        >
                            <span className="text-sm font-medium text-white/90">{stat.label}</span>
                            <span className="text-lg font-bold text-white">{stat.value}</span>
                        </div>
                    ))}
                </div>
            )}
        </Card>
    );
}
