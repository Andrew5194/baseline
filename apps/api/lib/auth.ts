import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { getDb, users } from '@baseline/db';
import { eq } from 'drizzle-orm';
import { verify } from '@node-rs/bcrypt';
import type { NextAuthConfig } from 'next-auth';

// A precomputed cost-12 bcrypt hash (same cost as signup). We compare against it
// when an account doesn't exist so login response time is identical whether or not
// the email is registered — closing the account-enumeration timing side channel.
const TIMING_SAFE_HASH = '$2b$12$iyjEJG0VjmPnVZmKrDLnRuQDLaW/jIHjsCktzqr3FPx6XFOA.pEYW';

export const authConfig: NextAuthConfig = {
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const db = getDb();
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, credentials.email as string))
          .limit(1);

        // Always run a bcrypt comparison — even when the account/hash is missing —
        // so timing doesn't reveal whether the email is registered.
        const valid = await verify(
          credentials.password as string,
          user?.passwordHash ?? TIMING_SAFE_HASH,
        );
        if (!user || !user.passwordHash || !valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  // Accept the forwarded host behind the proxy.
  trustHost: true,
  // Fixed cookie name (not the default `__Secure-` prefix, which Auth.js picks
  // unpredictably behind the proxy) so the web middleware matches it on both
  // localhost and the proxy. Secure is set in production (Cloud Run is HTTPS-only)
  // so the session cookie never rides plain HTTP; relaxed on localhost for dev.
  cookies: {
    sessionToken: {
      name: 'authjs.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/sign-in',
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
