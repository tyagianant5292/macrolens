import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

class BadCredentials extends CredentialsSignin {
  code = "credentials";
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),

  /// JWT, not database sessions. Not a preference — Auth.js cannot persist a credentials login
  /// to the Session table ("users authenticated in this manner are not persisted in the
  /// database"). The cost is real: a JWT can't be revoked server-side, so signing out only
  /// drops the local cookie and a copied token stays valid until it expires.
  ///
  /// `tokenVersion` buys revocation back. It's stamped into the token at login and compared
  /// against the User row on every request (requireUser already loads that row, so it's free).
  /// Bumping it — which changing your password does — invalidates every token everywhere.
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },

  pages: { signIn: "/sign-in", error: "/sign-in" },

  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const email = String(raw.email ?? "")
          .trim()
          .toLowerCase();
        const password = String(raw.password ?? "");
        if (!email || !password) throw new BadCredentials();

        const user = await prisma.user.findUnique({ where: { email } });

        // One failure for "no such account", "no password set yet" and "wrong password".
        // Distinguishing them would tell a stranger which email addresses have accounts here.
        if (!user?.passwordHash) throw new BadCredentials();
        if (!(await verifyPassword(password, user.passwordHash))) throw new BadCredentials();

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        // Fresh login — stamp the token with the version it was minted against.
        const row = await prisma.user.findUnique({
          where: { id: user.id },
          select: { tokenVersion: true },
        });
        token.uid = user.id;
        token.tokenVersion = row?.tokenVersion ?? 0;
      }
      return token;
    },

    session({ session, token }) {
      // Every query in this app is scoped by userId, and the default session carries none.
      if (typeof token.uid === "string") session.user.id = token.uid;
      if (typeof token.tokenVersion === "number") session.tokenVersion = token.tokenVersion;
      return session;
    },
  },
});
