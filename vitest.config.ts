import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    coverage: {
      // istanbul (not v8) is required: scripts/e2e.ts merges this unit coverage
      // with the e2e istanbul chunks via nyc. json -> coverage-final.json (nyc
      // merge); json-summary -> coverage-summary.json (scripts/coverage-total.ts).
      provider: "istanbul",
      reporter: ["json", "json-summary", "text-summary"],
      reportsDirectory: "coverage/unit",
      include: ["src/**"],
      exclude: [
        "**/*.test.ts",
        "**/*.d.ts",
        "src/main.tsx",
        "e2e/**",
        "node_modules/**",
      ],
      all: false,
    },
  },
});
