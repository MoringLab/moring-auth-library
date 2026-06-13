import { NextRequest, NextResponse } from 'next/server';

interface MoringMiddlewareOptions {
    publicPaths?: string[];
    cookieName?: string;
    redirectTo?: string;
    issuer?: string;
    clientId?: string;
}
declare function withMoringAuth(options?: MoringMiddlewareOptions): (request: NextRequest) => Promise<NextResponse<unknown>>;

export { type MoringMiddlewareOptions, withMoringAuth };
