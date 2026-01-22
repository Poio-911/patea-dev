import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get('q');
    if (!q || q.length < 3) {
      return NextResponse.json({ success: true, suggestions: [] });
    }
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`;
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'PateaApp/1.0 (+https://example.com)' },
      cache: 'no-store',
    });
    if (!resp.ok) {
      return NextResponse.json({ success: false, error: 'Geocoding error' }, { status: 502 });
    }
    const json = await resp.json();
    const suggestions = Array.isArray(json) ? json.map((r: any) => ({
      label: r.display_name as string,
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      placeId: `osm:${r.osm_type}:${r.osm_id}`,
    })) : [];
    return NextResponse.json({ success: true, suggestions });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Server error' }, { status: 500 });
  }
}
