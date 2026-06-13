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
  getMoringUser: () => getMoringUser,
  handleAuth: () => handleAuth
});
module.exports = __toCommonJS(index_exports);
var import_headers = require("next/headers");
var import_server = require("next/server");
var import_core = require("@moring-auth/core");
async function getMoringUser(options) {
  const cookieName = options?.cookieName || "moring_session";
  try {
    const cookieStore = await (0, import_headers.cookies)();
    const token = cookieStore.get(cookieName)?.value;
    if (!token) return null;
    const auth = (0, import_core.createMoringAuth)({
      issuer: options?.issuer,
      clientId: options?.clientId
    });
    return await auth.verifyToken(token);
  } catch (err) {
    return null;
  }
}
function handleAuth(options) {
  return async function GET(request) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    if (!code) {
      return import_server.NextResponse.json({ error: "Authorization code missing" }, { status: 400 });
    }
    try {
      const cookieStore = await (0, import_headers.cookies)();
      const codeVerifier = cookieStore.get("moring_code_verifier")?.value;
      const auth = (0, import_core.createMoringAuth)();
      const tokens = await auth.handleCallback(code, { codeVerifier });
      await auth.verifyToken(tokens.id_token);
      const redirectUrl = options?.successRedirectUrl || "/";
      const response = import_server.NextResponse.redirect(new URL(redirectUrl, request.url));
      response.cookies.delete("moring_code_verifier");
      response.cookies.set(options?.cookieName || "moring_session", tokens.id_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production" || process.env.NODE_ENV === "development",
        sameSite: "lax",
        maxAge: tokens.expires_in || 3600
      });
      return response;
    } catch (err) {
      console.error("SSO callback failed:", err);
      return import_server.NextResponse.json(
        { error: "SSO Authentication failed", details: err.message },
        { status: 500 }
      );
    }
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  getMoringUser,
  handleAuth
});
