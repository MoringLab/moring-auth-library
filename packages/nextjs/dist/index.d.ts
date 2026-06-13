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

export { type GetMoringUserOptions, getMoringUser };
