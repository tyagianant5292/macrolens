"use client";

import { Keyboard, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Props = {
  onDetect: (code: string) => void;
  onClose: () => void;
};

/// Live barcode scanning.
///
/// ZXing rather than the native BarcodeDetector API: BarcodeDetector doesn't exist in Safari,
/// so on an iPhone the native path would just silently never fire — a feature that appears to
/// work and doesn't. ZXing is ~200KB, so it's imported dynamically here and only downloaded
/// when someone actually opens the scanner.
///
/// Manual entry is always offered alongside. Cameras fail: bad light, a crumpled wrapper, a
/// denied permission. A scanner with no way to just type the number is a dead end.
export function BarcodeScanner({ onDetect, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [typed, setTyped] = useState("");
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    if (manual) return;

    let stop: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (cancelled) return;

        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromVideoDevice(
          undefined, // let the browser pick; on a phone it prefers the rear camera
          videoRef.current!,
          (result) => {
            if (result) onDetect(result.getText());
          },
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        stop = () => controls.stop();
        setStarting(false);
      } catch {
        if (!cancelled) {
          setError("Couldn't start the camera");
          setManual(true);
        }
      }
    })();

    return () => {
      cancelled = true;
      stop?.();
    };
  }, [manual, onDetect]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black">
      <div className="flex items-center justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <span className="text-sm font-medium text-white">
          {manual ? "Enter barcode" : "Point at the barcode"}
        </span>
        <button
          onClick={onClose}
          aria-label="Close scanner"
          className="grid size-9 place-items-center rounded-lg text-white/70 hover:bg-white/10"
        >
          <X className="size-5" />
        </button>
      </div>

      {manual ? (
        <form
          className="flex flex-1 flex-col items-center justify-center gap-3 px-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (/^\d{8,14}$/.test(typed)) onDetect(typed);
            else setError("A barcode is 8–14 digits");
          }}
        >
          <input
            autoFocus
            inputMode="numeric"
            value={typed}
            onChange={(e) => {
              setTyped(e.target.value.replace(/\D/g, ""));
              setError(null);
            }}
            placeholder="8901234567890"
            className="w-full max-w-xs rounded-lg border border-white/20 bg-white/5 px-3 py-2.5 text-center font-mono text-lg tracking-wider text-white placeholder:text-white/25 focus:border-white/50 focus:outline-none"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={typed.length < 8}
            className="w-full max-w-xs rounded-lg bg-white py-2.5 text-sm font-semibold text-black disabled:opacity-40"
          >
            Look up
          </button>
        </form>
      ) : (
        <div className="relative flex-1">
          <video
            ref={videoRef}
            playsInline
            muted
            className="size-full object-cover"
            aria-label="Barcode scanner camera view"
          />
          {starting && (
            <div className="absolute inset-0 grid place-items-center">
              <Loader2 className="size-6 animate-spin text-white/60" />
            </div>
          )}
          {/* Framing guide — a barcode is wide and short, so the reticle should be too. */}
          <div className="pointer-events-none absolute inset-x-8 top-1/2 h-28 -translate-y-1/2 rounded-lg border-2 border-white/70" />
        </div>
      )}

      <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          onClick={() => {
            setManual(!manual);
            setError(null);
          }}
          className="mx-auto flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-white/60 hover:bg-white/10 hover:text-white"
        >
          <Keyboard className="size-3.5" />
          {manual ? "Use the camera instead" : "Type the number instead"}
        </button>
      </div>
    </div>
  );
}
