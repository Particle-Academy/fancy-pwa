/**
 * @particle-academy/fancy-pwa/sw
 *
 * A tiny, Workbox-free service-worker toolkit. Import these INSIDE your app's
 * own `sw.ts` (the entry the Vite plugin bundles) and compose the caching
 * behaviour you want. Everything here runs in the ServiceWorkerGlobalScope.
 *
 *   precache(urls)                 cache the app shell on `install`
 *   registerRoute(matcher, strat)  route fetches to a strategy
 *   networkFirst / cacheFirst /
 *     staleWhileRevalidate         the three classic strategies
 *   offlineFallback(url)           serve a fallback when everything fails
 *
 * On `install` the precache is filled; on `activate` stale caches (any not
 * keyed by the current version) are deleted and clients claimed.
 */

/// <reference lib="webworker" />

/**
 * The SW global. We avoid `declare const self` (which collides with the DOM
 * lib's `self`) by casting through `globalThis` once, here.
 */
const sw = globalThis as unknown as ServiceWorkerGlobalScope & {
  /** Injected by the Vite plugin: the hashed asset filenames to precache. */
  __FANCY_PRECACHE?: string[];
  /** Injected by the Vite plugin: the build hash used to key caches. */
  __FANCY_VERSION?: string;
};

/** A fetch strategy: given a request, produce a response. */
export type Strategy = (request: Request) => Promise<Response>;

/** Route matcher: a RegExp tested against the URL, or a predicate over the request. */
export type RouteMatcher = RegExp | ((request: Request) => boolean);

const VERSION = sw.__FANCY_VERSION ?? "v1";
const PRECACHE_NAME = `fancy-pwa-precache-${VERSION}`;
const RUNTIME_NAME = `fancy-pwa-runtime-${VERSION}`;

interface Route {
  matcher: RouteMatcher;
  strategy: Strategy;
}

const routes: Route[] = [];
let fallbackUrl: string | null = null;
let precacheUrls: string[] = [];

function matches(matcher: RouteMatcher, request: Request): boolean {
  return matcher instanceof RegExp ? matcher.test(request.url) : matcher(request);
}

/** All cache names this build owns — used to spare them on `activate` cleanup. */
function currentCacheNames(): string[] {
  return [PRECACHE_NAME, RUNTIME_NAME];
}

/**
 * Register the app-shell URLs to cache on install. The plugin-injected
 * `self.__FANCY_PRECACHE` list is merged in automatically, so calling
 * `precache([])` is enough to cache exactly the build's hashed assets.
 */
export function precache(urls: string[] = []): void {
  const injected = sw.__FANCY_PRECACHE ?? [];
  precacheUrls = Array.from(new Set([...injected, ...urls]));
}

/** Register a route → strategy. Routes are tested in registration order. */
export function registerRoute(matcher: RouteMatcher, strategy: Strategy): void {
  routes.push({ matcher, strategy });
}

/** Set a fallback URL served when a navigation/request can't be satisfied. */
export function offlineFallback(url: string): void {
  fallbackUrl = url;
}

// ---- strategies -----------------------------------------------------------

/**
 * Network first, fall back to cache. Optionally cap freshness with `ttl` (ms):
 * a cached response older than `ttl` is ignored when the network is also down.
 */
export function networkFirst(options: { ttl?: number; cacheName?: string } = {}): Strategy {
  const { ttl, cacheName = RUNTIME_NAME } = options;
  return async (request) => {
    const cache = await caches.open(cacheName);
    try {
      const fresh = await fetch(request);
      if (fresh && fresh.ok) await cache.put(request, stamp(fresh.clone()));
      return fresh;
    } catch {
      const cached = await cache.match(request);
      if (cached && !isStale(cached, ttl)) return cached;
      if (cached) return cached; // stale but better than nothing offline
      throw new Error(`networkFirst: no response for ${request.url}`);
    }
  };
}

/**
 * Cache first, fall back to network (and populate the cache). `max` caps the
 * number of entries kept (oldest evicted, best-effort FIFO).
 */
export function cacheFirst(options: { max?: number; cacheName?: string } = {}): Strategy {
  const { max, cacheName = RUNTIME_NAME } = options;
  return async (request) => {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    if (cached) return cached;
    const fresh = await fetch(request);
    if (fresh && fresh.ok) {
      await cache.put(request, fresh.clone());
      if (max) await trim(cache, max);
    }
    return fresh;
  };
}

/**
 * Serve from cache immediately while refreshing it in the background. Falls
 * through to the network on a cold cache.
 */
export function staleWhileRevalidate(options: { cacheName?: string } = {}): Strategy {
  const { cacheName = RUNTIME_NAME } = options;
  return async (request) => {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    const network = fetch(request)
      .then((res) => {
        if (res && res.ok) void cache.put(request, res.clone());
        return res;
      })
      .catch(() => undefined);
    return cached ?? (await network) ?? Promise.reject(new Error("swr: no response"));
  };
}

// ---- cache freshness helpers ---------------------------------------------

const STAMP_HEADER = "x-fancy-pwa-cached-at";

function stamp(res: Response): Response {
  // Tag the response with a fetch timestamp so `ttl` can be enforced later.
  const headers = new Headers(res.headers);
  headers.set(STAMP_HEADER, String(Date.now()));
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

function isStale(res: Response, ttl?: number): boolean {
  if (!ttl) return false;
  const at = Number(res.headers.get(STAMP_HEADER) ?? 0);
  if (!at) return false;
  return Date.now() - at > ttl;
}

async function trim(cache: Cache, max: number): Promise<void> {
  const keys = await cache.keys();
  if (keys.length <= max) return;
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

// ---- lifecycle ------------------------------------------------------------

sw.addEventListener("install", (event) => {
  const e = event as ExtendableEvent;
  e.waitUntil(
    (async () => {
      if (precacheUrls.length) {
        const cache = await caches.open(PRECACHE_NAME);
        await cache.addAll(precacheUrls);
      }
      // New worker is ready; it still WAITS unless the app posts SKIP_WAITING.
    })(),
  );
});

sw.addEventListener("activate", (event) => {
  const e = event as ExtendableEvent;
  e.waitUntil(
    (async () => {
      const keep = new Set(currentCacheNames());
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n.startsWith("fancy-pwa-") && !keep.has(n))
          .map((n) => caches.delete(n)),
      );
      await sw.clients.claim();
    })(),
  );
});

sw.addEventListener("message", (event) => {
  const e = event as ExtendableMessageEvent;
  if ((e.data as { type?: string } | undefined)?.type === "SKIP_WAITING") {
    void sw.skipWaiting();
  }
});

sw.addEventListener("fetch", (event) => {
  const e = event as FetchEvent;
  const { request } = e;
  if (request.method !== "GET") return;

  const route = routes.find((r) => matches(r.matcher, request));
  if (!route && !fallbackUrl) return; // let the browser handle it

  e.respondWith(
    (async () => {
      try {
        if (route) return await route.strategy(request);
        throw new Error("no route");
      } catch {
        if (fallbackUrl) {
          const cache = await caches.open(PRECACHE_NAME);
          const fb = await cache.match(fallbackUrl);
          if (fb) return fb;
          return fetch(fallbackUrl);
        }
        return Response.error();
      }
    })(),
  );
});

/** The cache names this build uses (exposed for tests / diagnostics). */
export const cacheNames = { precache: PRECACHE_NAME, runtime: RUNTIME_NAME, version: VERSION };
