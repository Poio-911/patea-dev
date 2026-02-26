
'use client';

import { useState } from 'react';
import type { Match } from '@/lib/types';
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogFooter as DialogFooter,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
  ResponsiveDialogTrigger as DialogTrigger,
} from '@/components/ui/responsive-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface RescheduleMatchDialogProps {
  match: Match;
  onReschedule: (date: string, time: string) => Promise<void>;
  isSubmitting: boolean;
  children: React.ReactNode;
}

export function RescheduleMatchDialog({ match, onReschedule, isSubmitting, children }: RescheduleMatchDialogProps) {
  const [open, setOpen] = useState(false);

  const [formData, setFormData] = useState({
    date: match.date ? format(new Date(match.date), 'yyyy-MM-dd') : '',
    time: match.time || '19:00',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onReschedule(formData.date, formData.time);
      setOpen(false);
    } catch {
      // error handled in hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Reprogramar Partido</DialogTitle>
          <DialogDescription>
            Los jugadores inscriptos recibirán una notificación con el nuevo horario.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reschedule-date">Fecha</Label>
            <Input
              id="reschedule-date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
              min={format(new Date(), 'yyyy-MM-dd')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reschedule-time">Hora</Label>
            <Input
              id="reschedule-time"
              type="time"
              value={formData.time}
              onChange={(e) => setFormData({ ...formData, time: e.target.value })}
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
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
