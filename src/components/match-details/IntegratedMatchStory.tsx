'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Goal, Zap, Award, FileText, ChevronLeft, ChevronRight, Loader2, RefreshCcw } from 'lucide-react';
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
            {/* --- SECCION SIEMPRE VISIBLE: ROSTER INTERACTIVO --- */}
            {match.teams && match.teams.length === 2 && match.players && (
                <div className="bg-card border shadow-sm rounded-3xl py-8 px-4 sm:px-8">
                    <h3 className="text-center font-bold font-serif text-slate-400 uppercase tracking-widest text-sm mb-8">
                        — Los Protagonistas —
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
                        {match.teams.map((team, index) => {
                            const teamPlayers = match.players?.filter(p => team.players?.some(tp => tp.uid === p.uid)) || [];

                            return (
                                <div key={team.id || team.name || `team-${index}`} className="flex flex-col rounded-2xl border bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
                                    <div className="bg-muted px-6 py-4 border-b flex items-center justify-center">
                                        <h4 className="font-bold font-serif text-lg">{team.name}</h4>
                                    </div>
                                    <div className="p-4 flex flex-wrap justify-center gap-3 sm:gap-4">
                                        {teamPlayers.map((player) => {
                                            const quoteObj = chronicle?.playerVoices?.find(v =>
                                                v.playerName.toLowerCase() === player.displayName.toLowerCase() ||
                                                player.displayName.toLowerCase().includes(v.playerName.toLowerCase())
                                            );
                                            const hasQuote = !!quoteObj;
                                            const isSelected = selectedPlayerUid === player.uid;
                                            const ovrLevel = getOvrLevel(player.ovr);

                                            return (
                                                <div key={player.uid} className="relative w-[130px] sm:w-[140px] flex-shrink-0">
                                                    <AnimatePresence>
                                                        {isSelected && hasQuote && (
                                                            // Wrapper to hold both the shifting bubble and the fixed arrow
                                                            <div className="absolute bottom-[110%] left-1/2 -translate-x-1/2 z-[100] pointer-events-none flex flex-col items-center">
                                                                <motion.div
                                                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                                                    className="w-[280px] sm:w-[320px] bg-slate-800 text-white p-4 rounded-3xl shadow-xl origin-bottom"
                                                                    style={{
                                                                        transform: "translateX(clamp(calc(-100% + 70px), 0%, calc(100% - 70px)))"
                                                                    }}
                                                                >
                                                                    <p className="text-sm font-serif italic text-center leading-relaxed">"{quoteObj.quote}"</p>
                                                                </motion.div>
                                                                <motion.div
                                                                    initial={{ opacity: 0, y: 10 }}
                                                                    animate={{ opacity: 1, y: 0 }}
                                                                    exit={{ opacity: 0, y: 10 }}
                                                                    className="w-0 h-0 border-l-[8px] border-l-transparent border-t-[10px] border-t-slate-800 border-r-[8px] border-r-transparent -mt-[1px]"
                                                                />
                                                            </div>
                                                        )}
                                                    </AnimatePresence>

                                                    <button
                                                        onClick={() => hasQuote && togglePlayerQuote(player.uid)}
                                                        className={cn(
                                                            "w-full flex flex-col items-center text-center p-3 gap-2 rounded-xl transition-all relative border bg-card",
                                                            // Holographic effect style logic (borrowed from TeamRosterPlayer)
                                                            "game:holo-effect hover:shadow-md",
                                                            ovrLevel === 'elite' && "game:hover:border-purple-500/50 game:hover:shadow-lg game:hover:shadow-purple-500/30",
                                                            ovrLevel === 'gold' && "game:hover:border-yellow-500/50 game:hover:shadow-lg game:hover:shadow-yellow-500/30",
                                                            ovrLevel === 'silver' && "game:hover:border-gray-400/50 game:hover:shadow-lg game:hover:shadow-gray-400/30",
                                                            ovrLevel === 'bronze' && "game:hover:border-amber-700/50 game:hover:shadow-lg game:hover:shadow-amber-700/30",
                                                            hasQuote ? "cursor-pointer" : "opacity-80 cursor-default",
                                                            isSelected ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-transparent"
                                                        )}
                                                    >
                                                        <div className="relative mt-2">
                                                            <PlayerPhoto player={player as any} size="compact" />
                                                            {hasQuote && (
                                                                <div className="absolute -top-3 -right-3 bg-yellow-400 p-1.5 rounded-full shadow-md animate-bounce z-10">
                                                                    <FileText className="w-4 h-4 text-yellow-900" />
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="flex flex-col items-center mt-2 w-full">
                                                            <div className="flex items-center gap-2">
                                                                <p className="font-bold truncate w-24 text-base">{player.displayName}</p>
                                                            </div>
                                                            <div className="flex items-center justify-center gap-2 mt-1">
                                                                <PlayerOvr value={player.ovr} size="compact" />
                                                                <PlayerPositionBadge position={player.position as PlayerPosition} size="sm" showIcon={false} textOnly={true} />
                                                            </div>
                                                        </div>
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

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
                    <div className="relative bg-[#faf9f6] dark:bg-card border-b">
                        {/* Fondo sutil tipo papel prensa */}
                        <div className="absolute inset-0 opacity-[0.03] dark:opacity-5 pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\\"20\\" height=\\"20\\" viewBox=\\"0 0 20 20\\" xmlns=\\"http://www.w3.org/2000/svg\\"%3E%3Cg fill=\\"%23000000\\" fill-opacity=\\"1\\" fill-rule=\\"evenodd\\"%3E%3Ccircle cx=\\"3\\" cy=\\"3\\" r=\\"1\\"%3E%3C/circle%3E%3C/g%3E%3C/svg%3E")' }} />

                        <div className="relative pt-12 pb-10 px-6 sm:px-10 text-center space-y-8">
                            {/* Título */}
                            <h2 className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-slate-100 leading-tight font-serif tracking-tight max-w-3xl mx-auto" style={{ fontFamily: "Georgia, serif" }}>
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
                                        <p className="text-sm sm:text-xl font-bold font-serif text-slate-700 dark:text-slate-300 uppercase tracking-widest line-clamp-2">
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
                                        <p className="text-sm sm:text-xl font-bold font-serif text-slate-700 dark:text-slate-300 uppercase tracking-widest line-clamp-2">
                                            {match.teams[1]?.name || 'Equipo 2'}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Badges de Destaque (MVP) - Suspendidos debajo del resultado */}
                            {matchMVP && (
                                <div className="flex justify-center -mb-16 relative z-10 pt-4">
                                    <div className="flex items-center gap-3 bg-white dark:bg-slate-900 border shadow-lg rounded-full pr-6 pl-2 py-2">
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
                    <div className={cn("px-6 sm:px-12 py-12 bg-white dark:bg-card relative", matchMVP ? "pt-20" : "")}>
                        <div className="max-w-3xl mx-auto prose prose-lg dark:prose-invert">
                            <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-serif whitespace-pre-line text-lg
                          first-letter:float-left first-letter:text-7xl first-letter:font-black first-letter:text-slate-900 
                          dark:first-letter:text-slate-100 first-letter:mr-4 first-letter:mt-[-0.2em]">
                                {chronicle?.story}
                            </p>
                        </div>
                    </div>

                    {/* Footer / Regenerar */}
                    {isOrganizer && chronicle && !isGenerating && (
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 flex justify-end shrink-0 border-t rounded-b-3xl mt-[-1px]">
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
