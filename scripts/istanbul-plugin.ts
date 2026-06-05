import * as babel from "@babel/core";
import { join } from "node:path";

const repoRoot = import.meta.dir + "/..";
const srcRoot = join(repoRoot, "src") + "/";

export function istanbulPlugin(): import("bun").BunPlugin {
  return {
    name: "istanbul",
    setup(build) {
      build.onLoad({ filter: /src\/.*\.(ts|tsx)$/ }, async (args) => {
        const p = args.path;

        // Guard: only instrument files that actually live under <repo>/src/
        // (filter may also match node_modules paths containing /src/)
        if (!p.startsWith(srcRoot)) return undefined;

        // Skip test files, test directory, and declaration files
        if (
          p.endsWith(".test.ts") ||
          p.endsWith(".test.tsx") ||
          p.includes("/src/test/") ||
          p.endsWith(".d.ts")
        ) {
          return undefined;
        }

        const code = await Bun.file(p).text();

        const result = await babel.transformAsync(code, {
          filename: p,
          presets: [
            [
              "@babel/preset-typescript",
              {
                isTSX: p.endsWith(".tsx"),
                allExtensions: true,
              },
            ],
          ],
          plugins: ["babel-plugin-istanbul"],
          babelrc: false,
          configFile: false,
          sourceMaps: "inline",
        });

        if (!result || result.code == null) {
          throw new Error(`babel transform returned null for ${p}`);
        }

        // Return tsx loader so Bun handles any preserved JSX syntax
        return { contents: result.code, loader: "tsx" };
      });
    },
  };
}
