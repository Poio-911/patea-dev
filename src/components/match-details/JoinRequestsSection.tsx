'use client';

import { useState, useMemo } from 'react';
import { collection } from 'firebase/firestore';
import { useFirestore, useCollection } from '@/firebase';
import { respondJoinRequestAction } from '@/lib/actions/match-actions';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Check, X, Loader2, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getOvrColorClass } from '@/lib/player-utils';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface JoinRequest {
  uid: string;
  displayName: string;
  photoURL: string;
  ovr: number;
  position: string;
  requestedAt: string;
}

interface JoinRequestsSectionProps {
  matchId: string;
}

export function JoinRequestsSection({ matchId }: JoinRequestsSectionProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [respondingTo, setRespondingTo] = useState<string | null>(null);

  const requestsRef = useMemo(
    () => (firestore ? collection(firestore, `matches/${matchId}/joinRequests`) : null),
    [firestore, matchId]
  );
  const { data: requests, loading } = useCollection<JoinRequest>(requestsRef as any);

  if (loading || !requests || requests.length === 0) return null;

  const handleRespond = async (req: JoinRequest, accepted: boolean) => {
    setRespondingTo(req.uid);
    try {
      const result = await respondJoinRequestAction(matchId, req.uid, accepted);
      if ('success' in result && result.success) {
        toast({
          title: accepted ? `✅ ${req.displayName} aceptado` : `❌ ${req.displayName} rechazado`,
          description: accepted
            ? 'El jugador ya aparece en la lista del partido.'
            : 'Se notificó al jugador.',
        });
      } else {
        toast({ variant: 'destructive', title: 'Error', description: (result as any).error });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo procesar la solicitud.' });
    } finally {
      setRespondingTo(null);
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <UserPlus className="h-4 w-4 text-primary" />
        <h3 className="font-bold text-sm text-foreground">
          Solicitudes de unión
          <span className="ml-2 rounded-full bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5">
            {requests.length}
          </span>
        </h3>
      </div>

      {requests.map((req) => {
        const isProcessing = respondingTo === req.uid;
        const ovrColor = getOvrColorClass(req.ovr);

        return (
          <div
            key={req.uid}
            className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/5 px-3 py-2.5"
          >
            {/* Avatar → link al perfil */}
            <Link href={`/players/${req.uid}`} className="shrink-0">
              <Avatar className="h-10 w-10">
                <AvatarImage src={req.photoURL} alt={req.displayName} />
                <AvatarFallback className="text-xs font-bold">
                  {req.displayName?.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </Link>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <Link href={`/players/${req.uid}`} className="hover:underline">
                <p className="font-semibold text-sm text-foreground truncate">{req.displayName}</p>
              </Link>
              <p className="text-xs text-muted-foreground">
                {req.position}
                <span className={cn('ml-2 font-bold', ovrColor)}>OVR {req.ovr}</span>
              </p>
            </div>

            {/* Accept / Reject */}
            <div className="flex gap-1.5 shrink-0">
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 rounded-lg bg-green-500/15 hover:bg-green-500/30 text-green-400"
                disabled={isProcessing}
                onClick={() => handleRespond(req, true)}
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 rounded-lg bg-red-500/15 hover:bg-red-500/30 text-red-400"
                disabled={isProcessing}
                onClick={() => handleRespond(req, false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
