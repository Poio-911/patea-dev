
'use client';

import { useState } from 'react';
import { Match, LocationProposal } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, Plus, ThumbsUp, Check, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { proposeLocationAction, voteLocationAction, finalizeLocationAction } from '@/lib/actions/match-voting-actions';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface LocationVotingProps {
    match: Match;
    userId: string;
}

export function LocationVoting({ match, userId }: LocationVotingProps) {
    const [isProposing, setIsProposing] = useState(false);
    const [isVoting, setIsVoting] = useState<string | null>(null);
    const [isFinalizing, setIsFinalizing] = useState<string | null>(null);

    // Proposal state
    const [proposalName, setProposalName] = useState('');
    const [proposalAddress, setProposalAddress] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const { toast } = useToast();

    const isCaptain = match.captains?.includes(userId) || match.ownerUid === userId;
    const proposals = match.locationProposals || [];

    // Sort proposals by votes desc
    const sortedProposals = [...proposals].sort((a, b) => b.votes.length - a.votes.length);

    const handlePropose = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!proposalName) return;

        const formattedLocation = {
            name: proposalName,
            address: proposalAddress || proposalName, // fallback
            lat: 0, // No geocoding for manual input yet
            lng: 0,
            placeId: `custom-${Date.now()}`
        };

        setIsProposing(true);
        try {
            const res = await proposeLocationAction(match.id, formattedLocation);
            if ((res as any).success) {
                toast({ title: 'Cancha propuesta', description: `Has propuesto ${proposalName}` });
                setIsDialogOpen(false);
                setProposalName('');
                setProposalAddress('');
            } else {
                toast({ variant: 'destructive', title: 'Error', description: (res as any).error || 'Error al proponer' });
            }
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Error de conexión' });
        } finally {
            setIsProposing(false);
        }
    };

    const handleVote = async (proposalId: string) => {
        if (!match.isVotingOpen) return;
        setIsVoting(proposalId);
        try {
            const res = await voteLocationAction(match.id, proposalId);
            if (!(res as any).success) {
                toast({ variant: 'destructive', title: 'Error', description: (res as any).error || 'Error al votar' });
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
            const res = await finalizeLocationAction(match.id, proposalId);
            if ((res as any).success) {
                toast({ title: 'Cancha confirmada', description: 'Se ha cerrado la votación.' });
            } else {
                toast({ variant: 'destructive', title: 'Error', description: (res as any).error || 'Error al confirmar' });
            }
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error', description: 'Error al confirmar' });
        } finally {
            setIsFinalizing(null);
        }
    };

    // If voting is closed and location is confirmed, only Captains see this (to reopen/change)
    // If regular user, they only see it if voting is open or location is pending
    if (!match.isVotingOpen && match.location.name !== 'A confirmar' && !isCaptain) {
        return null;
    }

    return (
        <Card className="border-2 border-primary/20 bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-3 border-b">
                <div className="flex justify-between items-center">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <div className="p-2 bg-primary/10 rounded-full">
                            <MapPin className="h-5 w-5 text-primary" />
                        </div>
                        Votación de Cancha
                    </CardTitle>
                    {isCaptain && (
                        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                            <DialogTrigger asChild>
                                <Button size="sm" disabled={isProposing} variant="outline" className="border-primary/50 hover:bg-primary/10">
                                    <Plus className="h-4 w-4 mr-1" />
                                    Proponer Cancha
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Proponer Cancha</DialogTitle>
                                </DialogHeader>
                                <form onSubmit={handlePropose} className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="name">Nombre del Lugar</Label>
                                        <Input
                                            id="name"
                                            placeholder="Ej: Canchas del Parque"
                                            value={proposalName}
                                            onChange={(e) => setProposalName(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="address">Dirección (Opcional)</Label>
                                        <Input
                                            id="address"
                                            placeholder="Ej: Av. Principal 123"
                                            value={proposalAddress}
                                            onChange={(e) => setProposalAddress(e.target.value)}
                                        />
                                    </div>
                                    <div className="flex justify-end pt-2">
                                        <Button type="submit" disabled={isProposing}>
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
                        <MapPin className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                        <p className="text-muted-foreground font-medium">
                            {match.locationProposals && match.locationProposals.length > 0 ? '' :
                                (isCaptain ? 'Agregá opciones para que el grupo vote.' : 'Los capitanes están definiendo las opciones...')}
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-3">
                        {sortedProposals.map((proposal) => {
                            const hasVoted = proposal.votes.includes(userId);
                            const isWinning = sortedProposals[0].id === proposal.id && proposal.votes.length > 0;

                            return (
                                <div key={proposal.id} className={cn(
                                    "group relative rounded-lg border p-4 flex flex-col sm:flex-row gap-4 transition-all items-center",
                                    hasVoted ? "bg-primary/5 border-primary/30 shadow-sm" : "bg-card hover:bg-accent/50",
                                    isWinning && "border-yellow-500/50 shadow-[0_0_15px_-3px_rgba(234,179,8,0.2)] bg-yellow-500/5"
                                )}>

                                    <div className="flex-1 min-w-0 flex flex-col justify-center text-center sm:text-left w-full">
                                        <h4 className="font-bold truncate text-base">{proposal.location.name}</h4>
                                        <p className="text-sm text-muted-foreground truncate">{proposal.location.address}</p>

                                        <div className="flex items-center justify-center sm:justify-start gap-4 mt-2">
                                            <div className={cn(
                                                "flex items-center text-sm font-bold px-2 py-1 rounded-md",
                                                proposal.votes.length > 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                                            )}>
                                                <ThumbsUp className="h-3 w-3 mr-1.5" />
                                                {proposal.votes.length} voto{proposal.votes.length !== 1 && 's'}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-row sm:flex-col justify-center gap-2 mt-2 sm:mt-0 w-full sm:w-auto">
                                        <Button
                                            variant={hasVoted ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => handleVote(proposal.id)}
                                            disabled={!!isVoting || !match.isVotingOpen}
                                            className={cn("flex-1 sm:w-[120px]", hasVoted && "bg-primary text-primary-foreground shadow-md")}
                                        >
                                            {isVoting === proposal.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsUp className="h-4 w-4 mr-2" />}
                                            {hasVoted ? 'Votado' : 'Votar'}
                                        </Button>

                                        {isCaptain && (
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => handleFinalize(proposal.id)}
                                                disabled={!!isFinalizing}
                                                className="flex-1 sm:w-[120px] text-green-700 hover:text-green-800 bg-green-100 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300 dark:hover:bg-green-900/60"
                                            >
                                                {isFinalizing === proposal.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                                                Confirmar
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
