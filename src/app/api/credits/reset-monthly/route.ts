import { NextRequest, NextResponse } from 'next/server';
import { ensureMonthlyCreditResetAction } from '@/lib/actions/server-actions';
import { z } from 'zod';

const BodySchema = z.object({ userId: z.string().min(1) });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parse = BodySchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ success: false, error: 'Invalid body' }, { status: 400 });
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
