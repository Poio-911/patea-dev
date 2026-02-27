import { NextRequest, NextResponse } from 'next/server';
import { ensureMonthlyCreditResetAction } from '@/lib/actions/server-actions';
import { getAdminAuth } from '@/firebase/admin-init';
import { z } from 'zod';

const BodySchema = z.object({ userId: z.string().min(1) });

export async function POST(req: NextRequest) {
  try {
    // Audit 1.4: Verify authentication
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.split('Bearer ')[1];

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const parse = BodySchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ success: false, error: 'Invalid body' }, { status: 400 });
    }

    // Verify the token and ensure it matches the requested userId
    try {
      const decoded = await getAdminAuth().verifyIdToken(token);
      if (decoded.uid !== parse.data.userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    } catch (authError) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const result = await ensureMonthlyCreditResetAction(parse.data.userId);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error || 'Unknown error' }, { status: 500 });
    }

    return NextResponse.json({ success: true, updated: result.updated });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Unknown error' }, { status: 500 });
  }
}
