
'use client';

import { useState } from 'react';
import type { Match, MatchLocation } from '@/lib/types';
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

interface ChangeVenueDialogProps {
  match: Match;
  onChangeLocation: (location: MatchLocation) => Promise<void>;
  isSubmitting: boolean;
  children: React.ReactNode;
}

export function ChangeVenueDialog({ match, onChangeLocation, isSubmitting, children }: ChangeVenueDialogProps) {
  const [open, setOpen] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);

  const [formData, setFormData] = useState({
    name: match.location?.name || '',
    address: match.location?.address || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGeocoding(true);

    let location: MatchLocation = {
      name: formData.name,
      address: formData.address || formData.name,
      lat: match.location?.lat || 0,
      lng: match.location?.lng || 0,
      placeId: match.location?.placeId || `custom-${Date.now()}`,
    };

    // Try to geocode the address
    try {
      const addressToGeocode = formData.address || formData.name;
      const res = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: addressToGeocode }),
      });
      const json = await res.json();
      if (json?.success) {
        location = {
          name: formData.name,
          address: json.address || addressToGeocode,
          lat: json.lat ?? 0,
          lng: json.lng ?? 0,
          placeId: json.placeId || `custom-${Date.now()}`,
        };
      }
    } catch {
      // geocoding failed, use lat/lng 0 fallback
    } finally {
      setIsGeocoding(false);
    }

    try {
      await onChangeLocation(location);
      setOpen(false);
    } catch {
      // error handled in hook
    }
  };

  const busy = isSubmitting || isGeocoding;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Cambiar Cancha</DialogTitle>
          <DialogDescription>
            Los jugadores inscriptos recibirán una notificación con la nueva ubicación.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="venue-name">Nombre de la cancha</Label>
            <Input
              id="venue-name"
              type="text"
              placeholder="Ej: Cancha Municipal"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="venue-address">Dirección</Label>
            <Input
              id="venue-address"
              type="text"
              placeholder="Ej: Av. Corrientes 1234, Buenos Aires"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
