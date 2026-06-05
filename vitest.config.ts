import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["src/test/setup.ts"],
    env: { VITE_FF_MULTI_LANG: "true" },
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      // istanbul (not v8) is required: scripts/e2e.ts merges this unit coverage
      // with the e2e istanbul chunks via nyc. json -> coverage-final.json (nyc
      // merge); json-summary -> coverage-summary.json (scripts/coverage-total.ts).
      provider: "istanbul",
      reporter: ["text", "json", "json-summary"],
      reportsDirectory: "coverage/unit",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/main.tsx",
        "src/vite-env.d.ts",
        "src/lib/copy-as-image.ts",
        "src/test/**",
        "src/**/*.test.{ts,tsx}",
        "src/**/*.d.ts",
        "e2e/**",
        "node_modules/**",
      ],
      thresholds: { lines: 95 },
    },
  },
});
