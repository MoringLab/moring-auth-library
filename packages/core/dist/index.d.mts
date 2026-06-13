interface MoringAuthConfig {
    issuer: string;
    clientId: string;
    clientSecret?: string;
    redirectUri: string;
    scope?: string;
}
interface MoringUser {
    id: string;
    email: string;
    name?: string;
    picture?: string;
    [key: string]: any;
}
interface TokenResponse {
    access_token: string;
    id_token: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
    scope?: string;
}
interface OidcDiscoveryDoc {
    issuer: string;
    authorization_endpoint: string;
    token_endpoint: string;
    jwks_uri: string;
    userinfo_endpoint?: string;
    [key: string]: any;
}

declare class MoringAuth {
    private config;
    private discoveryPromise;
    constructor(config: MoringAuthConfig);
    /**
     * Fetches OIDC discovery document and caches it.
     */
    discover(): Promise<OidcDiscoveryDoc>;
    /**
     * Generates a login URL along with generated state, nonce, and PKCE parameters.
     */
    getLoginUrl(options?: {
        state?: string;
        nonce?: string;
        scope?: string[];
        codeChallenge?: string;
        codeChallengeMethod?: string;
        responseMode?: string;
    }): Promise<{
        url: string;
        state: string;
        nonce: string;
        codeVerifier?: string;
    }>;
    /**
     * Exchanges authorization code for access and ID tokens.
     */
    handleCallback(code: string, options?: {
        codeVerifier?: string;
    }): Promise<TokenResponse>;
    private generateCodeChallenge;
    private base64UrlEncode;
    /**
     * Verifies ID Token using remote JWKS keys.
     */
    verifyToken(idToken: string): Promise<MoringUser>;
    /**
     * Extracts user information from verified token (alias of verifyToken).
     */
    getUserFromToken(idToken: string): Promise<MoringUser>;
    private generateRandomString;
}
/**
 * Factory function to create a MoringAuth instance, reading environment variables by default.
 */
declare function createMoringAuth(config?: Partial<MoringAuthConfig>): MoringAuth;

declare function verifyIdToken(idToken: string, options: {
    jwksUri: string;
    issuer: string;
    clientId: string;
}): Promise<MoringUser>;

export { MoringAuth, type MoringAuthConfig, type MoringUser, type OidcDiscoveryDoc, type TokenResponse, createMoringAuth, verifyIdToken };
