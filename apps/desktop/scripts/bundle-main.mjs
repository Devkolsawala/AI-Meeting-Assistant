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

// Bundled CJS dependencies (electron-updater → fs-extra → graceful-fs, etc.) use
// dynamic require("fs"). In an ESM bundle, esbuild's __require shim throws "Dynamic
// require of X is not supported" unless a real `require` exists in scope — so we
// inject one via createRequire. Applied to main only (preload pulls in no such deps).
const requireShimBanner = [
  "import { createRequire as __meetcopilotCreateRequire } from 'node:module';",
  "const require = __meetcopilotCreateRequire(import.meta.url);",
].join("\n");

await build({
  ...common,
  entryPoints: [join(root, "src/main.ts")],
  outfile: join(root, "dist/main.js"),
  banner: { js: requireShimBanner },
});
await build({
  ...common,
  entryPoints: [join(root, "src/preload.ts")],
  outfile: join(root, "dist/preload.js"),
});
