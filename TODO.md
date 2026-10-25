# TODO

Roadmap for Pilot Matter, a browser-based Three.js flight simulator with no
build step. Items under `## Current` are the next work queue; the remaining
level 2 sections group planned work by theme and state the version update
that applies when their items are completed.

## Current

The work queued for the next run, copied here from the roadmap sections below.
Each item carries a nested `From:` line recording the section it came from, so
its context survives being archived.

- [ ] Say whether the `local-weather` branch is ready to be integrated, on the
  item that asks for it
  - The branch exists locally and on `origin`, and its item makes the merge
    conditional on its API having stabilized - a condition nobody has recorded
    an answer to, so the item cannot be queued or dropped as it stands.
  - Read the branch rather than merging it: what it adds (clouds, rain, moon,
    sky styling), what surface it exposes, whether that surface has settled,
    and what it would cost to bring onto main against the environment pipeline
    as it now is.
  - The answer is nested under the item as a note, with the date, so the next
    run reads a decision rather than asking the question again. Merge nothing
    this run - the item is the look, and the integration is whatever the look
    recommends.
  - From: Documentation & Polish `->` Pruning the Roadmap
- [ ] Prune the archived item still listed under `#### Canyon Run`
  - `Pin the way a cut is drawn against the way a cut is tested` sits unchecked
    under `#### Canyon Run` and checked in `TODO-archive.md`, archived with its
    `From: Game Modes UI/UX -> Improve Existing Game Modes -> Canyon Run` path.
  - It is built. `test/page.test.js` reads `js/walls.js` as source text and pins
    both halves the item asked for - `buildBeam` turning the cylinder with
    `quaternion.setFromUnitVectors` to the normalized across vector, and
    `buildCut` taking `const acrossX = section.dirZ` - each bounded to the
    function it is anchored on. Read those assertions against the module before
    checking the item off.
  - From: Documentation & Polish `->` Pruning the Roadmap
- [ ] Reassemble the five environments once the seamless algorithm lands, so
  each is an endless world with no join anywhere in it
  - The algorithm landed and the reassembly did not: `matchEdges` is called
    from `js/api/matter.js` only, so a host assembling its own world gets
    settled joins and the simulator does not. `Terrain.addTile` in
    `js/terrain.js` builds each tile with `buildEnvironment` and adds the mesh
    to the scene without ever settling it against the tiles beside it.
  - The base is seamless already and that is what hides this: `applyBase`
    samples the noise at `fieldX`/`fieldZ`, which are world coordinates, so the
    ground runs on across a join whatever tile draws it. What does not run on is
    anything an element added, because elements are placed from a per-tile
    `tileSeed` - a peak whose radius reaches past the edge is raised on one side
    of it and not the other.
  - Settle a tile against the tiles already drawn beside it as it is added, and
    leave the budget `drawTiles` spends per frame intact while doing it.
  - From: World & Environment
- [ ] **Mountain** length: a checkbox-gated `min` and `max` length
  (*required*)
  - No `length` range is declared today; `radius` is the only footprint span.
  - **This item and the width below it are what force the gated range kind into
    existence.** The three kinds are `span`, `scalar` and `gradient`, and none
    is a pair of bounds a checkbox turns on, so a fourth kind has to exist, be
    resolved by `resolveConfig`, and be drawn by `js/element-editor.js` before
    either item can be finished. Design it once, for both.
  - From: Environment Design
- [ ] **Mountain** width: a checkbox-gated `min` and `max` width (*required*)
  - No `width` range is declared either, for the same reason, and it takes the
    gated kind the length item introduces.
  - Girth and the bulk range are deliberately not queued with these two: both
    are cheap once the kind exists, and the bulk range randomizes the three
    ranges the others declare, so it wants all three in place first.
  - From: Environment Design

### Code Review Override - the pruning section still reads as unpruned

#### Found Issues

- [ ] `### Pruning the Roadmap` opens on the condition the pass just removed
  - **Issue**: the section's opening paragraph reads "Five sections are in that
    state, and `node todo.mjs --pending` counts 56 items where a handful are
    outstanding - a figure that makes the file useless for deciding what to do
    next, and that reads from outside as a project barely started." The
    10-25-26 pass pruned all five of those sections, and what is left under
    each is outstanding work rather than built work. The figure is wrong three
    times over: the tool read 67 at `HEAD`, not 56, and it reads 14 now. A run
    or a reader taking that paragraph at its word re-opens a pruning pass
    against five sections that hold seven genuinely unfinished items between
    them.
  - **Goal**: rewrite the paragraph so it describes the section as it now
    stands, and drop the item count rather than correcting it - the figure went
    stale between the day it was written and the day the pass ran, which is
    what any count of a moving queue does. The mechanism sentence above it
    ("Section 5 of the automation copies a roadmap item into `## Current` and
    leaves the original where it was") is still true and worth keeping, since
    it is why the section still has items under it. Keep the closing
    paragraph's standing procedure as written. Verify with
    `node todo.mjs --pending` and by reading the five sections back.
  - From: Code Review Override - the pruning section still reads as unpruned
- [ ] The Canyon Run pruning item names three different thresholds for one
  trigger
  - **Issue**: the item queued into `### Pruning the Roadmap` this run calls
    the straggler "the sixth instance of what this section describes", then
    says "If a third instance of that turns up, the thing to queue is a change
    to how an item is queued - not a seventh pruning item." Sixth, third and
    seventh cannot all be counting the same thing, and nothing in the item says
    which counter the trigger reads. Measured against the files: this pass
    checked off twelve roadmap originals whose `## Current` staging copy had
    already been archived by a run between 10-07-26 and 10-24-26 - all ten of
    `## Flight Controls`, plus `Rename the **Controls** entry` and `Accept
    typed values in the **Element Editor** and the **Settings** panel`. So on
    the reading that counts items the threshold was passed nine times over in
    the pass that wrote the sentence, and on the reading that counts pruning
    items it is at one of three. The next run cannot tell whether to change how
    items are queued or to queue another pruning item, which is the whole
    decision the sentence exists to make.
  - **Goal**: state one counter and the number it stands at. The pattern itself
    is real and is confirmed upstream: `## Current` is a staging area whose
    copies archive on their own, the tool has no concept of item identity
    across copies, and no rule in the automation's instructions covers the
    original left behind - so the change the item gestures at is a change to
    that tool rather than to this repository, and saying so is part of the fix.
  - From: Code Review Override - the pruning section still reads as unpruned

## Game UI/UX

Player-facing interface and experience around the flight model, beyond the
raw instrument readout. Completing items in this section applies a minor
version update.

## Game Modes UI/UX

Flights that are played rather than flown: a world, an objective, and the
stages the objective is set at. Completing items in this section applies a
minor version update.

### New Game Modes

### Improve Existing Game Modes

#### Runway Landing

#### Flying through Loops

#### Canyon Run

- [ ] Pin the way a cut is drawn against the way a cut is tested, so the two
  cannot drift apart
  - Nothing in `test/` reaches `js/walls.js`. The beam across each cut is the
    piece that was got wrong once, and the only thing that has ever caught it
    is a pair of eyes on a screenshot or - this run - a browser reading the
    quaternion back off the live scene. Both are checks that only happen when
    somebody runs them.
  - Two things are worth pinning, in the source-text idiom `test/page.test.js`
    already uses for `js/rings.js` and `js/guidance.js`, since `js/walls.js`
    imports Three.js and cannot be constructed in Node. First, that `buildBeam`
    turns the cylinder with `quaternion.setFromUnitVectors` from `(0, 1, 0)` to
    the across vector rather than by Euler angles - the module's own comment
    says a pair of Euler angles does not compose in the order Three.js applies
    them here, and that is the fault in as many words. Second, that `buildCut`
    takes `acrossX = section.dirZ` and `acrossZ = -section.dirX`, the same span
    `corridorCrossing` in `js/corridor.js` measures its offset along, so the
    posts stand where the rule tests. The second is the one with teeth: a
    corridor that flipped its offset convention would draw its walls on the
    wrong axis with the suite still green.
  - Bound each source span with `[^}]*?` the way `test/input-map.test.js`
    bounds its spans, so neither assertion can run past the function it is
    anchored on.

## World & Environment

Grow the procedural world beyond the single terrain tile. Completing items
in this section applies a minor version update.

- [ ] Reassemble the five environments once the seamless algorithm lands, so
  each is an endless world with no join anywhere in it
  - Left unchecked by the 10.25.2026 pruning. The algorithm landed and the
    reassembly did not: `matchEdges` is called from `js/api/matter.js` only,
    by `createEnvironment` and `createTiledEnvironment`, so a host assembling
    its own world gets settled joins and the simulator does not. `Terrain`
    in `js/terrain.js` lays each tile with `buildEnvironment` and adds the
    mesh to the scene without ever settling it against the tiles beside it.
  - The base is seamless already and that is what hides this: `applyBase`
    samples the noise at `fieldX`/`fieldZ`, which are world coordinates, so
    the ground runs on across a join whatever tile it is drawn by. What does
    not run on is anything an element added, because elements are placed from
    a per-tile `tileSeed` - a peak whose radius reaches past the edge is
    raised on one side of it and not the other.
- [ ] Integrate the weather system from the `local-weather` branch (clouds,
  rain, moon, sky styling) into main once its API stabilizes

## Environment Design

Turn the fixed terrain pass into placeable, range-configured elements, in
the spirit of the lightest-weight level editor that could work, where every
element is rendered by algorithm instead of placed as an asset. Completing
items in this section applies a minor version update.

- [ ] **Mountain** bulk range: an apply-to-all mode that randomizes length,
  width, and girth within range and applies transform effects such as
  rotation
  - Left unchecked by the 10.25.2026 pruning, with the three below it. This
    is the shape the pruning item said to read against the registry before
    calling it built, and the registry declares a different one: `mountain`
    in `js/environment/elements.js` carries `count`, `height`, `radius` and
    `girth`, where `radius` is one span standing for the whole footprint and
    `girth` is `scalar(0, 1, 0)`.
  - There is no gate to build these on. The three range kinds are `span`,
    `scalar` and `gradient`, and none of them is a pair of bounds a checkbox
    turns on - so a checkbox-gated range is a fourth kind, which the editor
    in `js/element-editor.js` would have to draw and `resolveConfig` would
    have to resolve, before any of the four can be worked.
  - What is built already covers part of the behaviour, which is worth
    knowing before the gate is added rather than after: the generator picks
    each peak's `radius` out of its span, turns it by a random `angle`, and
    stretches it by `1 + girth * (0.4 + random())`, so the randomize-and-
    rotate half of this item is there unconditionally rather than as a mode.
- [ ] **Mountain** length: a checkbox-gated `min` and `max` length
  (*required*)
  - No `length` range is declared; `radius` is the only footprint span.
- [ ] **Mountain** width: a checkbox-gated `min` and `max` width (*required*)
  - No `width` range is declared either, for the same reason.
- [ ] **Mountain** girth: a checkbox-gated `min` and `max` girth
  (*optional*); on, the form is generated by a random algorithm; off, the
  form is generated as mountains render today
  - The off state is honoured - at `girth: 0` the bump is the round one the
    simulator has always drawn - but by the value being zero rather than by a
    checkbox, and the one scalar is not the `min` and `max` pair asked for.

## Simulator API

Open the simulator up as two importable halves, so the flight model and the
world can each be used without the other. Completing items in this section
applies a minor version update.

## Simulator Configuration

Make the simulator start state and its options data the pilot can see and
change, rather than constants held in the flight code. Completing items in
this section applies a minor version update.

## Flight Controls

How the aircraft is flown rather than what it is flown over: what the keys
mean, how far the attitude may go, and which of that a pilot is allowed to
change. Completing items in this section applies a minor version update.

## Pause: Interactive Build Mode

The twelve-tool editor laid over the world, where ground is shaped by pointing
at it rather than by stepping numbers in a list. The plan for it is already
written; this section is what carries it out. Completing items in this section
applies a minor version update.

- [ ] Carry out the interactive build mode plan
  - **Goal**: Resolve to [interactive-mode-plan.prompt.md](.claude/prompts/interactive-mode-plan.prompt.md)
  - The plan states the twelve tools, the two-column palette, the per-tool
    panel and how each is configured, and says outright that this is not a
    second element editor. Work it from there rather than from this item, and
    break it into items here as its stages become clear - one item for twelve
    tools is not a queue, it is a heading.

## Documentation & Polish

Keep the docs accurate and improve first-run experience. Completing items
in this section applies a patch version update.

### Pruning the Roadmap

Section 5 of the automation copies a roadmap item into `## Current` and leaves
the original where it was, so a section goes on listing work the repository has
long since built. Five sections are in that state, and
`node todo.mjs --pending` counts 56 items where a handful are outstanding - a
figure that makes the file useless for deciding what to do next, and that reads
from outside as a project barely started.

Pruning is one item per section because the judgment is per item: each has to be
read against the source before it is called finished, which is a different
question from doing the next piece of work and should be answered deliberately
rather than as a side effect of refilling a queue. Nothing is deleted. A built
item is checked off and archived with its `From:` path, the way finished work
has always left this file, so the record of what was built survives in
`TODO-archive.md`. An item that turns out not to be built stays unchecked and
in place, and the pruning item says which ones those were.

- [ ] Say whether the `local-weather` branch is ready to be integrated, on the
  item that asks for it
  - The branch exists locally and on `origin`, and its item makes the merge
    conditional on its API having stabilized - a condition nobody has recorded
    an answer to, so the item cannot be queued or dropped as it stands.
  - Read the branch rather than merging it: what it adds (clouds, rain, moon,
    sky styling), what surface it exposes, whether that surface has settled,
    and what it would cost to bring onto main against the environment pipeline
    as it now is.
  - The answer is nested under the item as a note, with the date, so the next
    run reads a decision rather than asking the question again. Merge nothing
    this run - the item is the look, and the integration is whatever the look
    recommends.
- [ ] Prune the archived item still listed under `#### Canyon Run`
  - Found by the 10.25.2026 pruning pass, and it is the sixth instance of what
    this section describes rather than a new kind of thing: `Pin the way a cut
    is drawn against the way a cut is tested` sits unchecked under
    `#### Canyon Run` and checked in `TODO-archive.md`, archived with its
    `From: Game Modes UI/UX -> Improve Existing Game Modes -> Canyon Run` path.
  - It is built. `test/page.test.js` reads `js/walls.js` as source text and
    pins both halves the item asked for - `buildBeam` turning the cylinder with
    `quaternion.setFromUnitVectors` to the normalized across vector, and
    `buildCut` taking `const acrossX = section.dirZ` - each bounded to the
    function it is anchored on. Read those assertions against the module before
    checking the item off, the way the five sections above were read.
  - Worth noticing that this one was made by the run that finished the work,
    which is why the five sections above were not the end of it: every run that
    completes a queued item leaves its roadmap original behind, so pruning is a
    pass that comes round rather than a job that finishes. If a third instance
    of that turns up, the thing to queue is a change to how an item is queued -
    not a seventh pruning item.

## Complete

Everything already done, in the order it was finished, kept as the record of
how the simulator got here rather than as a list still to be worked.

> 262 earlier items in `TODO-archive.md`, newest last.

- [x] Fly by tilt, or by keys, whichever the pilot wants rather than whichever
  the machine has
  - `createTiltState(enabled)` takes the answer, and `js/main.js` hands it
    `isTouchOnly()` once at start-up with nothing able to change it afterwards.
    A tablet with a keyboard cannot turn tilt on and a phone cannot turn it off,
    though both are perfectly capable of the other.
  - The sensor may still refuse, so the setting is what is wanted rather than
    what is happening: `tiltFlying` already tells those two apart, and the pads
    stay on the glass for a tilt that was asked for and never arrived.
  - From: Flight Controls
- [x] Set how far the device is turned before it asks for anything
  - `TILT_DEADZONE` in `js/tilt-controls.js` is 7 degrees, and `tiltToInput`
    takes it as an argument that nothing passes. How still a hand is varies more
    between two pilots than almost anything else here, and a deadzone too narrow
    means an aircraft that will not fly straight.
  - A few labelled positions rather than a range of degrees, the way the other
    options in the settings panel are offered, so no combination of keys lands
    it between two of them.
  - From: Flight Controls
- [x] Choose which controls hand the aircraft back after a level off
  - `VERTICAL_CONTROLS` in `js/input-map.js` is the list `wantsVerticalChange`
    takes, and the throttle is in it: a nudge of the lever on an approach drops
    the altitude hold the pilot set it up with. Roll and yaw are deliberately
    out, and the reasoning for that is written where the list is.
  - A box per control rather than a list to pick from, since the question is
    whether each one counts and the answers are independent.
  - From: Flight Controls
- [x] Rebind the keys that are not control surfaces
  - `RESET_KEYS` and `LEVEL_OFF_KEYS` in `js/input-map.js` are kept out of the
    input state on purpose - one is an instruction and the other is a trim - so
    the keymap above will not reach them. `R` ends a flight on one press with
    nothing between, and `Space` is also the key a menu is chosen with, which
    `js/input-map.js` says is the reason it is bound apart.
  - Both rebindable, and reset allowed to be bound to nothing at all, for a
    pilot flying a long route who would rather reach for the pause menu.
  - From: Flight Controls
- [x] Remember whether the control reference list is open
  - `createHelpState(expanded = true)` in `js/controls-help.js` takes the state
    the list opens in and `js/main.js` passes nothing, so every session opens
    with the list over the corner of the window and the `H` key's answer is
    forgotten at the end of it.
  - Stored beside the other control settings rather than as a third thing: it is
    the same question the panel is already asking, which is how this pilot wants
    the controls to behave.
  - From: Flight Controls
- [x] Prune `## Flight Controls`, which is the worst of the five
  - Every one of its ten items is built, which makes it the whole section: the
    two axis toggles and the full 360 landed in `1.24.0-alpha`, five more in
    `1.0.0-alpha.1.25.0`, and the last two - flying by tilt and the deadzone -
    in `1.0.0-alpha.1.27.0`. Check each against `js/control-settings.js`,
    `js/input-map.js`, `js/key-bindings.js` and `js/tilt-controls.js` before
    checking it off.
  - The section header stays, per **Roadmap Section Structure**, with its
    opening paragraph. A section with nothing left under it is the record of
    that area of work being finished, not a section to delete.
  - From: Documentation & Polish `->` Pruning the Roadmap
- [x] Prune `## Simulator Configuration`
  - All nine are built. The start state, the environment selection and the five
    assembled environments are in the shipped simulator; the three naming the
    menu entry renamed in `1.24.0-alpha` are built; `Reset Flight` restores the
    configured start; the pause menu carries its `Settings` entry; and typed
    values landed in `1.0.0-alpha.1.27.0`.
  - Two of its items ask to reword the two above them, which were worded for a
    `Controls` entry that no longer exists. Read what each actually asks for
    before deciding it is done - a reword nobody did is not the same as a
    rename somebody did.
  - From: Documentation & Polish `->` Pruning the Roadmap
- [x] Prune `## Environment Design`
  - The registry it opens by asking for is `js/environment/elements.js`, and
    every element below it is implemented in it. The gradient helper is there
    too. Twenty items, and the one to be careful with is the mountain bulk
    range, whose checkbox-gated length, width and girth are a specific shape
    that may or may not be what the registry declares.
  - From: Documentation & Polish `->` Pruning the Roadmap
- [x] Prune `## Simulator API`
  - `js/api/index.js` exists and re-exports both halves, and the eleven items
    under it are the surface `docs/api.md` documents and `test/api-contract.js`
    and `test/api-reference.test.js` hold it to. The last item asks for unit
    tests of both pure surfaces, which is what those two files are.
  - From: Documentation & Polish `->` Pruning the Roadmap
- [x] Prune the four built items in `## World & Environment`
  - The edge algorithm's promise is held by `test/world-tiles.test.js`, and
    `matchEdges` and `SEAM_BLEND` settle an assembly where its fields meet, so
    the two algorithm items and the two reassembly items behind them are done.
  - The fifth item, the weather branch, is not pruned: it is real outstanding
    work and is the next item below.
  - From: Documentation & Polish `->` Pruning the Roadmap
