"use client";

import { useEffect } from "react";

/// Registers the service worker. Renders nothing.
///
/// Without this, Chrome on Android never offers "Install app" — a PWA is only installable if a
/// service worker with a fetch handler is registered. iOS Safari doesn't care, which is why
/// "Add to Home Screen" worked on iPhone while Android had no install option at all.
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // Dev has no /sw.js worth registering, and a stale worker in dev is a debugging trap.
    if (process.env.NODE_ENV !== "production") return;

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration failing means no install prompt — annoying, not fatal. The app works.
    });
  }, []);

  return null;
}
