// src/index.ts
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
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
function handleAuth(options) {
  return async function GET(request) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    if (!code) {
      return NextResponse.json({ error: "Authorization code missing" }, { status: 400 });
    }
    try {
      const cookieStore = await cookies();
      const codeVerifier = cookieStore.get("moring_code_verifier")?.value;
      const auth = createMoringAuth();
      const tokens = await auth.handleCallback(code, { codeVerifier });
      await auth.verifyToken(tokens.id_token);
      const redirectUrl = options?.successRedirectUrl || "/";
      const response = NextResponse.redirect(new URL(redirectUrl, request.url));
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
      return NextResponse.json(
        { error: "SSO Authentication failed", details: err.message },
        { status: 500 }
      );
    }
  };
}
export {
  getMoringUser,
  handleAuth
};
