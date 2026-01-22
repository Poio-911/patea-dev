import { NextResponse } from 'next/server';

// Mercado Pago integration is disabled. Return 410 Gone for any request.
export async function POST() {
  return NextResponse.json(
    { error: 'Mercado Pago integration disabled' },
    { status: 410 }
  );
}

export async function GET() {
  return NextResponse.json(
    { status: 'disabled', message: 'Mercado Pago integration disabled' },
    { status: 410 }
  );
}
