/**
 * @particle-academy/fancy-pwa
 *
 * A lean, framework-agnostic, SSR-safe Progressive Web App layer for the Fancy
 * UI suite. No Workbox, no heavy deps. Every hook is window-guarded with no
 * module-level browser access, so it's safe to import from an SSR bundle.
 *
 *   - Install prompt      `useInstallPrompt()` + `<InstallBanner>`
 *   - Online / offline    `useOnline()` / `useConnection()` + `<OfflineBanner>`
 *   - Service worker      `useServiceWorker()` + `registerFancyPwa()`
 *   - Update detection    `usePwaUpdate()` + `<UpdateToast>` (composes
 *                         `@particle-academy/fancy-app-update`)
 *   - Provider            `<FancyPwaProvider>`
 *
 * Subpath exports:
 *   - `@particle-academy/fancy-pwa/sw`    service-worker strategy toolkit
 *   - `@particle-academy/fancy-pwa/vite`  the `fancyPwa()` Vite plugin
 */

// Install
export { useInstallPrompt } from "./install";
export type { InstallPrompt, PromptInstallResult } from "./install";

// Online / connection
export { useOnline, useConnection } from "./online";
export type { ConnectionState } from "./online";

// Service worker
export {
  registerFancyPwa,
  useServiceWorker,
  activateWaitingWorker,
  checkForUpdate,
  getServiceWorkerSnapshot,
} from "./service-worker";
export type { ServiceWorkerState, RegisterFancyPwaOptions } from "./service-worker";

// Update detection (composed on fancy-app-update)
export { usePwaUpdate } from "./update";
export type { PwaUpdate, UsePwaUpdateOptions } from "./update";

// Provider
export { FancyPwaProvider, useFancyPwa } from "./provider";
export type { FancyPwaProviderProps, FancyPwaContextValue } from "./provider";

// Chrome components (compose react-fancy)
export { InstallBanner } from "./components/InstallBanner";
export type { InstallBannerProps } from "./components/InstallBanner";
export { OfflineBanner } from "./components/OfflineBanner";
export type { OfflineBannerProps } from "./components/OfflineBanner";
export { UpdateToast } from "./components/UpdateToast";
export type { UpdateToastProps } from "./components/UpdateToast";
