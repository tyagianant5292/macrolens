"use client";

import { Barcode, Camera, Loader2, Sparkles, Trash2, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { MEAL_LABELS, type DraftItem, type DraftResponse, type Meal } from "@/lib/api-types";
import { downscale } from "@/lib/downscale";
import { round, scaleToGrams, type Per100g } from "@/lib/nutrition/types";
import { BarcodeScanner } from "./BarcodeScanner";

type Props = {
  meal: Meal;
  day: string;
  onClose: () => void;
  onSaved: () => void;
};

type Stage = "input" | "thinking" | "review" | "saving";

/// Rescaling a draft when the user edits its grams. We don't have the food's per-100g row
/// on the client, but we can recover it from the draft itself — nutrition is linear in
/// grams, so dividing by the current portion gives us the per-100g basis back.
function rescale(item: DraftItem, grams: number): DraftItem {
  const per100g: Per100g = {
    kcal: (item.kcal / item.grams) * 100,
    protein: (item.protein / item.grams) * 100,
    carbs: (item.carbs / item.grams) * 100,
    fat: (item.fat / item.grams) * 100,
    fiber: (item.fiber / item.grams) * 100,
    sugar: (item.sugar / item.grams) * 100,
    micros: Object.fromEntries(
      Object.entries(item.micros).map(([k, v]) => [k, (v / item.grams) * 100]),
    ),
  };
  return {
    ...item,
    ...scaleToGrams(per100g, grams),
    grams,
    quantity: round((item.quantity / item.grams) * grams, 2),
  };
}

export function AddSheet({ meal, day, onClose, onSaved }: Props) {
  const [stage, setStage] = useState<Stage>("input");
  const [text, setText] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  /// Carried from whichever input produced the draft through to the save, so the entry keeps
  /// a link back to the photo it was read off / the barcode it came from.
  const [origin, setOrigin] = useState<{ photoId?: string; barcode?: string }>({});
  const fileInput = useRef<HTMLInputElement>(null);

  async function receive(res: Response) {
    const data: DraftResponse & { error?: string } = await res.json();
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Something went wrong");
      setStage("input");
      return;
    }
    setItems(data.items);
    setOrigin({ photoId: data.photoId, barcode: data.barcode });
    setStage("review");
  }

  async function submitText() {
    if (!text.trim()) return;
    setError(null);
    setStage("thinking");
    try {
      await receive(
        await fetch("/api/parse", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text }),
        }),
      );
    } catch {
      setError("Network error");
      setStage("input");
    }
  }

  async function submitPhoto(file: File) {
    setError(null);
    setStage("thinking");
    try {
      const form = new FormData();
      // Shrink on-device: an 8MB camera JPEG becomes ~80KB and nothing is lost that the
      // model could have used.
      form.append("image", await downscale(file));
      // Whatever's already typed becomes a hint — "the dal is homemade", "no oil" etc.
      if (text.trim()) form.append("hint", text);
      await receive(await fetch("/api/analyze", { method: "POST", body: form }));
    } catch {
      setError("Couldn't read that photo");
      setStage("input");
    }
  }

  const submitBarcode = useCallback(async (code: string) => {
    setScanning(false);
    setError(null);
    setStage("thinking");
    try {
      await receive(await fetch(`/api/barcode?code=${encodeURIComponent(code)}`));
    } catch {
      setError("Network error");
      setStage("input");
    }
  }, []);

  async function save() {
    setStage("saving");
    try {
      const res = await fetch("/api/entries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ date: day, meal, items, ...origin }),
      });
      if (!res.ok) throw new Error();
      onSaved();
    } catch {
      setError("Couldn't save. Try again?");
      setStage("review");
    }
  }

  const draftTotal = items.reduce((s, i) => s + i.kcal, 0);
  const busy = stage === "thinking" || stage === "saving";

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] overflow-y-auto rounded-t-2xl border-t border-border bg-surface pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <div className="mx-auto max-w-lg px-4">
          <div className="flex items-center justify-between py-4">
            <h2 className="font-semibold">
              Add to <span className="text-muted">{MEAL_LABELS[meal]}</span>
            </h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2"
            >
              <X className="size-4" />
            </button>
          </div>

          {stage === "review" || stage === "saving" ? (
            <>
              <p className="mb-3 text-xs text-muted">
                Check the portions — tap a weight to change it. These are estimates.
              </p>

              <ul className="space-y-2">
                {items.map((item, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm capitalize">{item.name}</span>
                        {item.confidence === "low" && (
                          <span
                            title="The model wasn't confident about this portion"
                            className="shrink-0 rounded bg-amber-500/15 px-1 py-0.5 text-[9px] font-medium uppercase text-amber-400"
                          >
                            unsure
                          </span>
                        )}
                        {item.source === "AI" && (
                          <span
                            title="Estimated by AI, not from a nutrition database"
                            className="flex shrink-0 items-center gap-0.5 rounded bg-surface px-1 py-0.5 text-[9px] font-medium uppercase text-muted"
                          >
                            <Sparkles className="size-2.5" />
                            est
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 font-mono text-[11px] tabular-nums text-muted">
                        {round(item.protein, 0)}P · {round(item.carbs, 0)}C ·{" "}
                        {round(item.fat, 0)}F
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={5000}
                        value={round(item.grams, 0)}
                        onChange={(e) => {
                          const g = Number(e.target.value);
                          if (g > 0) {
                            setItems((prev) =>
                              prev.map((it, j) => (i === j ? rescale(it, g) : it)),
                            );
                          }
                        }}
                        className="w-14 rounded border border-border bg-surface px-1.5 py-1 text-right font-mono text-sm tabular-nums focus:border-muted focus:outline-none"
                      />
                      <span className="text-xs text-muted">g</span>
                    </div>

                    <span className="w-12 shrink-0 text-right font-mono text-sm tabular-nums">
                      {round(item.kcal, 0)}
                    </span>

                    <button
                      onClick={() => setItems((prev) => prev.filter((_, j) => j !== i))}
                      aria-label={`Remove ${item.name}`}
                      className="grid size-7 shrink-0 place-items-center rounded text-muted hover:text-red-400"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>

              {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

              <div className="sticky bottom-0 mt-4 flex items-center gap-3 bg-surface py-3">
                <button
                  onClick={() => setStage("input")}
                  className="rounded-lg px-3 py-2.5 text-sm text-muted hover:bg-surface-2"
                >
                  Back
                </button>
                <button
                  onClick={save}
                  disabled={items.length === 0 || stage === "saving"}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-foreground py-2.5 text-sm font-semibold text-background disabled:opacity-40"
                >
                  {stage === "saving" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      Add {items.length} item{items.length === 1 ? "" : "s"} ·{" "}
                      {round(draftTotal, 0)} kcal
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            <>
              <textarea
                autoFocus
                rows={3}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitText();
                }}
                placeholder="2 roti, ek katori dal, 150g chawal…"
                className="w-full resize-none rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm placeholder:text-muted focus:border-muted focus:outline-none"
              />

              {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

              <div className="mt-3 flex gap-2">
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  // On a phone this opens the camera directly; on desktop it's a file picker.
                  capture="environment"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) submitPhoto(file);
                    e.target.value = "";
                  }}
                />
                <button
                  onClick={() => fileInput.current?.click()}
                  disabled={busy}
                  aria-label="Photograph the plate"
                  className="grid size-11 shrink-0 place-items-center rounded-lg border border-border bg-surface-2 hover:border-muted disabled:opacity-40"
                >
                  <Camera className="size-4" />
                </button>
                <button
                  onClick={() => setScanning(true)}
                  disabled={busy}
                  aria-label="Scan a barcode"
                  className="grid size-11 shrink-0 place-items-center rounded-lg border border-border bg-surface-2 hover:border-muted disabled:opacity-40"
                >
                  <Barcode className="size-4" />
                </button>
                <button
                  onClick={submitText}
                  disabled={busy || !text.trim()}
                  className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-foreground text-sm font-semibold text-background disabled:opacity-40"
                >
                  {stage === "thinking" ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Reading…
                    </>
                  ) : (
                    "Analyse"
                  )}
                </button>
              </div>

              <p className="mt-3 text-center text-[11px] text-muted">
                Type it, snap the plate, or scan a packet. English or Hinglish, both work.
              </p>
            </>
          )}
        </div>
      </div>

      {scanning && (
        <BarcodeScanner onDetect={submitBarcode} onClose={() => setScanning(false)} />
      )}
    </div>
  );
}
