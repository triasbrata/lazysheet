import plugin from "bun-plugin-tailwind";
import { istanbulPlugin } from "./istanbul-plugin";
import { rm, mkdir } from "node:fs/promises";
import { join } from "node:path";

const rootDir = import.meta.dir + "/..";
const distDir = join(rootDir, "dist");
const publicDir = join(rootDir, "public");

// Clean dist/ before build so stale Vite output never lingers.
await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });

const isE2E = Boolean(process.env.VITE_E2E);
const isDebug = Boolean(process.env.TAURI_ENV_DEBUG);

const plugins = [plugin];
if (isE2E) {
  plugins.push(istanbulPlugin());
}

// Bun.build env: "VITE_*" only inlines process.env.VITE_* — it does NOT replace
// import.meta.env.VITE_* references (which the app uses). We also use the optional-chain
// form (import.meta as any).env?.VITE_* in source so the Bun dev server (where
// import.meta.env is undefined) doesn't throw at runtime.
//
// Strategy: scan src for all import.meta.env.VITE_* references (both plain and ?.
// optional-chain forms), collect the key names, then define import.meta.env ITSELF
// as a JSON object literal containing all values. This works with both:
//   - import.meta.env.VITE_X   → { VITE_X: "val" }.VITE_X     → "val"
//   - import.meta.env?.VITE_X  → { VITE_X: "val" }?.VITE_X    → "val"
// Bun.build replaces the import.meta.env subexpression with the object literal.
const srcGlob = new Bun.Glob("**/*.{ts,tsx}");
const viteEnvKeys = new Set<string>();
for await (const file of srcGlob.scan({ cwd: join(rootDir, "src"), onlyFiles: true })) {
  const content = await Bun.file(join(rootDir, "src", file)).text();
  for (const match of content.matchAll(/\.env\??\.(VITE_[A-Z0-9_]+)/g)) {
    viteEnvKeys.add(match[1]);
  }
}

// Build a JS object literal containing ONLY the env vars that are actually set:
//   { VITE_FF_MULTI_LANG: "true" }   (if VITE_FF_MULTI_LANG=true in env)
//   {}                                (if no VITE_* vars are set)
// Bun's define replaces import.meta.env with this object literal. Then:
//   - env?.VITE_FF_MULTI_LANG on the object → property value or undefined (correct)
//   - Missing keys on {} → undefined  → parseFlag(undefined, defaultValue) (correct)
// Bun define rejects `undefined` as a value, so we omit unset keys entirely.
const envObj: Record<string, string> = {};
for (const key of viteEnvKeys) {
  const value = process.env[key];
  if (value !== undefined) {
    envObj[key] = JSON.stringify(value);
  }
}
const define: Record<string, string> = {
  "import.meta.env": `{${Object.entries(envObj)
    .map(([k, v]) => `${JSON.stringify(k)}:${v}`)
    .join(",")}}`,
};

const result = await Bun.build({
  entrypoints: [join(rootDir, "index.html")],
  outdir: distDir,
  plugins,
  define,
  minify: !isDebug,
  sourcemap: isDebug ? "linked" : "none",
  env: "disable",
  target: "browser",
});

if (!result.success) {
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

// Copy public/* into dist/ so root-served assets (tauri.svg) still exist.
const publicGlob = new Bun.Glob("**");
for await (const file of publicGlob.scan({ cwd: publicDir, onlyFiles: true })) {
  const src = Bun.file(join(publicDir, file));
  await Bun.write(join(distDir, file), src);
}

console.log("Build complete →", distDir);
