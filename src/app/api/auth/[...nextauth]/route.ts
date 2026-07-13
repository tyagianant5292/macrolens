import { handlers } from "@/auth";

/// Auth.js's own endpoints (sign-in, callback, sign-out, session). Deliberately the ONE route
/// under /api that has no requireUser() guard — guarding the sign-in route would mean you must
/// be signed in to sign in.
export const { GET, POST } = handlers;
