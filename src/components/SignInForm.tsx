"use client";

import { Loader2, Mail } from "lucide-react";
import { useFormStatus } from "react-dom";

function Submit() {
  // Sending the email takes a round-trip to Brevo. Without a pending state the button looks
  // dead and people mash it, which sends three links and invalidates the first two.
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-foreground py-2.5 text-sm font-semibold text-background disabled:opacity-50"
    >
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          Sending…
        </>
      ) : (
        <>
          <Mail className="size-4" />
          Email me a link
        </>
      )}
    </button>
  );
}

export function SignInForm({
  action,
  error,
}: {
  action: (formData: FormData) => Promise<void>;
  error?: string;
}) {
  return (
    <form action={action}>
      <label htmlFor="email" className="sr-only">
        Email address
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoFocus
        autoComplete="email"
        inputMode="email"
        placeholder="you@example.com"
        className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-center text-sm placeholder:text-muted focus:border-muted focus:outline-none"
      />

      <Submit />

      {error && (
        <p className="mt-3 text-center text-xs text-[var(--over)]">
          Couldn&apos;t send that link. Check the address and try again.
        </p>
      )}

      <p className="mt-4 text-center text-[11px] leading-relaxed text-muted">
        No password. We email you a link that signs you in.
      </p>
    </form>
  );
}
