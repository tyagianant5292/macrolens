"use client";

import { ArrowLeft, Loader2 } from "lucide-react";
import { useState } from "react";
import { signIn } from "next-auth/react";

type Mode = "password" | "email" | "code";

const input =
  "h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm placeholder:text-muted focus:border-muted focus:outline-none";
const primary =
  "mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-foreground text-sm font-semibold text-background disabled:opacity-40";

export function SignInForm() {
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function fail(message: string) {
    setError(message);
    setBusy(false);
  }

  async function login(withPassword: string) {
    const res = await signIn("credentials", {
      email: email.trim().toLowerCase(),
      password: withPassword,
      redirect: false,
    });
    if (res?.error) {
      fail("Email or password is wrong");
      return;
    }
    // Full reload rather than a router push: the page is a server component gated on the
    // session, and it has to be re-rendered on the server to see the new cookie.
    window.location.href = "/";
  }

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    await login(password);
  }

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return fail(body.error ?? "Couldn't send the code");

      setNotice(`Code sent to ${email.trim().toLowerCase()}`);
      setMode("code");
      setBusy(false);
    } catch {
      fail("Network error");
    }
  }

  async function setPasswordWithCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return fail(body.error ?? "Couldn't set that password");

      // Straight in — making someone type the password they just chose is pure ceremony.
      await login(password);
    } catch {
      fail("Network error");
    }
  }

  if (mode === "password") {
    return (
      <form onSubmit={signInWithPassword}>
        <div className="space-y-2">
          <input
            autoFocus
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={input}
          />
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className={input}
          />
        </div>

        <button type="submit" disabled={busy} className={primary}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : "Sign in"}
        </button>

        {error && <p className="mt-3 text-center text-xs text-[var(--over)]">{error}</p>}

        <button
          type="button"
          onClick={() => {
            setMode("email");
            setError(null);
            setPassword("");
          }}
          className="mt-4 w-full text-center text-[11px] leading-relaxed text-muted hover:text-foreground"
        >
          First time here, or forgot your password?
        </button>
      </form>
    );
  }

  if (mode === "email") {
    return (
      <form onSubmit={sendCode}>
        <p className="mb-3 text-center text-[11px] leading-relaxed text-muted">
          We&apos;ll email you a 6-digit code to prove the address is yours. Then you pick a
          password.
        </p>

        <input
          autoFocus
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className={input}
        />

        <button type="submit" disabled={busy} className={primary}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : "Send me a code"}
        </button>

        {error && <p className="mt-3 text-center text-xs text-[var(--over)]">{error}</p>}

        <button
          type="button"
          onClick={() => {
            setMode("password");
            setError(null);
          }}
          className="mt-4 flex w-full items-center justify-center gap-1 text-[11px] text-muted hover:text-foreground"
        >
          <ArrowLeft className="size-3" />
          Back to sign in
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={setPasswordWithCode}>
      {notice && (
        <p className="mb-3 text-center text-[11px] leading-relaxed text-muted">
          {notice}. It expires in 10 minutes.
        </p>
      )}

      <div className="space-y-2">
        <input
          autoFocus
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="000000"
          className={`${input} text-center font-mono text-lg tracking-[0.5em]`}
        />
        <input
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Choose a password (8+ characters)"
          className={input}
        />
      </div>

      <button type="submit" disabled={busy || code.length !== 6} className={primary}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : "Set password & sign in"}
      </button>

      {error && <p className="mt-3 text-center text-xs text-[var(--over)]">{error}</p>}

      <button
        type="button"
        onClick={() => {
          setMode("email");
          setError(null);
          setCode("");
          setPassword("");
        }}
        className="mt-4 flex w-full items-center justify-center gap-1 text-[11px] text-muted hover:text-foreground"
      >
        <ArrowLeft className="size-3" />
        Use a different email
      </button>
    </form>
  );
}
