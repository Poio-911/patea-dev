import { createHash, randomUUID } from 'crypto';
import * as admin from 'firebase-admin';

export type LocationSuggestion = {
  placeId: string;
  name: string;
  address: string;
  label: string;
  lat?: number;
  lng?: number;
};

export type ResolvedPlaceLocation = {
  placeId: string;
  name: string;
  address: string;
  label: string;
  lat: number;
  lng: number;
  photoUrl: string;
};

const ISO2_RE = /^[a-z]{2}$/i;
const NOMINATIM_USER_AGENT = 'PateaMobile/1.0 (+https://patea.app)';
const PLACE_DETAILS_FIELD_MASK = 'id,displayName,formattedAddress,location,photos';

export function normalizeCountryCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().toLowerCase();
  if (!ISO2_RE.test(trimmed)) return null;
  return trimmed;
}

export function safePlaceKey(raw: string): string {
  const cleaned = raw.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  if (cleaned.length >= 4 && cleaned.length <= 120) return cleaned;
  return createHash('sha256').update(raw.trim()).digest('hex');
}

export function venueDocId(groupId: string, placeId: string, name: string, lat: number, lng: number): string {
  const key = placeId.trim()
    ? ['place', groupId, placeId.trim()]
    : ['coord', groupId, name.trim().toLowerCase(), lat.toFixed(4), lng.toFixed(4)];
  return createHash('sha256').update(JSON.stringify(key)).digest('hex').slice(0, 32);
}

export function buildNominatimUri(query: string, countryCode: string | null): string {
  const params = new URLSearchParams({
    format: 'json',
    limit: '6',
    q: query.trim(),
  });
  if (countryCode) {
    params.set('countrycodes', countryCode);
  }
  return `https://nominatim.openstreetmap.org/search?${params.toString()}`;
}

export function parseGoogleAutocompleteSuggestions(payload: unknown): LocationSuggestion[] {
  if (!payload || typeof payload !== 'object') return [];
  const raw = (payload as Record<string, unknown>).suggestions;
  if (!Array.isArray(raw)) return [];

  const out: LocationSuggestion[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const pred = (item as Record<string, unknown>).placePrediction;
    if (!pred || typeof pred !== 'object') continue;
    const p = pred as Record<string, unknown>;
    const placeId = typeof p.placeId === 'string' ? p.placeId.trim() : '';
    if (!placeId) continue;

    const structured = p.structuredFormat && typeof p.structuredFormat === 'object'
      ? (p.structuredFormat as Record<string, unknown>)
      : null;
    const mainText = structured?.mainText && typeof structured.mainText === 'object'
      ? String((structured.mainText as Record<string, unknown>).text ?? '').trim()
      : '';
    const secondaryText = structured?.secondaryText && typeof structured.secondaryText === 'object'
      ? String((structured.secondaryText as Record<string, unknown>).text ?? '').trim()
      : '';
    const fullText = p.text && typeof p.text === 'object'
      ? String((p.text as Record<string, unknown>).text ?? '').trim()
      : '';

    const name = mainText || fullText || secondaryText;
    const address = secondaryText || fullText;
    const label = mainText && secondaryText && !mainText.includes(secondaryText)
      ? `${mainText} · ${secondaryText}`
      : (fullText || name);
    if (!label) continue;

    out.push({ placeId, name, address, label });
  }
  return out;
}

export function parseGooglePlaceDetails(payload: unknown): {
  placeId: string;
  name: string;
  address: string;
  label: string;
  lat: number;
  lng: number;
  photoName: string;
} | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  const placeId = typeof p.id === 'string' ? p.id.trim() : '';
  const displayName = p.displayName && typeof p.displayName === 'object'
    ? String((p.displayName as Record<string, unknown>).text ?? '').trim()
    : '';
  const formattedAddress = typeof p.formattedAddress === 'string' ? p.formattedAddress.trim() : '';
  const loc = p.location && typeof p.location === 'object'
    ? (p.location as Record<string, unknown>)
    : null;
  const lat = Number(loc?.latitude ?? 0);
  const lng = Number(loc?.longitude ?? 0);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
    return null;
  }

  let photoName = '';
  if (Array.isArray(p.photos) && p.photos.length > 0) {
    const first = p.photos[0];
    if (first && typeof first === 'object' && typeof (first as Record<string, unknown>).name === 'string') {
      photoName = String((first as Record<string, unknown>).name).trim();
    }
  }

  const name = displayName || formattedAddress || 'Cancha';
  const address = formattedAddress || name;
  const label = displayName && formattedAddress && !formattedAddress.toLowerCase().startsWith(displayName.toLowerCase())
    ? `${displayName} · ${formattedAddress}`
    : (displayName || formattedAddress);

  return { placeId, name, address, label, lat, lng, photoName };
}

export async function searchGooglePlacesAutocomplete(params: {
  apiKey: string;
  query: string;
  countryCode: string | null;
  sessionToken?: string;
}): Promise<LocationSuggestion[]> {
  const body: Record<string, unknown> = {
    input: params.query.trim(),
    languageCode: 'es',
  };
  if (params.countryCode) {
    body.includedRegionCodes = [params.countryCode];
  }
  if (params.sessionToken && params.sessionToken.trim()) {
    body.sessionToken = params.sessionToken.trim();
  }

  const resp = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': params.apiKey,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  if (!resp.ok) {
    throw new Error(`Places Autocomplete HTTP ${resp.status}`);
  }
  const json = await resp.json();
  return parseGoogleAutocompleteSuggestions(json);
}

export async function searchNominatim(query: string, countryCode: string | null): Promise<LocationSuggestion[]> {
  const resp = await fetch(buildNominatimUri(query, countryCode), {
    headers: { 'User-Agent': NOMINATIM_USER_AGENT },
    signal: AbortSignal.timeout(8000),
  });
  if (!resp.ok) return [];
  const raw = await resp.json();
  if (!Array.isArray(raw)) return [];

  const out: LocationSuggestion[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const m = item as Record<string, unknown>;
    const displayName = String(m.display_name ?? '').trim();
    if (!displayName) continue;
    const parts = displayName.split(',').map((s) => s.trim()).filter(Boolean);
    const name = parts[0] || displayName;
    const address = parts.slice(1, 4).join(', ') || displayName;
    const lat = Number(m.lat ?? 0) || 0;
    const lng = Number(m.lon ?? 0) || 0;
    const placeId = `osm:${String(m.osm_type ?? 'node')}:${String(m.osm_id ?? '')}`;
    out.push({ placeId, name, address, label: displayName, lat, lng });
  }
  return out;
}

export function buildStorageDownloadUrl(bucketName: string, path: string, token: string): string {
  return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucketName)}/o/${encodeURIComponent(path)}?alt=media&token=${encodeURIComponent(token)}`;
}

export async function cachePlacePhotoToStorage(params: {
  placeId: string;
  photoName: string;
  apiKey: string;
}): Promise<string> {
  if (!params.photoName || !params.apiKey) return '';
  const bucket = admin.storage().bucket();
  const objectPath = `venue-cache/${safePlaceKey(params.placeId)}.jpg`;
  const file = bucket.file(objectPath);

  const [exists] = await file.exists();
  if (exists) {
    const [meta] = await file.getMetadata();
    const rawTokens = String(meta?.metadata?.firebaseStorageDownloadTokens ?? '').trim();
    const existingToken = rawTokens.split(',').map((s) => s.trim()).find(Boolean);
    if (existingToken) {
      return buildStorageDownloadUrl(bucket.name, objectPath, existingToken);
    }
    const token = randomUUID();
    await file.setMetadata({ metadata: { firebaseStorageDownloadTokens: token } });
    return buildStorageDownloadUrl(bucket.name, objectPath, token);
  }

  const mediaUrl = `https://places.googleapis.com/v1/${params.photoName}/media?maxWidthPx=800`;
  const resp = await fetch(mediaUrl, {
    headers: { 'X-Goog-Api-Key': params.apiKey },
    redirect: 'follow',
    signal: AbortSignal.timeout(10000),
  });
  if (!resp.ok) return '';

  const contentType = resp.headers.get('content-type') || 'image/jpeg';
  if (!contentType.toLowerCase().startsWith('image/')) return '';
  const buf = Buffer.from(await resp.arrayBuffer());
  if (buf.length === 0 || buf.length > 5 * 1024 * 1024) return '';

  const token = randomUUID();
  await file.save(buf, {
    contentType,
    metadata: {
      cacheControl: 'public, max-age=31536000',
      metadata: { firebaseStorageDownloadTokens: token },
    },
  });
  return buildStorageDownloadUrl(bucket.name, objectPath, token);
}

export async function fetchGooglePlaceDetails(params: {
  apiKey: string;
  placeId: string;
  sessionToken?: string;
}): Promise<ResolvedPlaceLocation | null> {
  const cleanId = params.placeId.trim();
  if (!cleanId || cleanId.startsWith('osm:')) return null;

  const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(cleanId)}`);
  url.searchParams.set('languageCode', 'es');
  if (params.sessionToken && params.sessionToken.trim()) {
    url.searchParams.set('sessionToken', params.sessionToken.trim());
  }

  const resp = await fetch(url.toString(), {
    headers: {
      'X-Goog-Api-Key': params.apiKey,
      'X-Goog-FieldMask': PLACE_DETAILS_FIELD_MASK,
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!resp.ok) {
    throw new Error(`Place Details HTTP ${resp.status}`);
  }
  const parsed = parseGooglePlaceDetails(await resp.json());
  if (!parsed) return null;

  let photoUrl = '';
  if (parsed.photoName) {
    try {
      photoUrl = await cachePlacePhotoToStorage({
        placeId: parsed.placeId || cleanId,
        photoName: parsed.photoName,
        apiKey: params.apiKey,
      });
    } catch {
      photoUrl = '';
    }
  }

  return {
    placeId: parsed.placeId || cleanId,
    name: parsed.name,
    address: parsed.address,
    label: parsed.label,
    lat: parsed.lat,
    lng: parsed.lng,
    photoUrl,
  };
}

export async function upsertGroupVenue(
  db: admin.firestore.Firestore,
  input: {
    groupId: string | null | undefined;
    uid: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    placeId: string;
    photoUrl?: string;
  },
): Promise<string | null> {
  const groupId = typeof input.groupId === 'string' ? input.groupId.trim() : '';
  const name = input.name.trim();
  if (!groupId || !name || (input.lat === 0 && input.lng === 0)) return null;

  const id = venueDocId(groupId, input.placeId, name, input.lat, input.lng);
  const ref = db.collection('venues').doc(id);
  const now = new Date().toISOString();
  const cleanPhoto = typeof input.photoUrl === 'string' ? input.photoUrl.trim() : '';

  const snap = await ref.get();
  if (snap.exists) {
    const existing = snap.data() ?? {};
    const hasCustom = existing.customPhoto === true;
    const existingPhotos = Array.isArray(existing.photos) ? existing.photos.filter((p): p is string => typeof p === 'string' && !!p) : [];
    const patch: Record<string, unknown> = {
      name: existing.customName === true ? existing.name : name,
      address: input.address.trim() || existing.address || name,
      location: { lat: input.lat, lng: input.lng },
      placeId: input.placeId.trim() || existing.placeId || '',
      usageCount: admin.firestore.FieldValue.increment(1),
      lastUsedAt: now,
      updatedAt: now,
    };
    if (!hasCustom && cleanPhoto && !existingPhotos.includes(cleanPhoto)) {
      patch.photoUrl = cleanPhoto;
      patch.photos = [cleanPhoto, ...existingPhotos].slice(0, 5);
    }
    await ref.update(patch);
    return id;
  }

  await ref.set({
    id,
    groupId,
    name,
    address: input.address.trim() || name,
    location: { lat: input.lat, lng: input.lng },
    placeId: input.placeId.trim(),
    pricePerHour: 0,
    currency: 'UYU',
    photos: cleanPhoto ? [cleanPhoto] : [],
    ...(cleanPhoto ? { photoUrl: cleanPhoto } : {}),
    usageCount: 1,
    lastUsedAt: now,
    createdBy: input.uid,
    createdAt: now,
  });
  return id;
}
