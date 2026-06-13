// src/index.ts
import { cookies } from "next/headers";
import { createMoringAuth } from "@moring-auth/core";
async function getMoringUser(options) {
  const cookieName = options?.cookieName || "moring_session";
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(cookieName)?.value;
    if (!token) return null;
    const auth = createMoringAuth({
      issuer: options?.issuer,
      clientId: options?.clientId
    });
    return await auth.verifyToken(token);
  } catch (err) {
    return null;
  }
}
export {
  getMoringUser
};
