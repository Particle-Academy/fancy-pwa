import { useEffect, useState } from "react";
import { emitPwaActivity } from "./activity";

/** The non-standard `navigator.connection` Network Information API. */
interface NetworkInformation extends EventTarget {
  effectiveType?: "slow-2g" | "2g" | "3g" | "4g";
  saveData?: boolean;
  downlink?: number;
}

export interface ConnectionState {
  /** Whether the browser believes it is online. */
  online: boolean;
  /** Coarse connection quality, when the Network Information API is present. */
  effectiveType?: NetworkInformation["effectiveType"];
  /** The user's data-saver preference, when exposed. */
  saveData?: boolean;
  /** Estimated downlink in Mbit/s, when exposed. */
  downlink?: number;
}

function getConnection(): NetworkInformation | undefined {
  if (typeof window === "undefined" || typeof navigator === "undefined") return undefined;
  const nav = navigator as Navigator & {
    connection?: NetworkInformation;
    mozConnection?: NetworkInformation;
    webkitConnection?: NetworkInformation;
  };
  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection;
}

function readOnline(): boolean {
  // Guard on `window` (not `navigator`): Node SSR exposes a global `navigator`
  // with no `onLine`, so keying off `window` is the reliable SSR signal.
  if (typeof window === "undefined" || typeof navigator === "undefined") return true;
  return navigator.onLine;
}

/**
 * Reactive `navigator.onLine`. SSR-safe — returns `true` on the server and
 * subscribes to `online`/`offline` only in the browser.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState<boolean>(readOnline);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setOnline(readOnline());
    const goOnline = () => {
      setOnline(true);
      emitPwaActivity("pwa_online", undefined, "back online");
    };
    const goOffline = () => {
      setOnline(false);
      emitPwaActivity("pwa_offline", undefined, "went offline");
    };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return online;
}

/**
 * Richer connection state — online plus `navigator.connection` hints
 * (effectiveType / saveData / downlink) when the Network Information API is
 * available. SSR-safe.
 */
export function useConnection(): ConnectionState {
  const [state, setState] = useState<ConnectionState>(() => ({ online: readOnline() }));

  useEffect(() => {
    if (typeof window === "undefined") return;

    const read = (): ConnectionState => {
      const conn = getConnection();
      return {
        online: readOnline(),
        effectiveType: conn?.effectiveType,
        saveData: conn?.saveData,
        downlink: conn?.downlink,
      };
    };

    const update = () => setState(read());
    update();

    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    const conn = getConnection();
    conn?.addEventListener?.("change", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      conn?.removeEventListener?.("change", update);
    };
  }, []);

  return state;
}
