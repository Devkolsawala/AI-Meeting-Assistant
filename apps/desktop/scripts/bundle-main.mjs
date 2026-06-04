// Bundles the Electron main and preload entry points into self-contained files so
// the packaged app has no runtime node_modules dependency. @meetcopilot/shared is
// inlined here; "electron" and Node built-ins stay external (provided at runtime).
// The renderer is left as the multi-file tsc output (it imports shared types only).
import { build } from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const common = {
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  external: ["electron"],
  logLevel: "info",
};

await build({
  ...common,
  entryPoints: [join(root, "src/main.ts")],
  outfile: join(root, "dist/main.js"),
});
await build({
  ...common,
  entryPoints: [join(root, "src/preload.ts")],
  outfile: join(root, "dist/preload.js"),
});
