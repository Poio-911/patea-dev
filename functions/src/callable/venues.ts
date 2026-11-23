import { normalizeCost } from '../lib/match-extras';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import {
  fetchGooglePlaceDetails,
  normalizeCountryCode,
  searchGooglePlacesAutocomplete,
  searchNominatim,
  upsertGroupVenue,
} from '../lib/places-search';
import { hasPermission, resolveGroupRole } from './group-management';

const GOOGLE_PLACES_API_KEY = defineSecret('GOOGLE_PLACES_API_KEY');
const REGION = { region: 'us-central1' } as const;

function requireAuth(request: { auth?: { uid: string } | null }): string {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debés iniciar sesión.');
  return request.auth.uid;
}

function cleanId(value: unknown): string {
  const id = typeof value === 'string' ? value.trim() : '';
  if (!id || id.includes('/') || id.length > 128) return '';
  return id;
}

function isAllowedVenuePhotoUrl(url: string, bucketName: string, groupId: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (!trimmed.startsWith('https://firebasestorage.googleapis.com/')) return false;
  return trimmed.includes(encodeURIComponent(bucketName)) &&
    (trimmed.includes(encodeURIComponent(`venue-photos/${groupId}/`)) ||
      trimmed.includes(`venue-photos%2F${groupId}%2F`) ||
      trimmed.includes('venue-cache'));
}

/**
 * Busca canchas o direcciones con Google Places Autocomplete (New), filtrando
 * por el país del usuario/grupo (`countryCode` ISO-2) y con fallback a
 * Nominatim si falta la API key o hay error transitorio.
 */
export const suggestLocations = onCall(
  { ...REGION, secrets: [GOOGLE_PLACES_API_KEY] },
  async (request) => {
    requireAuth(request);
    const query = String(request.data?.query ?? '').trim().slice(0, 120);
    if (query.length < 2) {
      return { ok: true, provider: 'none', suggestions: [] };
    }

    const countryCode = normalizeCountryCode(request.data?.countryCode);
    const sessionToken = typeof request.data?.sessionToken === 'string'
      ? request.data.sessionToken.trim().slice(0, 80)
      : undefined;
    const apiKey = GOOGLE_PLACES_API_KEY.value().trim();

    if (apiKey) {
      try {
        const suggestions = await searchGooglePlacesAutocomplete({
          apiKey,
          query,
          countryCode,
          sessionToken,
        });
        return { ok: true, provider: 'google', suggestions };
      } catch (err) {
        console.warn('Google Places autocomplete fallback to Nominatim', {
          message: err instanceof Error ? err.message : 'unknown',
        });
      }
    }

    const suggestions = await searchNominatim(query, countryCode);
    return { ok: true, provider: 'nominatim', suggestions };
  },
);

/**
 * Resuelve coordenadas, dirección completa y foto cacheada en Storage para un
 * `placeId` seleccionado en Google Places (o conserva un resultado OSM).
 */
export const resolvePlaceLocation = onCall(
  { ...REGION, secrets: [GOOGLE_PLACES_API_KEY] },
  async (request) => {
    const uid = requireAuth(request);
    const placeId = String(request.data?.placeId ?? '').trim().slice(0, 180);
    const sessionToken = typeof request.data?.sessionToken === 'string'
      ? request.data.sessionToken.trim().slice(0, 80)
      : undefined;
    const groupId = cleanId(request.data?.groupId);
    const fallbackName = String(request.data?.fallbackName ?? '').trim().slice(0, 120);
    const fallbackAddress = String(request.data?.fallbackAddress ?? '').trim().slice(0, 240);
    const fallbackLat = Number(request.data?.fallbackLat ?? 0) || 0;
    const fallbackLng = Number(request.data?.fallbackLng ?? 0) || 0;

    if (!placeId && !fallbackName) {
      throw new HttpsError('invalid-argument', 'Falta la ubicación a resolver.');
    }

    const db = admin.firestore();

    // Si el grupo ya guardó este placeId con foto y coordenadas, reutilizamos sin
    // gastar ninguna llamada a Place Details ni Place Photos.
    if (groupId && placeId) {
      const existingSnap = await db
        .collection('venues')
        .where('groupId', '==', groupId)
        .where('placeId', '==', placeId)
        .limit(1)
        .get();
      if (!existingSnap.empty) {
        const v = existingSnap.docs[0].data() ?? {};
        const lat = Number(v.location?.lat ?? 0) || 0;
        const lng = Number(v.location?.lng ?? 0) || 0;
        const photoUrl = String(v.photoUrl ?? (Array.isArray(v.photos) ? v.photos[0] : '') ?? '');
        if (lat !== 0 && lng !== 0 && photoUrl) {
          return {
            ok: true,
            place: {
              placeId,
              name: String(v.name ?? fallbackName),
              address: String(v.address ?? fallbackAddress),
              label: String(v.name ?? fallbackName),
              lat,
              lng,
              photoUrl,
            },
          };
        }
      }
    }

    const apiKey = GOOGLE_PLACES_API_KEY.value().trim();
    if (apiKey && placeId && !placeId.startsWith('osm:')) {
      try {
        const resolved = await fetchGooglePlaceDetails({
          apiKey,
          placeId,
          sessionToken,
        });
        if (resolved) {
          if (groupId) {
            await upsertGroupVenue(db, {
              groupId,
              uid,
              name: resolved.name,
              address: resolved.address,
              lat: resolved.lat,
              lng: resolved.lng,
              placeId: resolved.placeId,
              photoUrl: resolved.photoUrl,
            }).catch(() => {});
          }
          return { ok: true, place: resolved };
        }
      } catch (err) {
        console.warn('Google Place Details failed, using fallback coordinates', {
          message: err instanceof Error ? err.message : 'unknown',
        });
      }
    }

    return {
      ok: true,
      place: {
        placeId,
        name: fallbackName || fallbackAddress || 'Cancha',
        address: fallbackAddress || fallbackName,
        label: fallbackName || fallbackAddress,
        lat: fallbackLat,
        lng: fallbackLng,
        photoUrl: '',
      },
    };
  },
);

/**
 * Actualiza nombre, foto personalizada o costo por partido de una cancha guardada
 * en el grupo.
 */
export const updateGroupVenue = onCall(REGION, async (request) => {
  const uid = requireAuth(request);
  const groupId = cleanId(request.data?.groupId);
  const venueId = cleanId(request.data?.venueId);
  if (!groupId || !venueId) {
    throw new HttpsError('invalid-argument', 'Grupo o cancha inválidos.');
  }

  const db = admin.firestore();
  const [groupSnap, venueSnap] = await Promise.all([
    db.doc(`groups/${groupId}`).get(),
    db.doc(`venues/${venueId}`).get(),
  ]);
  if (!groupSnap.exists) throw new HttpsError('not-found', 'Grupo no encontrado.');
  if (!venueSnap.exists) throw new HttpsError('not-found', 'Cancha no encontrada.');

  const group = groupSnap.data()!;
  const venue = venueSnap.data()!;
  if (venue.groupId !== groupId) {
    throw new HttpsError('permission-denied', 'La cancha no pertenece a este grupo.');
  }

  const role = resolveGroupRole(group, uid);
  const isCreator = venue.createdBy === uid;
  if (!isCreator && (!role || !hasPermission(role, 'teams.edit'))) {
    throw new HttpsError('permission-denied', 'No tenés permiso para editar canchas de este grupo.');
  }

  const patch: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };

  if (typeof request.data?.name === 'string') {
    const name = request.data.name.trim().slice(0, 120);
    if (name.length < 2) {
      throw new HttpsError('invalid-argument', 'El nombre debe tener al menos 2 caracteres.');
    }
    patch.name = name;
    patch.customName = true;
  }

  if (typeof request.data?.photoUrl === 'string') {
    const photoUrl = request.data.photoUrl.trim();
    if (!photoUrl) {
      patch.photoUrl = admin.firestore.FieldValue.delete();
      patch.photos = [];
      patch.customPhoto = false;
    } else {
      const bucketName = admin.storage().bucket().name;
      if (!isAllowedVenuePhotoUrl(photoUrl, bucketName, groupId)) {
        throw new HttpsError('invalid-argument', 'La foto debe subirse dentro del almacenamiento del grupo.');
      }
      const existingPhotos = Array.isArray(venue.photos)
        ? venue.photos.filter((p: unknown): p is string => typeof p === 'string' && p !== photoUrl)
        : [];
      patch.photoUrl = photoUrl;
      patch.photos = [photoUrl, ...existingPhotos].slice(0, 5);
      patch.customPhoto = true;
    }
  }

  // Costo por partido de la cancha. Presente = se cambia (monto 0 lo saca);
  // ausente = no se toca.
  if ('costPerMatch' in (request.data ?? {})) {
    let cost;
    try {
      cost = normalizeCost(request.data.costPerMatch, request.data.costCurrency);
    } catch (e) {
      throw new HttpsError('invalid-argument', e instanceof Error ? e.message : 'Costo no válido.');
    }
    if (cost) {
      patch.costPerMatch = cost.total;
      patch.costCurrency = cost.currency;
    } else {
      patch.costPerMatch = admin.firestore.FieldValue.delete();
      patch.costCurrency = admin.firestore.FieldValue.delete();
    }
  }

  await venueSnap.ref.update(patch);
  return { ok: true };
});

/**
 * Guarda el país por defecto de un grupo (código ISO-2, ej. "UY", "AR") para
 * filtrar búsquedas de canchas.
 */
export const setGroupCountry = onCall(REGION, async (request) => {
  const uid = requireAuth(request);
  const groupId = cleanId(request.data?.groupId);
  const countryCode = normalizeCountryCode(request.data?.countryCode);
  if (!groupId || !countryCode) {
    throw new HttpsError('invalid-argument', 'Grupo o país inválidos.');
  }

  const db = admin.firestore();
  const groupRef = db.doc(`groups/${groupId}`);
  const groupSnap = await groupRef.get();
  if (!groupSnap.exists) throw new HttpsError('not-found', 'Grupo no encontrado.');

  const group = groupSnap.data()!;
  const role = resolveGroupRole(group, uid);
  if (!role || (role !== 'admin' && role !== 'moderator')) {
    throw new HttpsError('permission-denied', 'Solo administradores pueden cambiar el país del grupo.');
  }

  await groupRef.update({
    countryCode: countryCode.toUpperCase(),
    updatedAt: new Date().toISOString(),
  });
  return { ok: true, countryCode: countryCode.toUpperCase() };
});
