/**
 * @particle-academy/fancy-pwa/vite
 *
 * `fancyPwa(options)` — a dependency-light Vite plugin that, on `build`:
 *   1. emits `manifest.webmanifest` from `options.manifest`,
 *   2. bundles your app's `sw.ts` (transformed via Vite's own esbuild) and
 *      injects `self.__FANCY_PRECACHE` (the hashed asset filenames) +
 *      `self.__FANCY_VERSION` (a build hash) into it,
 *   3. injects the manifest <link>, a theme-color <meta>, and (optionally) a
 *      SW-registration <script> into `index.html`.
 *
 * In `serve`/dev it is a deliberate no-op so it never fights HMR. (Blade hosts
 * with no `index.html` inject the tags manually — see the README snippet.)
 *
 * Typed against Vite's `Plugin` via a peer import; `vite` is an OPTIONAL peer,
 * so importing this subpath only makes sense in a Vite build.
 */
import type { Plugin } from "vite";

/** Minimal Web App Manifest shape (the common fields apps actually set). */
export interface WebAppManifest {
  name: string;
  short_name?: string;
  description?: string;
  icons: Array<{ src: string; sizes: string; type?: string; purpose?: string }>;
  theme_color?: string;
  background_color?: string;
  display?: "fullscreen" | "standalone" | "minimal-ui" | "browser";
  orientation?: string;
  start_url?: string;
  scope?: string;
  shortcuts?: Array<{
    name: string;
    short_name?: string;
    url: string;
    description?: string;
    icons?: Array<{ src: string; sizes: string; type?: string }>;
  }>;
  [key: string]: unknown;
}

export interface FancyPwaPluginOptions {
  /** The web app manifest to emit. */
  manifest: WebAppManifest;
  /** Path to your app's service-worker entry (e.g. `"resources/js/sw.ts"`). */
  sw: string;
  /** Emitted SW filename. Default `"sw.js"`. */
  swDest?: string;
  /** Emitted manifest filename. Default `"manifest.webmanifest"`. */
  manifestDest?: string;
  /** Inject a SW-registration <script> into index.html. Default `true`. */
  registerSw?: boolean;
  /** Also build/serve the SW in dev. Default `false` (don't fight HMR). */
  devSw?: boolean;
}

function hashOf(input: string): string {
  // Tiny, stable, dependency-free 32-bit FNV-1a → base36. Enough to key caches.
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

const REGISTER_SNIPPET = (swPath: string) =>
  `<script>if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('${swPath}')})}</script>`;

/**
 * The Fancy PWA Vite plugin. Heavy work runs only under `apply:"build"`.
 */
export function fancyPwa(options: FancyPwaPluginOptions): Plugin {
  const {
    manifest,
    sw,
    swDest = "sw.js",
    manifestDest = "manifest.webmanifest",
    registerSw = true,
    devSw = false,
  } = options;

  // Resolved from Vite's `base` in configResolved (e.g. "/build/" under
  // laravel-vite-plugin, "/" for a root SPA) so precache URLs + injected hrefs
  // point at the ACTUAL served asset paths, not a wrong "/"-rooted guess.
  let base = "/";
  const join = (b: string, p: string): string =>
    "/" + [b.replace(/^\/+|\/+$/g, ""), p.replace(/^\/+/, "")].filter(Boolean).join("/");

  return {
    name: "fancy-pwa",
    apply: "build",

    /** Inject manifest link, theme-color, and SW registration into index.html. */
    transformIndexHtml: {
      order: "post",
      handler() {
        const tags: import("vite").HtmlTagDescriptor[] = [
          { tag: "link", attrs: { rel: "manifest", href: join(base, manifestDest) }, injectTo: "head" },
        ];
        if (manifest.theme_color) {
          tags.push({
            tag: "meta",
            attrs: { name: "theme-color", content: manifest.theme_color },
            injectTo: "head",
          });
        }
        if (registerSw) {
          tags.push({
            tag: "script",
            children: REGISTER_SNIPPET(join(base, swDest)).replace(/^<script>|<\/script>$/g, ""),
            injectTo: "body",
          });
        }
        return tags;
      },
    },

    /**
     * Emit the manifest + the transformed, precache-injected SW. Runs once the
     * client bundle's asset list is known.
     */
    async generateBundle(_outputOptions, bundle) {
      // 1) Manifest.
      this.emitFile({
        type: "asset",
        fileName: manifestDest,
        source: JSON.stringify(manifest, null, 2),
      });

      // 2) Collect the emitted asset/chunk filenames to precache.
      const precache = Object.keys(bundle)
        .filter((name) => !name.endsWith(".map") && name !== swDest && name !== manifestDest)
        .map((name) => join(base, name));
      const version = hashOf(precache.join("|"));

      // 3) BUNDLE the app SW into a single classic-worker IIFE (inlining its
      //    imports from `/sw` etc.) via esbuild, with the precache globals
      //    injected as a banner. transform-only would leave bare ESM `import`s
      //    that a classic service worker can't evaluate ("script evaluation
      //    failed"). esbuild ships with Vite, so it's resolvable in a build.
      const esbuild = await import("esbuild");
      const injected =
        `globalThis.__FANCY_PRECACHE=${JSON.stringify(precache)};` +
        `globalThis.__FANCY_VERSION=${JSON.stringify(version)};`;
      const built = await esbuild.build({
        entryPoints: [sw],
        bundle: true,
        format: "iife",
        platform: "browser",
        target: "es2020",
        minify: true,
        write: false,
        banner: { js: injected },
      });
      const code = built.outputFiles?.[0]?.text ?? "";

      this.emitFile({ type: "asset", fileName: swDest, source: code });
    },

    configResolved(config) {
      // Capture the resolved public base ("/build/" under Laravel, "/" for a
      // root SPA) so precache URLs + injected hrefs are correct on every host.
      base = config.base || "/";
      // In dev (`serve`), `apply:"build"` already excludes us; this guard keeps
      // `devSw` meaningful if a host wires the plugin into a custom serve flow.
      if (config.command === "serve" && !devSw) return;
    },
  };
}

export default fancyPwa;
