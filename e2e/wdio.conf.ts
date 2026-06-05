import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dumpCoverage } from "./helpers/app.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Resolve the debug app binary. Honors CARGO_TARGET_DIR (cargo builds there
 * instead of src-tauri/target when it's set), falling back to the in-crate
 * target dir. LAZYSHEET_E2E_BIN overrides everything.
 */
function resolveAppBinary() {
  if (process.env.LAZYSHEET_E2E_BIN) return process.env.LAZYSHEET_E2E_BIN;
  const targetDir = process.env.CARGO_TARGET_DIR
    ? path.resolve(process.env.CARGO_TARGET_DIR)
    : path.resolve(__dirname, "../src-tauri/target");
  const realPath = path.join(targetDir, "debug", "lazysheet");
  return realPath;
}

/** Handle to the spawned tauri-webdriver intermediary process. */
let driverProc: ChildProcess | undefined;

export const config: WebdriverIO.Config = {
  hostname: "127.0.0.1",
  port: 4444,
  specs: ["./specs/**/*.e2e.ts"],
  maxInstances: 1,
  capabilities: [
    // `tauri:options` is a vendor (tauri-webdriver) extension capability not in
    // the standard WebdriverIO capability type — cast to satisfy the config type.
    {
      "tauri:options": {
        application: resolveAppBinary(),
      },
    } as WebdriverIO.Capabilities,
  ],
  reporters: ["spec"],
  framework: "mocha",
  mochaOpts: {
    ui: "bdd",
    timeout: 120000,
  },

  // Slow-mo (review mode): when E2E_SLOWMO is set, pause after each *action*
  // command so the app window can be watched step-by-step. Skips read/poll
  // commands (getText, isDisplayed, findElement…) so it stays watchable, not glacial.
  async afterCommand(commandName: string) {
    if (!process.env.E2E_SLOWMO) return;
    const watch = new Set<string>([
      "elementClick",
      "performActions",
      "elementSendKeys",
      "executeScript",
      "executeAsyncScript",
      "navigateTo",
    ]);
    if (watch.has(commandName)) {
      const ms = Number(process.env.E2E_SLOWMO) || 3000;
      await new Promise((r) => setTimeout(r, ms));
    }
  },

  onPrepare() {
    const nycOutputDir = path.resolve(__dirname, "../.nyc_output");
    fs.rmSync(nycOutputDir, { recursive: true, force: true });
    fs.mkdirSync(nycOutputDir, { recursive: true });
  },

  async afterTest() {
    try {
      await dumpCoverage();
    } catch {}
  },

  async after() {
    try {
      await dumpCoverage();
    } catch {}
  },

  beforeSession() {
    // tauri-webdriver: cross-platform intermediary (replaces tauri-driver).
    // Listens on :4444 for WebdriverIO, launches the app, and talks to the
    // embedded tauri-plugin-webdriver server on :4445 (native WebView APIs —
    // works on macOS/Linux/Windows, no WebKitWebDriver binary needed).
    driverProc = spawn(
      process.env.TAURI_WEBDRIVER || "tauri-webdriver",
      ["--port", "4444", "--native-port", "4445"],
      { stdio: ["inherit", process.stdout, process.stderr] },
    );
  },

  afterSession() {
    if (driverProc) {
      driverProc.kill();
    }
  },
};
