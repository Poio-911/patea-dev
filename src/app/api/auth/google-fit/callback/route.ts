import { NextRequest, NextResponse } from 'next/server';
import { processGoogleFitCallbackAction } from '@/lib/actions/google-fit-actions';

/**
 * Google Fit OAuth2 Callback Handler
 * This is where Google redirects after user authorizes the app
 */
export async function GET(request: NextRequest) {


  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');



  // User denied access
  if (error) {

    return NextResponse.redirect(
      new URL('/settings?google_fit_error=access_denied', request.url)
    );
  }

  // Missing parameters
  if (!code || !state) {

    return NextResponse.redirect(
      new URL('/settings?google_fit_error=invalid_callback', request.url)
    );
  }

  try {


    // Process the authorization code
    const result = await processGoogleFitCallbackAction(code, state);



    if (result.success && result.tokens && result.userId) {

      // Encode tokens as base64 to pass via URL
      const tokensEncoded = Buffer.from(JSON.stringify(result.tokens)).toString('base64');
      return NextResponse.redirect(
        new URL(`/settings?google_fit_tokens=${encodeURIComponent(tokensEncoded)}&user_id=${result.userId}`, request.url)
      );
    } else {

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
