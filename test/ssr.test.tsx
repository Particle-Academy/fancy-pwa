// @vitest-environment node
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { useInstallPrompt } from "../src/install";
import { useOnline, useConnection } from "../src/online";
import { useServiceWorker } from "../src/service-worker";
import { registerFancyPwa } from "../src/service-worker";

/**
 * In the `node` environment there is no `window` / `navigator`, so these assert
 * the SSR-safe defaults: hooks must render without throwing and return inert
 * values.
 */
describe("SSR safety (no window)", () => {
  it("window is undefined in this environment", () => {
    expect(typeof window).toBe("undefined");
  });

  it("hooks render to string without throwing and return sane defaults", () => {
    let captured: Record<string, unknown> = {};
    function Probe() {
      const install = useInstallPrompt();
      const online = useOnline();
      const conn = useConnection();
      const sw = useServiceWorker();
      captured = { install, online, conn, sw };
      return null;
    }
    expect(() => renderToString(createElement(Probe))).not.toThrow();

    const install = captured.install as ReturnType<typeof useInstallPrompt>;
    expect(install.canInstall).toBe(false);
    expect(install.installed).toBe(false);
    expect(captured.online).toBe(true); // assume online under SSR
    expect((captured.conn as { online: boolean }).online).toBe(true);
    const sw = captured.sw as ReturnType<typeof useServiceWorker>;
    expect(sw.registered).toBe(false);
    expect(sw.waiting).toBe(null);
  });

  it("registerFancyPwa resolves null (no-op) under SSR", async () => {
    await expect(registerFancyPwa()).resolves.toBe(null);
  });
});
