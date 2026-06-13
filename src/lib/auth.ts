import NextAuth from "next-auth"

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    {
      id: "moring",
      name: "Moring SSO",
      type: "oidc",
      issuer: process.env.SSO_ISSUER, // e.g. https://sso.moring.co
      clientId: process.env.SSO_CLIENT_ID,
      clientSecret: process.env.SSO_CLIENT_SECRET,
      authorization: { params: { scope: "openid email profile" } },
    },
  ],
  pages: {
    signIn: "/",
  },
  callbacks: {
    async jwt({ token, profile }) {
      if (profile) {
        // profile은 최초 로그인 시에만 전달됩니다.
        token.id = profile.sub;
        token.email = profile.email;
        token.name = profile.name || profile.preferred_username;
        token.picture = profile.picture;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.image = token.picture as string;
      }
      return session;
    },
  },
})
