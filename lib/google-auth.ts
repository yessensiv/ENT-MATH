import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

export const googleAuthConfigured = () => Boolean(process.env.AUTH_SECRET && process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google({ clientId: process.env.AUTH_GOOGLE_ID, clientSecret: process.env.AUTH_GOOGLE_SECRET })],
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 7 },
  callbacks: {
    signIn({ account, profile }) { return account?.provider === 'google' && profile?.email_verified === true; },
    jwt({ token, account, profile }) {
      if (account?.provider === 'google' && profile?.sub && profile.email_verified === true) token.learnerId = `google:${profile.sub}`;
      return token;
    },
    session({ session, token }) { if (session.user && typeof token.learnerId === 'string') session.user.id = token.learnerId; return session; },
  },
});
