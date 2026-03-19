'use client';

import * as React from 'react';
import { useFirestore } from '@/firebase';
import { collection, query, onSnapshot, doc, getDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserCheck, AlertCircle } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { Referee } from '@/lib/types';

interface MatchObj {
  id: string;
  homeTeamName: string;
  awayTeamName: string;
  refereeId?: string;
  refereeName?: string;
}

interface AssignRefereeDialogProps {
  leagueId: string;
  fixtureDocId: string;
  match: MatchObj | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AssignRefereeDialog({ leagueId, fixtureDocId, match, open, onOpenChange }: AssignRefereeDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [referees, setReferees] = React.useState<Referee[]>([]);
  const [selectedRefereeId, setSelectedRefereeId] = React.useState<string>('');
  const [loading, setLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);

  // Listen to referees
  React.useEffect(() => {
    if (!firestore || !open) return;

    const refereesRef = collection(firestore, 'leagues', leagueId, 'referees');
    const q = query(refereesRef);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Referee));
      setReferees(data);
      setLoading(false);
    }, (err) => {
      console.error('[AssignReferee] Error:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [firestore, leagueId, open]);

  // Set initial selected referee when dialog opens
  React.useEffect(() => {
    if (open && match) {
      setSelectedRefereeId(match.refereeId || '');
    }
  }, [open, match]);

  const handleAssign = async () => {
    if (!firestore || !match) return;

    if (!selectedRefereeId) {
      toast({ variant: 'destructive', title: 'Seleccioná un árbitro', description: 'Tenés que elegir un árbitro para asignar.' });
      return;
    }

    setIsSaving(true);
    try {
      const selectedReferee = referees.find(r => r.id === selectedRefereeId);
      if (!selectedReferee) throw new Error('Referee not found');

      // Update the fixture document
      const fixtureRef = doc(firestore, 'leagues', leagueId, 'fixtures', fixtureDocId);
      const fixtureSnap = await getDoc(fixtureRef);

      if (!fixtureSnap.exists()) {
        throw new Error('Fixture not found');
      }

      const fixtureData = fixtureSnap.data();
      const matches = fixtureData.matches || [];

      // Find and update the specific match
      const updatedMatches = matches.map((m: MatchObj) => {
        if (m.id === match.id) {
          return {
            ...m,
            refereeId: selectedReferee.id,
            refereeName: selectedReferee.name,
          };
        }
        return m;
      });

      const batch = writeBatch(firestore);

      // Update fixture with new match data
      batch.update(fixtureRef, { matches: updatedMatches });

      // Update referee's assignedMatches
      const refereeRef = doc(firestore, 'leagues', leagueId, 'referees', selectedReferee.id);
      const assignmentKey = `${fixtureDocId}:${match.id}`;
      const currentAssignments = selectedReferee.assignedMatches || [];

      if (!currentAssignments.includes(assignmentKey)) {
        batch.update(refereeRef, {
          assignedMatches: [...currentAssignments, assignmentKey],
        });
      }

      // If there was a previous referee, remove this match from their assignments
      if (match.refereeId && match.refereeId !== selectedReferee.id) {
        const previousRefereeRef = doc(firestore, 'leagues', leagueId, 'referees', match.refereeId);
        const previousRefereeSnap = await getDoc(previousRefereeRef);

        if (previousRefereeSnap.exists()) {
          const prevData = previousRefereeSnap.data();
          const prevAssignments = (prevData.assignedMatches || []) as string[];
          const filteredAssignments = prevAssignments.filter(a => a !== assignmentKey);
          batch.update(previousRefereeRef, { assignedMatches: filteredAssignments });
        }
      }

      await batch.commit();

      toast({
        title: 'Árbitro asignado',
        description: `${selectedReferee.name} fue asignado al partido ${match.homeTeamName} vs ${match.awayTeamName}.`
      });

      onOpenChange(false);
    } catch (e: any) {
      console.error('[AssignReferee] Error:', e);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo asignar el árbitro.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveAssignment = async () => {
    if (!firestore || !match || !match.refereeId) return;

    setIsSaving(true);
    try {
      const fixtureRef = doc(firestore, 'leagues', leagueId, 'fixtures', fixtureDocId);
      const fixtureSnap = await getDoc(fixtureRef);

      if (!fixtureSnap.exists()) {
        throw new Error('Fixture not found');
      }

      const fixtureData = fixtureSnap.data();
      const matches = fixtureData.matches || [];

      // Remove referee from match
      const updatedMatches = matches.map((m: MatchObj) => {
        if (m.id === match.id) {
          const { refereeId, refereeName, ...rest } = m;
          return rest;
        }
        return m;
      });

      const batch = writeBatch(firestore);

      // Update fixture
      batch.update(fixtureRef, { matches: updatedMatches });

      // Update referee's assignedMatches
      const refereeRef = doc(firestore, 'leagues', leagueId, 'referees', match.refereeId);
      const refereeSnap = await getDoc(refereeRef);

      if (refereeSnap.exists()) {
        const refereeData = refereeSnap.data();
        const assignmentKey = `${fixtureDocId}:${match.id}`;
        const currentAssignments = (refereeData.assignedMatches || []) as string[];
        const filteredAssignments = currentAssignments.filter(a => a !== assignmentKey);
        batch.update(refereeRef, { assignedMatches: filteredAssignments });
      }

      await batch.commit();

      toast({ title: 'Asignación removida', description: 'El árbitro fue removido del partido.' });
      onOpenChange(false);
    } catch (e: any) {
      console.error('[RemoveReferee] Error:', e);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo remover el árbitro.' });
    } finally {
      setIsSaving(false);
    }
  };

  if (!match) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline font-black text-xl uppercase tracking-tight flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" />
            Asignar Árbitro
          </DialogTitle>
          <DialogDescription>
            Partido: <span className="font-bold">{match.homeTeamName} vs {match.awayTeamName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : referees.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No hay árbitros registrados en esta liga. Primero agregá árbitros desde la pestaña de Árbitros.
              </AlertDescription>
            </Alert>
          ) : (
            <RadioGroup value={selectedRefereeId} onValueChange={setSelectedRefereeId}>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                {referees.map(referee => (
                  <div key={referee.id} className="flex items-center space-x-3 rounded-lg border border-border/50 p-3 hover:bg-accent/30 transition-colors">
                    <RadioGroupItem value={referee.id} id={`ref-${referee.id}`} />
                    <Label htmlFor={`ref-${referee.id}`} className="flex items-center gap-3 flex-1 cursor-pointer">
                      <Avatar className="h-9 w-9 border border-border">
                        <AvatarImage src={referee.photoUrl} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                          {referee.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate">{referee.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {referee.assignedMatches?.length || 0} partidos asignados
                        </p>
                      </div>
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
          )}

          {match.refereeId && (
            <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-border/50">
              <p className="text-xs text-muted-foreground mb-2">Árbitro actual:</p>
              <p className="font-bold text-sm">{match.refereeName}</p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {match.refereeId && (
            <Button
              variant="outline"
              className="w-full sm:w-auto border-destructive/30 text-destructive hover:bg-destructive/10"
              onClick={handleRemoveAssignment}
              disabled={isSaving}
            >
              Remover Asignación
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleAssign} disabled={isSaving || referees.length === 0}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserCheck className="mr-2 h-4 w-4" />}
            Asignar Árbitro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
