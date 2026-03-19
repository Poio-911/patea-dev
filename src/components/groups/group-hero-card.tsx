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
            "relative w-full rounded-xl overflow-hidden shadow-2xl border-2 border-border/40 group isolate",
            compact ? "min-h-[200px] h-auto" : "h-[280px] md:h-[320px]"
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
                "relative z-10 flex flex-col justify-end h-full",
                compact ? "p-4 sm:p-5" : "absolute inset-0 p-6"
            )}>

                {/* Top Right: Group Switcher & Actions */}
                <div className="absolute top-4 right-4 flex items-center gap-2">
                    <div className="bg-card/40 backdrop-blur-xl rounded-lg p-1 border border-border/40 shadow-lg">
                        <GroupSwitcher />
                    </div>
                </div>

                {/* Main Hero Content */}
                <div className="space-y-3 sm:space-y-4 max-w-3xl mt-16 sm:mt-0">

                    {/* Badge & Title */}
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-white/80 text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-1 sm:mb-2">
                            <Users2 className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
                            <span>Grupo Activo</span>
                        </div>
                        <h1 className={cn(
                            "font-black text-white tracking-tight leading-tight font-headline drop-shadow-xl break-words line-clamp-2 sm:line-clamp-3",
                            compact ? "text-lg sm:text-3xl" : "text-4xl md:text-5xl"
                        )}
                            title={group.name} // Show full name on hover
                        >
                            {group.name}
                        </h1>
                    </div>

                    {/* Invitation Code Ticket */}
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                        <div className="flex items-center gap-0 bg-card/40 backdrop-blur-xl border border-border/40 rounded-md overflow-hidden group/code transition-all hover:bg-card/60">
                            <div className="px-2 sm:px-3 py-1.5 sm:py-2 border-r border-white/10">
                                <span className="text-[10px] sm:text-xs text-white/70 font-semibold uppercase tracking-wider">Código</span>
                            </div>
                            <button
                                onClick={handleCopyCode}
                                className={cn(
                                    "flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 font-mono font-bold text-white tracking-widest hover:text-primary transition-colors",
                                    compact ? "text-sm sm:text-base" : "text-xl"
                                )}
                            >
                                {group.inviteCode}
                                <Copy className="h-3 w-3 sm:h-4 sm:w-4 opacity-50 group-hover/code:opacity-100" />
                            </button>
                        </div>

                        {/* Actions */}
                        <Button asChild size={compact ? "sm" : "default"} className="bg-[#25D366] hover:bg-[#25D366]/90 text-white font-bold border-0 shadow-lg shadow-green-900/20">
                            <a href={`https://wa.me/?text=${whatsAppShareText}`} target="_blank" rel="noopener noreferrer">
                                <WhatsAppIcon className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                                {compact ? "Invitar" : "Invitar Amigos"}
                            </a>
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
