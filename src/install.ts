import { useCallback, useEffect, useRef, useState } from "react";
import { emitPwaActivity } from "./activity";

/**
 * The non-standard `beforeinstallprompt` event (Chromium). Captured so we can
 * trigger the native install UI on demand instead of letting the browser show
 * its own mini-infobar.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export type PromptInstallResult = "accepted" | "dismissed" | "unavailable";

export interface InstallPrompt {
  /** True when the browser has offered an install prompt we can replay. */
  canInstall: boolean;
  /** Trigger the native install dialog. Resolves with the user's choice. */
  promptInstall: () => Promise<PromptInstallResult>;
  /** True once the app has been installed (this session, or running standalone). */
  installed: boolean;
  /** True when the user has dismissed our install affordance (persisted). */
  dismissed: boolean;
  /** Hide the install affordance and remember it. */
  dismiss: () => void;
}

const DISMISS_KEY = "fancy-pwa:install-dismissed";

function readDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  } catch {
    /* matchMedia unsupported */
  }
  // iOS Safari
  return (window.navigator as { standalone?: boolean }).standalone === true;
}

/**
 * Capture the browser's install prompt and expose a one-call installer.
 *
 * SSR-safe: every browser-API touch is window-guarded and lives in effects, so
 * the hook returns inert defaults on the server (`canInstall:false`,
 * `promptInstall` → `"unavailable"`).
 */
export function useInstallPrompt(): InstallPrompt {
  const [canInstall, setCanInstall] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setDismissed(readDismissed());
    if (isStandalone()) setInstalled(true);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      deferredRef.current = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    };
    const onInstalled = () => {
      deferredRef.current = null;
      setCanInstall(false);
      setInstalled(true);
      emitPwaActivity("pwa_installed", undefined, "the app was installed");
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<PromptInstallResult> => {
    const evt = deferredRef.current;
    if (!evt) return "unavailable";
    try {
      await evt.prompt();
      const { outcome } = await evt.userChoice;
      deferredRef.current = null;
      setCanInstall(false);
      if (outcome === "accepted") {
        emitPwaActivity("pwa_install_accepted");
      }
      return outcome;
    } catch {
      return "unavailable";
    }
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* storage unavailable (private mode) — keep in-memory only */
    }
  }, []);

  return { canInstall, promptInstall, installed, dismissed, dismiss };
}
