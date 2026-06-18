import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import {
  registerFancyPwa,
  useServiceWorker,
  type RegisterFancyPwaOptions,
  type ServiceWorkerState,
} from "./service-worker";

export interface FancyPwaContextValue {
  /** Live service-worker registration state. */
  sw: ServiceWorkerState;
}

const FancyPwaContext = createContext<FancyPwaContextValue | null>(null);

export interface FancyPwaProviderProps {
  children: ReactNode;
  /**
   * Service-worker registration options. Pass `register:false` to skip
   * registering (e.g. when a blade host already registers the SW inline).
   */
  options?: RegisterFancyPwaOptions & { register?: boolean };
}

/**
 * Mounts PWA context and registers the service worker once on the client.
 *
 * SSR-safe: renders `children` with no side effects on the server. Registration
 * happens in a client-only effect; `registerFancyPwa` is itself idempotent and
 * window-guarded.
 */
export function FancyPwaProvider({ children, options }: FancyPwaProviderProps) {
  const sw = useServiceWorker();

  useEffect(() => {
    if (options?.register === false) return;
    void registerFancyPwa(options);
  }, [options]);

  const value = useMemo<FancyPwaContextValue>(() => ({ sw }), [sw]);

  return <FancyPwaContext.Provider value={value}>{children}</FancyPwaContext.Provider>;
}

/**
 * Read the PWA context. Returns `null` when no `<FancyPwaProvider>` is mounted —
 * the standalone hooks (`useServiceWorker`, etc.) work without the provider, so
 * this is an optional convenience.
 */
export function useFancyPwa(): FancyPwaContextValue | null {
  return useContext(FancyPwaContext);
}
