'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { Calendar, Search, Trophy, UserSearch } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { mainNavItems, matchesNavItems, extraNavItems } from './nav-config';
import { useHaptics } from '@/hooks/use-haptics';

export function MobileNav() {
    // Detectar modo standalone (PWA instalado)
    useEffect(() => {
        if (typeof window !== 'undefined') {
            // navigator.standalone is iOS Safari specific (non-standard)
            const nav = window.navigator as Navigator & { standalone?: boolean };
            const isStandalone = window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
            if (isStandalone) {
                document.body.classList.add('standalone');
            } else {
                document.body.classList.remove('standalone');
            }
        }
    }, []);
    const pathname = usePathname() ?? '';
    const [matchesMenuOpen, setMatchesMenuOpen] = React.useState(false);
    const matchesMenuRef = React.useRef<HTMLDivElement | null>(null);
    const { tap } = useHaptics();

    // Close menu on route change
    React.useEffect(() => {
        setMatchesMenuOpen(false);
    }, [pathname]);

    // Click outside to close
    React.useEffect(() => {
        function handleClick(e: PointerEvent) {
            if (matchesMenuOpen && matchesMenuRef.current && !matchesMenuRef.current.contains(e.target as Node)) {
                setMatchesMenuOpen(false);
            }
        }
        document.addEventListener('pointerdown', handleClick);
        return () => document.removeEventListener('pointerdown', handleClick);
    }, [matchesMenuOpen]);

    const isMatchesActive = pathname.startsWith('/matches') || pathname.startsWith('/competitions');

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-card/90 backdrop-blur-lg shadow-lg md:hidden pb-[var(--safe-area-bottom,env(safe-area-inset-bottom))]">
            <div className="relative w-full px-2">
                <div className="flex h-14 w-full items-center justify-around font-medium">
                    {/* Left: Panel & Jugadores */}
                    <MobileNavItem key={mainNavItems[0].href} item={mainNavItems[0]} pathname={pathname} />
                    <MobileNavItem key={mainNavItems[1].href} item={mainNavItems[1]} pathname={pathname} />

                    {/* Middle Button: Matches (Submenu Trigger) */}
                    <div className="relative flex items-center justify-center">
                        <button
                            type="button"
                            onClick={() => { tap(); setMatchesMenuOpen(o => !o); }}
                            className={cn(
                                'group relative inline-flex flex-col items-center justify-center gap-1 px-1 transition-all duration-200',
                                isMatchesActive ? 'text-primary scale-110' : 'text-muted-foreground hover:text-foreground'
                            )}
                            aria-haspopup="true"
                            aria-expanded={matchesMenuOpen}
                        >
                            <Calendar className={cn('h-6 w-6 transition-all duration-200', isMatchesActive && 'stroke-[2.5px]')} />
                            <span className="text-[10px] leading-none">Partidos</span>
                        </button>

                        <AnimatePresence>
                            {matchesMenuOpen && (
                                <>
                                    {createPortal(
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md"
                                            onClick={() => setMatchesMenuOpen(false)}
                                        />,
                                        document.body
                                    )}

                                    {createPortal(
                                        <BottomSheetMenu ref={matchesMenuRef} pathname={pathname} onClose={() => setMatchesMenuOpen(false)} />,
                                        document.body
                                    )}
                                </>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Right: Comunidad & Evaluaciones */}
                    <MobileNavItem key={mainNavItems[3].href} item={mainNavItems[3]} pathname={pathname} />
                    <MobileNavItem key={extraNavItems[0].href} item={extraNavItems[0]} pathname={pathname} />
                </div>
            </div>
        </nav>
    );
}

function MobileNavItem({ item, pathname }: { item: any, pathname: string }) {
    const isActive = pathname.startsWith(item.href);
    const Icon = item.icon;
    const { tap } = useHaptics();
    return (
        <Link
            href={item.href}
            onClick={tap}
            className={cn(
                'group relative inline-flex flex-col items-center justify-center gap-1 px-1 text-muted-foreground transition-all duration-200 hover:text-foreground',
                isActive && 'text-primary font-bold'
            )}
        >
            <Icon className={cn('h-5 w-5 transition-all duration-200', isActive && 'scale-110 stroke-[2.5px]')} />
            <span className="text-[10px] leading-none">{item.label}</span>
        </Link>
    );
}

// Subcomponents for Menus
const BottomSheetMenu = React.forwardRef<HTMLDivElement, { pathname: string, onClose: () => void }>(({ pathname, onClose }, ref) => (
    <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed inset-x-0 bottom-0 z-[60]"
    >
        <div
            ref={ref}
            className="rounded-t-[2.5rem] bg-card/95 backdrop-blur-2xl border-t border-border shadow-[0_-8px_32px_rgba(0,0,0,0.4)] pt-3 pb-[calc(env(safe-area-inset-bottom)+20px)] sm:px-4"
        >
            <div className="mx-auto h-1.5 w-12 rounded-full bg-muted-foreground/20 mb-6" />
            <div className="px-6 space-y-2">
                <MenuLink href="/matches" icon={Calendar} label="Mis Partidos" pathname={pathname} onClose={onClose} matchExact={false} />
                <MenuLink href="/competitions" icon={Trophy} label="Competiciones" pathname={pathname} onClose={onClose} />
            </div>
        </div>
    </motion.div>
));
BottomSheetMenu.displayName = "BottomSheetMenu";

function MenuLink({ href, icon: Icon, label, pathname, onClose, matchExact = false, exclude }: any) {
    const isActive = matchExact ? pathname === href : pathname.startsWith(href) && (!exclude || !pathname.startsWith(exclude));
    return (
        <Link
            href={href}
            onClick={onClose}
            className={cn(
                'flex items-center gap-4 p-4 rounded-2xl transition-all duration-200',
                isActive ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted/50 active:scale-95'
            )}
        >
            <div className={cn(
                "w-10 h-10 grid place-items-center rounded-xl transition-colors",
                isActive ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-muted/50 text-muted-foreground"
            )}>
                <Icon className={cn("h-5 w-5", isActive && "stroke-[2.5px]")} />
            </div>
            <span className={cn(
                "text-base font-semibold tracking-tight",
                isActive ? "text-primary" : "text-foreground"
            )}>
                {label}
            </span>
        </Link>
    );
}
