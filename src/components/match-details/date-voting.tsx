'use client';

import { useState } from 'react';
import { Match, MatchDateProposal } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar as CalendarIcon, MapPin, Plus, ThumbsUp, Check, Loader2, CalendarDays } from 'lucide-react';
import {
    ResponsiveDialog as Dialog,
    ResponsiveDialogContent as DialogContent,
    ResponsiveDialogHeader as DialogHeader,
    ResponsiveDialogTitle as DialogTitle,
    ResponsiveDialogTrigger as DialogTrigger,
} from '@/components/ui/responsive-dialog';
import { addMatchDateProposalAction, voteMatchDateAction, confirmMatchDateAction } from '@/lib/actions/match-planning-actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ResponsivePopover as Popover, ResponsivePopoverContent as PopoverContent, ResponsivePopoverTrigger as PopoverTrigger } from '@/components/ui/responsive-popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface DateVotingProps {
    match: Match;
    userId: string;
}

export function DateVoting({ match, userId }: DateVotingProps) {
    const [isProposing, setIsProposing] = useState(false);
    const [isVoting, setIsVoting] = useState<string | null>(null);
    const [isFinalizing, setIsFinalizing] = useState<string | null>(null);

    // Proposal state
    const [proposalDate, setProposalDate] = useState<Date | undefined>(undefined);
    const [proposalTime, setProposalTime] = useState('21:00');
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const { toast } = useToast();

    const isCaptain = match.captains?.includes(userId) || match.ownerUid === userId;
    const proposals = match.dateProposals || [];

    // Sort proposals by votes desc
    const sortedProposals = [...proposals].sort((a, b) => b.votes.length - a.votes.length);

    const handlePropose = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!proposalDate || !proposalTime) {
            toast({ variant: 'destructive', title: 'Error', description: 'Selecciona fecha y hora' });
            return;
        }

        if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(proposalTime)) {
            toast({ variant: 'destructive', title: 'Error', description: 'Formato de hora inválido (HH:MM)' });
            return;
        }

        setIsProposing(true);
        try {
            const dateStr = proposalDate.toISOString();
            const res = await addMatchDateProposalAction(match.id, userId, dateStr, proposalTime);

            if (res.success) {
                toast({ title: 'Fecha propuesta', description: `Se propuso el ${format(proposalDate, 'PPP', { locale: es })} a las ${proposalTime}hs` });
                setIsDialogOpen(false);
                setProposalDate(undefined);
            } else {
                toast({ variant: 'destructive', title: 'Error', description: res.error || 'Error al proponer' });
            }
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Error de conexión' });
        } finally {
            setIsProposing(false);
        }
    };

    const handleVote = async (proposalId: string, hasVoted: boolean) => {
        if (!match.isVotingOpen) return;
        setIsVoting(proposalId);
        try {
            const action = hasVoted ? 'remove' : 'add';
            const res = await voteMatchDateAction(match.id, proposalId, userId, action);
            if (!res.success) {
                toast({ variant: 'destructive', title: 'Error', description: res.error || 'Error al votar' });
            }
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error', description: 'Error al votar' });
        } finally {
            setIsVoting(null);
        }
    };

    const handleFinalize = async (proposalId: string) => {
        setIsFinalizing(proposalId);
        try {
            const res = await confirmMatchDateAction(match.id, proposalId);
            if (res.success) {
                toast({ title: 'Fecha confirmada', description: 'El partido ya tiene fecha y hora confirmadas.' });
            } else {
                toast({ variant: 'destructive', title: 'Error', description: res.error || 'Error al confirmar' });
            }
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error', description: 'Error al confirmar' });
        } finally {
            setIsFinalizing(null);
        }
    };

    if (!match.isVotingOpen && match.status !== 'planning') {
        return null;
    }

    return (
        <Card className="border-2 border-primary/20 bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-3 border-b">
                <div className="flex justify-between items-center">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <div className="p-2 bg-primary/10 rounded-full">
                            <CalendarDays className="h-5 w-5 text-primary" />
                        </div>
                        Votación de Fecha
                    </CardTitle>
                    {isCaptain && (
                        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                            <DialogTrigger asChild>
                                <Button size="sm" disabled={isProposing} variant="outline" className="border-primary/50 hover:bg-primary/10">
                                    <Plus className="h-4 w-4 mr-1" />
                                    Proponer Fecha
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Proponer Fecha</DialogTitle>
                                </DialogHeader>
                                <form onSubmit={handlePropose} className="space-y-4 py-4">
                                    <div className="space-y-2 flex flex-col">
                                        <Label>Día del Partido</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant={"outline"}
                                                    className={cn(
                                                        "w-full justify-start text-left font-normal",
                                                        !proposalDate && "text-muted-foreground"
                                                    )}
                                                >
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {proposalDate ? format(proposalDate, "PPP", { locale: es }) : <span>Elegí una fecha</span>}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0 z-[9999]" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={proposalDate}
                                                    onSelect={setProposalDate}
                                                    initialFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="time">Hora</Label>
                                        <Input
                                            id="time"
                                            placeholder="Ej: 21:00"
                                            value={proposalTime}
                                            onChange={(e) => setProposalTime(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="flex justify-end pt-2">
                                        <Button type="submit" disabled={isProposing || !proposalDate}>
                                            {isProposing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            Proponer
                                        </Button>
                                    </div>
                                </form>
                            </DialogContent>
                        </Dialog>
                    )}
                </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
                {proposals.length === 0 ? (
                    <div className="text-center py-8 px-4 bg-muted/20 rounded-lg border border-dashed">
                        <CalendarDays className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                        <p className="text-muted-foreground font-medium">
                            {isCaptain ? 'Agregá opciones de fechas para que el grupo vote.' : 'Los organizadores están definiendo las opciones...'}
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-3">
                        {sortedProposals.map((proposal) => {
                            const hasVoted = proposal.votes.includes(userId);
                            const isWinning = sortedProposals[0].id === proposal.id && proposal.votes.length > 0;
                            const d = new Date(proposal.date);

                            return (
                                <div key={proposal.id} className={cn(
                                    "group relative rounded-lg border p-4 flex flex-col sm:flex-row gap-4 transition-all items-center",
                                    hasVoted ? "bg-primary/5 border-primary/30 shadow-sm" : "bg-card hover:bg-accent/50",
                                    isWinning && "border-yellow-500/50 shadow-[0_0_15px_-3px_rgba(234,179,8,0.2)] bg-yellow-500/5"
                                )}>

                                    <div className="flex-1 min-w-0 flex flex-col justify-center text-center sm:text-left w-full space-y-1">
                                        <h4 className="font-bold truncate text-lg capitalize">{format(d, 'EEEE d', { locale: es })} de {format(d, 'MMMM', { locale: es })}</h4>
                                        <p className="text-muted-foreground font-medium flex justify-center sm:justify-start items-center gap-1">
                                            A las {proposal.time} hs
                                        </p>

                                        <div className="flex items-center justify-center sm:justify-start gap-4 pt-1">
                                            <div className={cn(
                                                "flex items-center text-sm font-bold px-2 py-1 rounded-md transition-colors duration-300",
                                                proposal.votes.length > 0 ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground"
                                            )}>
                                                <ThumbsUp className="h-3 w-3 mr-1.5" />
                                                {proposal.votes.length} voto{proposal.votes.length !== 1 && 's'}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-row sm:flex-col justify-center gap-2 mt-2 sm:mt-0 w-full sm:w-auto shrink-0">
                                        <Button
                                            variant={hasVoted ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => handleVote(proposal.id, hasVoted)}
                                            disabled={!!isVoting || !match.isVotingOpen}
                                            className={cn("flex-1 sm:w-[130px] font-semibold transition-all duration-200 active:scale-95", hasVoted && "bg-primary text-primary-foreground shadow-md hover:bg-primary/90")}
                                        >
                                            {isVoting === proposal.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsUp className="h-4 w-4 mr-2" />}
                                            {hasVoted ? 'Ya votaste' : 'Votar esta'}
                                        </Button>

                                        {isCaptain && (
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => handleFinalize(proposal.id)}
                                                disabled={!!isFinalizing}
                                                className="flex-1 sm:w-[130px] font-bold text-green-700 hover:text-green-800 bg-green-100 hover:bg-green-200 border border-green-200"
                                            >
                                                {isFinalizing === proposal.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                                                Elegir esta
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
