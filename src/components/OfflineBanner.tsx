import type { ReactNode } from "react";
import { Callout } from "@particle-academy/react-fancy";
import type { Color } from "@particle-academy/react-fancy";
import { useOnline } from "../online";

export interface OfflineBannerProps {
  /** Callout color while offline. Default `"amber"`. */
  color?: Color;
  /** Message text. Default a generic offline notice. */
  children?: ReactNode;
  /** Extra classes on the Callout. */
  className?: string;
}

/**
 * A persistent, accessible offline notice built on react-fancy `Callout`.
 * Shown only while `navigator.onLine` is false. `aria-live="polite"` so screen
 * readers announce the connectivity change. SSR-safe (renders nothing on the
 * server, since SSR is assumed online).
 */
export function OfflineBanner({
  color = "amber",
  children = "You're offline. Some features may be unavailable until you reconnect.",
  className,
}: OfflineBannerProps) {
  const online = useOnline();
  if (online) return null;

  return (
    <div aria-live="polite">
      <Callout color={color} className={className}>
        {children}
      </Callout>
    </div>
  );
}
