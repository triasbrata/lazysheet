import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "istanbul",
      reporter: ["json", "text-summary"],
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
