
'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ResponsiveDialog as Dialog, ResponsiveDialogContent as DialogContent } from '@/components/ui/responsive-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Pencil } from 'lucide-react';
import { JerseyDesigner } from './team-builder/jersey-designer';
import { GroupTeam, Jersey } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

interface EditTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team: GroupTeam;
}

const editTeamSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
  jersey: z.object({
    type: z.custom<Jersey['type']>(),
    primaryColor: z.string(),
    secondaryColor: z.string(),
  }),
});

type EditTeamFormData = z.infer<typeof editTeamSchema>;

export function EditTeamDialog({ open, onOpenChange, team }: EditTeamDialogProps) {
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();

  const form = useForm<EditTeamFormData>({
    resolver: zodResolver(editTeamSchema),
    defaultValues: {
      name: team.name,
      jersey: team.jersey,
    },
  });

  const handleSave = async (data: EditTeamFormData) => {
    if (!firestore) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(firestore, 'teams', team.id), {
        name: data.name,
        jersey: data.jersey,
      });
      toast({ title: 'Equipo actualizado', description: `"${data.name}" fue guardado correctamente.` });
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating team:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo actualizar el equipo.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      form.reset({ name: team.name, jersey: team.jersey });
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg w-full flex flex-col p-0 gap-0 max-h-[85dvh] md:max-h-[80vh] bg-background/95 dark:bg-black/85 backdrop-blur-xl border-border/50 dark:border-white/10 overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 border-b border-border/10 dark:border-white/5 flex items-center gap-3 shrink-0">
          <Pencil className="w-4 h-4 text-primary" />
          <div>
            <h2 className="text-base font-black uppercase tracking-tight">Editar Equipo</h2>
            <p className="text-xs text-muted-foreground">Nombre e identidad visual</p>
          </div>
        </div>

        <form onSubmit={form.handleSubmit(handleSave)} className="flex flex-col flex-grow min-h-0">
          <div className="flex-grow overflow-y-auto px-4 sm:px-6 py-4 space-y-6">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="edit-team-name" className="text-xs uppercase tracking-widest text-muted-foreground">
                Nombre del Club
              </Label>
              <Input
                id="edit-team-name"
                {...form.register('name')}
                className="text-xl font-black italic bg-transparent border-0 border-b-2 border-border/40 dark:border-white/20 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary h-12 transition-colors"
              />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive font-bold">{form.formState.errors.name.message}</p>
              )}
            </div>

            {/* Jersey */}
            <div className="bg-muted/10 dark:bg-black/40 border border-border/10 dark:border-white/5 rounded-2xl p-4 backdrop-blur-md">
              <Controller
                control={form.control}
                name="jersey"
                render={({ field }) => (
                  <JerseyDesigner value={field.value} onChange={field.onChange} />
                )}
              />
            </div>
          </div>

          {/* Footer */}
          <div
            className="px-4 sm:px-6 py-4 border-t border-border/10 dark:border-white/10 bg-background/80 dark:bg-black/60 backdrop-blur-xl flex justify-end gap-3 shrink-0"
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
          >
            <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSaving || !form.formState.isValid}
              className="font-bold px-6"
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar Cambios
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
