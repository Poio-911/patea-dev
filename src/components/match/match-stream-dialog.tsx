"use client";

import React, { useState } from 'react';
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
  ResponsiveDialogDescription as DialogDescription,
} from '@/components/ui/responsive-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { Match } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { PlayCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type MatchStreamDialogProps = {
  match: Match;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function MatchStreamDialog({ match, open, onOpenChange }: MatchStreamDialogProps) {
  const firestore = useFirestore();
  const [active, setActive] = useState<boolean>(!!match.stream?.active);
  const [provider, setProvider] = useState<'youtube' | 'twitch' | 'kick' | 'custom'>(match.stream?.provider || 'youtube');
  const [videoId, setVideoId] = useState<string>(match.stream?.id || '');
  const [url, setUrl] = useState<string>(match.stream?.url || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!firestore) return;
    setSaving(true);
    try {
      const ref = doc(firestore, 'matches', match.id);
      await updateDoc(ref, {
        stream: {
          provider,
          id: provider === 'youtube' || provider === 'twitch' || provider === 'kick' ? (videoId || null) : null,
          url: provider === 'custom' ? (url || null) : null,
          active,
        },
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><PlayCircle className="h-5 w-5" /> Transmisión en vivo</DialogTitle>
          <DialogDescription>Opción gratuita: pegá el ID de YouTube Live y activá.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="stream-active">Activar transmisión</Label>
            <Switch id="stream-active" checked={active} onCheckedChange={setActive} />
          </div>

          <div className="space-y-2">
            <Label>Proveedor</Label>
            <Select value={provider} onValueChange={(v) => setProvider(v as any)}>
              <SelectTrigger><SelectValue placeholder="Elegir proveedor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="youtube">YouTube</SelectItem>
                <SelectItem value="twitch">Twitch</SelectItem>
                <SelectItem value="kick">Kick</SelectItem>
                <SelectItem value="custom">Embed personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {provider !== 'custom' ? (
            <div className="space-y-2">
              <Label htmlFor="provider-id">{provider === 'youtube' ? 'YouTube Video ID' : provider === 'twitch' ? 'Twitch Channel' : 'Kick Channel'}</Label>
              <Input id="provider-id" placeholder={provider === 'youtube' ? 'p.ej. dQw4w9WgXcQ' : 'p.ej. canal'} value={videoId} onChange={(e) => setVideoId(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                {provider === 'youtube' ? 'En la URL de YouTube, es lo que viene después de v=' : provider === 'twitch' ? 'Nombre del canal de Twitch. Nota: el reproductor requiere el dominio actual en el parámetro parent; en local usamos localhost y 127.0.0.1.' : 'Nombre del canal en Kick'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="custom-url">URL de embed</Label>
              <Input id="custom-url" placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
