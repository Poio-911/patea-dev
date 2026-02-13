'use client';

import { useMemo } from 'react';
import { Group } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Users2, Copy, LogOut } from 'lucide-react';
import { WhatsAppIcon } from '@/components/icons/whatsapp-icon';
import { GroupSwitcher } from '@/components/group-switcher';
import { toast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

import { cn } from '@/lib/utils';

interface GroupHeroCardProps {
    group: Group;
    compact?: boolean;
}

export function GroupHeroCard({ group, compact }: GroupHeroCardProps) {

    const handleCopyCode = () => {
        navigator.clipboard.writeText(group.inviteCode);
        toast({ title: '¡Copiado!', description: 'Código de invitación copiado al portapapeles.' });
    };

    const whatsAppShareText = useMemo(() => {
        if (!group) return '';
        const message = `¡Sumate a nuestro grupo de fútbol "${group.name}" en Pateá! Usá este código para unirte: ${group.inviteCode}`;
        return encodeURIComponent(message);
    }, [group]);

    return (
        <div className={cn(
            "relative w-full rounded-xl overflow-hidden shadow-2xl border-2 border-border/50 group isolate",
            compact ? "h-[180px] sm:h-[240px]" : "h-[280px] md:h-[320px]"
        )}>
            {/* Video Background */}
            <div className="absolute inset-0 z-0">
                <video
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    aria-hidden="true"
                >
                    <source src="/videos/groups.mp4" type="video/mp4" />
                </video>
                {/* Cinematic Overlay - Darker at bottom for text readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/30" />
            </div>

            {/* Content Layer */}
            <div className={cn(
                "absolute inset-0 z-10 flex flex-col justify-end",
                compact ? "p-4 sm:p-5" : "p-6"
            )}>

                {/* Top Right: Group Switcher & Actions */}
                <div className="absolute top-4 right-4 flex items-center gap-2">
                    <div className="bg-black/40 backdrop-blur-md rounded-lg p-1 border border-white/10 shadow-lg">
                        <GroupSwitcher />
                    </div>
                </div>

                {/* Main Hero Content */}
                <div className="space-y-4 max-w-3xl">

                    {/* Badge & Title */}
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-white/80 text-xs font-bold uppercase tracking-widest mb-2">
                            <Users2 className="h-4 w-4 text-primary" />
                            <span>Grupo Activo</span>
                        </div>
                        <h1 className={cn(
                            "font-black text-white tracking-tight leading-tight font-headline drop-shadow-xl",
                            compact ? "text-2xl sm:text-3xl" : "text-4xl md:text-5xl"
                        )}>
                            {group.name}
                        </h1>
                    </div>

                    {/* Invitation Code Ticket */}
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-0 bg-white/10 backdrop-blur-md border border-white/20 rounded-md overflow-hidden group/code transition-all hover:bg-white/20">
                            <div className="px-3 py-2 border-r border-white/10">
                                <span className="text-xs text-white/70 font-semibold uppercase tracking-wider">Código</span>
                            </div>
                            <button
                                onClick={handleCopyCode}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-2 font-mono font-bold text-white tracking-widest hover:text-primary transition-colors",
                                    compact ? "text-base" : "text-xl"
                                )}
                            >
                                {group.inviteCode}
                                <Copy className="h-4 w-4 opacity-50 group-hover/code:opacity-100" />
                            </button>
                        </div>

                        {/* Actions */}
                        <Button asChild className="bg-[#25D366] hover:bg-[#25D366]/90 text-white font-bold border-0 shadow-lg shadow-green-900/20">
                            <a href={`https://wa.me/?text=${whatsAppShareText}`} target="_blank" rel="noopener noreferrer">
                                <WhatsAppIcon className="mr-2 h-5 w-5" />
                                Invitar Amigos
                            </a>
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
