import InitColorSchemeScript from "@mui/material/InitColorSchemeScript";
import type { Metadata } from "next";
import Link from "next/link";
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
          <header className="flex items-center gap-6 border-b border-stone-200 px-6 py-3 dark:border-stone-800">
            <span className="font-semibold">Commute Time Analyzer</span>
            <nav className="flex gap-4 text-sm text-[var(--muted)]">
              <Link className="hover:text-[var(--fg)]" href="/">Overview</Link>
              <Link className="hover:text-[var(--fg)]" href="/patterns">Patterns</Link>
              <Link className="hover:text-[var(--fg)]" href="/quality">Data quality</Link>
            </nav>
          </header>
          <main className="px-6 py-6 max-w-6xl mx-auto">{children}</main>
        </ThemeProviders>
      </body>
    </html>
  );
}
