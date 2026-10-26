const CACHE = "wire-chief-shell-v8";
const BASE = "/Wire-Chife-";
const SHELL = [
  `${BASE}/`,
  `${BASE}/index.html`,
  `${BASE}/404.html`,
  `${BASE}/contacts/`,
  `${BASE}/contacts/index.html`,
  `${BASE}/sign-in/`,
  `${BASE}/sign-in/index.html`,
  `${BASE}/manifest.webmanifest`,
  `${BASE}/icon-192.png`,
  `${BASE}/icon-512.png`,
  `${BASE}/apple-touch-icon.png`,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.all(
        SHELL.map(async (path) => {
          try {
            const response = await fetch(path, { cache: "reload" });
            if (response.ok) await cache.put(path, response);
          } catch {
            // A missing shell file should not block the worker. Visited pages still cache below.
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname !== BASE && !url.pathname.startsWith(`${BASE}/`)) return;
  event.respondWith(networkFirst(request));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(request);
    if (request.mode === "navigate" && fresh.status === 404) {
      const shell = await shellResponse(cache);
      if (shell) return shell;
    }
    if (fresh.ok && (fresh.type === "basic" || fresh.type === "default")) {
      await cache.put(request, fresh.clone());
    }
    return fresh;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (request.mode === "navigate") {
      const shell = await shellResponse(cache);
      if (shell) return shell;
    }
    throw new Error("offline");
  }
}

async function shellResponse(cache) {
  return (await cache.match(`${BASE}/`)) || (await cache.match(`${BASE}/index.html`)) || (await cache.match(`${BASE}/404.html`));
}
