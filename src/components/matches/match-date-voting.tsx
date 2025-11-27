'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Calendar, ThumbsUp, Plus, Loader2, Trophy } from 'lucide-react';
import {
  proposeMatchDateAction,
  voteMatchDateProposalAction,
  getMatchDateProposalsAction,
} from '@/lib/actions/match-invitation-actions';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import type { MatchDateProposal } from '@/lib/types';
import { cn } from '@/lib/utils';

type MatchDateVotingProps = {
  matchId: string;
  totalPlayers: number;
  showTitle?: boolean;
};

export function MatchDateVoting({
  matchId,
  totalPlayers,
  showTitle = true,
}: MatchDateVotingProps) {
  const { user } = useUser();
  const { toast } = useToast();

  const [proposals, setProposals] = useState<MatchDateProposal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProposing, setIsProposing] = useState(false);
  const [showDialog, setShowDialog] = useState(false);

  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const loadProposals = async () => {
      try {
        const result = await getMatchDateProposalsAction(matchId);

        if (result.success && result.proposals) {
          setProposals(result.proposals);
        }

        // Suscribirse a cambios en tiempo real
        unsubscribe = onSnapshot(
          collection(db, 'matches', matchId, 'dateProposals'),
          (snapshot) => {
            const updatedProposals: MatchDateProposal[] = snapshot.docs
              .map(doc => ({
                ...doc.data(),
                id: doc.id,
              }))
              .sort((a: any, b: any) => (b.votesCount || 0) - (a.votesCount || 0)) as MatchDateProposal[];

            setProposals(updatedProposals);
          }
        );

        setIsLoading(false);
      } catch (error) {
        console.error('Error loading date proposals:', error);
        setIsLoading(false);
      }
    };

    loadProposals();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [matchId]);

  const handleProposeDate = async () => {
    if (!newDate || !newTime || !user?.uid) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Debes completar fecha y hora',
      });
      return;
    }

    setIsProposing(true);
    try {
      const result = await proposeMatchDateAction(matchId, newDate, newTime);

      if (result.success) {
        toast({
          title: 'Propuesta creada',
          description: 'Tu propuesta de fecha fue agregada',
        });
        setShowDialog(false);
        setNewDate('');
        setNewTime('');
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.error || 'No se pudo crear la propuesta',
        });
      }
    } catch (error) {
      console.error('Error proposing date:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Ocurrió un error al crear la propuesta',
      });
    } finally {
      setIsProposing(false);
    }
  };

  const handleVote = async (proposalId: string) => {
    if (!user?.uid) return;

    try {
      const result = await voteMatchDateProposalAction(matchId, proposalId);

      if (result.success) {
        toast({
          title: result.voted ? 'Voto registrado' : 'Voto removido',
          description: result.voted
            ? 'Tu voto fue agregado a esta propuesta'
            : 'Tu voto fue removido de esta propuesta',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.error || 'No se pudo registrar el voto',
        });
      }
    } catch (error) {
      console.error('Error voting:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Ocurrió un error al votar',
      });
    }
  };

  const majority = Math.ceil(totalPlayers / 2);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      {showTitle && (
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Propuestas de Fecha
            </CardTitle>
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-1" />
                  Proponer Fecha
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Proponer Nueva Fecha</DialogTitle>
                  <DialogDescription>
                    Sugiere una fecha alternativa. Los demás jugadores podrán votar.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="date">Fecha</Label>
                    <Input
                      id="date"
                      type="date"
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      disabled={isProposing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="time">Hora</Label>
                    <Input
                      id="time"
                      type="time"
                      value={newTime}
                      onChange={(e) => setNewTime(e.target.value)}
                      disabled={isProposing}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setShowDialog(false)}
                    disabled={isProposing}
                  >
                    Cancelar
                  </Button>
                  <Button onClick={handleProposeDate} disabled={isProposing}>
                    {isProposing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Proponer
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
      )}

      <CardContent className="space-y-3">
        {proposals.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No hay propuestas de fecha aún</p>
            <p className="text-xs mt-1">Sé el primero en proponer una alternativa</p>
          </div>
        ) : (
          proposals.map((proposal) => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              currentUserId={user?.uid}
              totalPlayers={totalPlayers}
              majority={majority}
              onVote={() => handleVote(proposal.id)}
            />
          ))
        )}

        {proposals.length > 0 && (
          <p className="text-xs text-center text-muted-foreground mt-4">
            Se requieren {majority} votos para confirmar automáticamente
          </p>
        )}
      </CardContent>
    </Card>
  );
}

type ProposalCardProps = {
  proposal: MatchDateProposal;
  currentUserId?: string;
  totalPlayers: number;
  majority: number;
  onVote: () => void;
};

function ProposalCard({
  proposal,
  currentUserId,
  totalPlayers,
  majority,
  onVote,
}: ProposalCardProps) {
  const hasVoted = currentUserId ? proposal.votes.includes(currentUserId) : false;
  const hasReachedMajority = proposal.votesCount >= majority;

  const formattedDate = new Date(proposal.proposedDate).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div
      className={cn(
        'relative p-4 rounded-lg border transition-all',
        hasReachedMajority
          ? 'bg-green-50 dark:bg-green-900/20 border-green-500'
          : 'bg-card hover:bg-muted/50'
      )}
    >
      {hasReachedMajority && (
        <div className="absolute top-2 right-2">
          <Badge className="bg-green-500 flex items-center gap-1">
            <Trophy className="w-3 h-3" />
            Mayoría
          </Badge>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-start justify-between pr-20">
          <div>
            <p className="font-semibold capitalize">{formattedDate}</p>
            <p className="text-sm text-muted-foreground">Hora: {proposal.proposedTime}</p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <ThumbsUp className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              {proposal.votesCount} / {totalPlayers} votos
            </span>
          </div>

          <Button
            variant={hasVoted ? 'default' : 'outline'}
            size="sm"
            onClick={onVote}
            className={cn(hasVoted && 'bg-primary')}
          >
            <ThumbsUp className="w-4 h-4 mr-1" />
            {hasVoted ? 'Votaste' : 'Votar'}
          </Button>
        </div>

        {/* Barra de progreso */}
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className={cn(
              'h-2 rounded-full transition-all',
              hasReachedMajority ? 'bg-green-500' : 'bg-primary'
            )}
            style={{ width: `${(proposal.votesCount / totalPlayers) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
