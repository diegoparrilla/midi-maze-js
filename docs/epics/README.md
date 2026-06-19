# Development tracker

Work is organised as **iterations → epics → stories → tasks**, mirroring the
system used in the sibling `md-MIDI2IP` project.

- **Iteration** — a milestone that ends in something testable by automation *and*
  by the user. Narrated in [`ITERATIONS.md`](ITERATIONS.md).
- **Epic** — `EPIC-NN-<slug>/` folder with an `epic.md`. `NN` is globally unique
  and zero-padded.
- **Story** — `STORY-NN-<slug>.md` inside an epic folder. `NN` restarts at 01 per
  epic. Has `## Tasks` (checkboxes), `## Acceptance` (automated + manual), `## Notes`.
- **Task** — a `- [ ]` / `- [x]` checkbox inside a story's `## Tasks` section.
  These checkboxes drive the progress numbers.

Cross-cutting decisions live in [`DECISIONS.md`](DECISIONS.md) as `D-NN` and are
referenced from stories. Hard constraints are `C-NN`.

## Workflow

1. New epic: `cp -r templates` into `EPIC-NN-<slug>/`, fill `epic.md`.
2. New story: copy `templates/story.md` to `EPIC-NN-<slug>/STORY-NN-<slug>.md`.
3. Tick tasks as you complete them.
4. Regenerate the dashboard:

   ```sh
   ./docs/epics/cockpit.sh            # writes STATUS.md
   ./docs/epics/cockpit.sh --stdout   # preview only
   ```

`STATUS.md` is generated — never edit it by hand.

## Reference source

The authoritative spec for game behaviour, the `.MAZ`/`.D8A` formats, and the MIDI
wire protocol is the reconstructed C at `../../../AtariST-MIDIMaze-Source/` (cloned
sibling, read-only). When in doubt, the original C wins.
