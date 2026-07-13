import type { DefaultSession } from "next-auth";

/// Auth.js's default session has no user id, and no notion of a token version. Both are put
/// there by the callbacks in `src/auth.ts`; this teaches TypeScript about them.
declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
    /// The `User.tokenVersion` this token was minted against. requireUser() compares it to the
    /// live row and rejects the request if they've diverged — see src/lib/user.ts.
    tokenVersion?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    tokenVersion?: number;
  }
}
