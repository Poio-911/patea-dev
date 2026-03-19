'use client';

import * as React from 'react';
import { useFirestore } from '@/firebase';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Plus, Pencil, Trash2, Users, DollarSign, Loader2 } from 'lucide-react';

interface Venue {
  id: string;
  name: string;
  address?: string;
  capacity?: number;
  costPerMatch?: number;
  notes?: string;
}

interface VenueFormData {
  name: string;
  address: string;
  capacity: string;
  costPerMatch: string;
  notes: string;
}

const EMPTY_FORM: VenueFormData = { name: '', address: '', capacity: '', costPerMatch: '', notes: '' };

interface LeagueVenuesTabProps {
  leagueId: string;
}

export function LeagueVenuesTab({ leagueId }: LeagueVenuesTabProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [venues, setVenues] = React.useState<Venue[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingVenue, setEditingVenue] = React.useState<Venue | null>(null);
  const [deleteVenue, setDeleteVenue] = React.useState<Venue | null>(null);
  const [form, setForm] = React.useState<VenueFormData>(EMPTY_FORM);
  const [isSaving, setIsSaving] = React.useState(false);

  // Real-time listener
  React.useEffect(() => {
    if (!firestore || !leagueId) return;
    const ref = collection(firestore, 'leagues', leagueId, 'venues');
    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Venue, 'id'>) }));
      setVenues(data);
      setLoading(false);
    });
    return unsub;
  }, [firestore, leagueId]);

  const openCreate = () => {
    setEditingVenue(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (venue: Venue) => {
    setEditingVenue(venue);
    setForm({
      name: venue.name,
      address: venue.address || '',
      capacity: venue.capacity !== undefined ? String(venue.capacity) : '',
      costPerMatch: venue.costPerMatch !== undefined ? String(venue.costPerMatch) : '',
      notes: venue.notes || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!firestore || !form.name.trim()) return;
    setIsSaving(true);

    const payload: Omit<Venue, 'id'> = {
      name: form.name.trim(),
      address: form.address.trim() || undefined,
      capacity: form.capacity ? parseInt(form.capacity, 10) : undefined,
      costPerMatch: form.costPerMatch ? parseFloat(form.costPerMatch) : undefined,
      notes: form.notes.trim() || undefined,
    };

    try {
      if (editingVenue) {
        await updateDoc(doc(firestore, 'leagues', leagueId, 'venues', editingVenue.id), payload);
        toast({ title: 'Sede actualizada' });
      } else {
        await addDoc(collection(firestore, 'leagues', leagueId, 'venues'), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        toast({ title: 'Sede agregada' });
      }
      setDialogOpen(false);
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar la sede.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!firestore || !deleteVenue) return;
    try {
      await deleteDoc(doc(firestore, 'leagues', leagueId, 'venues', deleteVenue.id));
      toast({ title: 'Sede eliminada' });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar la sede.' });
    } finally {
      setDeleteVenue(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold">Sedes</h3>
          <p className="text-sm text-muted-foreground">Administrá los lugares donde se juegan los partidos</p>
        </div>
        <Button size="sm" onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Agregar sede
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : venues.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <MapPin className="h-12 w-12 text-muted-foreground/30 mx-auto" />
          <p className="text-muted-foreground font-medium">No hay sedes registradas</p>
          <p className="text-xs text-muted-foreground">Agregá las canchas o instalaciones donde se juega la liga</p>
          <Button size="sm" variant="outline" onClick={openCreate} className="mt-2 gap-2">
            <Plus className="h-4 w-4" /> Agregar primera sede
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {venues.map((venue) => (
            <Card key={venue.id} className="border-border/40 bg-card/60 hover:bg-card/80 transition-colors">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <MapPin className="h-4 w-4 text-primary" />
                    </div>
                    <CardTitle className="text-sm font-bold truncate">{venue.name}</CardTitle>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(venue)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteVenue(venue)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {venue.address && (
                  <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
                    {venue.address}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {venue.capacity !== undefined && (
                    <Badge variant="secondary" className="text-xs gap-1">
                      <Users className="h-3 w-3" /> {venue.capacity} personas
                    </Badge>
                  )}
                  {venue.costPerMatch !== undefined && (
                    <Badge variant="secondary" className="text-xs gap-1">
                      <DollarSign className="h-3 w-3" /> {venue.costPerMatch}/partido
                    </Badge>
                  )}
                </div>
                {venue.notes && (
                  <p className="text-xs text-muted-foreground italic">{venue.notes}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingVenue ? 'Editar sede' : 'Nueva sede'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input
                placeholder="Ej. Complejo Deportivo Norte"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Dirección</Label>
              <Input
                placeholder="Calle, número, ciudad"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Capacidad (personas)</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="Ej. 500"
                  value={form.capacity}
                  onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Costo por partido ($)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Ej. 1500"
                  value={form.costPerMatch}
                  onChange={(e) => setForm((f) => ({ ...f, costPerMatch: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notas adicionales</Label>
              <Input
                placeholder="Ej. Trae las pecheras, estacionamiento gratis"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !form.name.trim()}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingVenue ? 'Guardar cambios' : 'Agregar sede'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteVenue} onOpenChange={(o) => !o && setDeleteVenue(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar sede?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará <strong>{deleteVenue?.name}</strong>. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
