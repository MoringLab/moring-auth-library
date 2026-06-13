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
  getMoringUser: () => getMoringUser
});
module.exports = __toCommonJS(index_exports);
var import_headers = require("next/headers");
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  getMoringUser
});
