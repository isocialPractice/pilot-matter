# TODO

Roadmap for Pilot Matter, a browser-based Three.js flight simulator with no
build step. Items under `## Current` are the next work queue; the remaining
level 2 sections group planned work by theme and state the version update
that applies when their items are completed.

## Current

The work queued for the next run, copied here from the roadmap sections below.
Each item carries a nested `From:` line recording the section it came from, so
its context survives being archived.

- [ ] Remember whether the control reference list is open
  - From: Flight Controls
- [ ] Choose which controls hand the aircraft back after a level off
  - From: Flight Controls
- [ ] Read tilt through the axis settings the keys are read through
  - From: Flight Controls
- [ ] Rebind any control to a key of the pilot's own
  - From: Flight Controls
- [ ] Rebind the keys that are not control surfaces
  - From: Flight Controls

### Code Review Override - the list guard reads one row, and comments name a retired entry

- [ ] The guard on the control list holds one row rather than the list
  - **Issue**: `the row that collapses the list names the action rather than the
    list` in `test/page.test.js:597` captures the whole body of
    `#controls-help-list` and then narrows to the `H` row before judging it, so
    `assert.doesNotMatch(action, /controls?/i)` at `:607` is scoped to the text
    after `H - ` and to nothing else. The list may therefore still name itself
    `Controls` in any other row with the suite green. Verified: adding
    `X - Show Controls<br>` under `index.html:1441` and running `npm test`
    leaves all 1245 tests passing, this new one included. That is the same gap
    that let this version's defect stand for a version - the suite read the
    heading and it read the hint and it never read a row - narrowed from the
    whole list to one row rather than closed. The test's own docstring states
    the wider bound it does not hold, "the list may not carry a second name for
    itself anywhere in it".
  - **Goal**: Hold the bound the docstring already states. Run the `doesNotMatch`
    over the captured list body rather than over the one row's action, with the
    `<h3>CONTROL REFERENCE</h3>` heading sliced off the span first so the list's
    own correct name is not read as the thing being forbidden - that heading is
    pinned already by `the reference list is headed with the name of the row that
    opens it` at `:582`, so nothing is lost by excluding it. Leave the
    `^Collapse` assertion on the `H` row, which is the one part of the test that
    is genuinely about that row's wording. Then re-run with
    `X - Show Controls<br>` in place to see it fail, the way this test was
    already checked against `H - Hide Controls`.
  - From: Code Review Override - the list guard reads one row, and comments name a retired entry
- [ ] Four comments still say the `Controls` entry is what puts the list on screen
  - **Issue**: the entry was renamed to `CONTROL SETTINGS` and no longer opens
    the reference list at all - `js/menu.js:13` carries
    `{ id: 'controls', label: 'CONTROL SETTINGS' }`, and `js/main.js:801` sends
    that entry to `openControlSettingsPanel()`, with the list reached one level
    in from there by the `CONTROL REFERENCE` row at `js/main.js:1077`. The
    comment at `js/main.js:802` says so in as many words: "the reference list it
    used to show is a row inside that panel now". Four other comments were not
    brought along and still assert the old causal chain in the present tense:
    `index.html:88` ("it is what the Controls entry puts on screen"),
    `js/main.js:237` ("the start screen's Controls entry puts the control list
    on screen"), `js/main.js:924` ("it is what the Controls entry puts on
    screen") and `test/page.test.js:765` ("the list is what the Controls entry
    puts on screen"). Two of the four are in the files this run edited, and
    `js/main.js` contradicts itself twice over inside one module. Nothing
    executes a comment, so nothing fails; the cost is that a reader sent to
    `js/main.js:924` to learn why the list takes the pointer is told it is
    answering for an entry that has not opened it since `1.23.0-alpha`.
  - **Goal**: Say in all four that the list is opened by the `CONTROL REFERENCE`
    row of the control settings panel, and that it is also collapsed by `H` over
    a flight, which is the arrangement `js/main.js:802` and
    `docs/controls/clearing-the-screen.html:94` already describe. Keep each
    comment's point intact rather than rewriting it - `index.html:88` and
    `test/page.test.js:765` exist to say why the list takes the pointer, and
    `js/main.js:237` is about the start screen specifically, where the row
    toggles rather than only opens. Leave
    `test/control-settings.test.js:461` exactly as it is: it names the entry in
    the past tense on purpose, "before this panel was between them", and is the
    one of the five that is already correct.
  - From: Code Review Override - the list guard reads one row, and comments name a retired entry

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

## Complete

Everything already done, in the order it was finished, kept as the record of
how the simulator got here rather than as a list still to be worked.

> 164 earlier items in `TODO-archive.md`, newest last.

- [x] Rename the **Controls** entry to **Control Settings**, and make what it
  opens a panel of settings rather than a list
  - From: Simulator Configuration
- [x] **Roll Sense**: Toggle pitch and roll between inverted and directional,
  independently
  - From: Flight Controls
- [x] Allow a full 360 in pitch and in roll, without breaking the controls at
  the limit
  - From: Flight Controls
- [x] Propose seven control settings worth having, as items in the **Flight
  Controls** section
  - From: Flight Controls
- [x] Roll Sense 1
  - **Issue**: The **ROLL AXIS** row offers its two settings the wrong way
    round, so the default names the behaviour of the other setting. Flown in
    Chromium with real key presses, reading the wings off the group's own world
    matrix rather than off an angle or a reading: with `ROLL AXIS` on its
    default of `DIRECTIONAL`, holding `A` puts the left tip at `+6.76` and the
    right at `-6.76` and carries the heading from 0 to `32.6` - the right wing
    down and a right turn - while `D` does the mirror of it and turns to
    `326.4`. Stepping the row to `INVERTED` reverses both, giving `A` a left tip
    of `-6.64` and a heading of `327.5`, which is the left wing down and a left
    turn. So `INVERTED` is what this repository calls directional and
    `DIRECTIONAL` is what it calls inverted. Three statements disagree with the
    default: `js/input-map.js` over `AXIS_DIRECTIONAL` ("right drops the right
    wing"), the **Flight Controls** roadmap item itself ("inverted means [...]
    right turns left"), and `CHEATSHEET.md`, `README.md` and
    `docs/cheatsheet.html`, which all list `A` as **Roll left** with no setting
    named. The **PITCH AXIS** row is correct and wants no change, and neither
    does `js/input-map.js`, which was confirmed to write `rollLeft` for `A` on
    `DIRECTIONAL` and `rollRight` for `A` on `INVERTED`. The sign is the two
    roll lines of `Aircraft.update` in `js/aircraft.js`, where `rollLeft` raises
    `rotation.z` and a raised `rotation.z` drops the right wing - the mirror of
    the fault the pitch keys four lines above already carry a comment about.
    Everything else about the item verified: the two axes step independently,
    `WASD` and the arrow keys turn over together rather than apart, the menus
    still walk the same way with an axis inverted, the choice is stored, and an
    axis turned over under a held key leaves nothing stuck on.
  - **Goal**: Resolve to [roll-sense.prompt.md](.claude/prompts/roll-sense.prompt.md)
  - From: Flight Controls
- [x] Nothing pins which way an input actually rolls or pitches the aircraft
  - **Issue**: The suite has no test that reads which way the aircraft
    physically goes for a given input. `test/input-map.test.js` pins which field
    a key writes, `test/tilt-controls.test.js` pins which field a tilt writes,
    and `test/flight-state.test.js` touches `rotation.z` only as a value carried
    or zeroed. That is the gap that let the roll sign above sit unnoticed
    through every run to here, and it is the same gap the pitch keys fell into
    once before, which their own comment records as "Raising it here flew W into
    a dive." Measuring it needs a browser today, which is why only this agent
    has ever measured it.
  - **Goal**: Pin the direction of all four pitch and roll controls off the
    attitude rather than off the Euler angle behind it, so the assertion states
    what a pilot would notice: `pitchUp` raises `getAttitude().forwardY`,
    `rollLeft` raises `getAttitude().rightY` - the right wing up, which is the
    left wing down - `rollRight` lowers it, and the coordinated turn follows the
    dropped wing, with `rollLeft` carrying `-rotation.y` down. `Aircraft`
    imports Three.js, so use the idiom the project already has for such modules
    rather than a plain Node construction. Worth doing in the same pass as
    **Roll Sense 1**, whose fix it is the check for.
  - From: UI/UX Override - the roll axis reads the wrong way round
- [x] The collapsed reference list still carries the name the expanded one gave
  up
  - **Issue**: `HELP_HINT` in `js/controls-help.js` is `H - CONTROLS`, and
    `index.html` writes the same string into `#controls-help-hint`, while the
    expanded list it collapses to is now headed `CONTROL REFERENCE`. The stated
    point of the rename was that the row which opens the list and the list it
    opens are named the same thing, and the collapsed form of that same list is
    the one place still naming it `CONTROLS` - so a pilot who collapses the list
    sees it change its own name. `docs/controls/clearing-the-screen.html`
    documents the `H - CONTROLS` line as it stands, and
    `the collapsed controls list leaves the hint that reopens it` in
    `test/page.test.js` asserts `index.html` carries `HELP_HINT`, so the
    constant, the markup, that page and the test all move together.
  - **Goal**: Name the collapsed hint for the list it reopens, and carry the new
    wording into `docs/controls/clearing-the-screen.html`. Keep the key at the
    front of it - the hint exists to say which key brings the list back - and
    keep it short enough for the corner it is drawn in.
  - From: UI/UX Override - the roll axis reads the wrong way round
- [x] Three of the four panel openers do not close the new panel
  - **Issue**: `openControlSettingsPanel` in `js/main.js` closes the other three
    panels, which is the convention `openSettingsPanel`, `openEditorPanel` and
    `openGameModesPanel` already keep with each other. None of those three was
    taught to close the control settings panel, so the set is no longer mutually
    exclusive in code - it is only exclusive because `syncOverlays` ranks
    `controls` below `modes` and `settings` and because every key that opens a
    panel is swallowed by the open one. Nothing reaches it today, which is why
    this is not filed as a defect: the control panel takes every key before the
    open keys are read, and the menus that could be clicked are display:none
    behind it. The next panel, or the next open key, is what makes it reachable,
    and the failure then is a panel that reappears when the one over it closes.
  - **Goal**: Add `closeControlSettings(this.controlSettings)` to the other three
    openers, so the exclusion is stated in each of them rather than resting on
    the order `syncOverlays` happens to rank them in.
  - From: UI/UX Override - the roll axis reads the wrong way round
- [x] The docs page twin of the README's menu paragraph was left behind
  - **Issue**: `README.md` was updated this run to read "In the settings panel,
    the control settings panel and the element editor, `A`/`D` or the arrows
    step the value under the cursor". `docs/controls/index.html` carries the
    same sentence under **Working a menu** and still names only the settings
    panel and the element editor, so the published page says the control
    settings panel's rows cannot be stepped while the README says they can. The
    same paragraph's `Esc` sentence is right either way.
  - **Goal**: Bring the **Working a menu** paragraph in
    `docs/controls/index.html` into line with the README's. Its key table is
    complete as it stands - the panel has no open key of its own - so the
    paragraph is the whole of it.
  - From: UI/UX Override - the roll axis reads the wrong way round
- [x] The row for `H` inside the reference list is the last place naming it
  `Controls`
  - **Issue**: this run renamed `HELP_HINT` to `H - CONTROL REFERENCE` so that
    the row which opens the list, the heading the list carries and the line the
    collapsed list leaves behind are one name, and `CHANGELOG.md` records the
    collapsed form as "the one place still naming it something else". It was
    not. `index.html:1441` draws `H - Hide Controls` as the ninth row of
    `#controls-help-list`, nine lines under the `<h3>CONTROL REFERENCE</h3>`
    heading at `:1432` and eight lines over the renamed hint at `:1449`, so the
    list still calls itself `Controls` in its own body - which is the exact
    reading the rename was made to stop. The three places that describe the key
    outside the game all avoid the word: `README.md:101`, `CHEATSHEET.md:24` and
    `docs/cheatsheet.html:114` each give `H` as collapsing "the control list",
    so the in-game row is the only outlier left. Nothing fails and nothing is
    unreachable; the cost is that a pilot reading the list for the key is told
    the key hides something called `Controls`.
  - **Goal**: Reword the `H` row of `#controls-help-list` in `index.html` so it
    names the action rather than a second name for the list - "Collapse List",
    matching the wording `README.md`, `CHEATSHEET.md` and `docs/cheatsheet.html`
    already use - and correct the `1.24.1-alpha` **Changed** entry in
    `CHANGELOG.md`, which claims the collapsed hint was the only place still
    reading `CONTROLS`. Worth checking `test/page.test.js` first: it reads the
    list's heading and the hint but not its rows, so the row may want pinning
    the way `the reference list is headed with the name of the row that opens it`
    pins the heading.
  - From: Code Review Override - the reference list still calls itself Controls on its own H row
