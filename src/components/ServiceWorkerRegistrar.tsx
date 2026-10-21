"use client"

import { useEffect } from "react"

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return
    }
    navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
      console.error("Service worker registration failed", error)
    })
  }, [])
  return null
}
