import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, Rajdhani } from "next/font/google";
import { Suspense } from "react";
import { AppShell } from "@/components/chrome";
import { DbProvider } from "@/components/db-ready";
import { PageFallback } from "@/components/states";
import { assetPath } from "@/lib/base-path";
import "./globals.css";

const body = Atkinson_Hyperlegible({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-body",
});

const display = Rajdhani({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: {
    default: "Wire Chief",
    template: "%s · Wire Chief",
  },
  description: "Jobsite daily reports, crew, open items, and material takeoffs for AKA Electric Inc. Stored on this device.",
  applicationName: "Wire Chief",
  appleWebApp: {
    capable: true,
    title: "Wire Chief",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: assetPath("/icon-192.png"), sizes: "192x192", type: "image/png" },
      { url: assetPath("/icon-512.png"), sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: assetPath("/apple-touch-icon.png"), sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#07090f",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable} dark h-full antialiased`}>
      <body className="min-h-full">
        <DbProvider>
          <Suspense fallback={<PageFallback />}>
            <AppShell>{children}</AppShell>
          </Suspense>
        </DbProvider>
      </body>
    </html>
  );
}
