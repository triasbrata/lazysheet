/**
 * OTA auto-update orchestration.
 *
 * Designed for full testability via dependency injection — no module mocking
 * needed in tests. The real defaults (plugin imports + sonner toast) are
 * resolved lazily inside `runUpdateCheck`.
 */

// Sonner is already statically bundled by the rest of the app — import it at
// module level so we don't trigger a "dynamic + static" Vite advisory.
import { toast as sonnerToast } from "sonner";

// ── Public types ─────────────────────────────────────────────────────────────

export type UpdateCheckTrigger = "startup" | "manual";

/** Minimal shape we depend on from @tauri-apps/plugin-updater's `Update`. */
export interface UpdateHandle {
  version: string;
  currentVersion: string;
  downloadAndInstall(onEvent?: (e: unknown) => void): Promise<void>;
}

export type UpdateDecision =
  | { kind: "none" }
  | { kind: "up-to-date" }
  | { kind: "offer"; version: string }
  | { kind: "error"; message: string };

/**
 * Minimal subset of the sonner `toast` API that we use, exposed as an
 * interface so tests can pass a lightweight fake without module mocking.
 */
export interface ToastApi {
  success(message: string, options?: Record<string, unknown>): string | number;
  error(message: string, options?: Record<string, unknown>): string | number;
  warning(message: string, options?: Record<string, unknown>): string | number;
  loading(message: string, options?: Record<string, unknown>): string | number;
  dismiss(id?: string | number): void;
}

export interface UpdateCheckOptions {
  trigger: UpdateCheckTrigger;
  /** Override for tests — defaults to the real plugin `check()`. */
  checkFn?: () => Promise<UpdateHandle | null>;
  /** Override for tests — defaults to the real plugin `relaunch()`. */
  relaunchFn?: () => Promise<void>;
  /** Override for tests — defaults to sonner `toast`. */
  toast?: ToastApi;
}

// ── Pure decision helper ─────────────────────────────────────────────────────

/**
 * Pure, synchronous decision function — no side-effects, easy to unit-test.
 *
 * - `null` update on startup  → silent (`"none"`)
 * - `null` update on manual   → surface "up-to-date"
 * - any non-null update        → offer install
 */
export function decideUpdateAction(
  update: UpdateHandle | null,
  trigger: UpdateCheckTrigger,
): UpdateDecision {
  if (update === null) {
    return trigger === "manual" ? { kind: "up-to-date" } : { kind: "none" };
  }
  return { kind: "offer", version: update.version };
}

// ── Async orchestrator ───────────────────────────────────────────────────────

/**
 * Run an update check and surface the result via toasts.
 *
 * Startup trigger is intentionally quiet on `none` and `error` so it never
 * interrupts the user on launch. Manual trigger always reports back.
 */
export async function runUpdateCheck(opts: UpdateCheckOptions): Promise<void> {
  const { trigger } = opts;

  // Resolve defaults lazily so the module works in test environments that
  // don't have the Tauri runtime.
  const checkFn =
    opts.checkFn ??
    (() =>
      import("@tauri-apps/plugin-updater").then((m) =>
        m.check() as Promise<UpdateHandle | null>,
      ));
  const relaunchFn =
    opts.relaunchFn ??
    (() => import("@tauri-apps/plugin-process").then((m) => m.relaunch()));
  const toastApi: ToastApi =
    opts.toast ?? (sonnerToast as unknown as ToastApi);

  // ── Check for update ──────────────────────────────────────────────────────
  let decision: UpdateDecision;
  let update: UpdateHandle | null = null;
  try {
    update = await checkFn();
    decision = decideUpdateAction(update, trigger);
  } catch (err) {
    decision = { kind: "error", message: String(err) };
  }

  // ── Act on decision ───────────────────────────────────────────────────────
  switch (decision.kind) {
    case "none":
      return;

    case "up-to-date":
      toastApi.success("You're on the latest version");
      return;

    case "error": {
      const { message } = decision;
      if (trigger === "manual") {
        toastApi.error("Update check failed", { description: message });
      } else {
        console.warn("[updater] startup check failed:", message);
      }
      return;
    }

    case "offer": {
      const { version } = decision;
      // `update` is guaranteed non-null when kind === "offer"
      const handle = update!;

      const doInstall = async () => {
        const loadingId = toastApi.loading("Downloading update…");
        try {
          await handle.downloadAndInstall();
          toastApi.dismiss(loadingId);
          await relaunchFn();
        } catch (err) {
          toastApi.dismiss(loadingId);
          toastApi.error("Update failed", { description: String(err) });
        }
      };

      toastApi.warning(`Update available (v${version})`, {
        duration: Infinity,
        action: {
          label: "Install",
          onClick: () => {
            void doInstall();
          },
        },
        cancel: { label: "Later" },
      });
      return;
    }
  }
}
