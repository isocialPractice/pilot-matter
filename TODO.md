# TODO

Roadmap for Pilot Matter, a browser-based Three.js flight simulator with no
build step. Items under `## Current` are the next work queue; the remaining
level 2 sections group planned work by theme and state the version update
that applies when their items are completed.

## Current

The work queued for the next run, copied here from the roadmap sections below.
Each item carries a nested `From:` line recording the section it came from, so
its context survives being archived.

- [ ] Prune `## Flight Controls`, which is the worst of the five
  - From: Documentation & Polish `->` Pruning the Roadmap
- [ ] Prune `## Simulator Configuration`
  - From: Documentation & Polish `->` Pruning the Roadmap
- [ ] Prune `## Environment Design`
  - From: Documentation & Polish `->` Pruning the Roadmap
- [ ] Prune `## Simulator API`
  - From: Documentation & Polish `->` Pruning the Roadmap
- [ ] Prune the four built items in `## World & Environment`
  - From: Documentation & Polish `->` Pruning the Roadmap

### UI/UX Override - a step key with a figure in hand

#### Found Issues

- [ ] The handler-order test still passes on a cancel outside the branch
  - **Issue**: Not a defect in the panels - both of them answer a step key
    correctly, on all four keys, and a browser run of this release confirmed it.
    The gap is in what pins that. `test/page.test.js` finds the cancel with
    `indexOf(cancel, works)` and then asserts only that it sits above the calls
    that write a value, which a cancel sitting *after* the `isMenuControlKey`
    branch satisfies just as well as one sitting *inside* it. Confirmed by
    mutation rather than by reading: a scratch `js/main.js` whose settings
    handler read `if (isMenuControlKey(e.code)) { }` followed by an unguarded
    `cancelTypedSetting(this.settings);` passed all 86 tests in that file. That
    build is the too-wide guard the release notes say the panels avoid - every
    key gives up on the figure, so a press the panel does nothing with silently
    throws away what the pilot typed.
  - **Goal**: Assert the cancel is governed by the branch, not merely below it -
    for both handlers, that the text between `isMenuControlKey(e.code)` and the
    cancel contains no statement terminator, so the two are one guarded
    statement rather than two. The browser-side reading that catches it is
    pressing a digit, then `KeyQ`, then a second digit: the row must come back
    `23_`, carrying the figure on, rather than `3_`. Reading the row alone does
    not catch it, because the handler returns on an ignored key without calling
    `syncOverlays`, so the stale text survives a figure that was dropped.
  - From: UI/UX Override - a step key with a figure in hand

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

- [ ] Test the edge algorithm against the promise it makes: that from any
  position, at any heading, the ground drawn reaches further than the camera
  can see, and that the tile at a given place is the same ground every time
  it is laid
- [ ] Reassemble the five environments against the edge algorithm as it
  stands, so a preset reads as one endless country rather than as the same
  square laid again and again with a different seed
- [ ] Make the edge algorithm seed a new tile against the tiles already
  beside it, so neighbouring ground blends into a seamless pattern rather
  than meeting at a join
- [ ] Reassemble the five environments once the seamless algorithm lands, so
  each is an endless world with no join anywhere in it
- [ ] Integrate the weather system from the `local-weather` branch (clouds,
  rain, moon, sky styling) into main once its API stabilizes

## Environment Design

Turn the fixed terrain pass into placeable, range-configured elements, in
the spirit of the lightest-weight level editor that could work, where every
element is rendered by algorithm instead of placed as an asset. Completing
items in this section applies a minor version update.

- [ ] Add an element registry (`js/environment/elements.js`) where each
  element declares its configurable ranges and its generator function, so
  new elements are data rather than a bespoke terrain pass
- [ ] **Mountain** height range: peaks render between a `min` and a `max`
  height
- [ ] **Mountain** bulk range: an apply-to-all mode that randomizes length,
  width, and girth within range and applies transform effects such as
  rotation
- [ ] **Mountain** length: a checkbox-gated `min` and `max` length
  (*required*)
- [ ] **Mountain** width: a checkbox-gated `min` and `max` width (*required*)
- [ ] **Mountain** girth: a checkbox-gated `min` and `max` girth
  (*optional*); on, the form is generated by a random algorithm; off, the
  form is generated as mountains render today
- [ ] Add a pure, testable gradient helper that blends a `light` and a `dark`
  color of one base hue with complementary steps, so no element shifts color
  dramatically across its gradient
- [ ] **Grass** color range: a green base rendered as a `light` to `dark`
  gradient
- [ ] **Sand** color range: a brown base rendered as a `light` to `dark`
  gradient
- [ ] **Water body** color range: a blue base rendered as a `light` to `dark`
  gradient
- [ ] **River** color range: a blue base rendered as a `light` to `dark`
  gradient
- [ ] **River** windy ratio: a `0` to `1` curve factor applied along the
  river path by an algorithm that avoids symmetry and reads as a natural
  river
- [ ] **River** width: a `0` to `1` width ratio varied gradually within a
  `min` and `max` width range, so neighboring segments never differ
  dramatically
- [ ] **Forest** tree height range: a `min` and `max` height for the trees in
  the forest
- [ ] **Forest** density: a `0` to `1` value setting how tightly the trees
  pack
- [ ] **Forest** size: a `min` and `max` circumference, with an algorithm
  that generates an asymmetric outline reading as a natural forest
- [ ] **Canyon** element: depth range, wall steepness, and a branching path
  length carved into the heightfield
- [ ] **Desert** element: dune height range and dune spacing, reusing the
  sand color range
- [ ] **Town** element: block-modeled buildings and homes, configured by
  grid size, block density, and building height range
- [ ] **Snow** element: a snow line altitude, a `0` to `1` coverage value,
  and a slope threshold so snow settles on high and flat ground

## Simulator API

Open the simulator up as two importable halves, so the flight model and the
world can each be used without the other. Completing items in this section
applies a minor version update.

- [ ] Add a single public entry point (`js/api/index.js`) that re-exports the
  Pilot API and the Matter API, so a host page imports one module
- [ ] **Pilot API**: move the control and flight loop behind a
  `createPilot()` factory that runs against a caller-supplied scene
- [ ] **Pilot API**: accept an external environment through a supplied
  terrain height sampler and bounds, so altitude and crash detection work
  outside the bundled terrain
- [ ] **Pilot API**: accept an external aircraft asset (any `Object3D` or
  loader result) with a declared control anchor, replacing the built-in mesh
- [ ] **Pilot API**: expose read-only telemetry (airspeed, altitude, vertical
  speed, heading, throttle) as a stable object, so an external HUD renders
  without reaching into internals
- [ ] **Pilot API**: publish the keybinding map as an interface a host can
  remap or replace with its own input source
- [ ] **Matter API**: add a `createEnvironment()` factory returning terrain,
  sky, and mountains as one detachable group any external scene can add
- [ ] **Matter API**: define the contract an external aircraft must satisfy
  (position, orientation, bounds query), so aircraft driven by other control
  APIs can fly the environment
- [ ] **Matter API**: allow caller-supplied meshes and materials to be
  registered as environment elements and placed by the generator
- [ ] **Matter API**: expose environment depth (fog and distance shading) as
  a standalone effect other scenes can apply without importing the terrain
- [ ] Add unit tests for the pure surfaces of both APIs: option defaults,
  contract validation, and telemetry shape

## Simulator Configuration

Make the simulator start state and its options data the pilot can see and
change, rather than constants held in the flight code. Completing items in
this section applies a minor version update.

- [ ] Set the initial flight state to 80 knots airspeed, 1390 ft altitude,
  +1260 ft/min vertical speed, heading 000, 20% throttle, and the chase
  camera, superseding the current standing start
- [ ] Make Reset Flight restore the configured start state instead of
  hardcoded values
- [ ] Add a start screen menu built on the keyboard menu in `js/menu.js`,
  with **Control Settings** and **Settings** entries
- [ ] Reach the control reference list from the start screen **Control
  Settings** entry, so it matches the pause menu entry of the same name
- [ ] Rename the **Controls** entry to **Control Settings**, and make what it
      opens a panel of settings rather than a list
  - Four sites carry the name today: the start screen and pause menu entries in
    `js/menu.js`, and the two `case 'controls':` handlers in `js/main.js`. The
    list itself is `js/controls-help.js`.
  - **What it opens changes with the name.** The entry currently shows a reference
    list; it should open the settings that govern the controls, with the reference
    list reachable from inside it rather than instead of it. The toggles under
    **Flight Controls** are the first things that belong there.
  - **Reword the two items above in the same pass.** Both name a **Controls**
    entry, so a run that renames the entry without touching them leaves the queue
    asking for the old name back.
- [ ] Accept typed values in the **Element Editor** and the **Settings** panel
  - Every value is stepped by clicking today, which is slow for a number a pilot
    already knows. Allow the value to be typed as well, validated against the
    same range the stepper honours, so the two routes cannot disagree about what
    is allowed.
- [ ] Add a **Settings** entry to the pause menu that opens the same panel
  the start screen opens
- [ ] Add an environment selection to the settings panel, defaulting to the
  current generated terrain
- [ ] Add 5 assembled environments, each a named preset of the Environment
  Design elements, selectable from the environment setting

## Flight Controls

How the aircraft is flown rather than what it is flown over: what the keys
mean, how far the attitude may go, and which of that a pilot is allowed to
change. Completing items in this section applies a minor version update.

- [ ] Allow a full 360 in pitch and in roll, without breaking the controls at
  the limit
  - The attitude is clamped at a maximum pitch and roll today, which is what
    keeps the input sane: past the limit, "up" stops meaning up. A loop or a
    barrel roll needs the clamp to open, and needs the controls to stay
    coherent on the way round rather than fighting the pilot at the top.
  - **The algorithm is the item.** Watch for the attitude crossing the current
    maximum and carry the frame round with it, so the input keeps meaning what
    it meant before the crossing. Decide it once, in the attitude code, rather
    than special-casing each key - a fix per key is how two keys come to
    disagree about which way is up at 180 degrees.
  - Leave the clamp in place for pilots who have not asked for this: it is the
    thing that makes ordinary flight readable, so the 360 is a setting rather
    than a new default.
- [ ] Toggle pitch and roll between inverted and directional, independently
  - Four states fall out of two toggles, and all four are wanted: pitch
    inverted with roll directional, both inverted, both directional, and pitch
    directional with roll inverted. Inverted means up lowers the nose and right
    turns left, which is what a pilot coming from a yoke expects; directional
    means the key points where the aircraft goes.
  - Both toggles live in the control settings, and both apply to `WASD` and the
    arrow keys alike, since they are two spellings of one input rather than two
    control schemes.
  - Depends on the control settings panel existing - see **Simulator
    Configuration**.
- [ ] Propose seven control settings worth having, as items in this section
  - The panel is worth more than the two toggles above, and what else belongs
    in it is a question about this simulator rather than a general one: read
    `js/input-map.js`, `js/controls-help.js` and `js/tilt-controls.js` and
    propose from what is already configurable in code but not in the interface.
  - Seven items, each one thing a pilot would change and a reason they would
    change it. Anything that is really a flight-model constant belongs under
    **Simulator Configuration** instead.
- [ ] Rebind any control to a key of the pilot's own
  - `DEFAULT_KEYMAP` in `js/input-map.js` is already a plain map from a control
    to the codes that work it, and `applyKeyToInput` takes the map rather than
    reading the constant - which is exactly what the Pilot API lets a host
    replace. The game offers none of it.
  - A row per control, showing the key it is on and taking the next key pressed
    as the new one. Two controls on one key is the state worth refusing, and a
    pilot who has bound themselves out of the panel needs the way back: a row
    that puts the whole map back as it was.
- [ ] Read tilt through the axis settings the keys are read through
  - `tiltToInput` in `js/tilt-controls.js` writes the four axis controls itself
    and says so in as many words - "neither needs inverting, and neither should
    be" - which was right while nothing could invert them. Now a pilot can set
    pitch inverted and find it applies to the keys and not to the device.
  - One setting rather than two more: whether the axis settings reach the tilt
    input as well. Off is the behaviour the comment describes and the reason for
    it, which is that the device is the aircraft; on is a pilot who thinks of it
    as a stick.
- [ ] Fly by tilt, or by keys, whichever the pilot wants rather than whichever
  the machine has
  - `createTiltState(enabled)` takes the answer, and `js/main.js` hands it
    `isTouchOnly()` once at start-up with nothing able to change it afterwards.
    A tablet with a keyboard cannot turn tilt on and a phone cannot turn it off,
    though both are perfectly capable of the other.
  - The sensor may still refuse, so the setting is what is wanted rather than
    what is happening: `tiltFlying` already tells those two apart, and the pads
    stay on the glass for a tilt that was asked for and never arrived.
- [ ] Set how far the device is turned before it asks for anything
  - `TILT_DEADZONE` in `js/tilt-controls.js` is 7 degrees, and `tiltToInput`
    takes it as an argument that nothing passes. How still a hand is varies more
    between two pilots than almost anything else here, and a deadzone too narrow
    means an aircraft that will not fly straight.
  - A few labelled positions rather than a range of degrees, the way the other
    options in the settings panel are offered, so no combination of keys lands
    it between two of them.
- [ ] Choose which controls hand the aircraft back after a level off
  - `VERTICAL_CONTROLS` in `js/input-map.js` is the list `wantsVerticalChange`
    takes, and the throttle is in it: a nudge of the lever on an approach drops
    the altitude hold the pilot set it up with. Roll and yaw are deliberately
    out, and the reasoning for that is written where the list is.
  - A box per control rather than a list to pick from, since the question is
    whether each one counts and the answers are independent.
- [ ] Rebind the keys that are not control surfaces
  - `RESET_KEYS` and `LEVEL_OFF_KEYS` in `js/input-map.js` are kept out of the
    input state on purpose - one is an instruction and the other is a trim - so
    the keymap above will not reach them. `R` ends a flight on one press with
    nothing between, and `Space` is also the key a menu is chosen with, which
    `js/input-map.js` says is the reason it is bound apart.
  - Both rebindable, and reset allowed to be bound to nothing at all, for a
    pilot flying a long route who would rather reach for the pause menu.
- [ ] Remember whether the control reference list is open
  - `createHelpState(expanded = true)` in `js/controls-help.js` takes the state
    the list opens in and `js/main.js` passes nothing, so every session opens
    with the list over the corner of the window and the `H` key's answer is
    forgotten at the end of it.
  - Stored beside the other control settings rather than as a third thing: it is
    the same question the panel is already asking, which is how this pilot wants
    the controls to behave.

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

- [ ] Prune `## Flight Controls`, which is the worst of the five
  - Every one of its ten items is built, which makes it the whole section: the
    two axis toggles and the full 360 landed in `1.24.0-alpha`, five more in
    `1.0.0-alpha.1.25.0`, and the last two - flying by tilt and the deadzone -
    in `1.0.0-alpha.1.27.0`. Check each against `js/control-settings.js`,
    `js/input-map.js`, `js/key-bindings.js` and `js/tilt-controls.js` before
    checking it off.
  - The section header stays, per **Roadmap Section Structure**, with its
    opening paragraph. A section with nothing left under it is the record of
    that area of work being finished, not a section to delete.
- [ ] Prune `## Simulator Configuration`
  - All nine are built. The start state, the environment selection and the five
    assembled environments are in the shipped simulator; the three naming the
    menu entry renamed in `1.24.0-alpha` are built; `Reset Flight` restores the
    configured start; the pause menu carries its `Settings` entry; and typed
    values landed in `1.0.0-alpha.1.27.0`.
  - Two of its items ask to reword the two above them, which were worded for a
    `Controls` entry that no longer exists. Read what each actually asks for
    before deciding it is done - a reword nobody did is not the same as a
    rename somebody did.
- [ ] Prune `## Environment Design`
  - The registry it opens by asking for is `js/environment/elements.js`, and
    every element below it is implemented in it. The gradient helper is there
    too. Twenty items, and the one to be careful with is the mountain bulk
    range, whose checkbox-gated length, width and girth are a specific shape
    that may or may not be what the registry declares.
- [ ] Prune `## Simulator API`
  - `js/api/index.js` exists and re-exports both halves, and the eleven items
    under it are the surface `docs/api.md` documents and `test/api-contract.js`
    and `test/api-reference.test.js` hold it to. The last item asks for unit
    tests of both pure surfaces, which is what those two files are.
- [ ] Prune the four built items in `## World & Environment`
  - The edge algorithm's promise is held by `test/world-tiles.test.js`, and
    `matchEdges` and `SEAM_BLEND` settle an assembly where its fields meet, so
    the two algorithm items and the two reassembly items behind them are done.
  - The fifth item, the weather branch, is not pruned: it is real outstanding
    work and is the next item below.
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

## Complete

Everything already done, in the order it was finished, kept as the record of
how the simulator got here rather than as a list still to be worked.

> 199 earlier items in `TODO-archive.md`, newest last.

- [x] Five documents write the reserved-key refusal out by hand and no test
  reads them against the eight keys
  - **Issue**: `test/site.test.js:466` is `CARRIES`, the table that holds a site
    page to a list the code publishes. Its docblock exists for this exact
    failure - the cheatsheet and the terrain page "could go stale with nothing
    failing", so "these are the pages the code is read against"
    (`test/site.test.js:462-464`). It has six rows: start fields, control
    settings, environments twice and game modes twice. The keys the game
    reserves have no row. `js/reserved-keys.js` publishes `reservedKeys()` and
    `reservedRole(code)`, and `js/control-settings.js:638` writes a refusal as
    `${keyLabel(code).toUpperCase()} IS ${reservedRole(code)}`, which
    `test/control-settings.test.js:796` asserts over every reserved key - so the
    notice is pinned in the panel and nowhere in the prose. Five documents write
    that notice, or the eight keys behind it, out by hand: `CHEATSHEET.md:170`
    and `docs/cheatsheet.html:235` carry `P IS PAUSE`, both added this turn;
    `docs/controls/control-settings.html:185` carries `P IS PAUSE` and
    `TAB IS INSTRUMENTS`; `README.md:128` carries `P IS PAUSE`; and
    `docs/controls/index.html:122` names all eight, as `C`, `P`, `O`, `L`, `M`,
    `H`, `Tab` and `F2`. The failing state is nameable and the code is already
    shaped for it: `reservedRoles()` at `js/reserved-keys.js:55` carries a list
    of codes per role rather than one code, written that way because a role
    "one key today is two the day a second way to open the settings is added"
    (`js/reserved-keys.js:93`), and `SETTINGS_OPEN_KEYS` is already a list. Add
    that ninth key, or rename a role from `PAUSE`, and all five documents are
    wrong with `npm test` green at 1318. That is the release this item sits
    under: the cheatsheet pair sat a release behind the panel and the suite
    reported 1318 passing the whole time.
  - **Goal**: Give `CARRIES` a reserved-key row, which is the mechanism the file
    already has for this. The material is the notice the panel writes -
    `keyLabel(code).toUpperCase()` + `' IS '` + `reservedRole(code)` over
    `reservedKeys()` - and the one page naming every reserved key today is
    `docs/controls/index.html`, which names the codes rather than the notices,
    while `docs/controls/control-settings.html` names two notices of the eight.
    So decide first which pages owe all eight and which owe one example, and
    write that decision into the row rather than leaving it to the next reader.
    `CARRIES` reads `sources`, which is `docs/**.html` only
    (`test/site.test.js:28`), so `CHEATSHEET.md` and `README.md` need the same
    check written beside it against `cheatsheetDoc` and `readme`. While there,
    add the refusal clause to the five essentials at `test/site.test.js:446`,
    which is what keeps `CHEATSHEET.md` and `docs/cheatsheet.html` saying the
    same thing: editing that sentence in one and not the other is green today.
  - From: Code Review Override - the reserved-key notices in the docs are held to nothing
- [x] Fly by tilt, or by keys, whichever the pilot wants rather than whichever
  the machine has
  - From: Flight Controls
- [x] Set how far the device is turned before it asks for anything
  - From: Flight Controls
- [x] **Typed Row**: Accept typed values in the **Element Editor** and the
  **Settings** panel
  - From: Simulator Configuration
- [x] Pin the way a cut is drawn against the way a cut is tested, so the two
  cannot drift apart
  - From: Game Modes UI/UX `->` Improve Existing Game Modes `->` Canyon Run
- [x] Typed Row 1: a press the figure cannot take restarts the figure rather
  than being refused
  - **Issue**: in the settings panel with the cursor on `START ALTITUDE`,
    typing `1`, `3`, `9` reads `START ALTITUDE  139_`; the next press of the
    minus key - the key beside `0`, and under the thumb on a numpad - leaves
    the row reading `START ALTITUDE  -_`, and `0` then `Enter` sets the start
    altitude to `0 FT`. The three digits already typed are gone with no sign
    they were, and a figure nobody asked for is taken. The eight character
    ceiling does the same: eight digits read `12345678_` and a ninth leaves
    `9_`. The element editor answers both presses identically - a minus part
    way along `COUNT` leaves `COUNT  -_`. `js/typed-value.js` refuses both
    presses correctly and says in `extendTypedValue` that refusing one "leaves
    the text as it was"; `js/main.js` then reads the same press a second time
    through `beginTypedSetting` / `beginTypedEditorValue`, which start a figure
    without asking whether one is already in hand. Observed in Chromium against
    `npm run serve`, both panels, and confirmed against the module directly:
    `readTypedKey('139', 'Minus')` is `null` and `startsTypedValue('Minus')` is
    `true`.
  - **Goal**: Resolve to [typed-row-refused-press.prompt.md](.claude/prompts/typed-row-refused-press.prompt.md)
  - From: Simulator Configuration
- [x] Typed Row 2: a figure stays behind on the row the cursor walked off
  - **Issue**: the cursor leaving a row mid-figure is deliberate, and the
    figure surviving the walk is what is wrong with it. In the settings panel,
    typing `2` at `START ALTITUDE` and pressing `S` moves the highlight to
    `START CLIMB` while the caret stays on `START ALTITUDE`; `5`, `0`, `0` then
    go to the unhighlighted row and `Enter` sets a start altitude of 2500 feet
    while the cursor sits on the climb row. The element editor does the same,
    and there it closes a door the code opens on purpose: open an element, type
    a digit into a range, walk down to `RESTORE THE PRESET` and press `Enter` -
    the `Enter` is taken by the figure, the row reads `LINE  ‹ 7 ›` and the
    preset is never restored. Clicking the same entry does restore it, because
    `onEditorPointer` calls `cancelTypedEditorValue` first and `onEditorKey`
    has no equivalent. That leaves `restoreEditor`'s own `state.typing = null`,
    and the comment above it, unreachable from the keyboard. Observed in
    Chromium against `npm run serve`.
  - **Goal**: Resolve to [typed-row-cursor-left.prompt.md](.claude/prompts/typed-row-cursor-left.prompt.md)
  - From: Simulator Configuration
- [x] The cheatsheet offers a typed figure at a row that steps through a list
  - **Issue**: the paragraph added under `## The start state` in `CHEATSHEET.md`
    and under `<h2 id="the-start-state">` in `docs/cheatsheet.html` opens "Every
    row in the table above can be typed into as well as stepped". That table
    carries six rows, and `START CAMERA` is the sixth: it steps through `chase`,
    `cockpit` and `orbit`, its `Step` column reads `-`, and
    `isTypedSettingRow(state, 'cameraMode')` is `false`, so a digit pressed at
    it does nothing. The same paragraph closes "A row that steps through a list
    cannot be typed into", which is the sentence that contradicts its own
    opening - a reader taking either at its word is wrong about the other. The
    settings page has it right already: `docs/controls/settings.html` says
    "every row of the start state but the condition, the strip and the view".
  - **Goal**: narrow the claim in both files to the rows that hold a figure,
    the way the settings page words it, so `START CAMERA` is not offered a
    typed figure it refuses. The five rows above it are correct as written.
  - From: UI/UX Override - a figure typed into a panel row
- [x] A step key with a figure in hand moves the value behind the caret
  - **Issue**: The cursor keys now give up on a half typed figure, but the step
    keys beside them do not: they are read above that in the same handler. At
    `START ALTITUDE` reading `1390 FT`, typing `2` and pressing `->` leaves the
    row reading `START ALTITUDE  2_` while the stored altitude moves to 1400,
    and a second press takes it to 1410 with nothing on the panel saying so.
    The `Enter` that follows is then refused against a figure the pilot never
    typed. The element editor does the same to a range. Clicking the row
    instead reads `START ALTITUDE  ‹ 1420 FT ›` with no caret, because the
    pointer route gives up on the figure first - so the same action answers
    differently depending on which hand does it.
  - **Goal**: Resolve to [typed-row-adjust-key.prompt.md](.claude/prompts/typed-row-adjust-key.prompt.md)
  - From: UI/UX Override - a figure typed into a panel row
- [x] The handler-order test finds its cancel by the first match rather than in
  the branch it means, so the item above cannot pass it
  - **Issue**: `test/page.test.js`, in "and walking the cursor off one gives up
    on it the same way", takes `given = body[0].indexOf(cancel)` over the whole
    handler and asserts `given > body[0].indexOf('isMenuKey(e.code)')`. The
    occurrence it means is the one in the menu-key branch, and `indexOf` returns
    whichever comes first - so a `cancelTypedSetting(this.settings)` anywhere
    above `isMenuKey` reads as a cancel in the wrong place. The step-key branch
    is above `isMenuKey`, which makes this the test the item above has to get
    past. Measured: with that one line added over `adjustSetting` in
    `onSettingsKey` and nothing else changed, `node --test test/page.test.js`
    fails with "onSettingsKey should give up on a figure where the cursor
    walks" while the menu-key branch still gives up on the figure exactly as it
    does now. The editor's companion test, "and hands the editor the rows that
    walking off one rebuilt", reads its `cancelTypedEditorValue` and
    `setMenuEntries` the same unanchored way.
  - **Goal**: Search from the branch rather than from the top of the handler -
    `body[0].indexOf(cancel, menu)` in place of `body[0].indexOf(cancel)`, and
    the same for the editor test's two lookups - so each assertion reads the
    occurrence that sits where the cursor walks. While there, give both tests
    the `assert.ok(body, ...)` the idiom beside them carries at
    `test/page.test.js:1927`: a regex that stopped matching throws a TypeError
    on `body[0]` rather than naming the handler it could not find.
  - From: UI/UX Override - a figure typed into a panel row
