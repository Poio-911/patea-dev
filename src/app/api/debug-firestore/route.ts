import { NextResponse } from 'next/server';
import { getAdminDb } from '../../../firebase/admin-init';

export async function GET() {
  // Restrict to development environments
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }
  try {
    const snap = await getAdminDb().collection('socialActivities').limit(5).get();
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ success: true, count: docs.length, docs });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message, stack: e.stack }, { status: 500 });
  }
}
