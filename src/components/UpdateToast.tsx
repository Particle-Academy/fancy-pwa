import { useEffect, useRef, type ReactNode } from "react";
import { Button, useToast } from "@particle-academy/react-fancy";
import { usePwaUpdate, type UsePwaUpdateOptions } from "../update";

export interface UpdateToastProps extends UsePwaUpdateOptions {
  /** Toast title. Default `"New version ready"`. */
  title?: string;
  /** Toast description. Default `"Reload to update."`. */
  description?: string;
  /** Reload button label. Default `"Reload"`. */
  reloadLabel?: string;
  /**
   * Render-prop escape hatch. Receives `{ reload, dismiss }` and renders your
   * own affordance instead of the default floating Reload button. The toast
   * still fires.
   */
  children?: (api: { reload: () => void; dismiss: () => void }) => ReactNode;
}

/**
 * Surfaces a one-time toast when a PWA update becomes available (SW app-shell
 * update OR asset drift, unified by `usePwaUpdate`), plus a Reload affordance
 * that applies it. **Propose-then-confirm** — never reloads on its own.
 *
 * Requires a `<Toast.Provider>` ancestor (react-fancy) for the toast; the
 * Reload button renders regardless. SSR-safe.
 */
export function UpdateToast({
  title = "New version ready",
  description = "Reload to update.",
  reloadLabel = "Reload",
  children,
  ...updateOptions
}: UpdateToastProps) {
  const { updateAvailable, reload, dismiss } = usePwaUpdate(updateOptions);
  const { toast } = useToast();
  const firedRef = useRef(false);

  useEffect(() => {
    if (updateAvailable && !firedRef.current) {
      firedRef.current = true;
      toast({ title, description, variant: "info", duration: 0 });
    }
    if (!updateAvailable) firedRef.current = false;
  }, [updateAvailable, toast, title, description]);

  if (!updateAvailable) return null;

  if (children) return <>{children({ reload, dismiss })}</>;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
      <span className="text-sm">{description}</span>
      <Button color="blue" onClick={reload}>
        {reloadLabel}
      </Button>
      <Button variant="ghost" onClick={dismiss}>
        Dismiss
      </Button>
    </div>
  );
}
