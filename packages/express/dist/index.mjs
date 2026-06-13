// src/index.ts
import { createMoringAuth } from "@moring-auth/core";
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
      const auth = createMoringAuth({
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
export {
  requireMoringAuth
};
