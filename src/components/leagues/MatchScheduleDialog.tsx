
'use client';

import { useState } from 'react';
import type { Match, MatchLocation } from '@/lib/types';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { updateMatchDateAction } from '@/lib/actions/server-actions';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';

type MatchScheduleDialogProps = {
  match: Match | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export function MatchScheduleDialog({ match, open, onOpenChange, onSuccess }: MatchScheduleDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    date: match ? format(new Date(match.date), 'yyyy-MM-dd') : '',
    time: match?.time || '19:00',
    location: match?.location?.name || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!match) return;

    setIsSubmitting(true);

    try {
      // Create date-time ISO string
      const dateTimeString = new Date(`${formData.date}T${formData.time}`).toISOString();

      // Create location object (keeping existing data if available)
      const location: MatchLocation | undefined = formData.location
        ? {
            name: formData.location,
            address: match.location?.address || '',
            lat: match.location?.lat || 0,
            lng: match.location?.lng || 0,
            placeId: match.location?.placeId || '',
          }
        : undefined;

      const result = await updateMatchDateAction(
        match.id,
        dateTimeString,
        formData.time,
        location
      );

      if (result.success) {
        toast({
          title: 'Fecha actualizada',
          description: 'La fecha del partido ha sido actualizada correctamente.',
        });
        onOpenChange(false);
        onSuccess?.();
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo actualizar la fecha del partido.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!match) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar Fecha del Partido</DialogTitle>
          <DialogDescription>
            {match.teams?.[0]?.name} vs {match.teams?.[1]?.name}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="date">Fecha</Label>
            <Input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
              min={format(new Date(), 'yyyy-MM-dd')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="time">Hora</Label>
            <Input
              id="time"
              type="time"
              value={formData.time}
              onChange={(e) => setFormData({ ...formData, time: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Ubicación</Label>
            <Input
              id="location"
              type="text"
              placeholder="Ej: Cancha Municipal"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Para establecer ubicación con mapa, edita el partido desde su página de detalle.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
