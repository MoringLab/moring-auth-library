import { Request, Response, NextFunction } from 'express';
import { MoringUser } from '@moring-auth/core';

declare global {
    namespace Express {
        interface Request {
            user?: MoringUser;
        }
    }
}
interface ExpressMiddlewareOptions {
    cookieName?: string;
    issuer?: string;
    clientId?: string;
    required?: boolean;
}
/**
 * Express middleware to protect API routes with Moring SSO token validation.
 * Extracts token from cookies (requires cookie-parser) or Authorization header (Bearer token).
 */
declare function requireMoringAuth(options?: ExpressMiddlewareOptions): (req: Request, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;

export { type ExpressMiddlewareOptions, requireMoringAuth };
