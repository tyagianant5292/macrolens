import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MacroLens",
    short_name: "MacroLens",
    description: "Log meals by photo, text or barcode. Macros, micros and daily totals.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0d10",
    theme_color: "#0b0d10",
    orientation: "portrait",
    icons: [
      // Chrome's install criteria want a real 192 and a real 512 PNG. It was SVG-only before,
      // which renders fine but is not enough to make the app installable on Android.
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Maskable: Android crops the icon to whatever shape the launcher uses, so this one is
      // allowed to have its corners eaten. The artwork is centred with room to spare.
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      // Kept for anything that prefers a vector.
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
