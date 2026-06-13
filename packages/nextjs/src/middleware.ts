import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMoringAuth } from '@moring-auth/core';

export interface MoringMiddlewareOptions {
  publicPaths?: string[];
  cookieName?: string;
  redirectTo?: string;
  issuer?: string;
  clientId?: string;
}

export function withMoringAuth(options?: MoringMiddlewareOptions) {
  const cookieName = options?.cookieName || 'moring_session';
  const publicPaths = options?.publicPaths || [];
  const redirectTo = options?.redirectTo || '/';

  return async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Standard Next.js patterns to ignore
    if (
      pathname.startsWith('/_next') ||
      pathname.startsWith('/static') ||
      pathname.includes('.')
    ) {
      return NextResponse.next();
    }

    // Check if the current route is a public path
    const isPublic = publicPaths.some((p) => {
      if (p.endsWith('/*')) {
        return pathname.startsWith(p.slice(0, -2));
      }
      return pathname === p;
    });

    if (isPublic) {
      return NextResponse.next();
    }

    const token = request.cookies.get(cookieName)?.value;

    if (!token) {
      const url = request.nextUrl.clone();
      url.pathname = redirectTo;
      url.searchParams.set('callbackUrl', request.nextUrl.pathname);
      return NextResponse.redirect(url);
    }

    try {
      const auth = createMoringAuth({
        issuer: options?.issuer,
        clientId: options?.clientId,
      });
      // Verifying ID token or Access Token stored in the cookie
      await auth.verifyToken(token);
      return NextResponse.next();
    } catch (err) {
      const url = request.nextUrl.clone();
      url.pathname = redirectTo;
      url.searchParams.set('callbackUrl', request.nextUrl.pathname);
      const response = NextResponse.redirect(url);
      response.cookies.delete(cookieName);
      return response;
    }
  };
}
