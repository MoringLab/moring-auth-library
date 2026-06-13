import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createMoringAuth, MoringUser } from '@moring-auth/core';

export interface GetMoringUserOptions {
  cookieName?: string;
  issuer?: string;
  clientId?: string;
}

/**
 * Retrieves the currently authenticated Moring user from the request session cookie (Server-side).
 */
export async function getMoringUser(options?: GetMoringUserOptions): Promise<MoringUser | null> {
  const cookieName = options?.cookieName || 'moring_session';
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(cookieName)?.value;
    if (!token) return null;

    const auth = createMoringAuth({
      issuer: options?.issuer,
      clientId: options?.clientId,
    });
    return await auth.verifyToken(token);
  } catch (err) {
    // If the token is expired or invalid, return null
    return null;
  }
}

export interface HandleAuthOptions {
  successRedirectUrl?: string;
  cookieName?: string;
}

/**
 * Creates a Next.js route handler for the Moring SSO callback.
 */
export function handleAuth(options?: HandleAuthOptions) {
  return async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json({ error: 'Authorization code missing' }, { status: 400 });
    }

    try {
      const cookieStore = await cookies();
      const codeVerifier = cookieStore.get('moring_code_verifier')?.value;

      const auth = createMoringAuth();
      const tokens = await auth.handleCallback(code, { codeVerifier });
      await auth.verifyToken(tokens.id_token);

      const redirectUrl = options?.successRedirectUrl || '/';
      const response = NextResponse.redirect(new URL(redirectUrl, request.url));
      
      response.cookies.delete('moring_code_verifier');
      
      response.cookies.set(options?.cookieName || 'moring_session', tokens.id_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'development',
        sameSite: 'lax',
        maxAge: tokens.expires_in || 3600,
      });

      return response;
    } catch (err: any) {
      console.error('SSO callback failed:', err);
      return NextResponse.json(
        { error: 'SSO Authentication failed', details: err.message },
        { status: 500 }
      );
    }
  };
}
