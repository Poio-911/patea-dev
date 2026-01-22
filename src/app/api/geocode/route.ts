import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const BodySchema = z.object({ address: z.string().min(5) });

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parse = BodySchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ success: false, error: 'Invalid address', issues: parse.error.issues }, { status: 400 });
    }
    const q = encodeURIComponent(parse.data.address);
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${q}`;
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'PateaApp/1.0 (+https://example.com)'
      },
      cache: 'no-store',
    });
    if (!resp.ok) {
      return NextResponse.json({ success: false, error: 'Geocoding error' }, { status: 502 });
    }
    const json = await resp.json();
    if (!Array.isArray(json) || json.length === 0) {
      return NextResponse.json({ success: false, error: 'No results' }, { status: 404 });
    }
    const r = json[0];
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.lon);
    const name = r.display_name as string;
    const placeId = `osm:${r.osm_type}:${r.osm_id}`;
    return NextResponse.json({ success: true, lat, lng, name, placeId });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Server error' }, { status: 500 });
  }
}
