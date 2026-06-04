import { spawn } from "node:child_process";
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
  console.log({ realPath });
  return realPath;
}

/** Handle to the spawned tauri-webdriver intermediary process. */
let driverProc;

export const config = {
  hostname: "127.0.0.1",
  port: 4444,
  specs: ["./specs/**/*.e2e.js"],
  maxInstances: 1,
  capabilities: [
    {
      "tauri:options": {
        application: resolveAppBinary(),
      },
    },
  ],
  reporters: ["spec"],
  framework: "mocha",
  mochaOpts: {
    ui: "bdd",
    timeout: 120000,
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
