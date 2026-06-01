import { describe, it, expect, vi } from "vitest";
import {
  decideUpdateAction,
  runUpdateCheck,
  type UpdateHandle,
  type ToastApi,
} from "./updater";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeUpdate(version = "9.9.9"): UpdateHandle {
  return {
    version,
    currentVersion: "0.4.0",
    downloadAndInstall: vi.fn(async () => {}),
  };
}

function makeToast(): ToastApi & {
  calls: { method: string; args: unknown[] }[];
} {
  const calls: { method: string; args: unknown[] }[] = [];
  let idCounter = 1;

  const record =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push({ method, args });
      return idCounter++;
    };

  return {
    calls,
    success: record("success") as ToastApi["success"],
    error: record("error") as ToastApi["error"],
    warning: record("warning") as ToastApi["warning"],
    loading: record("loading") as ToastApi["loading"],
    dismiss: record("dismiss") as ToastApi["dismiss"],
  };
}

// ── decideUpdateAction ───────────────────────────────────────────────────────

describe("decideUpdateAction", () => {
  it("null update + startup -> {kind:'none'}", () => {
    expect(decideUpdateAction(null, "startup")).toEqual({ kind: "none" });
  });

  it("null update + manual -> {kind:'up-to-date'}", () => {
    expect(decideUpdateAction(null, "manual")).toEqual({ kind: "up-to-date" });
  });

  it("non-null update + startup -> {kind:'offer', version:'9.9.9'}", () => {
    const update = makeUpdate("9.9.9");
    expect(decideUpdateAction(update, "startup")).toEqual({
      kind: "offer",
      version: "9.9.9",
    });
  });
});

// ── runUpdateCheck ───────────────────────────────────────────────────────────

describe("runUpdateCheck", () => {
  it("checkFn rejecting + manual -> toast.error called once", async () => {
    const toast = makeToast();
    const checkFn = vi.fn(async (): Promise<UpdateHandle | null> => {
      throw new Error("network error");
    });
    const relaunchFn = vi.fn(async () => {});

    await runUpdateCheck({ trigger: "manual", checkFn, relaunchFn, toast });

    const errorCalls = toast.calls.filter((c) => c.method === "error");
    expect(errorCalls).toHaveLength(1);
    expect(errorCalls[0].args[0]).toBe("Update check failed");
  });

  it(
    "checkFn resolving an UpdateHandle + manual -> warning shown; onClick triggers downloadAndInstall + relaunch",
    async () => {
      const toast = makeToast();
      const update = makeUpdate("9.9.9");
      const checkFn = vi.fn(async (): Promise<UpdateHandle | null> => update);
      const relaunchFn = vi.fn(async () => {});

      await runUpdateCheck({ trigger: "manual", checkFn, relaunchFn, toast });

      // warning should have been called
      const warningCalls = toast.calls.filter((c) => c.method === "warning");
      expect(warningCalls).toHaveLength(1);
      expect(warningCalls[0].args[0]).toContain("v9.9.9");

      // Extract the action.onClick from the options object
      const options = warningCalls[0].args[1] as {
        action?: { label: string; onClick: () => void };
      };
      expect(options.action?.label).toBe("Install");

      // Simulate the user clicking "Install"
      await options.action!.onClick();

      expect(update.downloadAndInstall).toHaveBeenCalledOnce();
      expect(relaunchFn).toHaveBeenCalledOnce();
    },
  );
});
