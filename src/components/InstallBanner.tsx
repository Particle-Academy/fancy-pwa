import type { ReactNode } from "react";
import { Button, Callout } from "@particle-academy/react-fancy";
import type { Color } from "@particle-academy/react-fancy";
import { useInstallPrompt, type InstallPrompt } from "../install";

export interface InstallBannerProps {
  /** Callout color. Default `"blue"`. */
  color?: Color;
  /** Heading / body text. Default a generic install nudge. */
  title?: ReactNode;
  /** Install button label. Default `"Install"`. */
  installLabel?: string;
  /** Extra classes on the Callout. */
  className?: string;
  /**
   * Render-prop escape hatch — receive the full install state and render your
   * own UI. When provided, the default Callout chrome is bypassed (you still get
   * `null` suppression handled for you).
   */
  children?: (state: InstallPrompt) => ReactNode;
}

/**
 * A dismissible install nudge built on react-fancy `Callout` + `Button`.
 *
 * Renders `null` unless the browser has offered an install prompt and the app
 * is neither already installed nor dismissed — so it's safe to always mount.
 * SSR-safe via `useInstallPrompt`.
 */
export function InstallBanner({
  color = "blue",
  title = "Install this app for a faster, offline-ready experience.",
  installLabel = "Install",
  className,
  children,
}: InstallBannerProps) {
  const state = useInstallPrompt();
  const { canInstall, installed, dismissed, promptInstall, dismiss } = state;

  if (!canInstall || installed || dismissed) return null;

  if (children) return <>{children(state)}</>;

  return (
    <Callout color={color} dismissible onDismiss={dismiss} className={className}>
      <div className="flex items-center justify-between gap-3">
        <span>{title}</span>
        <Button color={color} onClick={() => void promptInstall()}>
          {installLabel}
        </Button>
      </div>
    </Callout>
  );
}
