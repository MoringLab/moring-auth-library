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

  /**
   * Opens the Moring SSO Login page in a popup window and returns tokens and user object upon successful login without requiring a redirect.
   */
  loginWithPopup: (options?: { state?: string; nonce?: string; scope?: string[], popupWidth?: number, popupHeight?: number }) => Promise<{
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

  const loginWithPopup = async (options?: { state?: string; nonce?: string; scope?: string[], popupWidth?: number, popupHeight?: number }) => {
    return new Promise<{ tokens: TokenResponse; user: MoringUser }>(async (resolve, reject) => {
      try {
        const client = createMoringAuth({ issuer, clientId, redirectUri, scope });
        const { url, state, codeVerifier } = await client.getLoginUrl({
          ...options,
          responseMode: 'web_message'
        });

        const width = options?.popupWidth || 500;
        const height = options?.popupHeight || 600;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;
        
        const popup = window.open(url, 'MoringSSOLogin', `width=${width},height=${height},left=${left},top=${top}`);
        
        if (!popup) {
          throw new Error('Popup blocked by browser. Please allow popups for this site.');
        }

        const messageListener = async (event: MessageEvent) => {
          // Verify origin (SSO Server)
          const issuerOrigin = new URL(issuer).origin;
          if (event.origin !== issuerOrigin) return;

          // oidc-provider sends web_message as:
          // { type: "authorization_response", response: { code: "...", state: "..." } }
          if (event.data?.type === 'authorization_response' && event.data?.response) {
            window.removeEventListener('message', messageListener);
            const responseData = event.data.response;

            if (responseData.error) {
              reject(new Error(responseData.error_description || responseData.error));
              return;
            }

            if (responseData.state !== state) {
              reject(new Error('State mismatch in popup response'));
              return;
            }

            try {
              const tokens = await client.handleCallback(responseData.code, { codeVerifier });
              const user = await client.verifyToken(tokens.id_token);
              resolve({ tokens, user });
            } catch (err) {
              reject(err);
            }
          }
        };

        window.addEventListener('message', messageListener);

        // Check if popup closed manually by user
        const checkClosed = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkClosed);
            window.removeEventListener('message', messageListener);
            reject(new Error('Popup closed by user before completing login'));
          }
        }, 1000);

      } catch (err) {
        reject(err);
      }
    });
  };

  return {
    login,
    handleCallback,
    loginWithPopup,
  };
}
