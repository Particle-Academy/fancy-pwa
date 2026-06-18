# @particle-academy/fancy-pwa

A lean, **framework-agnostic, SSR-safe** Progressive Web App layer for the
[Fancy UI](https://github.com/Particle-Academy) suite. No Workbox, no heavy
dependencies. Every hook is window-guarded with no module-level browser access,
so it imports cleanly into an SSR bundle.

What you get:

- **Install prompt** — `useInstallPrompt()` + `<InstallBanner>`
- **Online / offline** — `useOnline()` / `useConnection()` + `<OfflineBanner>`
- **Service worker** — `useServiceWorker()` + `registerFancyPwa()` + a tiny,
  Workbox-free strategy toolkit at `@particle-academy/fancy-pwa/sw`
- **Update detection** — `usePwaUpdate()` + `<UpdateToast>`, composed on
  [`@particle-academy/fancy-app-update`](https://github.com/Particle-Academy/fancy-app-update)
  so **app-shell SW updates and plain asset drift surface as one signal**
- **Vite plugin** — `fancyPwa()` at `@particle-academy/fancy-pwa/vite`
- **Provider** — `<FancyPwaProvider>`

## Install

```bash
npm install @particle-academy/fancy-pwa
```

Peers: `react`, `react-dom`, `@particle-academy/fancy-app-update`. Optional
peers (only needed for the features that use them): `@particle-academy/react-fancy`
(the chrome components), `@particle-academy/fancy-auto-common` (Human+ activity),
`vite` (the build plugin).

## 1. The Vite plugin

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { fancyPwa } from "@particle-academy/fancy-pwa/vite";

export default defineConfig({
  plugins: [
    fancyPwa({
      sw: "src/sw.ts", // your service-worker entry (see below)
      manifest: {
        name: "My Fancy App",
        short_name: "Fancy",
        start_url: "/",
        scope: "/",
        display: "standalone",
        theme_color: "#0ea5e9",
        background_color: "#ffffff",
        icons: [
          { src: "/icons/192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/512.png", sizes: "512x512", type: "image/png" },
        ],
      },
    }),
  ],
});
```

On `build` the plugin (a no-op in dev, so it never fights HMR):

- emits `manifest.webmanifest`,
- bundles your `sw.ts` to `sw.js`, injecting `self.__FANCY_PRECACHE` (the hashed
  asset filenames) and `self.__FANCY_VERSION` (a build hash to key caches),
- injects `<link rel="manifest">`, a `<meta name="theme-color">`, and (unless
  `registerSw:false`) a SW-registration `<script>` into `index.html`.

## 2. Your app's service worker (`src/sw.ts`)

Compose the strategy toolkit. `precache([])` automatically includes the
plugin-injected hashed assets.

```ts
// src/sw.ts
import {
  precache,
  registerRoute,
  networkFirst,
  cacheFirst,
  staleWhileRevalidate,
  offlineFallback,
} from "@particle-academy/fancy-pwa/sw";

precache(["/", "/offline.html"]); // app shell + the injected build assets

registerRoute(/\/api\//, networkFirst({ ttl: 60_000 }));
registerRoute(/\.(png|jpg|svg|woff2)$/, cacheFirst({ max: 60 }));
registerRoute((req) => req.mode === "navigate", staleWhileRevalidate());

offlineFallback("/offline.html");
```

On `install` the precache fills; on `activate` stale caches (anything not keyed
by the current version) are deleted and clients claimed. A `SKIP_WAITING`
message triggers `skipWaiting()` — that's what `usePwaUpdate().reload()` sends.

## 3. Wire the React layer

```tsx
import {
  FancyPwaProvider,
  InstallBanner,
  OfflineBanner,
  UpdateToast,
} from "@particle-academy/fancy-pwa";
import { Toast } from "@particle-academy/react-fancy";

export function App({ children }) {
  return (
    <FancyPwaProvider options={{ swUrl: "/sw.js" }}>
      <Toast.Provider>
        <OfflineBanner />
        <InstallBanner />
        <UpdateToast />
        {children}
      </Toast.Provider>
    </FancyPwaProvider>
  );
}
```

- `<FancyPwaProvider>` registers the SW once on mount (client only) and provides
  shared SW state. SSR renders `children` with no side effects.
- `<InstallBanner>` renders `null` until the browser offers an install prompt
  (and the app isn't already installed/dismissed). Render-prop friendly.
- `<OfflineBanner>` shows only while offline (`aria-live="polite"`).
- `<UpdateToast>` fires a react-fancy toast when an update is available and
  renders a Reload affordance. **Requires a `<Toast.Provider>` ancestor.**

### Hooks directly

```tsx
const { canInstall, promptInstall, installed, dismissed, dismiss } = useInstallPrompt();
const online = useOnline();
const { online, effectiveType, saveData, downlink } = useConnection();
const { registered, waiting, offlineReady, error, activate } = useServiceWorker();
const { updateAvailable, reload, dismiss } = usePwaUpdate();
```

## Propose-then-confirm updates

`usePwaUpdate()` **never auto-reloads**. `updateAvailable` becomes true when a
SW worker is `waiting` OR when fancy-app-update detects asset drift (its ETag
poll). `reload()` applies the update only when you call it — SW skip-waiting
when a worker is waiting, else a hard refresh. Agents propose; humans confirm.

## Blade / non-Vite hosts (manual injection)

If your host serves HTML itself (Laravel blade, etc.), the plugin still emits
`manifest.webmanifest` + `sw.js`, but you inject the head tags manually:

```html
<link rel="manifest" href="/manifest.webmanifest" />
<meta name="theme-color" content="#0ea5e9" />
<script>
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js');
    });
  }
</script>
```

(Or skip the inline script and let `<FancyPwaProvider>` register the SW for you.)

## Human+ (optional)

When `@particle-academy/fancy-auto-common` is installed, fancy-pwa broadcasts
`AutoActivity` events on install, offline↔online transitions, and
update-available — so presence / coaching layers compose for free. It's a soft,
lazily-imported optional peer: absent it, this is a silent no-op.

## License

MIT
