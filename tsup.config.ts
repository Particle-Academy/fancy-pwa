import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    vite: "src/vite/index.ts",
    sw: "src/sw/index.ts",
    styles: "src/styles.css",
  },
  format: ["esm", "cjs"],
  dts: {
    entry: ["src/index.ts", "src/vite/index.ts", "src/sw/index.ts"],
  },
  external: [
    "react",
    "react-dom",
    "react/jsx-runtime",
    "@particle-academy/fancy-app-update",
    "@particle-academy/react-fancy",
    "@particle-academy/fancy-auto-common",
    "vite",
    // esbuild must NOT be bundled — it ships its own CJS `require("fs")` that
    // breaks when inlined into an ESM build ("Dynamic require of 'fs' is not
    // supported"). The /vite plugin dynamic-imports it at runtime; it resolves
    // from the consumer's install (esbuild ships with Vite).
    "esbuild",
    "node:*",
  ],
  treeshake: true,
  clean: true,
  sourcemap: true,
});
