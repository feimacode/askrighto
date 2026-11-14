// Bundles the server and its dependencies into one file, dist/askrighto.js,
// so the container image needs no node_modules.
import { build } from "esbuild";
import { chmodSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

await build({
  entryPoints: [resolve(ROOT, "src/main.ts")],
  outfile: resolve(ROOT, "dist/askrighto.js"),
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  minify: false,
  legalComments: "linked",
  // CommonJS dependencies (express) call require(); give the ESM bundle one.
  banner: {
    js: "import { createRequire as __arCreateRequire } from 'node:module';\nconst require = __arCreateRequire(import.meta.url);",
  },
  logLevel: "warning",
});
chmodSync(resolve(ROOT, "dist/askrighto.js"), 0o755);
