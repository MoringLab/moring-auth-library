// src/provider.tsx
import { createContext } from "react";
import { jsx } from "react/jsx-runtime";
var MoringAuthContext = createContext(null);
var MoringAuthProvider = ({
  issuer,
  clientId,
  redirectUri,
  scope,
  children
}) => {
  return /* @__PURE__ */ jsx(MoringAuthContext.Provider, { value: { issuer, clientId, redirectUri, scope }, children });
};

// src/hooks.ts
import { useContext } from "react";
import { createMoringAuth } from "@moring-auth/core";
function useMoringAuth() {
  const context = useContext(MoringAuthContext);
  if (!context) {
    throw new Error("useMoringAuth must be used within a MoringAuthProvider");
  }
  const { issuer, clientId, redirectUri, scope } = context;
  const login = async (options) => {
    const client = createMoringAuth({ issuer, clientId, redirectUri, scope });
    const { url, state, nonce, codeVerifier } = await client.getLoginUrl(options);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("moring_auth_state", state);
      window.sessionStorage.setItem("moring_auth_nonce", nonce);
      if (codeVerifier) {
        window.sessionStorage.setItem("moring_auth_code_verifier", codeVerifier);
      }
      window.location.href = url;
    }
  };
  const handleCallback = async (code) => {
    const client = createMoringAuth({ issuer, clientId, redirectUri, scope });
    let codeVerifier;
    if (typeof window !== "undefined") {
      codeVerifier = window.sessionStorage.getItem("moring_auth_code_verifier") || void 0;
    }
    const tokens = await client.handleCallback(code, { codeVerifier });
    const user = await client.verifyToken(tokens.id_token);
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem("moring_auth_state");
      window.sessionStorage.removeItem("moring_auth_nonce");
      window.sessionStorage.removeItem("moring_auth_code_verifier");
    }
    return { tokens, user };
  };
  return {
    login,
    handleCallback
  };
}
export {
  MoringAuthContext,
  MoringAuthProvider,
  useMoringAuth
};
