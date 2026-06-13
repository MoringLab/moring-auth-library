import { NextResponse } from 'next/server';
import { MoringUser } from '@moring-auth/core';

interface GetMoringUserOptions {
    cookieName?: string;
    issuer?: string;
    clientId?: string;
}
/**
 * Retrieves the currently authenticated Moring user from the request session cookie (Server-side).
 */
declare function getMoringUser(options?: GetMoringUserOptions): Promise<MoringUser | null>;
interface HandleAuthOptions {
    successRedirectUrl?: string;
    cookieName?: string;
}
/**
 * Creates a Next.js route handler for the Moring SSO callback.
 */
declare function handleAuth(options?: HandleAuthOptions): (request: Request) => Promise<NextResponse<unknown>>;

export { type GetMoringUserOptions, type HandleAuthOptions, getMoringUser, handleAuth };
