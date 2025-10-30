
// This component has been modified to remove the drag-and-drop functionality
// due to dependency conflicts.
// The core logic for team management remains, but reordering must be done
// through other UI elements if needed in the future.
'use client';

import { useState } from 'react';
import { useForm, useFieldArray, FormProvider } from 'react-hook-form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from './ui/button';
import { Loader2 } from 'lucide-react';
import type { Match, Team, Player } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';

interface EditableTeamsDialogProps {
  match: Match;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

// This is the simpler player type used within the Match.teams array
type TeamPlayer = {
  uid: string;
  displayName: string;
  position: string;
  ovr: number;
};


export function EditableTeamsDialog({ match, onOpenChange, open }: EditableTeamsDialogProps) {
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();

  const methods = useForm({
    defaultValues: {
      teams: match.teams,
    },
  });

  const { fields, update } = useFieldArray({
    control: methods.control,
    name: 'teams',
  });

  const handleSave = async () => {
    if (!firestore) return;
    setIsSaving(true);
    try {
      const matchRef = doc(firestore, 'matches', match.id);
      await updateDoc(matchRef, { teams: methods.getValues().teams });
      toast({ title: 'Equipos actualizados', description: 'Los cambios se guardaron correctamente.' });
      onOpenChange(false);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron guardar los cambios.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Editar Equipos</DialogTitle>
          <DialogDescription>
            Funcionalidad de arrastrar y soltar desactivada temporalmente.
          </DialogDescription>
        </DialogHeader>
        <FormProvider {...methods}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fields.map((team) => (
              <div key={team.id} className="p-4 border rounded-lg">
                <h3 className="font-bold text-lg mb-2">{(team as Team).name}</h3>
                <div className="space-y-2">
                  {(team as Team).players.map((player: TeamPlayer) => (
                     <div key={player.uid} className="p-2 border rounded-md bg-background">
                       {player.displayName}
                     </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </FormProvider>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar Cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
