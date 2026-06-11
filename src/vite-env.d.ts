/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Set to "true" only for e2e (WebDriver) builds. Enables the window.__E2E__ test hook. */
  readonly VITE_E2E?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  /**
   * E2E test hook — present ONLY in builds made with VITE_E2E=true (tree-shaken from prod).
   * Drives the app's real open-by-path flow (real Rust backend) and exposes clipboard reads
   * so WebdriverIO specs can assert without a native file dialog.
   */
  __E2E__?: {
    open(path: string): Promise<void>;
    readClipboard(): Promise<string>;
    /**
     * Run an update check against a mocked plugin response. `update: null`
     * simulates up-to-date; `{ version }` simulates an available update;
     * `fail` simulates a check error. Never relaunches the app.
     */
    runUpdateCheck(mock: {
      trigger?: "startup" | "manual";
      update?: { version: string } | null;
      fail?: string;
    }): Promise<void>;
    /** Dismiss all toasts — used by specs to isolate toast assertions. */
    dismissToasts(): void;
    /**
     * Render the open summary table to a PNG via the real copy-as-image
     * pipeline (capturing the blob instead of writing the clipboard) and report
     * decoded stats. `nonBlank` confirms the WebKit blank-render workaround
     * produced actual pixels.
     */
    captureSummaryImage(): Promise<
      | { ok: true; bytes: number; width: number; height: number; nonBlank: boolean }
      | { ok: false; error: string }
    >;
    /** Returns the current grid zoom level (1 = 100%). */
    getZoom?: () => number;
  };
}
