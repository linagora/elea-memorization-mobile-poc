# Éléa memorization mobile POC

**Expo / React Native** POC that wraps Éléa's *Memorization* SPA (Moodle) in a `WebView`.
The app holds no business logic of its own: it loads Éléa's page and injects JavaScript to
fill the gaps the page doesn't cover on mobile.

Its core is **offline support**: a cache layer over the module's `GET`/`SET` calls that
serves the last known value with no network and replays offline `SET`s once it returns,
matching the "Cache mobile" component of the spec's sequence diagrams. Three pieces are
supporting scaffolding, outside the spec: an **HTML snapshot** (a demo-only offline freeze
of the page), **auto-login**, and **mobile UI adaptation**.

```
App (Expo / React Native)
└─ BrowserView
   ├─ WebView ──► Éléa SPA (Moodle)
   │     injected scripts: autoLogin · cache (offline GET/SET) · mobile (CSS + DEV button)
   └─ DevToolsPanel (logs, force cache, …)
```

## How it works

A patched `window.fetch` intercepts the module's `ajax.php` endpoint; every other request
passes through (and, on the module page, triggers an HTML-snapshot refresh).

|       | Online                                                | Offline / Force cache                            |
| ----- | ----------------------------------------------------- | ------------------------------------------------ |
| `GET` | fetch the server, refresh the cache, return its value | return the cached value (*alternative* scenario) |
| `SET` | cache the date from the body, POST; if the server doesn't confirm `success:true`, enqueue for replay | cache the date, enqueue the `SET`, return KO to the SPA |

On reconnection (the `online` event, and at startup) the offline `SET` queue drains in
arrival order, re-injecting the live `sesskey` and dequeuing each entry only on
`success:true`. If the whole page can't load, native serves the last HTML snapshot.

## Install & run

```bash
npm install
cp .env.example .env   # fill in URLs / credentials locally

npm start              # platform picker
npm run android        # or :ios / :web
```

Each start command runs `build:injections` first.

## Configuration

`.env` is gitignored and never committed.

| Variable                            | Role                                            |
| ----------------------------------- | ----------------------------------------------- |
| `EXPO_PUBLIC_MEMORIZATION_URL`      | URL of the Memorization SPA to load             |
| `EXPO_PUBLIC_MEMORIZATION_BASE_URL` | Base URL for the offline fallback (snapshot)    |
| `EXPO_PUBLIC_ELEA_LOGIN_USERNAME`   | Username for auto-login (optional)              |
| `EXPO_PUBLIC_ELEA_LOGIN_PASSWORD`   | Password for auto-login (optional)              |

If credentials are absent, auto-login is disabled and the SPA stays usable via manual login.

> ⚠️ **`EXPO_PUBLIC_*` variables are NOT secret.** Expo inlines them into the JS bundle
> shipped to the device, and auto-login puts the password in clear text in the page. This
> is acceptable for a **POC test account only**. Production auth (short-lived token,
> OAuth/SSO, secure native storage) is a known follow-up.

## Features

- **Auto-login** (`autoLogin.js`) reads the `logintoken` (CSRF), POSTs the credentials,
  then redirects to the Memorization module.
- **Cache & offline** (`cache.js`) patches `window.fetch` to add the offline cache and the
  sync queue (see [How it works](#how-it-works)). A "Force cache" toggle simulates offline
  from the Dev panel.
- **Mobile adaptation** (`mobile.js`) handles safe-area insets and the viewport, and adds a
  **DEV** button to the nav bar that opens the tools panel.
- **Dev panel** (`devToolsPanel.jsx`) offers a Force cache toggle, navigation, a module
  shortcut, and a log console.

## Injected scripts

Sources in `src/injections/source/*.js` are bundled and minified by **esbuild** into
`src/injections/generatedScripts.js` (generated; do not edit it by hand, change the sources
then rebuild):

```bash
npm run build:injections
```

Scripts talk to the native side via `window.ReactNativeWebView.postMessage`, prefixed by
category and handled in `BrowserView.handleMessage`:

| Prefix           | Use                                              |
| ---------------- | ------------------------------------------------ |
| `[LOGIN] …`      | Auto-login steps                                 |
| `[CACHE] …`      | Cache, `SET` sync, snapshot                      |
| `[OFFLINE_HTML]` | Encoded HTML snapshot, stored natively           |
| `[DEVTOOLS] …`   | Dev panel toggle                                 |
| `[INJECT] …`     | Runtime error in an injected script              |

## Quality

```bash
npm run lint
npm test           # node:test on the pure helpers
```

Non-trivial logic is isolated in pure, tested modules and shared with `cache.js` via
`require` (inlined by esbuild): `dateUtils.js` (format normalization), `setQueue.js`
(FIFO queue of offline `SET`s), `syncQueue.js` (drain/resync orchestration).

## Limits (POC)

- **HTML snapshot:** a static DOM freeze (inlined CSS/JS/images under one `AsyncStorage`
  key). It proves the screen stays visible offline but is single-page, unversioned, and
  fragile to SPA markup changes. A real version would use a service worker or native
  rendering.
- **Sync queue:** the offline `SET` queue (`setQueue.js` + `syncQueue.js`) is durable
  offline-first logic: replays in arrival order, dequeues only on `success:true`, stops on
  the first error so no data is lost. Out of scope for now: conflict handling (replaying a
  stale `SET` regresses a newer value) and poison entries (a permanently rejected entry
  blocks the drain and would need a retry/sidelining mechanism).
- **Other:** more robust auth/session handling, logging (X-API?), other media, integration
  tests.
