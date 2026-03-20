'use client';

import * as React from 'react';
import { useFirestore } from '@/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format as formatDate, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar as CalendarIcon, Loader2, Settings, PlayCircle, UserCheck } from 'lucide-react';
import type { BracketMatch, Cup } from '@/lib/types';
import { AssignRefereeDialog } from './assign-referee-dialog';

interface BracketMatchSettingsDialogProps {
  cupId: string;
  match: BracketMatch | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BracketMatchSettingsDialog({ cupId, match, open, onOpenChange }: BracketMatchSettingsDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [date, setDate] = React.useState('');
  const [time, setTime] = React.useState('');
  const [venue, setVenue] = React.useState('');
  const [streamingUrl, setStreamingUrl] = React.useState('');
  const [isLive, setIsLive] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isRefereeDialogOpen, setIsRefereeDialogOpen] = React.useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = React.useState(false);

  // Load match data when dialog opens
  React.useEffect(() => {
    if (open && match) {
      setDate(match.date || '');
      setTime(match.time || '');
      setVenue(match.venue || '');
      setStreamingUrl(match.streamingUrl || '');
      setIsLive(match.isLive || false);
    }
  }, [open, match]);

  const parseDateFromText = React.useCallback((value?: string): Date | undefined => {
    if (!value) return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
      const [day, month, year] = trimmed.split('/').map(Number);
      const date = new Date(year, month - 1, day);
      if (!Number.isNaN(date.getTime())) return date;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [year, month, day] = trimmed.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      if (!Number.isNaN(date.getTime())) return date;
    }

    return undefined;
  }, []);

  const handleSave = async () => {
    if (!match) return;
    setIsSaving(true);
    try {
      const { updateBracketMatchSettingsAction } = await import('@/lib/actions/server-actions');
      const res = await updateBracketMatchSettingsAction(cupId, match.id, {
        date,
        time,
        venue,
        streamingUrl,
        isLive,
      });
      if (!res?.success) throw new Error(res?.error || 'Error');
      toast({ title: 'Datos actualizados', description: 'La programación del partido fue guardada.' });
      onOpenChange(false);
    } catch (e: any) {
      console.error('[BracketMatchSettings] Error:', e);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo actualizar el partido.' });
    } finally {
      setIsSaving(false);
    }
  };

  if (!match) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 uppercase font-black">
              <Settings className="h-4 w-4 text-primary" />
              Configurar Partido
            </DialogTitle>
            <DialogDescription>
              {match.team1Name} vs {match.team2Name}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Árbitro Section */}
            <div className="grid gap-2 border-b border-border/40 pb-4">
              <Label className="flex items-center gap-2 font-bold">
                <UserCheck className="w-4 h-4 text-primary" />
                Árbitro
              </Label>
              {match.refereeName ? (
                <div className="flex items-center justify-between bg-muted/30 rounded-lg p-3 border border-border/40">
                  <span className="text-sm font-medium">{match.refereeName}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsRefereeDialogOpen(true)}
                    className="h-7 text-xs"
                  >
                    Cambiar
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => setIsRefereeDialogOpen(true)}
                  className="w-full justify-start text-muted-foreground"
                >
                  <UserCheck className="mr-2 h-4 w-4" />
                  Asignar Árbitro
                </Button>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="date">Fecha</Label>
              <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between bg-background/50 border-border/40 hover:bg-background/80 font-normal"
                  >
                    <span className={date ? 'text-foreground font-bold' : 'text-muted-foreground'}>
                      {date || 'Seleccioná una fecha'}
                    </span>
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-[9999]" align="start">
                  <Calendar
                    mode="single"
                    locale={es}
                    selected={parseDateFromText(date)}
                    onSelect={(selectedDate) => {
                      if (!selectedDate) return;
                      setDate(formatDate(selectedDate, 'dd/MM/yyyy'));
                      setIsDatePickerOpen(false);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="time">Hora (Ej: 20:30)</Label>
              <Input id="time" value={time} onChange={(e) => setTime(e.target.value)} placeholder="HH:MM" />
            </div>

            {/* Cancha/Sede */}
            <div className="grid gap-2">
              <Label htmlFor="venue">Cancha / Sede</Label>
              <Input id="venue" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Estadio Principal" />
            </div>

            {/* Streaming Section */}
            <div className="grid gap-2 border-t border-border/40 pt-4 mt-2">
              <Label htmlFor="streamingUrl" className="flex items-center gap-2 text-primary font-bold">
                <PlayCircle className="w-4 h-4" /> Link de Transmisión (Streaming)
              </Label>
              <Input id="streamingUrl" value={streamingUrl} onChange={(e) => setStreamingUrl(e.target.value)} placeholder="https://youtube.com/live/..." />
            </div>

            {/* En Vivo Toggle */}
            <div className="flex items-center space-x-2 bg-primary/5 p-3 rounded-xl border border-primary/20">
              <Checkbox
                id="isLive"
                checked={isLive}
                onCheckedChange={(checked) => setIsLive(checked === true)}
              />
              <label
                htmlFor="isLive"
                className="text-sm font-bold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer text-primary"
              >
                ESTÁ TRANSMITIENDO EN VIVO AHORA
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Guardar Datos'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Referee Dialog */}
      <AssignRefereeDialog
        competitionId={cupId}
        competitionType="cups"
        matchForBracket={match}
        open={isRefereeDialogOpen}
        onOpenChange={setIsRefereeDialogOpen}
      />
    </>
  );
}
