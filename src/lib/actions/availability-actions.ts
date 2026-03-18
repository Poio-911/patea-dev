'use server';

import { getAdminDb } from '@/firebase/admin-init';
import { requireAuth } from '@/lib/auth/get-server-session';
import type { Availability, DayOfWeek, Player, TimeOfDay } from '@/lib/types';
import ngeohash from 'ngeohash';

function buildAvailability(days: DayOfWeek[], times: TimeOfDay[]): Availability {
  const finalDays: DayOfWeek[] = days.length > 0 ? days : ['sabado', 'domingo'];
  const finalTimes: TimeOfDay[] = times.length > 0 ? times : ['tarde', 'noche'];
  const availability: Availability = {};

  finalDays.forEach((day) => {
    availability[day] = finalTimes;
  });

  return availability;
}

async function upsertAvailabilityDocument(userId: string, availability: Availability, locationOverride?: { lat: number; lng: number }) {
  const db = getAdminDb();
  const [userSnap, playerSnap] = await Promise.all([
    db.collection('users').doc(userId).get(),
    db.collection('players').doc(userId).get(),
  ]);

  if (!playerSnap.exists) {
    return { success: false as const, error: 'No se encontró tu perfil de jugador.' };
  }

  const savedLocation = userSnap.data()?.savedLocation;
  const lat = locationOverride?.lat ?? savedLocation?.lat;
  const lng = locationOverride?.lng ?? savedLocation?.lng;

  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return { success: false as const, error: 'Primero debes guardar una ubicación.' };
  }

  const player = playerSnap.data() as Player;
  const hash = ngeohash.encode(lat, lng);

  await db.collection('availablePlayers').doc(userId).set({
    uid: userId,
    displayName: player.name,
    photoURL: player.photoURL || (player as any).photoUrl || '',
    photoUrl: (player as any).photoUrl || player.photoURL || '',
    position: player.position,
    ovr: player.ovr,
    location: {
      lat,
      lng,
      geohash: hash,
    },
    geohash: hash,
    availability,
  }, { merge: true });

  return { success: true as const, availability };
}

export async function enableAvailabilityAction(days: DayOfWeek[], times: TimeOfDay[]) {
  try {
    const userId = await requireAuth();
    const availability = buildAvailability(days, times);
    return await upsertAvailabilityDocument(userId, availability);
  } catch (error: any) {
    console.error('Error enabling availability:', error);
    return { success: false, error: error.message || 'No se pudo activar la visibilidad.' };
  }
}

export async function disableAvailabilityAction() {
  try {
    const userId = await requireAuth();
    await getAdminDb().collection('availablePlayers').doc(userId).delete();
    return { success: true };
  } catch (error: any) {
    console.error('Error disabling availability:', error);
    return { success: false, error: error.message || 'No se pudo desactivar la visibilidad.' };
  }
}

export async function updateAvailabilityPreferencesAction(days: DayOfWeek[], times: TimeOfDay[]) {
  try {
    const userId = await requireAuth();
    const availability = buildAvailability(days, times);
    await getAdminDb().collection('availablePlayers').doc(userId).set({ availability }, { merge: true });
    return { success: true, availability };
  } catch (error: any) {
    console.error('Error updating availability preferences:', error);
    return { success: false, error: error.message || 'No se pudo actualizar la disponibilidad.' };
  }
}

export async function setAvailabilityAction(availability: Availability, locationOverride?: { lat: number; lng: number }) {
  try {
    const userId = await requireAuth();
    return await upsertAvailabilityDocument(userId, availability, locationOverride);
  } catch (error: any) {
    console.error('Error setting availability:', error);
    return { success: false, error: error.message || 'No se pudo guardar la disponibilidad.' };
  }
}