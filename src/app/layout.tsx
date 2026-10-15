import InitColorSchemeScript from "@mui/material/InitColorSchemeScript";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import ThemeProviders from "@/components/ThemeProviders";
import "./globals.css";

export const metadata: Metadata = {
  title: "Commute Time Analyzer",
  description: "Traffic-aware travel-time collector and analysis dashboard",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <InitColorSchemeScript defaultMode="system" />
      </head>
      <body className="min-h-screen">
        <ThemeProviders>
          <header className="border-b border-stone-200 dark:border-stone-800 px-6 py-3">
            <span className="font-semibold">Commute Time Analyzer</span>
          </header>
          <main className="px-6 py-6 max-w-6xl mx-auto">{children}</main>
        </ThemeProviders>
      </body>
    </html>
  );
}
