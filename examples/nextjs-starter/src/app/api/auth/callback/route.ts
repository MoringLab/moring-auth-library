import { NextResponse } from 'next/server';
import { createMoringAuth } from '@moring-auth/core';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.json({ error: 'Authorization code missing' }, { status: 400 });
  }

  try {
    const auth = createMoringAuth();
    const tokens = await auth.handleCallback(code);
    
    // ID Token verification extracts and validates OIDC user profile
    const user = await auth.verifyToken(tokens.id_token);

    const response = NextResponse.redirect(new URL('/protected', request.url));
    
    // Save token as an HTTP-only secure cookie
    response.cookies.set('moring_session', tokens.id_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: tokens.expires_in || 3600,
    });

    return response;
  } catch (err: any) {
    console.error('SSO callback authentication failed:', err);
    return NextResponse.json(
      { error: 'SSO Authentication failed', details: err.message },
      { status: 500 }
    );
  }
}
