'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Switch } from '@/components/ui/switch';
import { MapPin, Plus, Loader2, Building2 } from 'lucide-react';
import {
  getGroupVenuesAction,
  createVenueAction,
  updateVenueAction,
  deleteVenueAction,
} from '@/lib/actions/venue-actions';
import { useToast } from '@/hooks/use-toast';
import type { Venue, VenueSurface } from '@/lib/types';
import { VenueCard } from './venue-card';

type VenueManagerProps = {
  groupId: string;
};

export function VenueManager({ groupId }: VenueManagerProps) {
  const { toast } = useToast();

  const [venues, setVenues] = useState<Venue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [venueToDelete, setVenueToDelete] = useState<Venue | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    lat: '',
    lng: '',
    pricePerHour: '',
    currency: 'ARS',
    surface: '' as VenueSurface | '',
    capacity: '',
    fieldSize: '',
    hasLighting: false,
    hasParking: false,
    hasChangingRooms: false,
    hasShowers: false,
    contactPhone: '',
    contactEmail: '',
    website: '',
    notes: '',
  });

  useEffect(() => {
    loadVenues();
  }, [groupId]);

  const loadVenues = async () => {
    try {
      const result = await getGroupVenuesAction(groupId);
      if (result.success && result.venues) {
        setVenues(result.venues);
      }
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading venues:', error);
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      address: '',
      lat: '',
      lng: '',
      pricePerHour: '',
      currency: 'ARS',
      surface: '',
      capacity: '',
      fieldSize: '',
      hasLighting: false,
      hasParking: false,
      hasChangingRooms: false,
      hasShowers: false,
      contactPhone: '',
      contactEmail: '',
      website: '',
      notes: '',
    });
    setEditingVenue(null);
  };

  const handleCreate = () => {
    resetForm();
    setShowDialog(true);
  };

  const handleEdit = (venue: Venue) => {
    setEditingVenue(venue);
    setFormData({
      name: venue.name,
      address: venue.address,
      lat: venue.location.lat.toString(),
      lng: venue.location.lng.toString(),
      pricePerHour: venue.pricePerHour.toString(),
      currency: venue.currency,
      surface: venue.surface || '',
      capacity: venue.capacity?.toString() || '',
      fieldSize: venue.fieldSize || '',
      hasLighting: venue.hasLighting || false,
      hasParking: venue.hasParking || false,
      hasChangingRooms: venue.hasChangingRooms || false,
      hasShowers: venue.hasShowers || false,
      contactPhone: venue.contactPhone || '',
      contactEmail: venue.contactEmail || '',
      website: venue.website || '',
      notes: venue.notes || '',
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    // Validación básica
    if (!formData.name || !formData.address || !formData.lat || !formData.lng || !formData.pricePerHour) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Completá todos los campos obligatorios',
      });
      return;
    }

    setIsSaving(true);
    try {
      const venueData = {
        name: formData.name,
        address: formData.address,
        location: {
          lat: parseFloat(formData.lat),
          lng: parseFloat(formData.lng),
        },
        pricePerHour: parseFloat(formData.pricePerHour),
        currency: formData.currency,
        surface: formData.surface || undefined,
        capacity: formData.capacity ? parseInt(formData.capacity) : undefined,
        fieldSize: formData.fieldSize || undefined,
        hasLighting: formData.hasLighting,
        hasParking: formData.hasParking,
        hasChangingRooms: formData.hasChangingRooms,
        hasShowers: formData.hasShowers,
        contactPhone: formData.contactPhone || undefined,
        contactEmail: formData.contactEmail || undefined,
        website: formData.website || undefined,
        notes: formData.notes || undefined,
      };

      if (editingVenue) {
        // Actualizar
        const result = await updateVenueAction(editingVenue.id, venueData);
        if (result.success) {
          toast({ title: 'Cancha actualizada', description: 'Los cambios fueron guardados' });
          await loadVenues();
          setShowDialog(false);
          resetForm();
        } else {
          toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
      } else {
        // Crear
        const result = await createVenueAction(groupId, venueData as any);
        if (result.success) {
          toast({ title: 'Cancha creada', description: 'La cancha fue agregada al grupo' });
          await loadVenues();
          setShowDialog(false);
          resetForm();
        } else {
          toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
      }
    } catch (error) {
      console.error('Error saving venue:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Ocurrió un error al guardar' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!venueToDelete) return;

    setIsDeleting(true);
    try {
      const result = await deleteVenueAction(venueToDelete.id);
      if (result.success) {
        toast({ title: 'Cancha eliminada', description: 'La cancha fue removida del grupo' });
        await loadVenues();
        setShowDeleteDialog(false);
        setVenueToDelete(null);
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
      }
    } catch (error) {
      console.error('Error deleting venue:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Ocurrió un error al eliminar' });
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Canchas del Grupo ({venues.length})
              </CardTitle>
              <CardDescription>Gestioná las canchas donde juegan</CardDescription>
            </div>
            <Button onClick={handleCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Agregar Cancha
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {venues.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">No hay canchas agregadas aún</p>
              <Button onClick={handleCreate} variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Agregar Primera Cancha
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {venues.map((venue) => (
                <VenueCard
                  key={venue.id}
                  venue={venue}
                  onEdit={() => handleEdit(venue)}
                  onDelete={() => {
                    setVenueToDelete(venue);
                    setShowDeleteDialog(true);
                  }}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Crear/Editar */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingVenue ? 'Editar Cancha' : 'Nueva Cancha'}</DialogTitle>
            <DialogDescription>
              Configurá la información de la cancha para usarla en partidos
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Nombre */}
            <div className="space-y-2">
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                placeholder="Ej: Complejo Deportivo Los Pinos"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            {/* Dirección */}
            <div className="space-y-2">
              <Label htmlFor="address">Dirección *</Label>
              <Input
                id="address"
                placeholder="Calle, número, ciudad"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>

            {/* Ubicación */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="lat">Latitud *</Label>
                <Input
                  id="lat"
                  type="number"
                  step="any"
                  placeholder="-34.603722"
                  value={formData.lat}
                  onChange={(e) => setFormData({ ...formData, lat: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lng">Longitud *</Label>
                <Input
                  id="lng"
                  type="number"
                  step="any"
                  placeholder="-58.381592"
                  value={formData.lng}
                  onChange={(e) => setFormData({ ...formData, lng: e.target.value })}
                />
              </div>
            </div>

            {/* Precio */}
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="price">Precio por hora *</Label>
                <Input
                  id="price"
                  type="number"
                  placeholder="5000"
                  value={formData.pricePerHour}
                  onChange={(e) => setFormData({ ...formData, pricePerHour: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Moneda</Label>
                <Select value={formData.currency} onValueChange={(value) => setFormData({ ...formData, currency: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ARS">ARS</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Superficie y capacidad */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="surface">Superficie</Label>
                <Select value={formData.surface} onValueChange={(value) => setFormData({ ...formData, surface: value as VenueSurface })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="grass">Césped</SelectItem>
                    <SelectItem value="artificial">Sintético</SelectItem>
                    <SelectItem value="indoor">Indoor</SelectItem>
                    <SelectItem value="clay">Tierra</SelectItem>
                    <SelectItem value="concrete">Cemento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="capacity">Capacidad</Label>
                <Input
                  id="capacity"
                  type="number"
                  placeholder="22"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fieldSize">Tamaño</Label>
                <Select value={formData.fieldSize} onValueChange={(value) => setFormData({ ...formData, fieldSize: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5v5">5v5</SelectItem>
                    <SelectItem value="7v7">7v7</SelectItem>
                    <SelectItem value="11v11">11v11</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Amenities */}
            <div className="space-y-3">
              <Label>Servicios</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center justify-between space-x-2 p-2 border rounded">
                  <Label htmlFor="lighting" className="cursor-pointer">Iluminación</Label>
                  <Switch
                    id="lighting"
                    checked={formData.hasLighting}
                    onCheckedChange={(checked) => setFormData({ ...formData, hasLighting: checked })}
                  />
                </div>
                <div className="flex items-center justify-between space-x-2 p-2 border rounded">
                  <Label htmlFor="parking" className="cursor-pointer">Estacionamiento</Label>
                  <Switch
                    id="parking"
                    checked={formData.hasParking}
                    onCheckedChange={(checked) => setFormData({ ...formData, hasParking: checked })}
                  />
                </div>
                <div className="flex items-center justify-between space-x-2 p-2 border rounded">
                  <Label htmlFor="changing" className="cursor-pointer">Vestuarios</Label>
                  <Switch
                    id="changing"
                    checked={formData.hasChangingRooms}
                    onCheckedChange={(checked) => setFormData({ ...formData, hasChangingRooms: checked })}
                  />
                </div>
                <div className="flex items-center justify-between space-x-2 p-2 border rounded">
                  <Label htmlFor="showers" className="cursor-pointer">Duchas</Label>
                  <Switch
                    id="showers"
                    checked={formData.hasShowers}
                    onCheckedChange={(checked) => setFormData({ ...formData, hasShowers: checked })}
                  />
                </div>
              </div>
            </div>

            {/* Contacto */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input
                  id="phone"
                  placeholder="+54 11 1234-5678"
                  value={formData.contactPhone}
                  onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="contacto@cancha.com"
                  value={formData.contactEmail}
                  onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">Sitio Web</Label>
              <Input
                id="website"
                placeholder="https://www.cancha.com"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              />
            </div>

            {/* Notas */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notas</Label>
              <Textarea
                id="notes"
                placeholder="Información adicional sobre la cancha..."
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingVenue ? 'Guardar Cambios' : 'Crear Cancha'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Eliminar */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cancha?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que querés eliminar <strong>{venueToDelete?.name}</strong>?
              {' '}Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
