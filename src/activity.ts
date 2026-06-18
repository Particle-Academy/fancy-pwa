/**
 * Optional Human+ activity emission.
 *
 * `@particle-academy/fancy-auto-common` is an OPTIONAL peer — never a hard dep.
 * When it resolves, PWA lifecycle moments (install, offline↔online, an update
 * becoming available) broadcast an `AutoActivityEvent` so presence / coaching
 * layers can compose for free. When it is absent, this is a silent no-op.
 *
 * We import it lazily + best-effort (mirroring fancy-heuristics-js's optional
 * peer pattern) so the dependency stays soft and SSR-safe.
 */

const AGENT_ID = "fancy-pwa";

let emit:
  | ((event: {
      agentId: string;
      agentName?: string;
      target: { kind: string; label?: string };
      action: string;
      timestamp: number;
      meta?: Record<string, unknown>;
      source?: string;
    }) => void)
  | null
  | undefined;

let loading: Promise<void> | null = null;

function load(): void {
  if (emit !== undefined || loading) return;
  loading = import("@particle-academy/fancy-auto-common")
    .then((mod) => {
      emit = (mod as { emitActivity?: typeof emit }).emitActivity ?? null;
    })
    .catch(() => {
      emit = null;
    });
}

/**
 * Best-effort: broadcast a PWA activity event through fancy-auto-common when it
 * is installed. Safe to call anywhere — no-ops under SSR and when the optional
 * peer is missing.
 */
export function emitPwaActivity(
  action: string,
  meta?: Record<string, unknown>,
  label?: string,
): void {
  if (typeof window === "undefined") return;
  load();
  // If the module is already resolved, emit synchronously; otherwise emit once
  // it lands (the lifecycle moment is best-effort, so a microtask delay is fine).
  const send = () => {
    try {
      emit?.({
        agentId: AGENT_ID,
        agentName: "PWA",
        target: { kind: "ux", label },
        action,
        timestamp: Date.now(),
        meta,
        source: "agent",
      });
    } catch {
      /* never let activity break the app */
    }
  };
  if (emit !== undefined) {
    send();
  } else {
    loading?.then(send);
  }
}
