'use client';

import { useState, useEffect, useCallback } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import type { Player, AvailablePlayer, DayOfWeek, TimeOfDay, Availability, SavedLocation } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Search, MapPin, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { saveUserLocationAction, reverseGeocodeAction } from '@/lib/actions/location-actions';
import { cn } from '@/lib/utils';

const daysOfWeek: { id: DayOfWeek; label: string; short: string }[] = [
  { id: 'lunes', label: 'Lunes', short: 'Lun' },
  { id: 'martes', label: 'Martes', short: 'Mar' },
  { id: 'miercoles', label: 'Miércoles', short: 'Mie' },
  { id: 'jueves', label: 'Jueves', short: 'Jue' },
  { id: 'viernes', label: 'Viernes', short: 'Vie' },
  { id: 'sabado', label: 'Sábado', short: 'Sáb' },
  { id: 'domingo', label: 'Domingo', short: 'Dom' },
];

const timeSlots: { id: TimeOfDay; label: string }[] = [
  { id: 'mañana', label: 'Mañana' },
  { id: 'tarde', label: 'Tarde' },
  { id: 'noche', label: 'Noche' },
];

interface AvailabilityCardProps {
  player: Player | null;
  availablePlayerData: AvailablePlayer | null;
  savedLocation?: SavedLocation;
}

export function AvailabilityCard({ player, availablePlayerData, savedLocation }: AvailabilityCardProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [isVisible, setIsVisible] = useState(!!availablePlayerData);
  const [isToggling, setIsToggling] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Local state for availability preferences
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>([]);
  const [selectedTimes, setSelectedTimes] = useState<TimeOfDay[]>([]);
  const [currentLocation, setCurrentLocation] = useState<SavedLocation | undefined>(savedLocation);

  // Initialize from existing data
  useEffect(() => {
    if (availablePlayerData?.availability) {
      const days: DayOfWeek[] = [];
      const times = new Set<TimeOfDay>();

      Object.entries(availablePlayerData.availability).forEach(([day, dayTimes]) => {
        if (dayTimes && dayTimes.length > 0) {
          days.push(day as DayOfWeek);
          dayTimes.forEach((t) => times.add(t));
        }
      });

      setSelectedDays(days);
      setSelectedTimes(Array.from(times));
    }
  }, [availablePlayerData]);

  useEffect(() => {
    setCurrentLocation(savedLocation);
  }, [savedLocation]);

  useEffect(() => {
    setIsVisible(!!availablePlayerData);
  }, [availablePlayerData]);

  const requestLocation = useCallback(async (): Promise<{ lat: number; lng: number; label?: string } | null> => {
    return new Promise((resolve) => {
      setLocationError(null);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;

          // Try to get a human-readable label
          const geocodeResult = await reverseGeocodeAction(latitude, longitude);
          const label = geocodeResult.success ? geocodeResult.label : undefined;

          resolve({ lat: latitude, lng: longitude, label });
        },
        (error) => {
          let message = 'No se pudo obtener tu ubicación.';
          if (error.code === error.PERMISSION_DENIED) {
            message = 'Permiso de ubicación denegado. Activalo en la configuración del navegador.';
          }
          setLocationError(message);
          resolve(null);
        }
      );
    });
  }, []);

  const handleToggleVisibility = async (checked: boolean) => {
    if (!firestore || !user || !player) return;

    setIsToggling(true);
    setLocationError(null);

    try {
      const availablePlayerRef = doc(firestore, 'availablePlayers', user.uid);

      if (checked) {
        // Need location to enable visibility
        let location = currentLocation;

        if (!location) {
          const newLocation = await requestLocation();
          if (!newLocation) {
            setIsToggling(false);
            return;
          }
          location = { ...newLocation, savedAt: new Date().toISOString() };

          // Save location for future use
          await saveUserLocationAction(location.lat, location.lng, location.label);
          setCurrentLocation(location);
        }

        // Build availability object from selected days/times
        const availability: Availability = {};
        selectedDays.forEach((day) => {
          availability[day] = selectedTimes.length > 0 ? selectedTimes : ['tarde', 'noche'];
        });

        // If no days selected, default to weekends
        if (selectedDays.length === 0) {
          availability.sabado = selectedTimes.length > 0 ? selectedTimes : ['tarde', 'noche'];
          availability.domingo = selectedTimes.length > 0 ? selectedTimes : ['tarde', 'noche'];
          setSelectedDays(['sabado', 'domingo']);
          if (selectedTimes.length === 0) {
            setSelectedTimes(['tarde', 'noche']);
          }
        }

        const newAvailablePlayer: Omit<AvailablePlayer, 'id'> = {
          uid: user.uid,
          displayName: player.name,
          photoUrl: player.photoUrl || '',
          position: player.position,
          ovr: player.ovr,
          location: { lat: location.lat, lng: location.lng },
          availability,
        };

        await setDoc(availablePlayerRef, newAvailablePlayer, { merge: true });
        setIsVisible(true);
        toast({ title: 'Visibilidad activada', description: 'Ahora otros DTs pueden encontrarte.' });
      } else {
        await deleteDoc(availablePlayerRef);
        setIsVisible(false);
        toast({ title: 'Visibilidad desactivada', description: 'Ya no aparecés en búsquedas.' });
      }
    } catch (error) {
      console.error('Error toggling visibility:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo cambiar la visibilidad.' });
    } finally {
      setIsToggling(false);
    }
  };

  const handleUpdateLocation = async () => {
    setIsUpdatingLocation(true);
    const newLocation = await requestLocation();

    if (newLocation) {
      const location: SavedLocation = { ...newLocation, savedAt: new Date().toISOString() };
      await saveUserLocationAction(location.lat, location.lng, location.label);
      setCurrentLocation(location);

      // If visible, update the availablePlayers document
      if (isVisible && firestore && user) {
        const availablePlayerRef = doc(firestore, 'availablePlayers', user.uid);
        await setDoc(availablePlayerRef, { location: { lat: location.lat, lng: location.lng } }, { merge: true });
      }

      toast({ title: 'Ubicación actualizada' });
    }

    setIsUpdatingLocation(false);
  };

  const handleDaysChange = async (days: string[]) => {
    setSelectedDays(days as DayOfWeek[]);

    if (isVisible && firestore && user) {
      setIsSaving(true);
      const availability: Availability = {};
      (days as DayOfWeek[]).forEach((day) => {
        availability[day] = selectedTimes.length > 0 ? selectedTimes : ['tarde', 'noche'];
      });

      try {
        const availablePlayerRef = doc(firestore, 'availablePlayers', user.uid);
        await setDoc(availablePlayerRef, { availability }, { merge: true });
      } catch (error) {
        console.error('Error updating days:', error);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleTimesChange = async (times: string[]) => {
    setSelectedTimes(times as TimeOfDay[]);

    if (isVisible && firestore && user && selectedDays.length > 0) {
      setIsSaving(true);
      const availability: Availability = {};
      selectedDays.forEach((day) => {
        availability[day] = times as TimeOfDay[];
      });

      try {
        const availablePlayerRef = doc(firestore, 'availablePlayers', user.uid);
        await setDoc(availablePlayerRef, { availability }, { merge: true });
      } catch (error) {
        console.error('Error updating times:', error);
      } finally {
        setIsSaving(false);
      }
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Search className="h-5 w-5 text-primary" />
          Buscar Partido
        </CardTitle>
        <CardDescription className="text-sm">
          Mostrá tu perfil a organizadores para que te inviten a sus partidos
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Visibility Toggle */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Visible para otros</span>
          <div className="flex items-center gap-2">
            {isToggling && <Loader2 className="h-4 w-4 animate-spin" />}
            <Switch
              checked={isVisible}
              onCheckedChange={handleToggleVisibility}
              disabled={isToggling || !player}
            />
          </div>
        </div>

        {locationError && (
          <Alert variant="destructive" className="py-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">{locationError}</AlertDescription>
          </Alert>
        )}

        {/* Status indicator */}
        {isVisible && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle className="h-3.5 w-3.5 text-green-500" />
            <span>Estás visible en la búsqueda de jugadores</span>
          </div>
        )}

        {/* Days Selection */}
        <div className={cn('space-y-2', !isVisible && 'opacity-50 pointer-events-none')}>
          <label className="text-sm font-medium flex items-center gap-2">
            Días disponibles
            {isSaving && <Loader2 className="h-3 w-3 animate-spin" />}
          </label>
          <ToggleGroup
            type="multiple"
            variant="outline"
            value={selectedDays}
            onValueChange={handleDaysChange}
            className="flex flex-wrap gap-1"
          >
            {daysOfWeek.map((day) => (
              <ToggleGroupItem
                key={day.id}
                value={day.id}
                className="text-xs px-2 h-8 flex-1 min-w-[40px]"
                disabled={!isVisible}
              >
                {day.short}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        {/* Time Slots */}
        <div className={cn('space-y-2', !isVisible && 'opacity-50 pointer-events-none')}>
          <label className="text-sm font-medium">Horarios preferidos</label>
          <ToggleGroup
            type="multiple"
            variant="outline"
            value={selectedTimes}
            onValueChange={handleTimesChange}
            className="flex gap-1"
          >
            {timeSlots.map((slot) => (
              <ToggleGroupItem
                key={slot.id}
                value={slot.id}
                className="text-xs px-3 h-8 flex-1"
                disabled={!isVisible}
              >
                {slot.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        {/* Location */}
        <div className={cn('space-y-2', !isVisible && 'opacity-50 pointer-events-none')}>
          <label className="text-sm font-medium">Ubicación</label>
          <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
            <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm text-muted-foreground flex-1 truncate">
              {currentLocation?.label || 'Sin ubicación guardada'}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={handleUpdateLocation}
              disabled={!isVisible || isUpdatingLocation}
            >
              {isUpdatingLocation ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              <span className="sr-only">Actualizar ubicación</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
