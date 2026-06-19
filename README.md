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

## Plan & status

Work is organised as iterations → epics → stories → tasks under
[`docs/epics/`](docs/epics/). Start with
[`docs/epics/ITERATIONS.md`](docs/epics/ITERATIONS.md) and
[`docs/epics/DECISIONS.md`](docs/epics/DECISIONS.md). Regenerate the dashboard with
`./docs/epics/cockpit.sh` (writes `docs/epics/STATUS.md` — do not edit by hand).

The authoritative reference for game behaviour, file formats, and the MIDI protocol
is the reconstructed C in the sarnau repo above (the original game loads `.MAZ`
ASCII mazes; `.MZE` is MIDI Maze 2 and is not used here).
