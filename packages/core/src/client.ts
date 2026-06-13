import { MoringAuthConfig, OidcDiscoveryDoc, TokenResponse, MoringUser } from './types';
import { verifyIdToken } from './verify';

export class MoringAuth {
  private config: MoringAuthConfig;
  private discoveryPromise: Promise<OidcDiscoveryDoc> | null = null;

  constructor(config: MoringAuthConfig) {
    this.config = config;
  }

  /**
   * Fetches OIDC discovery document and caches it.
   */
  async discover(): Promise<OidcDiscoveryDoc> {
    if (this.discoveryPromise) return this.discoveryPromise;

    this.discoveryPromise = (async () => {
      const issuerUrl = this.config.issuer.replace(/\/$/, '');
      const discoveryUrl = `${issuerUrl}/.well-known/openid-configuration`;
      try {
        const res = await fetch(discoveryUrl);
        if (!res.ok) {
          throw new Error(`Failed to fetch OIDC configuration from ${discoveryUrl}: ${res.statusText}`);
        }
        return (await res.json()) as OidcDiscoveryDoc;
      } catch (err) {
        this.discoveryPromise = null; // reset cache on failure so retry is possible
        throw err;
      }
    })();

    return this.discoveryPromise;
  }

  /**
   * Generates a login URL along with generated state, nonce, and PKCE parameters.
   */
  async getLoginUrl(options?: {
    state?: string;
    nonce?: string;
    scope?: string[];
    codeChallenge?: string;
    codeChallengeMethod?: string;
  }): Promise<{
    url: string;
    state: string;
    nonce: string;
    codeVerifier?: string;
  }> {
    const discovery = await this.discover();
    const state = options?.state || this.generateRandomString(16);
    const nonce = options?.nonce || this.generateRandomString(16);
    const scope = options?.scope || (this.config.scope ? this.config.scope.split(' ') : ['openid', 'email', 'profile']);

    const url = new URL(discovery.authorization_endpoint);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', this.config.clientId);
    url.searchParams.set('redirect_uri', this.config.redirectUri);
    url.searchParams.set('scope', scope.join(' '));
    url.searchParams.set('state', state);
    url.searchParams.set('nonce', nonce);

    let codeVerifier: string | undefined;
    if (options?.codeChallenge) {
      url.searchParams.set('code_challenge', options.codeChallenge);
      url.searchParams.set('code_challenge_method', options.codeChallengeMethod || 'S256');
    } else if (options?.codeChallengeMethod === 'S256' || !this.config.clientSecret) {
      // Auto-generate PKCE verifier if clientSecret is absent (typical SPA client) or S256 explicitly requested
      codeVerifier = this.generateRandomString(43);
      const codeChallenge = await this.generateCodeChallenge(codeVerifier);
      url.searchParams.set('code_challenge', codeChallenge);
      url.searchParams.set('code_challenge_method', 'S256');
    }

    return { url: url.toString(), state, nonce, codeVerifier };
  }

  /**
   * Exchanges authorization code for access and ID tokens.
   */
  async handleCallback(code: string, options?: { codeVerifier?: string }): Promise<TokenResponse> {
    const discovery = await this.discover();
    const body = new URLSearchParams();
    body.set('grant_type', 'authorization_code');
    body.set('code', code);
    body.set('redirect_uri', this.config.redirectUri);
    body.set('client_id', this.config.clientId);
    if (this.config.clientSecret) {
      body.set('client_secret', this.config.clientSecret);
    }
    if (options?.codeVerifier) {
      body.set('code_verifier', options.codeVerifier);
    }

    const res = await fetch(discovery.token_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to exchange authorization code: ${res.statusText} - ${errorText}`);
    }

    return (await res.json()) as TokenResponse;
  }

  private async generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    
    let hash: ArrayBuffer;
    if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
      hash = await crypto.subtle.digest('SHA-256', data);
    } else if (typeof globalThis !== 'undefined' && (globalThis as any).crypto?.subtle?.digest) {
      hash = await (globalThis as any).crypto.subtle.digest('SHA-256', data);
    } else {
      // In node environments where web crypto is not global, fallback to Node's crypto
      try {
        const nodeCrypto = require('crypto');
        const buffer = nodeCrypto.createHash('sha256').update(data).digest();
        hash = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
      } catch (err) {
        throw new Error('Web Crypto API (crypto.subtle.digest) is not supported in this runtime.');
      }
    }

    return this.base64UrlEncode(new Uint8Array(hash));
  }

  private base64UrlEncode(array: Uint8Array): string {
    if (typeof btoa !== 'undefined') {
      let binary = '';
      const len = array.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(array[i]);
      }
      return btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
    } else {
      // Node.js fallback
      return Buffer.from(array).toString('base64url');
    }
  }

  /**
   * Verifies ID Token using remote JWKS keys.
   */
  async verifyToken(idToken: string): Promise<MoringUser> {
    const discovery = await this.discover();
    return verifyIdToken(idToken, {
      jwksUri: discovery.jwks_uri,
      issuer: discovery.issuer,
      clientId: this.config.clientId,
    });
  }

  /**
   * Extracts user information from verified token (alias of verifyToken).
   */
  async getUserFromToken(idToken: string): Promise<MoringUser> {
    return this.verifyToken(idToken);
  }

  private generateRandomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    
    // Check if crypto API is available (works in browsers and Node.js)
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const randomValues = new Uint8Array(length);
      crypto.getRandomValues(randomValues);
      for (let i = 0; i < length; i++) {
        result += chars[randomValues[i] % chars.length];
      }
    } else {
      // Fallback for custom runtimes
      for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    }
    return result;
  }
}

/**
 * Factory function to create a MoringAuth instance, reading environment variables by default.
 */
export function createMoringAuth(config?: Partial<MoringAuthConfig>): MoringAuth {
  const env = typeof process !== 'undefined' ? process.env : {};
  const issuer = config?.issuer || env.MORING_ISSUER || env.SSO_ISSUER;
  const clientId = config?.clientId || env.MORING_CLIENT_ID || env.SSO_CLIENT_ID;
  const clientSecret = config?.clientSecret || env.MORING_CLIENT_SECRET || env.SSO_CLIENT_SECRET;
  const redirectUri = config?.redirectUri || env.MORING_REDIRECT_URI || '';

  if (!issuer) throw new Error('MoringAuth: issuer (MORING_ISSUER) is required.');
  if (!clientId) throw new Error('MoringAuth: clientId (MORING_CLIENT_ID) is required.');

  return new MoringAuth({
    issuer,
    clientId,
    clientSecret,
    redirectUri,
    scope: config?.scope,
  });
}
