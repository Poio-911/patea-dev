import { NextResponse } from 'next/server';

/**
 * TEMPORAL: Debug endpoint to verify Google Fit configuration
 * DELETE THIS FILE after debugging
 */
export async function GET() {
  return NextResponse.json({
    hasClientId: !!process.env.GOOGLE_FIT_CLIENT_ID,
    hasClientSecret: !!process.env.GOOGLE_FIT_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_FIT_REDIRECT_URI,
    // Show first 10 chars of client ID for verification
    clientIdPrefix: process.env.GOOGLE_FIT_CLIENT_ID?.substring(0, 20) + '...',
  });
}
