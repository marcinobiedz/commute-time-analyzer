const CACHE_NAME = "commute-shell-v1"
const SHELL_URL = "/"

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.add(SHELL_URL))
      .catch((error) => console.warn("Shell cache failed during install", error)),
  )
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") {
    return
  }
  event.respondWith(
    fetch(event.request).catch(() => caches.match(SHELL_URL)),
  )
})
