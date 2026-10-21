import InitColorSchemeScript from "@mui/material/InitColorSchemeScript";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";
import ThemeProviders from "@/components/ThemeProviders";
import "./globals.css";

export const metadata: Metadata = {
  title: "Commute time",
  description: "Traffic-aware drive time for the selected day",
};

export const viewport: Viewport = {
  themeColor: "#1c1917",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <InitColorSchemeScript defaultMode="system" />
      </head>
      <body className="min-h-screen">
        <ServiceWorkerRegistrar />
        <ThemeProviders>
          <header className="flex items-center border-b border-stone-200 px-6 py-3 dark:border-stone-800">
            <span className="font-semibold">Commute time</span>
          </header>
          <main className="px-6 py-6 max-w-6xl mx-auto">{children}</main>
        </ThemeProviders>
      </body>
    </html>
  );
}
