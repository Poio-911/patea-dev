'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, Navigation, ArrowRight, UserRound, ChevronLeft, ChevronRight, User } from 'lucide-react';
import { useFirestore, useUser } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { Match, Player, UserProfile } from '@/lib/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { JerseyPreview } from './team-builder/jersey-preview';
import { cn, formatVenueName } from '@/lib/utils';
import { getMatchTheme } from '@/lib/match-theme';
import { motion, AnimatePresence } from 'framer-motion';

const typeLabels: Record<string, string> = {
    manual: 'Amistoso',
    collaborative: 'Colaborativo',
    by_teams: 'Por Equipos',
    intergroup_friendly: 'Intergrupos',
    league: 'Liga',
    cup: 'Copa',
    league_final: 'Final',
};

interface NextMatchCardProps {
    matches: Match[] | Match | null;
    allPlayers?: Player[];
}

const InfoRow = ({ icon: Icon, text, children, size = 'sm' }: { icon: React.ElementType, text?: string, children?: React.ReactNode, size?: 'xs' | 'sm' }) => {
    return (
        <div className={`flex items-center gap-2.5 ${size === 'xs' ? 'text-[10px] md:text-sm' : 'text-sm'} min-w-0 font-medium`}>
            <Icon className="h-3.5 w-3.5 shrink-0 text-white/70" />
            {text && <span className="truncate">{text}</span>}
            {children}
        </div>
    );
};

export function NextMatchCard({ matches, allPlayers = [] }: NextMatchCardProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const { user } = useUser();
    const firestore = useFirestore();
    const [ownerName, setOwnerName] = useState<string | null>(null);
    const [ownerPhoto, setOwnerPhoto] = useState<string | null>(null);

    // Normalize matches to an array
    const matchList = useMemo(() => {
        if (!matches) return [];
        const arr = Array.isArray(matches) ? matches : [matches];

        // Filter out past matches
        return arr.filter(m => {
            const dateObj = new Date(m.date);
            const [hh, mm] = (m.time || '00:00').split(':').map(Number);
            dateObj.setHours(hh || 0, mm || 0, 0, 0);
            return dateObj.getTime() >= new Date().getTime();
        });
    }, [matches]);

    const currentMatch = matchList[currentIndex];

    // Fetch owner details (same logic as MatchCard)
    useEffect(() => {
        if (!currentMatch) return;

        const fetchOwner = async () => {
            if (!firestore) return;

            // 1. Try in allPlayers
            const ownerInGroup = allPlayers.find(p => p.id === currentMatch.ownerUid || p.uid === currentMatch.ownerUid);
            if (ownerInGroup) {
                setOwnerName(ownerInGroup.name);
                setOwnerPhoto((ownerInGroup as any).photoUrl || (ownerInGroup as any).photoURL || null);
                return;
            }

            // 2. Try current user
            if (user?.uid === currentMatch.ownerUid) {
                setOwnerName(user.displayName);
                setOwnerPhoto(user.photoURL);
                return;
            }

            // 3. Fetch from Firestore
            try {
                const userDocRef = doc(firestore, 'users', currentMatch.ownerUid);
                const userDoc = await getDoc(userDocRef);
                if (userDoc.exists()) {
                    const userData = userDoc.data() as UserProfile;
                    setOwnerName(userData.displayName || 'Organizador');
                    setOwnerPhoto(userData.photoURL || null);
                } else {
                    setOwnerName('Club Local');
                    setOwnerPhoto(null);
                }
            } catch {
                setOwnerName('Club Local');
                setOwnerPhoto(null);
            }
        };

        fetchOwner();
    }, [firestore, currentMatch, allPlayers, user]);

    const nextSlide = useCallback(() => {
        setCurrentIndex((prev) => (prev + 1) % matchList.length);
    }, [matchList.length]);

    const prevSlide = useCallback(() => {
        setCurrentIndex((prev) => (prev - 1 + matchList.length) % matchList.length);
    }, [matchList.length]);

    // Auto-advance carousel
    useEffect(() => {
        if (matchList.length <= 1) return;
        const timer = setInterval(nextSlide, 8000);
        return () => clearInterval(timer);
    }, [matchList.length, nextSlide]);

    if (matchList.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center text-center border-2 border-dashed border-muted-foreground/30 rounded-xl p-12 h-full bg-card/20 backdrop-blur-sm">
                <Calendar className="h-12 w-12 text-muted-foreground/50" />
                <h2 className="mt-4 text-xl font-semibold">No hay fútbol a la vista</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                    Armá un nuevo partido para que empiece a rodar la pelota.
                </p>
                <Button asChild variant="default" className="mt-4">
                    <Link href="/matches">
                        <Calendar className="mr-2 h-4 w-4" />
                        Ir a Partidos
                    </Link>
                </Button>
            </div>
        );
    }

    const matchTheme = getMatchTheme(currentMatch.type);
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(currentMatch.location.address)}&query_place_id=${currentMatch.location.placeId}`;
    const isTeamMatch = currentMatch.type === 'by_teams' && currentMatch.teams && currentMatch.teams.length === 2;

    // Dynamic photo from /images/backgrounds/ (same as match cards) but AT FULL COLOR
    const matchPhoto = `/images/backgrounds/fondo_${(Math.abs(currentMatch.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % 12) + 1}.jpg`;

    return (
        <div className={cn(
            "relative overflow-hidden rounded-xl border-2 shadow-2xl isolate next-match-banner bg-card border-white/10 group h-[380px] md:h-[480px]",
            matchTheme.border
        )}>
            {/* Background Container (Animated) */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentMatch.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1 }}
                    className="absolute inset-0 z-0 h-full w-full"
                >
                    <img
                        src={matchPhoto}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/50 z-[1]" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent z-[2]" />
                    <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-transparent to-transparent z-[2]" />
                    <div className={cn(
                        "absolute inset-0 z-[1] opacity-35 mix-blend-overlay",
                        matchTheme.bannerOverlay
                    )} />
                </motion.div>
            </AnimatePresence>

            {/* Content Container */}
            <div className="relative z-10 p-5 md:p-10 text-white h-full flex flex-col">

                {/* 1. Header Row (Static position, dynamic content) */}
                <div className="flex items-center justify-between gap-4 mb-4 md:mb-8 h-10 shrink-0">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentMatch.id + '_type'}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className={cn(
                                "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border border-white/30 bg-black/60 backdrop-blur-2xl shadow-2xl"
                            )}
                        >
                            <div className={cn("w-2 h-2 rounded-full shrink-0 shadow-[0_0_8px_currentColor]", matchTheme.badgeColor.replace('bg-', 'text-'))} />
                            <span>{typeLabels[currentMatch.type] || currentMatch.type}</span>
                        </motion.div>
                    </AnimatePresence>

                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentMatch.id + '_owner'}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            className="flex items-center gap-2 px-3 py-1 rounded-full bg-black/60 backdrop-blur-2xl border border-white/10 shadow-2xl"
                        >
                            <div className="h-6 w-6 rounded-full overflow-hidden border border-white/30 bg-white/10 flex items-center justify-center text-[10px] font-bold shrink-0">
                                {ownerPhoto ? (
                                    <img src={ownerPhoto} alt={ownerName || ''} className="h-full w-full object-cover" />
                                ) : (
                                    <div className="bg-muted w-full h-full flex items-center justify-center">
                                        <User className="h-3.5 w-3.5 text-white/80" />
                                    </div>
                                )}
                            </div>
                            <span className="text-[10px] md:text-sm font-black text-white leading-none">
                                Organiza: <span className="text-primary brightness-150 uppercase tracking-tighter">{ownerName || 'Club'}</span>
                            </span>
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* 2. Middle Content (Animated Area) */}
                <div className="flex-1 min-h-0 flex items-center justify-center relative">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentMatch.id + '_center'}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.05 }}
                            transition={{ duration: 0.5 }}
                            className="w-full h-full flex items-center justify-center"
                        >
                            {isTeamMatch ? (
                                <div className="flex items-center justify-between gap-2 md:gap-12 w-full max-w-4xl px-2">
                                    <div className="flex flex-col items-center gap-2 md:gap-4 w-[45%]">
                                        <div className="scale-[0.55] xs:scale-[0.8] sm:scale-100 md:scale-110 transition-transform origin-center">
                                            <JerseyPreview jersey={currentMatch.teams![0].jersey} size="lg" className="drop-shadow-[0_15px_30px_rgba(0,0,0,0.8)]" />
                                        </div>
                                        <h3 className="text-[10px] md:text-xl font-black text-center uppercase tracking-tighter drop-shadow-2xl line-clamp-1">{currentMatch.teams![0].name}</h3>
                                    </div>
                                    <div className="flex flex-col items-center justify-center px-1">
                                        <span className="text-2xl md:text-7xl font-black text-white/10 italic tracking-tighter select-none drop-shadow-sm">VS</span>
                                    </div>
                                    <div className="flex flex-col items-center gap-2 md:gap-4 w-[45%]">
                                        <div className="scale-[0.55] xs:scale-[0.8] sm:scale-100 md:scale-110 transition-transform origin-center">
                                            <JerseyPreview jersey={currentMatch.teams![1].jersey} size="lg" className="drop-shadow-[0_15px_30px_rgba(0,0,0,0.8)]" />
                                        </div>
                                        <h3 className="text-[10px] md:text-xl font-black text-center uppercase tracking-tighter drop-shadow-2xl line-clamp-1">{currentMatch.teams![1].name}</h3>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center w-full px-4">
                                    <h3 className="text-3xl md:text-6xl font-black tracking-tighter uppercase italic leading-[0.85] drop-shadow-[0_10px_20px_rgba(0,0,0,0.6)]">
                                        {currentMatch.title}
                                    </h3>
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* 3. Metadata (Animated Area) */}
                <div className="h-16 md:h-20 shrink-0 mt-4 overflow-hidden border-t border-white/10 pt-4 flex flex-col justify-center">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentMatch.id + '_meta'}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="flex flex-wrap justify-center md:justify-start gap-x-6 md:gap-x-10 gap-y-2"
                        >
                            <InfoRow icon={Calendar} text={format(new Date(currentMatch.date), "EEEE, d 'de' MMMM", { locale: es })} size="xs" />
                            <div className="h-4 w-px bg-white/10 hidden sm:block" />
                            <InfoRow icon={Clock} text={`${currentMatch.time} hs`} size="xs" />
                            <div className="h-4 w-px bg-white/10 hidden lg:block" />
                            <InfoRow icon={Navigation} size="xs">
                                <Link
                                    href={googleMapsUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:text-primary transition-colors flex items-center gap-1.5 font-black group/link"
                                >
                                    <span className="truncate max-w-[140px] md:max-w-none">{formatVenueName(currentMatch.location.name, currentMatch.location.address)}</span>
                                    <ArrowRight className="h-3 w-3 shrink-0 group-hover/link:translate-x-1 transition-transform" />
                                </Link>
                            </InfoRow>
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* 4. Action Row (STATIC POSITION) */}
                <div className="flex flex-col items-center mt-6 shrink-0 relative">
                    {/* Fixed action button */}
                    <Button
                        asChild
                        size="lg"
                        className={cn(
                            "group/btn relative overflow-hidden font-black uppercase tracking-[0.25em] px-12 md:px-24 h-11 md:h-14 text-xs md:text-base transition-all hover:scale-105 active:scale-95 z-20",
                            "bg-primary shadow-[0_20px_40px_rgba(0,0,0,0.5)] hover:bg-primary/95",
                            "text-black game-theme-button"
                        )}
                    >
                        <Link href={`/matches/${currentMatch.id}`}>
                            Ver Detalles
                            <ArrowRight className="ml-3 h-4 w-4 md:h-5 md:w-5 group-hover/btn:translate-x-3 transition-transform" />
                        </Link>
                    </Button>

                    {/* Dots Pagination (Moved below button in mobile if needed, or keeping absolute) */}
                    {matchList.length > 1 && (
                        <div className="flex gap-2 mt-4 z-20">
                            {matchList.map((_, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setCurrentIndex(idx)}
                                    className={cn(
                                        "h-1 rounded-full transition-all duration-300",
                                        idx === currentIndex ? "w-6 bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)]" : "w-1.5 bg-white/40 hover:bg-white/60"
                                    )}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Navigation Controls (Desktop Hover Only) */}
            {matchList.length > 1 && (
                <>
                    <button
                        onClick={prevSlide}
                        className="absolute left-4 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full bg-black/40 hover:bg-black/80 text-white/70 hover:text-white transition-all opacity-0 group-hover:opacity-100 backdrop-blur-xl border border-white/20 hidden md:flex"
                    >
                        <ChevronLeft className="h-6 w-6" />
                    </button>
                    <button
                        onClick={nextSlide}
                        className="absolute right-4 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full bg-black/40 hover:bg-black/80 text-white/70 hover:text-white transition-all opacity-0 group-hover:opacity-100 backdrop-blur-xl border border-white/20 hidden md:flex"
                    >
                        <ChevronRight className="h-6 w-6" />
                    </button>
                </>
            )}
        </div>
    );
}
