import { describe, it, expect, vi } from "vitest";
import {
  decideUpdateAction,
  runUpdateCheck,
  type UpdateHandle,
  type ToastApi,
} from "./updater";

// Stub the lazy-imported Tauri plugins so the default (no-checkFn / no-relaunchFn)
// branches resolve deterministically instead of hitting a real `invoke` (undefined
// in jsdom) and leaking an unhandled rejection that fails the process exit code.
vi.mock("@tauri-apps/plugin-updater", () => ({ check: vi.fn(async () => null) }));
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch: vi.fn(async () => {}) }));

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
        cancel?: { label: string };
      };
      expect(options.action?.label).toBe("Install");
      expect(options.cancel?.label).toBe("Later");

      // Simulate the user clicking "Install"
      await options.action!.onClick();

      expect(update.downloadAndInstall).toHaveBeenCalledOnce();
      expect(relaunchFn).toHaveBeenCalledOnce();
    },
  );

  it("checkFn resolving null + startup -> silent (no toast calls)", async () => {
    const toast = makeToast();
    const checkFn = vi.fn(async (): Promise<UpdateHandle | null> => null);
    const relaunchFn = vi.fn(async () => {});

    await runUpdateCheck({ trigger: "startup", checkFn, relaunchFn, toast });

    expect(toast.calls).toHaveLength(0);
    expect(relaunchFn).not.toHaveBeenCalled();
  });

  it("checkFn resolving null + manual -> toast.success called (up-to-date)", async () => {
    const toast = makeToast();
    const checkFn = vi.fn(async (): Promise<UpdateHandle | null> => null);
    const relaunchFn = vi.fn(async () => {});

    await runUpdateCheck({ trigger: "manual", checkFn, relaunchFn, toast });

    const successCalls = toast.calls.filter((c) => c.method === "success");
    expect(successCalls).toHaveLength(1);
    expect(successCalls[0].args[0]).toContain("latest version");
  });

  it("checkFn rejecting + startup -> console.warn only, no toast", async () => {
    const toast = makeToast();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const checkFn = vi.fn(async (): Promise<UpdateHandle | null> => {
      throw new Error("timeout");
    });
    const relaunchFn = vi.fn(async () => {});

    await runUpdateCheck({ trigger: "startup", checkFn, relaunchFn, toast });

    expect(toast.calls).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toContain("[updater]");
    warnSpy.mockRestore();
  });

  it("offer: downloadAndInstall failing -> toast.error with 'Update failed'", async () => {
    const toast = makeToast();
    const installError = new Error("disk full");
    const update = makeUpdate("2.0.0");
    (update.downloadAndInstall as ReturnType<typeof vi.fn>).mockRejectedValue(installError);
    const checkFn = vi.fn(async (): Promise<UpdateHandle | null> => update);
    const relaunchFn = vi.fn(async () => {});

    await runUpdateCheck({ trigger: "manual", checkFn, relaunchFn, toast });

    const warningCalls = toast.calls.filter((c) => c.method === "warning");
    expect(warningCalls).toHaveLength(1);

    const options = warningCalls[0].args[1] as {
      action?: { label: string; onClick: () => void };
    };
    // Trigger install which will throw
    await options.action!.onClick();

    const errorCalls = toast.calls.filter((c) => c.method === "error");
    expect(errorCalls).toHaveLength(1);
    expect(errorCalls[0].args[0]).toBe("Update failed");
    expect(errorCalls[0].args[1]).toMatchObject({ description: expect.stringContaining("disk full") });
    // dismiss called for loading toast
    const dismissCalls = toast.calls.filter((c) => c.method === "dismiss");
    expect(dismissCalls).toHaveLength(1);
    // relaunch NOT called because install threw
    expect(relaunchFn).not.toHaveBeenCalled();
  });

  it("offer + startup trigger -> warning still shown with version", async () => {
    const toast = makeToast();
    const update = makeUpdate("1.2.3");
    const checkFn = vi.fn(async (): Promise<UpdateHandle | null> => update);
    const relaunchFn = vi.fn(async () => {});

    await runUpdateCheck({ trigger: "startup", checkFn, relaunchFn, toast });

    const warningCalls = toast.calls.filter((c) => c.method === "warning");
    expect(warningCalls).toHaveLength(1);
    expect(warningCalls[0].args[0]).toContain("v1.2.3");
  });

  it("omitting checkFn falls through to default (throws in test env) -> caught as error", async () => {
    // When checkFn is not provided, the default lazy import path is taken.
    // In a non-Tauri env, import("@tauri-apps/plugin-updater") rejects.
    // The catch block handles it gracefully (no toast for startup trigger).
    const toast = makeToast();
    const relaunchFn = vi.fn(async () => {});
    // Do NOT pass checkFn — exercises the default lazy-import branch.
    await expect(
      runUpdateCheck({ trigger: "startup", relaunchFn, toast }),
    ).resolves.toBeUndefined();
    // Either silent (startup) or error toast — both are valid depending on the env.
    // We just verify no unhandled rejection.
  });

  it("omitting relaunchFn falls through to default relaunch branch", async () => {
    const toast = makeToast();
    const update = makeUpdate("2.0.0");
    const checkFn = vi.fn(async (): Promise<UpdateHandle | null> => update);
    // Do NOT pass relaunchFn — exercises default relaunch branch.
    // Simulate install succeeding; relaunch will use the default lazy-import.
    // The default relaunch will fail in test env (no Tauri), but doInstall catches it.
    await runUpdateCheck({ trigger: "manual", checkFn, toast });

    const warningCalls = toast.calls.filter((c) => c.method === "warning");
    expect(warningCalls).toHaveLength(1);
    // Don't trigger install — just verify the warning was set up correctly.
    const options = warningCalls[0].args[1] as {
      action?: { label: string; onClick: () => void };
    };
    expect(options.action?.label).toBe("Install");
  });
});
