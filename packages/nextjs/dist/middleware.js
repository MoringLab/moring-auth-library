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

// src/middleware.ts
var middleware_exports = {};
__export(middleware_exports, {
  withMoringAuth: () => withMoringAuth
});
module.exports = __toCommonJS(middleware_exports);
var import_server = require("next/server");
var import_core = require("@moring-auth/core");
function withMoringAuth(options) {
  const cookieName = options?.cookieName || "moring_session";
  const publicPaths = options?.publicPaths || [];
  const redirectTo = options?.redirectTo || "/";
  return async function middleware(request) {
    const { pathname } = request.nextUrl;
    if (pathname.startsWith("/_next") || pathname.startsWith("/static") || pathname.includes(".")) {
      return import_server.NextResponse.next();
    }
    const isPublic = publicPaths.some((p) => {
      if (p.endsWith("/*")) {
        return pathname.startsWith(p.slice(0, -2));
      }
      return pathname === p;
    });
    if (isPublic) {
      return import_server.NextResponse.next();
    }
    const token = request.cookies.get(cookieName)?.value;
    if (!token) {
      const url = request.nextUrl.clone();
      url.pathname = redirectTo;
      url.searchParams.set("callbackUrl", request.nextUrl.pathname);
      return import_server.NextResponse.redirect(url);
    }
    try {
      const auth = (0, import_core.createMoringAuth)({
        issuer: options?.issuer,
        clientId: options?.clientId
      });
      await auth.verifyToken(token);
      return import_server.NextResponse.next();
    } catch (err) {
      const url = request.nextUrl.clone();
      url.pathname = redirectTo;
      url.searchParams.set("callbackUrl", request.nextUrl.pathname);
      const response = import_server.NextResponse.redirect(url);
      response.cookies.delete(cookieName);
      return response;
    }
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  withMoringAuth
});
