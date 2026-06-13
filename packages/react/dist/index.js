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
  MoringAuthContext: () => MoringAuthContext,
  MoringAuthProvider: () => MoringAuthProvider,
  useMoringAuth: () => useMoringAuth
});
module.exports = __toCommonJS(index_exports);

// src/provider.tsx
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
var MoringAuthContext = (0, import_react.createContext)(null);
var MoringAuthProvider = ({
  issuer,
  clientId,
  redirectUri,
  scope,
  children
}) => {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MoringAuthContext.Provider, { value: { issuer, clientId, redirectUri, scope }, children });
};

// src/hooks.ts
var import_react2 = require("react");
var import_core = require("@moring-auth/core");
function useMoringAuth() {
  const context = (0, import_react2.useContext)(MoringAuthContext);
  if (!context) {
    throw new Error("useMoringAuth must be used within a MoringAuthProvider");
  }
  const { issuer, clientId, redirectUri, scope } = context;
  const login = async (options) => {
    const client = (0, import_core.createMoringAuth)({ issuer, clientId, redirectUri, scope });
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
    const client = (0, import_core.createMoringAuth)({ issuer, clientId, redirectUri, scope });
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
        const client = (0, import_core.createMoringAuth)({ issuer, clientId, redirectUri, scope });
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  MoringAuthContext,
  MoringAuthProvider,
  useMoringAuth
});
