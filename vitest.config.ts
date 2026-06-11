import { defineConfig, defineProject } from 'vitest/config'
import path from 'node:path'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { playwright } from '@vitest/browser-playwright'

export default defineConfig({
  test: {
    projects: [
      // ─── Unit project (node, happy-dom) ────────────────────────────────
      defineProject({
        resolve: {
          alias: {
            '#': path.resolve(__dirname, './src'),
          },
        },
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.{ts,tsx}'],
          exclude: ['src/**/*.e2e.test.{ts,tsx}'],
        },
      }),

      // ─── Browser project (Playwright / chromium) ───────────────────────
      // Explicit minimal plugin list — do NOT inherit the cloudflare/tanstack
      // Start plugins from vite.config.ts (they break the browser iframe).
      defineProject({
        plugins: [viteReact(), tailwindcss()],
        resolve: {
          alias: {
            '#': path.resolve(__dirname, './src'),
            // Stub out TanStack Start server modules — they require vite-plugin
            // context (#tanstack-router-entry / #tanstack-start-entry) that is
            // absent in this minimal browser project. Source files that import
            // these are already mocked via vi.mock() in the test files.
            '@tanstack/react-start': path.resolve(
              __dirname,
              './src/test/__stubs__/tanstack-start.ts',
            ),
            '@tanstack/react-start/server': path.resolve(
              __dirname,
              './src/test/__stubs__/tanstack-start.ts',
            ),
          },
        },
        test: {
          name: 'browser',
          include: ['src/**/*.e2e.test.{ts,tsx}'],
          setupFiles: ['./vitest.browser.setup.ts'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
          },
        },
      }),
    ],

    // ─── Coverage — unit project only ──────────────────────────────────
    // Run with: vitest run --project unit --coverage
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.d.ts',
        'src/routeTree.gen.ts',
        'src/components/ui/**',
        'src/**/*.e2e.{ts,tsx}',
        'src/**/*.e2e.test.{ts,tsx}',
        'src/test/**',
      ],
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 95,
        statements: 95,
      },
    },
  },
})
