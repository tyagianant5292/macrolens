import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { ServiceWorker } from "@/components/ServiceWorker";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MacroLens",
  description: "Log meals by photo, text or barcode. Macros, micros and daily totals.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    // Black-translucent: the page paints under the status bar, which is what makes the app
    // look native rather than like a web page in a frame.
    statusBarStyle: "black-translucent",
    title: "MacroLens",
  },
  // iOS ignores the manifest's icons for the home-screen icon and uses this instead.
  icons: { apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#0b0d10",
  width: "device-width",
  initialScale: 1,
  // Lets the sticky header sit under the notch instead of beside it.
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
