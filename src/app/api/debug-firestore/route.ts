import { NextResponse } from 'next/server';
import { adminDb } from '@/firebase/admin-init';

export async function GET() {
  try {
    const snap = await adminDb.collection('socialActivities').limit(5).get();
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ success: true, count: docs.length, docs });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message, stack: e.stack }, { status: 500 });
  }
}
