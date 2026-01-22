import { NextResponse } from 'next/server';
import { seedActivitiesAction } from '@/lib/actions/social-actions';
import { z } from 'zod';

const BodySchema = z.object({
  userId: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const parse = BodySchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', issues: parse.error.issues },
        { status: 400 }
      );
    }
    const result = await seedActivitiesAction(parse.data.userId);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Unknown error' }, { status: 500 });
  }
}
