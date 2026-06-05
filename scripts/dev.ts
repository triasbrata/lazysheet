import { join, extname } from "node:path";
import { existsSync } from "node:fs";

const host = process.env.TAURI_DEV_HOST ?? "localhost";
const port = 1420;
const isPreview = process.argv.includes("--preview");

if (isPreview) {
  // Serve dist/ statically — no HMR, no HTML import.
  const distDir = join(import.meta.dir, "..", "dist");

  const mimeTypes: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".mjs": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".webp": "image/webp",
  };

  const server = Bun.serve({
    port,
    hostname: host,
    fetch(req) {
      const url = new URL(req.url);
      let pathname = url.pathname;

      // Normalize root to index.html
      if (pathname === "/") pathname = "/index.html";

      const filePath = join(distDir, pathname);

      // Serve the file if it exists; fall back to index.html for SPA routing
      const resolvedPath = existsSync(filePath) ? filePath : join(distDir, "index.html");
      const ext = extname(resolvedPath);
      const contentType = mimeTypes[ext] ?? "application/octet-stream";

      return new Response(Bun.file(resolvedPath), {
        headers: { "Content-Type": contentType },
      });
    },
  });

  const url = `http://${host}:${port}`;
  console.log(`Preview server running → ${url}`);
  console.log("Serving dist/ statically (no HMR). Ctrl+C to stop.");

  // Keep process alive
  await new Promise<never>(() => {});
} else {
  // Dev server: Bun HTML import — [serve.static] plugins (bun-plugin-tailwind) apply.
  // @ts-expect-error — Bun HTML import; typed by Bun runtime, not tsc
  const index = await import("../index.html");

  const server = Bun.serve({
    port,
    hostname: host,
    routes: {
      "/*": index.default,
    },
    development: {
      hmr: true,
      console: true,
    },
  });

  const url = `http://${host}:${port}`;
  console.log(`Dev server running → ${url}`);
  console.log("HMR enabled. Ctrl+C to stop.");

  // Keep process alive
  await new Promise<never>(() => {});
}
