"use client";

import { Barcode, Camera, Loader2, Plus, Sparkles, Trash2, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import type { DraftItem, DraftResponse, MealSlot } from "@/lib/api-types";
import { downscale } from "@/lib/downscale";
import { round, scaleToGrams, type Per100g } from "@/lib/nutrition/types";
import { BarcodeScanner } from "./BarcodeScanner";
import { MacroLine } from "./NutritionRow";

type Props = {
  meal: MealSlot;
  day: string;
  onClose: () => void;
  onSaved: () => void;
};

/// A draft plus where it came from, so a photo's items keep their photo through to the save.
type Draft = DraftItem & { photoId?: string; barcode?: string };

/// Rescaling a draft when the user edits its grams. We don't have the food's per-100g row on
/// the client, but nutrition is linear in grams — dividing by the current portion recovers the
/// per-100g basis, so no round-trip is needed to re-price it.
function rescale(item: Draft, grams: number): Draft {
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
  const [text, setText] = useState("");
  const [items, setItems] = useState<Draft[]>([]);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const textInput = useRef<HTMLInputElement>(null);

  /// Every input — a typed line, a photo, a barcode — lands here and APPENDS. That's the whole
  /// design: you build the meal up one thing at a time and watch the total climb, rather than
  /// composing one long sentence and hoping the model got all of it.
  const absorb = useCallback(async (run: () => Promise<Response>) => {
    setBusy(true);
    setError(null);
    try {
      const res = await run();
      const data: DraftResponse & { error?: string } = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Couldn't read that");
        return;
      }
      setItems((prev) => [
        ...prev,
        ...data.items.map((i) => ({ ...i, photoId: data.photoId, barcode: data.barcode })),
      ]);
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }, []);

  async function addText() {
    const line = text.trim();
    if (!line) return;
    // Clear immediately: the field is ready for the next food while this one is still resolving.
    setText("");
    textInput.current?.focus();
    await absorb(() =>
      fetch("/api/parse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: line }),
      }),
    );
  }

  async function addPhoto(file: File) {
    const form = new FormData();
    // Shrink on-device: an 8MB camera JPEG becomes ~80KB and nothing the model could use is lost.
    form.append("image", await downscale(file));
    await absorb(() => fetch("/api/analyze", { method: "POST", body: form }));
  }

  const addBarcode = useCallback(
    async (code: string) => {
      setScanning(false);
      await absorb(() => fetch(`/api/barcode?code=${encodeURIComponent(code)}`));
    },
    [absorb],
  );

  async function save() {
    setSaving(true);
    setError(null);
    try {
      // One photo can yield several items, so the photoId rides on the items, not the request.
      // Group by it and post once per source so each entry keeps the right picture.
      const groups = new Map<string, Draft[]>();
      for (const item of items) {
        const key = `${item.photoId ?? ""}|${item.barcode ?? ""}`;
        const list = groups.get(key);
        if (list) list.push(item);
        else groups.set(key, [item]);
      }

      for (const group of groups.values()) {
        const res = await fetch("/api/entries", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            date: day,
            mealId: meal.id,
            photoId: group[0].photoId,
            barcode: group[0].barcode,
            items: group,
          }),
        });
        if (!res.ok) throw new Error();
      }
      onSaved();
    } catch {
      setError("Couldn't save. Try again?");
      setSaving(false);
    }
  }

  const total = items.reduce(
    (t, i) => ({
      kcal: t.kcal + i.kcal,
      protein: t.protein + i.protein,
    }),
    { kcal: 0, protein: 0 },
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] flex-col rounded-t-2xl border-t border-border bg-surface"
      >
        <div className="mx-auto flex w-full max-w-lg items-center justify-between px-4 py-4">
          <h2 className="font-semibold">
            Add to <span className="text-muted">{meal.name}</span>
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Input row. Stays put while the list below grows — you never lose the field. */}
        <div className="mx-auto w-full max-w-lg px-4">
          <div className="flex gap-2">
            <input
              ref={textInput}
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addText();
              }}
              placeholder="50g oats"
              className="h-11 min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-3 text-sm placeholder:text-muted focus:border-muted focus:outline-none"
            />
            <button
              onClick={addText}
              disabled={busy || !text.trim()}
              aria-label="Add this food"
              className="grid size-11 shrink-0 place-items-center rounded-lg bg-foreground text-background disabled:opacity-40"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-5" />}
            </button>
          </div>

          <div className="mt-2 flex gap-2">
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              // On a phone this opens the camera directly; on desktop it's a file picker.
              capture="environment"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) addPhoto(file);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => fileInput.current?.click()}
              disabled={busy}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-surface-2 py-2 text-xs text-muted hover:border-muted hover:text-foreground disabled:opacity-40"
            >
              <Camera className="size-3.5" />
              Photo of the plate
            </button>
            <button
              onClick={() => setScanning(true)}
              disabled={busy}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-surface-2 py-2 text-xs text-muted hover:border-muted hover:text-foreground disabled:opacity-40"
            >
              <Barcode className="size-3.5" />
              Scan a packet
            </button>
          </div>

          {error && <p className="mt-2 text-xs text-[var(--over)]">{error}</p>}
        </div>

        {/* The running list. */}
        <div className="mx-auto w-full max-w-lg flex-1 overflow-y-auto px-4 py-3">
          {items.length === 0 ? (
            <p className="py-6 text-center text-xs leading-relaxed text-muted">
              Add foods one at a time — each is analysed as you go.
              <br />
              English or Hinglish, both work.
            </p>
          ) : (
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
                    <div className="mt-1">
                      <MacroLine n={item} />
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={5000}
                      value={round(item.grams, 0)}
                      aria-label={`Grams of ${item.name}`}
                      onChange={(e) => {
                        const g = Number(e.target.value);
                        if (g > 0) {
                          setItems((prev) => prev.map((it, j) => (i === j ? rescale(it, g) : it)));
                        }
                      }}
                      className="w-14 rounded border border-border bg-surface px-1.5 py-1 text-right font-mono text-sm tabular-nums focus:border-muted focus:outline-none"
                    />
                    <span className="text-xs text-muted">g</span>
                  </div>

                  <span className="w-11 shrink-0 text-right font-mono text-sm tabular-nums">
                    {round(item.kcal, 0)}
                  </span>

                  <button
                    onClick={() => setItems((prev) => prev.filter((_, j) => j !== i))}
                    aria-label={`Remove ${item.name}`}
                    className="grid size-7 shrink-0 place-items-center rounded text-muted hover:text-[var(--over)]"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Save bar. Shows the running total so you can stop when you've hit your numbers. */}
        {items.length > 0 && (
          <div className="border-t border-border bg-surface pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
            <div className="mx-auto w-full max-w-lg px-4">
              <button
                onClick={save}
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-foreground py-3 text-sm font-semibold text-background disabled:opacity-40"
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    Save {items.length} item{items.length === 1 ? "" : "s"}
                    <span className="font-mono font-normal opacity-60">
                      {round(total.kcal, 0)} kcal · {round(total.protein, 0)}g P
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {scanning && <BarcodeScanner onDetect={addBarcode} onClose={() => setScanning(false)} />}
    </div>
  );
}
