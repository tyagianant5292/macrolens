"use client";

import { Loader2, Plus, X } from "lucide-react";
import { useState } from "react";

/// Adding a meal lives here, on the day itself, right under the last meal card.
///
/// It was originally only in the settings sheet, which was wrong: "how do I add a meal?" is a
/// question you have while looking at your meals, and the answer has to be where you're looking.
export function NewMealButton({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    const value = name.trim();
    if (!value) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/meals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: value }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof body.error === "string" ? body.error : "Couldn't add that");
        return;
      }
      setName("");
      setOpen(false);
      onCreated();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-3 text-xs text-muted hover:border-muted hover:text-foreground"
      >
        <Plus className="size-3.5" />
        New meal
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="flex gap-2">
        <input
          autoFocus
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") create();
            if (e.key === "Escape") setOpen(false);
          }}
          maxLength={30}
          placeholder="Tea time, Bed time, Pre-workout…"
          className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-3 text-sm placeholder:text-muted focus:border-muted focus:outline-none"
        />
        <button
          onClick={create}
          disabled={busy || !name.trim()}
          className="h-10 shrink-0 rounded-lg bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-40"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : "Add"}
        </button>
        <button
          onClick={() => setOpen(false)}
          aria-label="Cancel"
          className="grid size-10 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2"
        >
          <X className="size-4" />
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-[var(--over)]">{error}</p>}
    </div>
  );
}
