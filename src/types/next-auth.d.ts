import type { DefaultSession } from "next-auth";

/// Auth.js's default session user has no `id`. Every query in this app is scoped by userId,
/// so the session callback in `src/auth.ts` puts it there — this teaches TypeScript about it.
declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}
