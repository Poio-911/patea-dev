'use server';

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getServerSession } from '@/lib/auth/get-server-session';
import type { SavedLocation } from '@/lib/types';
import * as geohash from 'ngeohash';

// Initialize Firebase Admin
if (getApps().length === 0) {
  const serviceAccountJson = JSON.parse(
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}'
  );

  initializeApp({
    credential: cert(serviceAccountJson),
    projectId: serviceAccountJson.project_id,
  });
}

const db = getFirestore();

/**
 * Save user's location for availability feature.
 * This persists the location so we don't need to ask for geolocation every time.
 */
export async function saveUserLocationAction(
  lat: number,
  lng: number,
  label?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession();
    if (!session?.user?.uid) {
      return { success: false, error: 'No autenticado' };
    }

    const hash = geohash.encode(lat, lng);

    const savedLocation: SavedLocation & { geohash?: string } = {
      lat,
      lng,
      label,
      savedAt: new Date().toISOString(),
      geohash: hash,
    };

    const batch = db.batch();

    // 1. Update User Profile
    const userRef = db.collection('users').doc(session.user.uid);
    batch.set(userRef, { savedLocation }, { merge: true });

    // 2. Update AvailablePlayer (if exists) implementation of "Unified Location"
    // We assume the user might be in 'availablePlayers' collection.
    // Ideally this logic should be in a separate trigger, but for now we do it here to ensure consistency.
    const availablePlayerRef = db.collection('availablePlayers').doc(session.user.uid);
    // We use set with merge: true to avoid overwriting other fields if it exists, 
    // but we only want to update if the player IS already available. 
    // Checking existence inside a batch is not possible directly without a transaction.
    // For simplicity/performance in this action, we can try to update it blindly 
    // OR we just update the user profile and let a Cloud Function sync it.
    // However, since we don't have Cloud Functions here, we should try to update it if it exists.

    // Let's do a transactional update to be safe and correct.
    await db.runTransaction(async (t) => {
      t.set(userRef, { savedLocation }, { merge: true });

      const apDoc = await t.get(availablePlayerRef);
      if (apDoc.exists) {
        t.update(availablePlayerRef, {
          'location.lat': lat,
          'location.lng': lng,
          'location.geohash': hash
        });
      }
    });

    return { success: true };
  } catch (error) {
    console.error('Error saving location:', error);
    return { success: false, error: 'Error al guardar la ubicación' };
  }
}

/**
 * Get user's saved location.
 */
export async function getUserLocationAction(): Promise<{
  success: boolean;
  location?: SavedLocation;
  error?: string;
}> {
  try {
    const session = await getServerSession();
    if (!session?.user?.uid) {
      return { success: false, error: 'No autenticado' };
    }

    const userDoc = await db.collection('users').doc(session.user.uid).get();
    const userData = userDoc.data();

    if (userData?.savedLocation) {
      return { success: true, location: userData.savedLocation as SavedLocation };
    }

    return { success: true, location: undefined };
  } catch (error) {
    console.error('Error getting location:', error);
    return { success: false, error: 'Error al obtener la ubicación' };
  }
}

/**
 * Reverse geocode coordinates to get a human-readable label.
 * Uses Google Maps Geocoding API.
 */
export async function reverseGeocodeAction(
  lat: number,
  lng: number
): Promise<{ success: boolean; label?: string; error?: string }> {
  try {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return { success: false, error: 'API key not configured' };
    }

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}&language=es`
    );

    if (!response.ok) {
      return { success: false, error: 'Error en geocoding' };
    }

    const data = await response.json();

    if (data.status === 'OK' && data.results.length > 0) {
      // Try to find a locality or neighborhood
      const result = data.results[0];
      const components = result.address_components || [];

      let neighborhood = '';
      let locality = '';
      let adminArea = '';

      for (const component of components) {
        const types = component.types || [];
        if (types.includes('neighborhood') || types.includes('sublocality')) {
          neighborhood = component.long_name;
        }
        if (types.includes('locality')) {
          locality = component.long_name;
        }
        if (types.includes('administrative_area_level_1')) {
          adminArea = component.short_name;
        }
      }

      // Build a short label like "Palermo, Buenos Aires"
      const parts = [neighborhood || locality, adminArea].filter(Boolean);
      const label = parts.join(', ') || result.formatted_address?.split(',')[0] || 'Ubicación guardada';

      return { success: true, label };
    }

    return { success: true, label: 'Ubicación guardada' };
  } catch (error) {
    console.error('Error in reverse geocoding:', error);
    return { success: false, error: 'Error al obtener dirección' };
  }
}
