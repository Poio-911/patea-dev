import { NextRequest, NextResponse } from 'next/server';
import { processGoogleFitCallbackAction } from '@/lib/actions/server-actions';

/**
 * Google Fit OAuth2 Callback Handler
 * This is where Google redirects after user authorizes the app
 */
export async function GET(request: NextRequest) {
  console.log('[Google Fit Callback] Request received');

  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  console.log('[Google Fit Callback] Params:', {
    hasCode: !!code,
    hasState: !!state,
    error
  });

  // User denied access
  if (error) {
    console.log('[Google Fit Callback] User denied access');
    return NextResponse.redirect(
      new URL('/settings?google_fit_error=access_denied', request.url)
    );
  }

  // Missing parameters
  if (!code || !state) {
    console.log('[Google Fit Callback] Missing required parameters');
    return NextResponse.redirect(
      new URL('/settings?google_fit_error=invalid_callback', request.url)
    );
  }

  try {
    console.log('[Google Fit Callback] Processing authorization code...');

    // Process the authorization code
    const result = await processGoogleFitCallbackAction(code, state);

    console.log('[Google Fit Callback] Result:', result);

    if (result.success && result.tokens && result.userId) {
      console.log('[Google Fit Callback] Success! Redirecting with tokens...');
      // Encode tokens as base64 to pass via URL
      const tokensEncoded = Buffer.from(JSON.stringify(result.tokens)).toString('base64');
      return NextResponse.redirect(
        new URL(`/settings?google_fit_tokens=${encodeURIComponent(tokensEncoded)}&user_id=${result.userId}`, request.url)
      );
    } else {
      console.log('[Google Fit Callback] Failed:', result.error);
      return NextResponse.redirect(
        new URL(`/settings?google_fit_error=${encodeURIComponent(result.error || 'connection_failed')}`, request.url)
      );
    }
  } catch (error) {
    console.error('[Google Fit Callback] Exception:', error);
    return NextResponse.redirect(
      new URL('/settings?google_fit_error=server_error', request.url)
    );
  }
}
