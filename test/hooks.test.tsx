import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useInstallPrompt } from "../src/install";
import { useOnline } from "../src/online";

function fireBeforeInstallPrompt() {
  const evt = new Event("beforeinstallprompt") as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  };
  evt.prompt = vi.fn(() => Promise.resolve());
  evt.userChoice = Promise.resolve({ outcome: "accepted", platform: "web" });
  window.dispatchEvent(evt);
  return evt;
}

describe("useInstallPrompt", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("captures beforeinstallprompt → canInstall true and promptInstall resolves", async () => {
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.canInstall).toBe(false);

    act(() => {
      fireBeforeInstallPrompt();
    });
    expect(result.current.canInstall).toBe(true);

    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.promptInstall();
    });
    expect(outcome).toBe("accepted");
    expect(result.current.canInstall).toBe(false);
  });

  it("promptInstall returns 'unavailable' with no captured event", async () => {
    const { result } = renderHook(() => useInstallPrompt());
    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.promptInstall();
    });
    expect(outcome).toBe("unavailable");
  });

  it("appinstalled → installed true", () => {
    const { result } = renderHook(() => useInstallPrompt());
    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });
    expect(result.current.installed).toBe(true);
  });

  it("dismiss persists to localStorage", () => {
    const { result } = renderHook(() => useInstallPrompt());
    act(() => {
      result.current.dismiss();
    });
    expect(result.current.dismissed).toBe(true);
    expect(window.localStorage.getItem("fancy-pwa:install-dismissed")).toBe("1");
  });
});

describe("useOnline", () => {
  it("toggles on online/offline events", () => {
    const { result } = renderHook(() => useOnline());
    expect(result.current).toBe(true); // jsdom defaults online

    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(result.current).toBe(false);

    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(result.current).toBe(true);
  });
});
