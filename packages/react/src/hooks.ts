import { useContext } from 'react';
import { MoringAuthContext } from './provider';
import { createMoringAuth, TokenResponse, MoringUser } from '@moring-auth/core';

export interface UseMoringAuthResult {
  /**
   * Redirects the user to the Moring SSO Login page.
   */
  login: (options?: { state?: string; nonce?: string; scope?: string[] }) => Promise<void>;

  /**
   * Handles OIDC Authorization Code callback, exchanging the code for tokens and verifying the ID Token.
   */
  handleCallback: (code: string) => Promise<{
    tokens: TokenResponse;
    user: MoringUser;
  }>;
}

export function useMoringAuth(): UseMoringAuthResult {
  const context = useContext(MoringAuthContext);
  if (!context) {
    throw new Error('useMoringAuth must be used within a MoringAuthProvider');
  }

  const { issuer, clientId, redirectUri, scope } = context;

  const login = async (options?: { state?: string; nonce?: string; scope?: string[] }) => {
    // React SPA has no clientSecret, so PKCE is auto-enabled in getLoginUrl()
    const client = createMoringAuth({ issuer, clientId, redirectUri, scope });
    const { url, state, nonce, codeVerifier } = await client.getLoginUrl(options);

    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('moring_auth_state', state);
      window.sessionStorage.setItem('moring_auth_nonce', nonce);
      if (codeVerifier) {
        window.sessionStorage.setItem('moring_auth_code_verifier', codeVerifier);
      }
      window.location.href = url;
    }
  };

  const handleCallback = async (code: string) => {
    const client = createMoringAuth({ issuer, clientId, redirectUri, scope });
    
    let codeVerifier: string | undefined;
    if (typeof window !== 'undefined') {
      codeVerifier = window.sessionStorage.getItem('moring_auth_code_verifier') || undefined;
    }

    const tokens = await client.handleCallback(code, { codeVerifier });
    const user = await client.verifyToken(tokens.id_token);

    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem('moring_auth_state');
      window.sessionStorage.removeItem('moring_auth_nonce');
      window.sessionStorage.removeItem('moring_auth_code_verifier');
    }

    return { tokens, user };
  };

  return {
    login,
    handleCallback,
  };
}
