import React from 'react';
import { TokenResponse, MoringUser } from '@moring-auth/core';

interface MoringAuthContextType {
    issuer: string;
    clientId: string;
    redirectUri: string;
    scope?: string;
}
declare const MoringAuthContext: React.Context<MoringAuthContextType | null>;
interface MoringAuthProviderProps {
    issuer: string;
    clientId: string;
    redirectUri: string;
    scope?: string;
    children: React.ReactNode;
}
declare const MoringAuthProvider: React.FC<MoringAuthProviderProps>;

interface UseMoringAuthResult {
    /**
     * Redirects the user to the Moring SSO Login page.
     */
    login: (options?: {
        state?: string;
        nonce?: string;
        scope?: string[];
    }) => Promise<void>;
    /**
     * Handles OIDC Authorization Code callback, exchanging the code for tokens and verifying the ID Token.
     */
    handleCallback: (code: string) => Promise<{
        tokens: TokenResponse;
        user: MoringUser;
    }>;
}
declare function useMoringAuth(): UseMoringAuthResult;

export { MoringAuthContext, type MoringAuthContextType, MoringAuthProvider, type MoringAuthProviderProps, type UseMoringAuthResult, useMoringAuth };
