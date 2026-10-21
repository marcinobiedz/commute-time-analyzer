import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Commute time",
    short_name: "Commute",
    description: "Traffic-aware commute drive times, one bar per 5-minute sample.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fafaf9",
    theme_color: "#1c1917",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
