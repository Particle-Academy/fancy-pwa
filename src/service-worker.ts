import { useCallback, useEffect, useState } from "react";
import { emitPwaActivity } from "./activity";

export interface RegisterFancyPwaOptions {
  /** URL of the built service worker. Default `/sw.js`. */
  swUrl?: string;
  /** Registration scope. Defaults to the SW URL's directory. */
  scope?: string;
  /** Register immediately, or wait for the `load` event. Default `true`. */
  immediate?: boolean;
}

export interface ServiceWorkerState {
  /** True once a registration exists. */
  registered: boolean;
  /** A worker that has installed and is waiting to activate (an update). */
  waiting: ServiceWorker | null;
  /** True once a worker controls the page (offline cache is live). */
  offlineReady: boolean;
  /** Registration error, if any. */
  error: Error | null;
  /** Tell the waiting worker to skip waiting + take over (reloads on swap). */
  activate: () => void;
}

/**
 * Shared, module-level SW state. The provider / `registerFancyPwa` keep it
 * current; `useServiceWorker` subscribes to it, and `usePwaUpdate` reads
 * `waiting` from it for its `check`. Lives outside React so a single SW
 * registration backs every consumer.
 */
type Snapshot = {
  registered: boolean;
  waiting: ServiceWorker | null;
  offlineReady: boolean;
  error: Error | null;
};

const snapshot: Snapshot = {
  registered: false,
  waiting: null,
  offlineReady: false,
  error: null,
};

let registration: ServiceWorkerRegistration | null = null;
let registerPromise: Promise<ServiceWorkerRegistration | null> | null = null;
let controllerChangeBound = false;
let reloading = false;

const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Read-only view of the current SW snapshot (for non-React consumers). */
export function getServiceWorkerSnapshot(): Readonly<Snapshot> {
  return snapshot;
}

function setWaiting(worker: ServiceWorker | null): void {
  if (snapshot.waiting === worker) return;
  snapshot.waiting = worker;
  notify();
  if (worker) emitPwaActivity("pwa_update_available", undefined, "a new version is ready");
}

function trackInstalling(worker: ServiceWorker | null): void {
  if (!worker) return;
  worker.addEventListener("statechange", () => {
    if (worker.state === "installed") {
      if (typeof navigator !== "undefined" && navigator.serviceWorker.controller) {
        // An existing controller means this install is an UPDATE → it waits.
        setWaiting(worker);
      } else {
        // First install → offline cache is now primed.
        snapshot.offlineReady = true;
        notify();
        emitPwaActivity("pwa_offline_ready", undefined, "ready to work offline");
      }
    }
  });
}

function bindControllerChange(): void {
  if (controllerChangeBound || typeof navigator === "undefined") return;
  controllerChangeBound = true;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    // Reload ONCE when the new worker takes control (after SKIP_WAITING).
    if (reloading) return;
    reloading = true;
    if (typeof window !== "undefined") window.location.reload();
  });
}

/** Post SKIP_WAITING to the waiting worker. The controllerchange handler reloads. */
export function activateWaitingWorker(): void {
  const worker = snapshot.waiting;
  if (!worker) return;
  bindControllerChange();
  worker.postMessage({ type: "SKIP_WAITING" });
}

/**
 * Register the service worker. Idempotent — a second call returns the same
 * in-flight/settled promise. Window/navigator-guarded, so it's a no-op (resolves
 * `null`) under SSR or where service workers are unsupported.
 */
export function registerFancyPwa(
  options: RegisterFancyPwaOptions = {},
): Promise<ServiceWorkerRegistration | null> {
  const { swUrl = "/sw.js", scope, immediate = true } = options;

  if (registerPromise) return registerPromise;
  if (
    typeof window === "undefined" ||
    typeof navigator === "undefined" ||
    !("serviceWorker" in navigator)
  ) {
    return Promise.resolve(null);
  }

  registerPromise = new Promise<ServiceWorkerRegistration | null>((resolve) => {
    const run = async () => {
      try {
        const reg = await navigator.serviceWorker.register(
          swUrl,
          scope ? { scope } : undefined,
        );
        registration = reg;
        snapshot.registered = true;
        snapshot.error = null;
        if (navigator.serviceWorker.controller) snapshot.offlineReady = true;
        notify();
        bindControllerChange();

        // Already have a waiting worker (updated before this load).
        if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);

        reg.addEventListener("updatefound", () => {
          trackInstalling(reg.installing);
        });
        // Catch a worker that installed between register() and listener bind.
        trackInstalling(reg.installing);

        resolve(reg);
      } catch (err) {
        snapshot.error = err instanceof Error ? err : new Error(String(err));
        notify();
        resolve(null);
      }
    };

    if (immediate || document.readyState === "complete") {
      void run();
    } else {
      window.addEventListener("load", () => void run(), { once: true });
    }
  });

  return registerPromise;
}

/** Ask the browser to check the SW URL for an update now. */
export async function checkForUpdate(): Promise<void> {
  try {
    await registration?.update();
  } catch {
    /* offline / network blip — ignore */
  }
}

/**
 * Subscribe to SW registration lifecycle. SSR-safe (returns inert defaults on
 * the server). Does NOT itself register — mount `<FancyPwaProvider>` or call
 * `registerFancyPwa` for that.
 */
export function useServiceWorker(): ServiceWorkerState {
  const [, force] = useState(0);

  useEffect(() => subscribe(() => force((n) => n + 1)), []);

  const activate = useCallback(() => activateWaitingWorker(), []);

  return {
    registered: snapshot.registered,
    waiting: snapshot.waiting,
    offlineReady: snapshot.offlineReady,
    error: snapshot.error,
    activate,
  };
}

/** Test-only: reset the module singleton between cases. */
export function __resetServiceWorkerState(): void {
  snapshot.registered = false;
  snapshot.waiting = null;
  snapshot.offlineReady = false;
  snapshot.error = null;
  registration = null;
  registerPromise = null;
  controllerChangeBound = false;
  reloading = false;
  listeners.clear();
}
