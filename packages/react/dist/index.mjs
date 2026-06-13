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
  const loginWithPopup = async (options) => {
    return new Promise(async (resolve, reject) => {
      try {
        const client = createMoringAuth({ issuer, clientId, redirectUri, scope });
        const { url, state, codeVerifier } = await client.getLoginUrl({
          ...options,
          responseMode: "web_message"
        });
        const width = options?.popupWidth || 500;
        const height = options?.popupHeight || 600;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;
        const popup = window.open(url, "MoringSSOLogin", `width=${width},height=${height},left=${left},top=${top}`);
        if (!popup) {
          throw new Error("Popup blocked by browser. Please allow popups for this site.");
        }
        const messageListener = async (event) => {
          const issuerOrigin = new URL(issuer).origin;
          if (event.origin !== issuerOrigin) return;
          if (event.data?.type === "authorization_response" && event.data?.response) {
            window.removeEventListener("message", messageListener);
            const responseData = event.data.response;
            if (responseData.error) {
              reject(new Error(responseData.error_description || responseData.error));
              return;
            }
            if (responseData.state !== state) {
              reject(new Error("State mismatch in popup response"));
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
        window.addEventListener("message", messageListener);
        const checkClosed = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkClosed);
            window.removeEventListener("message", messageListener);
            reject(new Error("Popup closed by user before completing login"));
          }
        }, 1e3);
      } catch (err) {
        reject(err);
      }
    });
  };
  return {
    login,
    handleCallback,
    loginWithPopup
  };
}
export {
  MoringAuthContext,
  MoringAuthProvider,
  useMoringAuth
};
