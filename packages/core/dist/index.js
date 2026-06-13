"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  MoringAuth: () => MoringAuth,
  createMoringAuth: () => createMoringAuth,
  verifyIdToken: () => verifyIdToken
});
module.exports = __toCommonJS(index_exports);

// src/verify.ts
var import_jose = require("jose");
var jwksCache = /* @__PURE__ */ new Map();
function getOrCreateJwks(jwksUri) {
  if (!jwksCache.has(jwksUri)) {
    jwksCache.set(jwksUri, (0, import_jose.createRemoteJWKSet)(new URL(jwksUri)));
  }
  return jwksCache.get(jwksUri);
}
async function verifyIdToken(idToken, options) {
  const jwks = getOrCreateJwks(options.jwksUri);
  const { payload } = await (0, import_jose.jwtVerify)(idToken, jwks, {
    issuer: options.issuer,
    audience: options.clientId
  });
  return {
    id: payload.sub || payload.id,
    email: payload.email,
    name: payload.name || payload.preferred_username,
    picture: payload.picture || payload.avatar_url,
    ...payload
  };
}

// src/client.ts
var MoringAuth = class {
  config;
  discoveryPromise = null;
  constructor(config) {
    this.config = config;
  }
  /**
   * Fetches OIDC discovery document and caches it.
   */
  async discover() {
    if (this.discoveryPromise) return this.discoveryPromise;
    this.discoveryPromise = (async () => {
      const issuerUrl = this.config.issuer.replace(/\/$/, "");
      const discoveryUrl = `${issuerUrl}/.well-known/openid-configuration`;
      try {
        const res = await fetch(discoveryUrl);
        if (!res.ok) {
          throw new Error(`Failed to fetch OIDC configuration from ${discoveryUrl}: ${res.statusText}`);
        }
        return await res.json();
      } catch (err) {
        this.discoveryPromise = null;
        throw err;
      }
    })();
    return this.discoveryPromise;
  }
  /**
   * Generates a login URL along with generated state, nonce, and PKCE parameters.
   */
  async getLoginUrl(options) {
    const discovery = await this.discover();
    const state = options?.state || this.generateRandomString(16);
    const nonce = options?.nonce || this.generateRandomString(16);
    const scope = options?.scope || (this.config.scope ? this.config.scope.split(" ") : ["openid", "email", "profile"]);
    const url = new URL(discovery.authorization_endpoint);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", this.config.clientId);
    url.searchParams.set("redirect_uri", this.config.redirectUri);
    url.searchParams.set("scope", scope.join(" "));
    url.searchParams.set("state", state);
    url.searchParams.set("nonce", nonce);
    let codeVerifier;
    if (options?.codeChallenge) {
      url.searchParams.set("code_challenge", options.codeChallenge);
      url.searchParams.set("code_challenge_method", options.codeChallengeMethod || "S256");
    } else if (options?.codeChallengeMethod === "S256" || !this.config.clientSecret) {
      codeVerifier = this.generateRandomString(43);
      const codeChallenge = await this.generateCodeChallenge(codeVerifier);
      url.searchParams.set("code_challenge", codeChallenge);
      url.searchParams.set("code_challenge_method", "S256");
    }
    return { url: url.toString(), state, nonce, codeVerifier };
  }
  /**
   * Exchanges authorization code for access and ID tokens.
   */
  async handleCallback(code, options) {
    const discovery = await this.discover();
    const body = new URLSearchParams();
    body.set("grant_type", "authorization_code");
    body.set("code", code);
    body.set("redirect_uri", this.config.redirectUri);
    body.set("client_id", this.config.clientId);
    if (this.config.clientSecret) {
      body.set("client_secret", this.config.clientSecret);
    }
    if (options?.codeVerifier) {
      body.set("code_verifier", options.codeVerifier);
    }
    const res = await fetch(discovery.token_endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: body.toString()
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to exchange authorization code: ${res.statusText} - ${errorText}`);
    }
    return await res.json();
  }
  async generateCodeChallenge(verifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    let hash;
    if (typeof crypto !== "undefined" && crypto.subtle && crypto.subtle.digest) {
      hash = await crypto.subtle.digest("SHA-256", data);
    } else if (typeof globalThis !== "undefined" && globalThis.crypto?.subtle?.digest) {
      hash = await globalThis.crypto.subtle.digest("SHA-256", data);
    } else {
      try {
        const nodeCrypto = require("crypto");
        const buffer = nodeCrypto.createHash("sha256").update(data).digest();
        hash = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
      } catch (err) {
        throw new Error("Web Crypto API (crypto.subtle.digest) is not supported in this runtime.");
      }
    }
    return this.base64UrlEncode(new Uint8Array(hash));
  }
  base64UrlEncode(array) {
    if (typeof btoa !== "undefined") {
      let binary = "";
      const len = array.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(array[i]);
      }
      return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    } else {
      return Buffer.from(array).toString("base64url");
    }
  }
  /**
   * Verifies ID Token using remote JWKS keys.
   */
  async verifyToken(idToken) {
    const discovery = await this.discover();
    return verifyIdToken(idToken, {
      jwksUri: discovery.jwks_uri,
      issuer: discovery.issuer,
      clientId: this.config.clientId
    });
  }
  /**
   * Extracts user information from verified token (alias of verifyToken).
   */
  async getUserFromToken(idToken) {
    return this.verifyToken(idToken);
  }
  generateRandomString(length) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      const randomValues = new Uint8Array(length);
      crypto.getRandomValues(randomValues);
      for (let i = 0; i < length; i++) {
        result += chars[randomValues[i] % chars.length];
      }
    } else {
      for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    }
    return result;
  }
};
function createMoringAuth(config) {
  const env = typeof process !== "undefined" ? process.env : {};
  const issuer = config?.issuer || env.MORING_ISSUER || env.SSO_ISSUER;
  const clientId = config?.clientId || env.MORING_CLIENT_ID || env.SSO_CLIENT_ID;
  const clientSecret = config?.clientSecret || env.MORING_CLIENT_SECRET || env.SSO_CLIENT_SECRET;
  const redirectUri = config?.redirectUri || env.MORING_REDIRECT_URI || "";
  if (!issuer) throw new Error("MoringAuth: issuer (MORING_ISSUER) is required.");
  if (!clientId) throw new Error("MoringAuth: clientId (MORING_CLIENT_ID) is required.");
  return new MoringAuth({
    issuer,
    clientId,
    clientSecret,
    redirectUri,
    scope: config?.scope
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  MoringAuth,
  createMoringAuth,
  verifyIdToken
});
