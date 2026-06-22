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

## Deploying (S3 static website → http://midimaze.sidecartridge.com)

Pushing to `main` builds the site and syncs `dist/` to the S3 bucket
`midimaze.sidecartridge.com` via [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
(`aws s3 sync`, auth from the repo secrets `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`,
region `eu-west-3`). Content-hashed assets are cached `immutable`; `index.html` is uploaded
`no-cache`.

**Served over plain HTTP on purpose.** The page opens a `ws://` connection to the
[`md-MIDI2IP`](https://github.com/diegoparrilla/md-MIDI2IP) orchestrator, and browsers
refuse an insecure `ws://` socket from an HTTPS page (mixed content). The S3 website
endpoint is HTTP, so the page can reach a local / LAN orchestrator. Keep the Cloudflare DNS
record **proxy off (DNS only)** so it stays HTTP.

One-time bucket setup (outside this repo):

1. **Static website hosting** enabled — Index & Error document `index.html`.
2. Bucket name = the domain (`midimaze.sidecartridge.com`); **Block Public Access off** with
   a public-read bucket policy (`s3:GetObject` on `arn:aws:s3:::midimaze.sidecartridge.com/*`).
3. DNS: Cloudflare CNAME `midimaze` → the bucket's
   `midimaze.sidecartridge.com.s3-website.eu-west-3.amazonaws.com` endpoint, proxy disabled.
4. The IAM user behind the secrets needs `s3:PutObject` / `s3:DeleteObject` / `s3:ListBucket`
   on the bucket.

Thereafter every push to `main` redeploys automatically. Verify a build locally with
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
