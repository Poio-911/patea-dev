'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Goal, Zap, Award, FileText, ChevronLeft, ChevronRight, Loader2, RefreshCcw, Quote } from 'lucide-react';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Match, GenerateMatchChronicleOutput } from '@/lib/types';
import { getMatchResultStatsAction, type MatchResultStats } from '@/lib/actions/match-result-actions';
import { generateMatchChronicleAction } from '@/lib/actions/server-actions';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { PlayerOvr, PlayerPhoto, PlayerPositionBadge } from '@/components/player-styles';
import { getOvrLevel } from '@/lib/player-utils';
import type { PlayerPosition } from '@/lib/types';

interface IntegratedMatchStoryProps {
    match: Match;
}

export function IntegratedMatchStory({ match }: IntegratedMatchStoryProps) {
    const [stats, setStats] = useState<MatchResultStats | null>(null);
    const [chronicle, setChronicle] = useState<GenerateMatchChronicleOutput | null>(null);
    const [isLoadingStats, setIsLoadingStats] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [currentSlide, setCurrentSlide] = useState(0);

    const { toast } = useToast();
    const { user } = useUser();
    const isOrganizer = user?.uid === match.ownerUid;

    // Cargar estadísticas reportadas
    useEffect(() => {
        let mounted = true;
        const loadStats = async () => {
            setIsLoadingStats(true);
            const res = await getMatchResultStatsAction(match.id);
            if (mounted && res.success && res.stats) {
                setStats(res.stats);
            }
            if (mounted) setIsLoadingStats(false);
        };
        loadStats();
        return () => { mounted = false; };
    }, [match.id]);

    // Cargar crónica existente del partido
    useEffect(() => {
        if (match.chronicle) {
            setChronicle(match.chronicle);
        }
    }, [match.chronicle]);

    const handleGenerateChronicle = async (isRegenerating = false) => {
        if (!isRegenerating && match.chronicle) {
            toast({ title: 'Crónica ya generada', description: 'Este partido ya tiene una crónica.' });
            return;
        }
        setIsGenerating(true);
        try {
            const result = await generateMatchChronicleAction(match.id);
            if ('error' in result) throw new Error(String(result.error));
            if ('data' in result && result.data) {
                setChronicle(result.data);
                toast({ title: 'Relato creado', description: 'La revista del partido está lista.' });
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message || 'No se pudo generar.' });
        } finally {
            setIsGenerating(false);
        }
    };

    const [selectedPlayerUid, setSelectedPlayerUid] = useState<string | null>(null);

    const togglePlayerQuote = (uid: string) => {
        if (selectedPlayerUid === uid) {
            setSelectedPlayerUid(null);
        } else {
            setSelectedPlayerUid(uid);
        }
    };

    if (isLoadingStats) {
        return (
            <div className="flex items-center justify-center py-10 rounded-2xl border bg-card/50 shadow-sm min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
            </div>
        );
    }

    // 3. LA REVISTA (Loaded State variables)
    const hasScore = stats && (stats.hasFinalScore || stats.totalTeam1Goals > 0 || stats.totalTeam2Goals > 0);
    const team1Score = stats?.finalScore?.team1 ?? stats?.totalTeam1Goals ?? 0;
    const team2Score = stats?.finalScore?.team2 ?? stats?.totalTeam2Goals ?? 0;
    const matchMVP = stats?.mvpPlayer;

    return (
        <div className="space-y-6">

            {/* --- SECCION CONDICIONAL: RELATO DE LA IA --- */}
            {(!chronicle && !isGenerating) ? (
                <div className="p-8 text-center rounded-3xl border bg-card shadow-sm space-y-4">
                    <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <FileText className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-xl font-bold font-serif">La Historia del Partido</h3>
                    <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-6">
                        Creá la revista oficial de este partido: resultado, crónica detallada y habilitá los testimonios interactivos del vestuario.
                    </p>
                    <Button onClick={() => handleGenerateChronicle(false)} className="px-8 font-serif italic text-lg shadow-md hover:scale-105 transition-transform">
                        Publicar Revista
                    </Button>
                </div>
            ) : isGenerating ? (
                <div className="p-12 text-center rounded-3xl border bg-card shadow-sm space-y-6 overflow-hidden relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent animate-shimmer" />
                    <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4 opacity-70" />
                    <h3 className="text-2xl font-serif italic text-foreground tracking-wide">Escribiendo la historia...</h3>
                    <p className="text-muted-foreground animate-pulse">Entrevistando jugadores y cerrando la edición.</p>
                </div>
            ) : chronicle ? (
                <div className="bg-card border shadow-sm rounded-3xl overflow-hidden flex flex-col">

                    {/* SECTION 1: CABECERA Y RESULTADO */}
                    <div className="relative bg-background border-b">
                        {/* Fondo sutil tipo papel prensa */}
                        <div className="absolute inset-0 opacity-[0.03] dark:opacity-5 pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\\"20\\" height=\\"20\\" viewBox=\\"0 0 20 20\\" xmlns=\\"http://www.w3.org/2000/svg\\"%3E%3Cg fill=\\"%23000000\\" fill-opacity=\\"1\\" fill-rule=\\"evenodd\\"%3E%3Ccircle cx=\\"3\\" cy=\\"3\\" r=\\"1\\"%3E%3C/circle%3E%3C/g%3E%3C/svg%3E")' }} />

                        <div className="relative pt-12 pb-10 px-6 sm:px-10 text-center space-y-8">
                            {/* Título */}
                            <h2 className="text-4xl sm:text-5xl font-black text-foreground leading-tight font-serif tracking-tight max-w-3xl mx-auto" style={{ fontFamily: "Georgia, serif" }}>
                                "{chronicle?.headline}"
                            </h2>

                            {/* Separador elegante */}
                            <div className="flex items-center justify-center gap-4 opacity-40">
                                <div className="h-[1px] w-16 bg-foreground" />
                                <div className="w-2 h-2 rotate-45 bg-foreground" />
                                <div className="h-[1px] w-16 bg-foreground" />
                            </div>

                            {/* Marcador Integrado (Forzado en Fila para Móvil) */}
                            {hasScore && match.teams && match.teams.length >= 2 && (
                                <div className="flex flex-row items-center justify-center gap-4 sm:gap-12 pt-4 relative w-full px-2">

                                    {/* Equipo 1 */}
                                    <div className="flex-1 flex flex-col items-end text-right">
                                        <p className="text-sm sm:text-xl font-bold font-serif text-foreground/80 uppercase tracking-widest line-clamp-2">
                                            {match.teams[0]?.name || 'Equipo 1'}
                                        </p>
                                    </div>

                                    {/* Score */}
                                    <div className="flex items-center px-4 sm:px-6 py-2 bg-foreground text-background rounded-2xl shadow-xl shrink-0">
                                        <span className="text-3xl sm:text-5xl font-black font-serif">{team1Score}</span>
                                        <span className="text-lg sm:text-2xl font-light mx-2 sm:mx-4 opacity-50">-</span>
                                        <span className="text-3xl sm:text-5xl font-black font-serif">{team2Score}</span>
                                    </div>

                                    {/* Equipo 2 */}
                                    <div className="flex-1 flex flex-col items-start text-left">
                                        <p className="text-sm sm:text-xl font-bold font-serif text-foreground/80 uppercase tracking-widest line-clamp-2">
                                            {match.teams[1]?.name || 'Equipo 2'}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Badges de Destaque (MVP) - Suspendidos debajo del resultado */}
                            {matchMVP && (
                                <div className="flex justify-center -mb-16 relative z-10 pt-4">
                                    <div className="flex items-center gap-3 bg-card border shadow-lg rounded-full pr-6 pl-2 py-2">
                                        <Avatar className="h-10 w-10 border-2 border-yellow-400">
                                            <AvatarImage src={matchMVP.photoURL} />
                                            <AvatarFallback className="bg-yellow-100 text-yellow-700 font-bold">{matchMVP.displayName[0]}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col text-left">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-yellow-600 dark:text-yellow-500 flex items-center gap-1">
                                                <Award className="w-3 h-3" /> MVP del Partido
                                            </span>
                                            <span className="text-sm font-bold font-serif leading-none mt-0.5">{matchMVP.displayName}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* SECTION 2: CUERPO NARRATIVO */}
                    <div className={cn("px-6 sm:px-12 py-12 bg-card relative", matchMVP ? "pt-20" : "")}>
                        <div className="max-w-3xl mx-auto prose prose-lg dark:prose-invert">
                            <p className="text-foreground/80 leading-relaxed font-serif whitespace-pre-line text-lg
                          first-letter:float-left first-letter:text-7xl first-letter:font-black first-letter:text-foreground
                          first-letter:mr-4 first-letter:mt-[-0.2em]">
                                {chronicle?.story}
                            </p>
                        </div>

                        {/* --- VOCES DEL VESTUARIO (CARRUSEL) --- */}
                        {chronicle?.playerVoices && chronicle.playerVoices.length > 0 && (
                            <div className="mt-20 pt-12 border-t border-border">
                                <h3 className="text-center font-bold font-serif text-slate-400 uppercase tracking-widest text-sm mb-12 flex items-center justify-center gap-3">
                                    <Quote className="w-4 h-4" /> Voces del Vestuario <Quote className="w-4 h-4 rotate-180" />
                                </h3>

                                <div className="max-w-4xl mx-auto px-12">
                                    <Carousel
                                        opts={{
                                            align: "start",
                                            loop: true,
                                        }}
                                        className="w-full"
                                    >
                                        <CarouselContent className="-ml-4">
                                            {chronicle.playerVoices.map((voice, idx) => {
                                                const player = match.players?.find(p =>
                                                    p.displayName.toLowerCase() === voice.playerName.toLowerCase() ||
                                                    p.displayName.toLowerCase().includes(voice.playerName.toLowerCase()) ||
                                                    voice.playerName.toLowerCase().includes(p.displayName.toLowerCase())
                                                );

                                                return (
                                                    <CarouselItem key={idx} className="pl-4 md:basis-1/2 lg:basis-1/2">
                                                        <div className="p-1 h-full">
                                                            <div className="bg-card border border-border rounded-3xl p-6 h-full flex flex-col gap-4 relative overflow-hidden group hover:shadow-lg transition-all duration-300">
                                                                <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
                                                                    <Quote className="w-20 h-20 rotate-180" />
                                                                </div>

                                                                <p className="text-base font-serif italic leading-relaxed text-foreground/80 relative z-10 flex-grow">
                                                                    "{voice.quote}"
                                                                </p>

                                                                <div className="flex items-center gap-3 mt-2 relative z-10">
                                                                    <Avatar className="h-10 w-10 border-2 border-border">
                                                                        <AvatarImage src={player?.photoURL} />
                                                                        <AvatarFallback className="text-xs font-bold">{voice.playerName[0]}</AvatarFallback>
                                                                    </Avatar>
                                                                    <div className="flex flex-col">
                                                                        <span className="text-sm font-bold font-serif">{voice.playerName}</span>
                                                                        {player && (
                                                                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
                                                                                {player.position}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </CarouselItem>
                                                );
                                            })}
                                        </CarouselContent>
                                        <div className="hidden sm:block">
                                            <CarouselPrevious className="-left-12" />
                                            <CarouselNext className="-right-12" />
                                        </div>
                                    </Carousel>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer / Regenerar */}
                    {isOrganizer && chronicle && !isGenerating && (
                        <div className="bg-muted/50 p-4 flex justify-end shrink-0 border-t rounded-b-3xl mt-[-1px]">
                            <Button variant="ghost" size="sm" onClick={() => handleGenerateChronicle(true)} disabled={isGenerating} className="text-xs text-muted-foreground hover:text-foreground">
                                <RefreshCcw className="mr-2 h-3 w-3" />
                                Regenerar Historia (Admin)
                            </Button>
                        </div>
                    )}
                </div>
            ) : null}
        </div>
    );
}
