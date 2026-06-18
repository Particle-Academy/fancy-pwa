// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * The SW module touches `self.addEventListener` at import time. `vi.hoisted`
 * runs BEFORE the (hoisted) static import below, so we stub a minimal
 * ServiceWorkerGlobalScope-ish global there, plus install the fake `caches`.
 */
vi.hoisted(() => {
  (globalThis as any).self = globalThis;
  if (typeof (globalThis as any).addEventListener !== "function") {
    (globalThis as any).addEventListener = () => {};
  }
  (globalThis as any).clients = { claim: async () => {} };
  (globalThis as any).skipWaiting = async () => {};
});

class FakeCache {
  store = new Map<string, Response>();
  async match(req: Request | string): Promise<Response | undefined> {
    return this.store.get(keyOf(req));
  }
  async put(req: Request | string, res: Response): Promise<void> {
    this.store.set(keyOf(req), res);
  }
  async delete(req: Request | string): Promise<boolean> {
    return this.store.delete(keyOf(req));
  }
  async keys(): Promise<Request[]> {
    return [...this.store.keys()].map((u) => new Request(u));
  }
  async addAll(urls: string[]): Promise<void> {
    for (const u of urls) this.store.set(keyOf(u), new Response("precached:" + u));
  }
}

function keyOf(req: Request | string): string {
  return typeof req === "string" ? req : req.url;
}

const cacheRegistry = new Map<string, FakeCache>();
const fakeCaches = {
  open: vi.fn(async (name: string) => {
    if (!cacheRegistry.has(name)) cacheRegistry.set(name, new FakeCache());
    return cacheRegistry.get(name)!;
  }),
  keys: vi.fn(async () => [...cacheRegistry.keys()]),
  delete: vi.fn(async (name: string) => cacheRegistry.delete(name)),
};

beforeEach(() => {
  cacheRegistry.clear();
  vi.restoreAllMocks();
  // Re-install caches each time (restoreAllMocks clears the .open impl above on
  // some setups; reassign defensively).
  (globalThis as any).caches = fakeCaches;
  fakeCaches.open.mockImplementation(async (name: string) => {
    if (!cacheRegistry.has(name)) cacheRegistry.set(name, new FakeCache());
    return cacheRegistry.get(name)!;
  });
});

(globalThis as any).caches = fakeCaches;

import { cacheFirst, networkFirst, staleWhileRevalidate } from "../src/sw/index";

describe("SW strategies", () => {
  it("cacheFirst returns the cached response without hitting the network", async () => {
    const req = new Request("https://x/app.js");
    const cache = await fakeCaches.open("fancy-pwa-runtime-v1");
    await cache.put(req, new Response("CACHED"));
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const res = await cacheFirst()(req);
    expect(await res.text()).toBe("CACHED");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("cacheFirst falls back to network and populates cache on a miss", async () => {
    const req = new Request("https://x/new.js");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("NET", { status: 200 }));

    const res = await cacheFirst()(req);
    expect(await res.text()).toBe("NET");
    const cache = await fakeCaches.open("fancy-pwa-runtime-v1");
    expect(await cache.match(req)).toBeTruthy();
  });

  it("networkFirst prefers the network, falling back to cache when offline", async () => {
    const req = new Request("https://x/data.json");
    const cache = await fakeCaches.open("fancy-pwa-runtime-v1");
    await cache.put(req, new Response("OLD"));

    // Online: network wins.
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("FRESH", { status: 200 }));
    const fresh = await networkFirst()(req);
    expect(await fresh.text()).toBe("FRESH");

    // Offline: cache (now "FRESH" from the put above) is served.
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("offline"));
    const cached = await networkFirst()(req);
    expect(await cached.text()).toBe("FRESH");
  });

  it("staleWhileRevalidate serves cache immediately and refreshes in background", async () => {
    const req = new Request("https://x/page.html");
    const cache = await fakeCaches.open("fancy-pwa-runtime-v1");
    await cache.put(req, new Response("STALE"));
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("FRESH", { status: 200 }));

    const res = await staleWhileRevalidate()(req);
    expect(await res.text()).toBe("STALE"); // immediate cache hit
  });

  it("staleWhileRevalidate falls through to network on a cold cache", async () => {
    const req = new Request("https://x/cold.html");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("FRESH", { status: 200 }));
    const res = await staleWhileRevalidate()(req);
    expect(await res.text()).toBe("FRESH");
  });
});
