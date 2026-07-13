import { clerkMiddleware } from "@clerk/nextjs/server";

/// `proxy`, not `middleware` — Next 16 renamed the convention.
///
/// This ONLY attaches Clerk's auth context to the request. It deliberately does no route
/// protection: Clerk now deprecates middleware-based `auth.protect()` because path matching
/// diverges from how Next actually routes, which either leaves a resource reachable or — as
/// happened here — 404s the entire app including the sign-in page.
///
/// Protection lives with the resource instead: every API route calls `requireUser()`, and
/// `page.tsx` redirects on the server. A new route is not protected until it says so, so if
/// you add one, guard it.
export default clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
