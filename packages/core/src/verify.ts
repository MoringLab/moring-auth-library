import { createRemoteJWKSet, jwtVerify } from 'jose';
import { MoringUser } from './types';

const jwksCache = new Map<string, any>();

function getOrCreateJwks(jwksUri: string) {
  if (!jwksCache.has(jwksUri)) {
    jwksCache.set(jwksUri, createRemoteJWKSet(new URL(jwksUri)));
  }
  return jwksCache.get(jwksUri)!;
}

export async function verifyIdToken(
  idToken: string,
  options: { jwksUri: string; issuer: string; clientId: string }
): Promise<MoringUser> {
  const jwks = getOrCreateJwks(options.jwksUri);

  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: options.issuer,
    audience: options.clientId,
  });

  // Extract OIDC claim values to construct standardized MoringUser object
  return {
    id: (payload.sub || payload.id) as string,
    email: payload.email as string,
    name: (payload.name || payload.preferred_username) as string,
    picture: (payload.picture || payload.avatar_url) as string,
    ...payload,
  };
}
