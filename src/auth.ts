import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import { prisma } from "@/lib/prisma";
import { sendMail, signInEmail } from "@/lib/mail";

/// Two hours, not the default 24. A magic link sitting in an inbox is a bearer token for the
/// whole account; there's no reason for it to stay live overnight. The email quotes this exact
/// value — see signInEmail — so the two can't drift.
const LINK_MAX_AGE = 2 * 60 * 60;

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),

  // Database sessions, not JWT. The session is a row we can delete, so signing out (or
  // revoking a stolen link) actually ends the session instead of waiting for a token to expire.
  session: { strategy: "database" },

  pages: { signIn: "/sign-in", verifyRequest: "/sign-in?sent=1" },

  providers: [
    {
      id: "email",
      type: "email",
      name: "Email",
      maxAge: LINK_MAX_AGE,
      from: process.env.MAIL_FROM ?? "",
      async sendVerificationRequest({ identifier, url }) {
        const { host } = new URL(url);
        const { subject, html, text } = signInEmail(url, host, LINK_MAX_AGE);
        await sendMail({ to: identifier, subject, html, text });
      },
    },
  ],

  callbacks: {
    // The default session has no user id on it, and every query in this app is scoped by
    // userId — without this, requireUser() has nothing to scope by.
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
});
