# Éléa — Memorization mobile POC

**Expo / React Native** mobile app POC that wraps Éléa's *Memorization* SPA in a
`WebView` and, through script injection, adds three native capabilities: **auto-login**,
**offline support** (cache + HTML snapshot) and **mobile UI adaptation**.

> Context: Éléa provides the SPA URL, the mobile app displays it in a WebView, following
> the provided specification (nominal / alternative sequence diagrams and the reference
> Moodle JS).

## Principle

The app holds no business logic of its own: it loads Éléa's (Moodle)
`local/memorization/index.php` page in a WebView and injects JavaScript to fill the gaps
the web page does not cover on mobile.

```
App (Expo / React Native)
└─ BrowserView
   ├─ WebView ──► Éléa SPA (Moodle)
   │     injected scripts:
   │       ├─ autoLogin  (auto-login)
   │       ├─ cache      (offline GET/SET)
   │       └─ mobile     (CSS + DEV button)
   └─ DevToolsPanel (logs, force cache, …)
```

## Features

- **Auto-login** (`src/injections/source/autoLogin.js`) — on the Moodle login page, reads
  the `logintoken` (CSRF) and POSTs the credentials, then redirects to the Memorization
  module. Cleanly disabled when no credentials are provided.
- **Cache & offline** (`src/injections/source/cache.js`) — patches `window.fetch` to
  intercept the `ajax.php` endpoint:
  - cache of the last known date (`GET`);
  - **multi-entry FIFO queue** of `SET`s made offline
    (`src/injections/source/setQueue.js`): each `SET` is enqueued and replayed in arrival
    order when the network returns, re-injecting the live `sesskey` and validating the
    `success:true` contract. The drain stops on the first error (network or server
    rejection), keeping that entry and the following ones so no data is lost. See
    [Limits & directions](#structural-the-sync-queue);
  - **"Force cache"** mode to simulate offline from the Dev panel;
  - capture of a **self-contained HTML snapshot** (inlined CSS/JS/images) sent to native
    and stored via `AsyncStorage`, served as a fallback when the network fails.
- **Mobile adaptation** (`src/injections/source/mobile.js`) — handles *safe area insets*,
  the viewport, and adds a **DEV** button to the navigation bar that opens the tools panel.
- **Dev panel** (`src/ui/devToolsPanel.jsx`) — "Force cache" toggle, navigation
  (back / forward / reload), direct access to the module, and a log console.

## Requirements

- Node.js (recent LTS) and npm
- [Expo CLI](https://docs.expo.dev/) (via `npx expo`)
- To test on a device: the **Expo Go** app, or an iOS simulator / Android emulator

## Configuration

URLs and credentials are **never** committed (`.env` is gitignored). Copy the template and
fill in the values locally:

```bash
cp .env.example .env
```

| Variable                              | Role                                                        |
| ------------------------------------- | ----------------------------------------------------------- |
| `EXPO_PUBLIC_MEMORIZATION_URL`        | URL of the Memorization SPA to load                         |
| `EXPO_PUBLIC_MEMORIZATION_BASE_URL`   | Base URL used for the offline fallback (snapshot)           |
| `EXPO_PUBLIC_ELEA_LOGIN_USERNAME`     | Username for auto-login (optional)                          |
| `EXPO_PUBLIC_ELEA_LOGIN_PASSWORD`     | Password for auto-login (optional)                          |

If credentials are absent, auto-login is simply disabled (the SPA stays usable via manual
login). The `.env` file is not versioned (see `.gitignore`).

> ⚠️ **Security — `EXPO_PUBLIC_*` variables are NOT secret.** Expo inlines them into the
> JavaScript bundle shipped to the device: a password provided this way is extractable
> from the binary, and auto-login puts it in clear text in the page
> (`window.__memoLoginPassword`). This is acceptable for a **POC test account only**.
> Production authentication will go through a real flow (short-lived token, Moodle
> OAuth/SSO, secure native storage) — already identified as a follow-up.

## Install & run

```bash
npm install

npm start        # build injections + Expo (platform picker)
npm run android  # build injections + run Android
npm run ios      # build injections + run iOS
npm run web      # build injections + run web
```

Each start command runs `build:injections` first.

## Building the injected scripts

The scripts in `src/injections/source/*.js` are written as readable JS, then bundled and
minified by **esbuild** into `src/injections/generatedScripts.js` (exported constants
injected into the WebView).

```bash
npm run build:injections
```

> `src/injections/generatedScripts.js` is **generated** — do not edit it by hand. Change
> the sources in `src/injections/source/`, then rebuild.

## Project structure

```
index.js                          Expo entry point
App.js                            Re-exports src/app
src/
  app.jsx                         Root (SafeAreaProvider + BrowserView)
  browser/
    config.js                     URLs, cache keys, flags (from env)
    hooks.js                      useDebugLogs, useOfflineSnapshot (AsyncStorage)
  injections/
    webview.js                    Builds the scripts to inject (+ globals)
    generatedScripts.js           [generated] minified scripts
    source/
      autoLogin.js                Moodle auto-login
      cache.js                    Fetch patch, offline GET/SET, snapshot, queue drain
      dateUtils.js                Pure date helpers (shared, tested)
      dateUtils.test.js           Unit tests (node:test) for dateUtils
      setQueue.js                 FIFO queue of offline SETs (pure, tested)
      setQueue.test.js            Unit tests (node:test) for setQueue
      mobile.js                   Mobile CSS, viewport, DEV button
  ui/
    browserView.jsx               WebView + injection/message orchestration
    devToolsPanel.jsx             Developer tools panel
scripts/
  buildInjectedScripts.js         esbuild build of the injections
```

## WebView ↔ native communication

Injected scripts send messages via `window.ReactNativeWebView.postMessage`, prefixed by
category and handled in `BrowserView.handleMessage`:

| Prefix           | Use                                                     |
| ---------------- | ------------------------------------------------------- |
| `[LOGIN] …`      | Auto-login steps                                        |
| `[CACHE] …`      | Cache, `SET` synchronization, snapshot                  |
| `[OFFLINE_HTML]` | Encoded HTML snapshot, stored on the native side        |
| `[DEVTOOLS] …`   | Dev panel toggle                                        |
| `[INJECT] …`     | Runtime error in an injected script                     |

## Quality

```bash
npm run lint      # ESLint (Expo config)
npm test          # Unit tests (node:test) for the date/queue helpers
```

Non-trivial logic is isolated in **pure** modules (shared with `cache.js` via `require`,
inlined by esbuild) and covered by `node:test`:

- `dateUtils.js` / `dateUtils.test.js` — format normalization (Unix seconds ↔
  `YYYY/MM/DD HH:mm:ss`), extraction from the POST body and from the server JSON
  (`data.time`), `normalize`/`toUnixMs` round-trip;
- `setQueue.js` / `setQueue.test.js` — FIFO queue of offline `SET`s: robust
  parse/serialize, entry factory (minimal payload reconstruction, id/timestamp), enqueue
  with a cap, and replay-body reconstruction with the live `sesskey`.

The browser-side orchestration (queue drain, `localStorage` storage, live `sesskey`) lives
in `cache.js` and builds on these tested primitives.

## Limits & directions (POC)

### Demo-only: the HTML snapshot

The **offline HTML snapshot** (`buildOfflineSnapshotHtml`) is a demonstration artifact,
**not meant to last**. It is a static freeze of the DOM rendered at time T, with inlined
CSS/JS/images stored under a single `AsyncStorage` key. It shows that the screen stays
visible without a network, but:

- server-dependent interactivity is frozen (only the GET/SET buttons are re-wired by hand);
- it handles a single page, with no versioning or invalidation, and grows with the base64
  images;
- it is fragile to SPA markup changes (depends on specific IDs).

In a real version, it would be replaced by a durable approach (service worker / app cache,
or native rendering of the key screens).

### Structural: the sync queue

Conversely, **queuing and resynchronizing offline `SET`s** (`setQueue.js` +
`syncPendingOfflineSet`) carries *offline-first* logic that is meant to last: a user action
enqueued without a network, then replayed when connectivity returns, re-injecting the live
`sesskey` and validating the `success:true` contract.

**Multi-entry FIFO queue.** As per the sequence diagram (*Alternative scenarios*, which
mentions replaying "**the set requests**", plural), each offline `SET` is enqueued with its
own request body. When the network returns, entries are replayed **in arrival order**; an
entry is dequeued only after the server confirms `success:true`. On the first error
(network or rejection), the drain stops, keeping the head entry and all the following ones
— order is preserved and no data is lost. The queue is capped (`MAX_QUEUE_ENTRIES`) to
bound storage size.

Deliberately out of scope for this POC, to be decided:

- **conflict handling** — if a more recent `SET` already set the value server-side,
  replaying an older `SET` regresses it (harmless while the data is a single "last write
  wins" date, but structural as soon as `SET`s carry distinct values to keep, e.g.
  **logging** / X-API);
- **the "poison" entry** — an entry the server keeps rejecting blocks the drain; a V1 would
  add a retry counter / a sidelining mechanism.

### Other topics

Identified for upcoming versions: more robust authentication / session handling, logging
(X-API?), support for other media, and integration tests.
