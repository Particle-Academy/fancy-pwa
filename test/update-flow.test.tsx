import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

import {
  registerFancyPwa,
  getServiceWorkerSnapshot,
  __resetServiceWorkerState,
} from "../src/service-worker";

/** A tiny EventTarget-backed fake of a ServiceWorkerRegistration. */
class FakeWorker extends EventTarget {
  state = "installing";
  postMessage = vi.fn();
  setState(s: string) {
    this.state = s;
    this.dispatchEvent(new Event("statechange"));
  }
}

class FakeRegistration extends EventTarget {
  installing: FakeWorker | null = null;
  waiting: FakeWorker | null = null;
  update = vi.fn(async () => {});
}

function installFakeSW() {
  const reg = new FakeRegistration();
  const controller = {}; // a truthy controller → installs become "updates" that wait
  const swContainer = new EventTarget() as EventTarget & {
    controller: unknown;
    register: ReturnType<typeof vi.fn>;
  };
  swContainer.controller = controller;
  swContainer.register = vi.fn(async () => reg);
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: swContainer,
  });
  return { reg, swContainer };
}

describe("SW update flow → usePwaUpdate check", () => {
  beforeEach(() => {
    __resetServiceWorkerState();
  });

  it("a newly installed worker (with an existing controller) becomes `waiting`", async () => {
    const { reg } = installFakeSW();

    await act(async () => {
      await registerFancyPwa({ immediate: true });
    });
    expect(getServiceWorkerSnapshot().registered).toBe(true);

    // Simulate an update being found and installing.
    const worker = new FakeWorker();
    reg.installing = worker;
    act(() => {
      reg.dispatchEvent(new Event("updatefound"));
    });
    act(() => {
      worker.setState("installed");
    });

    await waitFor(() => {
      expect(getServiceWorkerSnapshot().waiting).toBe(worker);
    });
  });

  it("usePwaUpdate.check resolves true when a worker is waiting", async () => {
    const { reg } = installFakeSW();
    await act(async () => {
      await registerFancyPwa({ immediate: true });
    });

    // Lazy import so the hook composes the live module state.
    const { usePwaUpdate } = await import("../src/update");
    const { result } = renderHook(() => usePwaUpdate({ enabled: false }));
    expect(result.current.updateAvailable).toBe(false);

    const worker = new FakeWorker();
    reg.installing = worker;
    act(() => {
      reg.dispatchEvent(new Event("updatefound"));
    });
    act(() => {
      worker.setState("installed");
    });

    await waitFor(() => {
      expect(result.current.updateAvailable).toBe(true);
    });
  });
});
