"use client";

import { Barcode, FlaskConical, Pencil, Sparkles } from "lucide-react";
import type { Source } from "@/lib/api-types";

/// Every food says where its numbers came from — not just the AI ones.
///
/// Badging only the AI estimates was a mistake: an unbadged row is ambiguous. Is it real lab
/// data, or did the badge just fail to render? You end up unable to answer "are these numbers
/// measured or guessed?" about your own food log, which is the one question the whole hybrid
/// design exists to make answerable.
const SOURCES: Record<Source, { label: string; title: string; icon: typeof Sparkles; className: string }> = {
  USDA: {
    label: "USDA",
    title: "Measured lab values from USDA FoodData Central",
    icon: FlaskConical,
    className: "bg-[var(--fiber)]/15 text-[var(--fiber)]",
  },
  OFF: {
    label: "Label",
    title: "From the manufacturer's own label, via barcode",
    icon: Barcode,
    className: "bg-[var(--protein)]/15 text-[var(--protein)]",
  },
  AI: {
    label: "Est",
    title: "Estimated by AI — a ballpark, not a measurement. Tap to check the portion.",
    icon: Sparkles,
    className: "bg-amber-500/15 text-amber-400",
  },
  MANUAL: {
    label: "Manual",
    title: "You entered these numbers yourself",
    icon: Pencil,
    className: "bg-surface-2 text-muted",
  },
};

export function SourceBadge({ source }: { source: Source }) {
  const s = SOURCES[source];
  const Icon = s.icon;

  return (
    <span
      title={s.title}
      className={`flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide ${s.className}`}
    >
      <Icon className="size-2.5" />
      {s.label}
    </span>
  );
}

/// The full sentence, for the expanded detail panel. The badge is a glance; this is the answer.
export function SourceLine({ source }: { source: Source }) {
  const s = SOURCES[source];

  return (
    <p className="text-[11px] leading-relaxed text-muted">
      {source === "AI" ? (
        <>
          <span className="text-amber-400">Estimated by AI.</span> USDA had no match for this
          food, so these numbers are the model&apos;s recall rather than a measurement — treat
          them as a ballpark and correct the portion if it looks off.
        </>
      ) : (
        s.title + "."
      )}
    </p>
  );
}
