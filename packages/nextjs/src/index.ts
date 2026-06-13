import { cookies } from 'next/headers';
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
