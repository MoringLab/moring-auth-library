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
  requireMoringAuth: () => requireMoringAuth
});
module.exports = __toCommonJS(index_exports);
var import_core = require("@moring-auth/core");
function requireMoringAuth(options) {
  const cookieName = options?.cookieName || "moring_session";
  const required = options?.required !== false;
  return async (req, res, next) => {
    let token = req.cookies?.[cookieName];
    if (!token && req.headers.cookie) {
      const cookies = req.headers.cookie.split(";").reduce((acc, c) => {
        const [key, val] = c.trim().split("=");
        acc[key] = val;
        return acc;
      }, {});
      token = cookies[cookieName];
    }
    if (!token && req.headers.authorization) {
      const parts = req.headers.authorization.split(" ");
      if (parts[0] === "Bearer" && parts[1]) {
        token = parts[1];
      }
    }
    if (!token) {
      if (required) {
        return res.status(401).json({ error: "Unauthorized: Session token not found" });
      }
      return next();
    }
    try {
      const auth = (0, import_core.createMoringAuth)({
        issuer: options?.issuer,
        clientId: options?.clientId
      });
      const user = await auth.verifyToken(token);
      req.user = user;
      next();
    } catch (err) {
      if (required) {
        return res.status(401).json({ error: `Unauthorized: Invalid token - ${err.message}` });
      }
      next();
    }
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  requireMoringAuth
});
