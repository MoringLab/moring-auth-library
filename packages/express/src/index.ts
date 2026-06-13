import { Request, Response, NextFunction } from 'express';
import { createMoringAuth, MoringUser } from '@moring-auth/core';

// Extend Request to include user property
declare global {
  namespace Express {
    interface Request {
      user?: MoringUser;
    }
  }
}

export interface ExpressMiddlewareOptions {
  cookieName?: string;
  issuer?: string;
  clientId?: string;
  required?: boolean;
}

/**
 * Express middleware to protect API routes with Moring SSO token validation.
 * Extracts token from cookies (requires cookie-parser) or Authorization header (Bearer token).
 */
export function requireMoringAuth(options?: ExpressMiddlewareOptions) {
  const cookieName = options?.cookieName || 'moring_session';
  const required = options?.required !== false; // default true

  return async (req: Request, res: Response, next: NextFunction) => {
    // Read cookie from standard req.cookies (cookie-parser required) or req.headers.cookie parser fallback
    let token = (req as any).cookies?.[cookieName];

    // Fallback parsing of cookie if cookie-parser is not configured
    if (!token && req.headers.cookie) {
      const cookies = req.headers.cookie.split(';').reduce((acc: any, c) => {
        const [key, val] = c.trim().split('=');
        acc[key] = val;
        return acc;
      }, {});
      token = cookies[cookieName];
    }

    // Fallback to Bearer token in Authorization header
    if (!token && req.headers.authorization) {
      const parts = req.headers.authorization.split(' ');
      if (parts[0] === 'Bearer' && parts[1]) {
        token = parts[1];
      }
    }

    if (!token) {
      if (required) {
        return res.status(401).json({ error: 'Unauthorized: Session token not found' });
      }
      return next();
    }

    try {
      const auth = createMoringAuth({
        issuer: options?.issuer,
        clientId: options?.clientId,
      });
      const user = await auth.verifyToken(token);
      req.user = user;
      next();
    } catch (err: any) {
      if (required) {
        return res.status(401).json({ error: `Unauthorized: Invalid token - ${err.message}` });
      }
      next();
    }
  };
}
