# midi-maze-js

A wire-faithful, browser-based re-creation of the Atari ST game **MIDI Maze**,
ported from the reconstructed C source:
https://github.com/sarnau/AtariST-MIDIMaze-Source

The goal is to play MIDI Maze in a mobile/desktop browser and — over a WebSocket
link to the [`md-MIDI2IP`](https://github.com/diegoparrilla/md-MIDI2IP) ring
orchestrator — share a ring with real Atari STs.

## Development

Requires Node 20+.

```sh
npm install      # install dependencies
npm run dev      # start the Vite dev server (open the printed URL)
npm run build    # type-check + produce a static bundle in dist/
npm run preview  # serve the built bundle
npm test         # run the Vitest suite once
npm run test:watch
npm run lint     # eslint + prettier --check
npm run format   # prettier --write (code only; Markdown is hand-managed)
```

The build output in `dist/` is a self-contained static page, launchable from any
browser.

## Deploying (GitHub Pages → midimaze.sidecartridge.com)

Pushing to `main` builds the site and publishes `dist/` to GitHub Pages via
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). The custom domain is
carried by [`public/CNAME`](public/CNAME) (`midimaze.sidecartridge.com`), which Vite
copies into `dist/` so the domain survives each Actions deploy.

DNS is already configured in Cloudflare: a **CNAME** record `midimaze` →
`sidecartridge.github.io`, **proxy disabled (DNS only / grey cloud, no caching)** so
GitHub serves and renews TLS directly.

One-time GitHub setup (repo **Settings → Pages**):

1. **Build and deployment → Source:** select **GitHub Actions** (not "Deploy from a
   branch").
2. Push to `main` (or run the **Deploy to GitHub Pages** workflow via *Actions →
   Run workflow*). The first run publishes the site and registers the custom domain
   from the `CNAME` file.
3. **Custom domain** should show `midimaze.sidecartridge.com`; once DNS verifies, tick
   **Enforce HTTPS**.

Thereafter every push to `main` redeploys automatically. To verify locally:
`npm run build && npm run preview`.

## Plan & status

Work is organised as iterations → epics → stories → tasks under
[`docs/epics/`](docs/epics/). Start with
[`docs/epics/ITERATIONS.md`](docs/epics/ITERATIONS.md) and
[`docs/epics/DECISIONS.md`](docs/epics/DECISIONS.md). Regenerate the dashboard with
`./docs/epics/cockpit.sh` (writes `docs/epics/STATUS.md` — do not edit by hand).

The authoritative reference for game behaviour, file formats, and the MIDI protocol
is the reconstructed C in the sarnau repo above (the original game loads `.MAZ`
ASCII mazes; `.MZE` is MIDI Maze 2 and is not used here).
