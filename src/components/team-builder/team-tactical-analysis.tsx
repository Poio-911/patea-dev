import { Player } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Shield, Target, Anchor, Footprints, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface TeamTacticalAnalysisProps {
    selectedPlayers: Player[];
}

export function TeamTacticalAnalysis({ selectedPlayers }: TeamTacticalAnalysisProps) {
    const countGK = selectedPlayers.filter(p => p.position === 'POR').length;
    const countDEF = selectedPlayers.filter(p => p.position === 'DEF').length;
    const countMED = selectedPlayers.filter(p => p.position === 'MED').length;
    const countFWD = selectedPlayers.filter(p => p.position === 'DEL').length;

    const positions = [
        { id: 'POR', label: 'Portería', icon: Shield, covered: countGK > 0, count: countGK, color: 'text-yellow-400', bg: 'bg-yellow-400/20', border: 'border-yellow-400/50' },
        { id: 'DEF', label: 'Defensa', icon: Anchor, covered: countDEF > 0, count: countDEF, color: 'text-blue-400', bg: 'bg-blue-400/20', border: 'border-blue-400/50' },
        { id: 'MED', label: 'Medio', icon: Target, covered: countMED > 0, count: countMED, color: 'text-green-400', bg: 'bg-green-400/20', border: 'border-green-400/50' },
        { id: 'DEL', label: 'Ataque', icon: Footprints, covered: countFWD > 0, count: countFWD, color: 'text-red-400', bg: 'bg-red-400/20', border: 'border-red-400/50' },
    ];

    const allCovered = positions.every(p => p.covered);

    return (
        <div className="rounded-xl border border-border/50 dark:border-white/10 bg-background/50 dark:bg-black/40 backdrop-blur-md p-4">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    Análisis Táctico
                </h3>
                {allCovered ? (
                    <span className="flex items-center gap-1.5 text-xs font-bold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-400/10 px-2 py-0.5 rounded-full border border-green-200 dark:border-green-400/20">
                        <CheckCircle2 className="w-3 h-3" /> BALANCEADO
                    </span>
                ) : (
                    <span className="flex items-center gap-1.5 text-xs font-bold text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-400/10 px-2 py-0.5 rounded-full border border-orange-200 dark:border-orange-400/20 animate-pulse">
                        <AlertTriangle className="w-3 h-3" /> DESBALANCEADO
                    </span>
                )}
            </div>

            <div className="grid grid-cols-4 gap-2">
                {positions.map((pos) => (
                    <div
                        key={pos.id}
                        className={cn(
                            "flex flex-col items-center justify-center p-2 rounded-lg border transition-all duration-300",
                            pos.covered
                                ? cn(
                                    // Light Mode
                                    "bg-background shadow-sm",
                                    // Dark Mode
                                    pos.bg,
                                    pos.border,
                                    "opacity-100 dark:shadow-[0_0_10px_-3px_rgba(255,255,255,0.1)]"
                                )
                                : "bg-muted/20 border-border/10 dark:border-white/5 opacity-50 grayscale"
                        )}
                    >
                        <pos.icon className={cn("w-5 h-5 mb-1 transition-colors", pos.covered ? pos.color : "text-muted-foreground")} />
                        <span className={cn("text-[10px] font-bold uppercase tracking-tight", pos.covered ? "text-foreground" : "text-muted-foreground")}>
                            {pos.label}
                        </span>
                        <span className={cn("text-[11px] font-black mt-0.5", pos.covered ? pos.color : "text-muted-foreground/40")}>
                            {pos.count > 0 ? pos.count : '—'}
                        </span>
                    </div>
                ))}
            </div>

            {!allCovered && (
                <p className="text-[10px] text-muted-foreground mt-3 text-center">
                    Te recomendamos cubrir todas las líneas para tener un equipo competitivo.
                </p>
            )}
        </div>
    );
}
