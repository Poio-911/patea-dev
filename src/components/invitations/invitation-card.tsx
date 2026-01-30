'use client';

import { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { Invitation, Match } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar, MapPin, User, Check, X, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface InvitationCardProps {
  invitation: Invitation;
  onAccept: (invitation: Invitation) => Promise<void>;
  onReject: (invitation: Invitation) => Promise<void>;
  isProcessing: boolean;
}

export function InvitationCard({ invitation, onAccept, onReject, isProcessing }: InvitationCardProps) {
  const firestore = useFirestore();
  const [matchInfo, setMatchInfo] = useState<{
    title: string;
    date: string | null;
    location: string | null;
    inviterName: string | null;
    inviterPhoto: string | null;
  }>({
    title: '',
    date: null,
    location: null,
    inviterName: null,
    inviterPhoto: null,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMatchInfo = async () => {
      if (invitation.matchId && firestore) {
        setIsLoading(true);
        try {
          const matchRef = doc(firestore, 'matches', invitation.matchId);
          const matchSnap = await getDoc(matchRef);
          if (matchSnap.exists()) {
            const matchData = matchSnap.data() as Match;

            // Fetch inviter info
            let inviterName = null;
            let inviterPhoto = null;
            if (invitation.createdBy) {
              const userRef = doc(firestore, 'users', invitation.createdBy);
              const userSnap = await getDoc(userRef);
              if (userSnap.exists()) {
                const userData = userSnap.data();
                inviterName = userData.displayName || 'Organizador';
                inviterPhoto = userData.photoURL || null;
              }
            }

            setMatchInfo({
              title: matchData.title || 'Partido',
              date: matchData.date,
              location: matchData.location?.name || matchData.location?.address || null,
              inviterName,
              inviterPhoto,
            });
          } else {
            setMatchInfo(prev => ({ ...prev, title: 'Partido no encontrado' }));
          }
        } catch (error) {
          console.error('Error fetching match info:', error);
          setMatchInfo(prev => ({ ...prev, title: 'Error al cargar' }));
        } finally {
          setIsLoading(false);
        }
      }
    };

    fetchMatchInfo();
  }, [invitation.matchId, invitation.createdBy, firestore]);

  const formattedDate = matchInfo.date
    ? format(new Date(matchInfo.date), "EEEE d 'de' MMMM, HH:mm", { locale: es })
    : null;

  if (isLoading) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-l-4 border-l-primary">
      <CardContent className="p-4">
        {/* Match Title */}
        <div className="flex items-start gap-3 mb-3">
          <div className="flex-1">
            <h3 className="font-semibold text-base leading-tight">{matchInfo.title}</h3>
          </div>
        </div>

        {/* Match Details */}
        <div className="space-y-2 mb-4">
          {formattedDate && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4 shrink-0" />
              <span className="capitalize">{formattedDate}</span>
            </div>
          )}
          {matchInfo.location && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0" />
              <span className="truncate">{matchInfo.location}</span>
            </div>
          )}
          {matchInfo.inviterName && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4 shrink-0" />
              <span>Invitado por: </span>
              <div className="flex items-center gap-1.5">
                <Avatar className="h-5 w-5">
                  <AvatarImage src={matchInfo.inviterPhoto || undefined} />
                  <AvatarFallback className="text-[10px]">
                    {matchInfo.inviterName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium text-foreground">{matchInfo.inviterName}</span>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onReject(invitation)}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <X className="h-4 w-4 mr-1.5" />
                Rechazar
              </>
            )}
          </Button>
          <Button
            size="sm"
            className="flex-1"
            onClick={() => onAccept(invitation)}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Check className="h-4 w-4 mr-1.5" />
                Aceptar
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface RespondedInvitationCardProps {
  invitation: Invitation;
}

export function RespondedInvitationCard({ invitation }: RespondedInvitationCardProps) {
  const firestore = useFirestore();
  const [matchTitle, setMatchTitle] = useState<string>('');
  const [matchDate, setMatchDate] = useState<string | null>(null);

  useEffect(() => {
    const fetchMatchInfo = async () => {
      if (invitation.matchId && firestore) {
        try {
          const matchRef = doc(firestore, 'matches', invitation.matchId);
          const matchSnap = await getDoc(matchRef);
          if (matchSnap.exists()) {
            const matchData = matchSnap.data() as Match;
            setMatchTitle(matchData.title || 'Partido');
            setMatchDate(matchData.date);
          }
        } catch (error) {
          console.error('Error fetching match info:', error);
        }
      }
    };
    fetchMatchInfo();
  }, [invitation.matchId, firestore]);

  const isAccepted = invitation.status === 'accepted';
  const formattedDate = matchDate
    ? format(new Date(matchDate), "d MMM, HH:mm", { locale: es })
    : null;

  return (
    <Card className={cn(
      "overflow-hidden border-l-4",
      isAccepted ? "border-l-green-500 bg-green-500/5" : "border-l-muted bg-muted/30"
    )}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{matchTitle || invitation.matchTitle}</p>
            {formattedDate && (
              <p className="text-xs text-muted-foreground">{formattedDate}</p>
            )}
          </div>
          <div className={cn(
            "text-xs font-medium px-2 py-1 rounded-full",
            isAccepted
              ? "bg-green-500/10 text-green-600"
              : "bg-muted text-muted-foreground"
          )}>
            {isAccepted ? 'Aceptada' : 'Rechazada'}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
