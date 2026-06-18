import { useCallback } from "react";
import { useAppUpdate } from "@particle-academy/fancy-app-update";
import {
  getServiceWorkerSnapshot,
  activateWaitingWorker,
  useServiceWorker,
} from "./service-worker";

export interface PwaUpdate {
  /** True when either a SW worker is waiting OR app-update detected asset drift. */
  updateAvailable: boolean;
  /**
   * Apply the update. Prefers SW skip-waiting (the controllerchange handler
   * reloads); falls back to app-update's hard refresh when no SW is waiting.
   * Never called automatically — propose-then-confirm.
   */
  reload: () => void;
  /** Dismiss the prompt until the next page load. */
  dismiss: () => void;
}

export interface UsePwaUpdateOptions {
  /** Poll interval for the app-update ETag fallback, ms. */
  interval?: number;
  /** Turn detection on/off. Default `true`. */
  enabled?: boolean;
}

/**
 * One unified "an update is ready" signal for the whole app.
 *
 * Composes `@particle-academy/fancy-app-update`'s `useAppUpdate({ check })`:
 *   - `check` resolves `true` the moment a service worker is `waiting`
 *     (an app-shell update), so SW updates surface through the SAME hook.
 *   - When no SW is waiting, app-update falls back to its own ETag /
 *     Last-Modified poll of the page URL, so plain asset drift (no SW)
 *     ALSO surfaces here.
 *
 * Both paths become one `updateAvailable` flag. `reload()` applies whichever
 * is live. **Never auto-reloads** — only on an explicit `reload()` call.
 *
 * SSR-safe: `useAppUpdate` and `useServiceWorker` are both window-guarded.
 */
export function usePwaUpdate(options: UsePwaUpdateOptions = {}): PwaUpdate {
  const { interval, enabled = true } = options;
  // Re-render when SW `waiting` flips so `useAppUpdate`'s next poll/check
  // reflects it (and so the returned flag is fresh).
  const sw = useServiceWorker();

  const { updateAvailable, refresh, dismiss } = useAppUpdate({
    enabled,
    interval,
    // Highest-priority detector: a waiting SW means the new app shell is ready.
    // Returning false here lets app-update fall through to its ETag strategy,
    // so asset-only deploys (no SW) are still caught.
    check: () => getServiceWorkerSnapshot().waiting != null,
  });

  const reload = useCallback(() => {
    if (getServiceWorkerSnapshot().waiting) {
      activateWaitingWorker(); // SKIP_WAITING → controllerchange → reload once
    } else {
      refresh(); // app-update's hard reload
    }
  }, [refresh]);

  // `sw.waiting` is read so an immediate SW-driven update shows even before the
  // next app-update poll tick.
  const available = updateAvailable || sw.waiting != null;

  return { updateAvailable: available, reload, dismiss };
}
