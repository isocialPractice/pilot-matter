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

### Code Review Override - the capture follows the name only halfway

#### Resolve Issues

- [ ] Row Scan 2
  - **Issue**: `SECOND_NAME_ROW` at `test/page.test.js:751` takes the pattern
    text from `SECOND_NAME` but respells everything else about it, so the pair
    the item set out to stop drifting still drifts in two of the three ways the
    name can be edited. The flags are written out again as `'i'` rather than
    read from `SECOND_NAME.flags`: tighten the name to `/Controls?/` on the
    view that a row always capitalises it, and the guard's
    `assert.doesNotMatch(rows, SECOND_NAME)` passes a row reading
    `X - show controls` while `SECOND_NAME_ROW` goes on matching that same row,
    so the guard and its own capture disagree about one row. And the name is
    interpolated unparenthesised, so widening it to an alternation breaks the
    row context out of the pattern: with `SECOND_NAME` set to
    `/controls?|key list/i`, `SECOND_NAME_ROW` builds as
    `/[^\r\n]*controls?|key list[^\r\n]*/i`, and a row `H - Hide Key List` is
    quoted as the bare fragment `Key List` instead of the whole row - which is
    the one thing the capture exists to do rather than matching the name alone.
    Both measured against the live definitions. Nothing fails today, because
    `/controls?/i` is a bare sequence carrying the single flag that happens to
    be respelled correctly, so the next edit to the name is what reaches it.
    The `1.0.0-alpha.1.24.6` entry in `CHANGELOG.md` states the opposite as
    already achieved: "Widening either reaches both callers."
  - **Goal**: Build the capture from the whole of `SECOND_NAME` rather than
    from its `source` alone. Wrap the interpolation in a non-capturing group so
    an alternation cannot reach past it, and pass `SECOND_NAME.flags` in place
    of the literal `'i'` so the case rule has one definition too. Both
    measurements above then agree with the guard, and the name becomes editable
    in the way the entry already claims it is. Correct the "Widening either
    reaches both callers" sentence in the `1.0.0-alpha.1.24.6` entry of
    `CHANGELOG.md` to match what is true once the derivation is finished.
  - From: Code Review Override - what the balanced span promises, and markup read as a row

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

> 172 earlier items in `TODO-archive.md`, newest last.

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
- [x] The guard on the control list holds one row rather than the list
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
- [x] Four comments still say the `Controls` entry is what puts the list on screen
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
- [x] **Balanced Span**: The list guard reads to the first `</div>` rather than to the end of the list
  - **Issue**: `the row that collapses the list names the action rather than the
    list` now runs its `doesNotMatch` over the whole captured body, which is the
    bound its docstring states - but the capture it reads is
    `/<div id="controls-help-list">([\s\S]*?)<\/div>/` at `test/page.test.js:598`,
    non-greedy to the *first* `</div>`. The body of `#controls-help-list` happens
    to carry no nested element today, so the capture happens to reach the end of
    the list, and nothing in the suite holds that it does. Verified against the
    same capture with one row group added: a list reading
    `<div class="group">W/S or arrows - Pitch<br></div>` followed by
    `X - Show Controls<br>` captures only as far as the group's close, and
    `/controls?/i` over that span returns false - the guard goes blind to the
    second name exactly as it did before this version widened it. The companion
    test at `:664` would catch a wrapper placed around most of the rows, since
    the keys it looks for would fall outside the capture, but not one placed
    after the last key row, which is where a footnote or a group of trailing rows
    would go. So the gap is narrowed again rather than closed: from one row of
    fifteen to everything before the first nested close.
  - **Goal**: Make the span the guard reads the span the docstring claims. Either
    capture the list body by balancing its close rather than taking the first one
    - matching to the `</div>` that precedes `<div id="controls-help-hint">`, which
    is the sibling that already marks the end of the list - or hold the list free
    of nested elements in a test of its own so the non-greedy capture is sound by
    something stated rather than by accident. Shared with `:664`, which takes the
    same capture and has the same reach. Then re-run with a row group added ahead
    of an `X - Show Controls<br>` row to see it fail, the way the widened guard
    was already checked against a plain trailing row.
  - From: Code Review Override - the widened guard's own reach, and one more comment naming the start menu
- [x] A fifth comment still says the start menu is what opens the control list
  - **Issue**: the four comments this version corrected were the four the item
    named, and the second paragraph of the one at `js/main.js:926` was not among
    them. It still reads "Over the title screen the list is not a toggle but a
    panel the start menu opened" at `js/main.js:933`, three lines below the
    paragraph that was rewritten to say the `CONTROL REFERENCE` row is what puts
    the list on screen. The start menu does not open the list: its
    `CONTROL SETTINGS` entry opens the control settings panel, and the row inside
    that panel sets `titleHelp` at `js/main.js:1083`, so the menu is two levels
    removed from it. That is the same stale chain the item existed to remove, and
    it now sits in the same docblock as its own correction, which reads as the two
    halves disagreeing about what opens the list. The clause after it is already
    right - it names the `Control Reference` row - so only the attribution is
    wrong.
  - **Goal**: Say the list over the title screen is a panel the `CONTROL REFERENCE`
    row opened, rather than one the start menu opened, keeping the paragraph's
    point intact: that over the title the list is a panel rather than a toggle, so
    a click closes it the way choosing that row again would. Leave the rest of the
    docblock as this version left it. While there, check the same docblock reads as
    one account of the list rather than two.
  - From: Code Review Override - the widened guard's own reach, and one more comment naming the start menu
- [x] Balanced Span 1
  - **Issue**: `elementBody()` at `test/page.test.js:603` keeps its documented
    promise in one direction only. Its docstring says the span is "null again
    when its tags do not balance", but the loop returns at the first point the
    depth reaches zero, so only the unclosed direction - a missing `</div>`,
    where the depth never returns and the loop falls through to `return null` -
    is reported. An element carrying one `</div>` too many returns a truncated
    span instead, silently. Verified against a list reading
    `W/S - Pitch<br></div>` on the third line followed by
    `H - Show Controls<br>` and `F2 - Photo`: the reader returns only
    `<h3>CONTROL REFERENCE</h3>` and the first row, and `/Show Controls/` over
    that span is false. That is the same blindness the item coined
    **Balanced Span** existed to end - a guard reading a span shorter than the
    one its docstring states, passing because it cannot see the row that would
    fail it - arriving now through a stray close rather than through a nested
    one. The `assert.ok(list, 'index.html should carry the control list')` in
    both callers cannot tell the two apart either: on a genuine null it names a
    list that is carried, and on an element whose body is empty the reader
    returns `''`, which is falsy, so a present-but-empty list is reported as a
    missing one too.
  - **Goal**: Make the function's behaviour and its docstring say the same
    thing. Either detect the over-closed direction and return null for it -
    the depth going negative before the element's own close is the signal, and
    it means the markup cannot be read rather than that the element is short -
    or narrow the docstring to the direction the loop actually reports and say
    plainly that a stray close truncates the span. Prefer the first: a test
    reading a short span and passing is the failure mode of the last three
    versions. While there, separate "no such element" from "cannot be read"
    well enough that a caller can say which it hit, so the
    `should carry the control list` message stops being the answer to three
    different conditions, and decide whether an empty body is a null or an
    empty string. Then extend
    `a list body is read past a nested close rather than up to the first one`
    to hold whichever contract is chosen, since nothing in the suite exercises
    either unbalanced direction today.
  - From: Code Review Override - the widened guard's own reach, and one more comment naming the start menu
- [x] **Row Scan**: The self-name guard reads a wrapper's own attribute as a row
  - **Issue**: `the row that collapses the list names the action rather than the
    list` at `test/page.test.js:659` runs `assert.doesNotMatch(rows, /controls?/i)`
    over the list body with only the `<h3>` heading removed, so the body it
    scans is markup as well as text. Every nested element's tag is in that scan.
    Verified against a list whose first row is wrapped in
    `<div class="controls-row">`: `/controls?/i` matches, the test fails, and
    the row it names in the failure message is `div class="controls-row"` -
    an attribute, while the same span with its tags stripped carries no row
    naming the list at all. So the guard reports a second name that does not
    exist and points the reader at a tag. The exposure is not new - the capture
    this version replaced also held a nested element's opening tag - but it now
    covers every nested element in the list rather than only those ahead of the
    first close, and a wrapper named after the panel it sits in is the likely
    name for one. The new test's own example wrapper, `<div class="group">`,
    happens to carry no `control` and so does not show this.
  - **Goal**: Scan the rows rather than the markup: take the tags off the span
    before looking for a second name, so a class or id carrying the list's name
    is not read as a row and the failure message quotes row text. Keep the
    `<h3>` removal ahead of it, since the heading is the list's own correct name
    and is held by the test above. Then state the new bound with a case the page
    cannot show - a row wrapped in an element whose attribute carries `control`
    passing, alongside a genuine `X - Show Controls` row still failing - so this
    guard's reach is held by something written rather than by the wrapper names
    the page happens to use.
  - From: Code Review Override - what the balanced span promises, and markup read as a row
- [x] Move the version into the nested pre-release form
  - **The core is doing the suffix's job.** `package.json` reads
    `1.24.4-alpha`, which claims twenty-four minor releases of a package that
    is not on a registry, while the `-alpha` says it is not released at all.
    Every run climbs a release number nothing has released.
  - **Write `1.0.0-alpha.1.24.4`.** The core becomes the release being worked
    towards and stops moving until the suffix is dropped; the old core moves
    into the suffix, where it keeps the record of how far the project has
    come. The inner triple then moves the way the core used to: a patch to
    `1.0.0-alpha.1.24.5`, a minor to `1.0.0-alpha.1.25.0`, a major to
    `1.0.0-alpha.2.0.0`. `### Version Schemes` in the automation instructions
    is the standing rule.
  - **This is not a release.** It re-expresses the version the project is
    already at, so it earns no step of its own. Items completed alongside it
    earn their step from the corrected form, in one entry under one version.
  - **Change it in `package.json` and in this run's `CHANGELOG.md` heading,
    and nowhere else.** Every other mention of `1.24.4` in the repository is
    history - a past entry, a note, a heading naming the release some work
    belonged to - and history is not corrected. In particular, do not rewrite
    an override heading or a `- From:` line that names an old version: a
    `From:` line has to match its heading word for word, and editing one of
    the pair breaks the item mid-run.
  - **Say in the entry why the version looks smaller than yesterday's.** The
    new version sorts below the last one published, and a reader who meets
    that with no explanation beside it goes looking for a mistake. Name the
    old form and the new one, and say the switch was deliberate.
  - **Leave the three existing tags alone.** They record releases that
    happened. Do not delete one, do not move one, and do not re-tag to make
    the ordering look right - the next releases pass them.
  - **Two traps.** `1.0.0-alpha.1.02.0` is not valid semver, so nothing pads
    an identifier and nothing tidies one. And `npm version patch` is the
    wrong command here: it strips the pre-release and yields a bare `1.0.0`.
    Only the last identifier has a command at all, `npm version prerelease`;
    an inner minor or major is a hand edit.
  - From: Version Scheme Override - re-express the pre-release before the next bump
- [x] Row Scan 1
  - **Issue**: `a list is scanned for a second name by its rows rather than by
    its markup` at `test/page.test.js:774` splits the bound across two fixtures,
    and the half that needed stating cannot fail. The item asked for a wrapper
    whose attribute carries `control` to pass *alongside* a genuine
    `X - Show Controls` row still failing - one span holding both - but
    `wrapped` carries the wrapper with no named row and `named` carries the row
    with no wrapper. Nothing in `named` is a tag, so
    `named.match(/[^\r\n]*controls?[^\r\n]*/i)[0]` can only be the row, and the
    assertion that a failure quotes the row "rather than a tag" has no tag
    available to quote. Verified by cutting the tag strip out of `listRows`
    entirely, leaving the `<h3>` removal alone: both `named` assertions still
    pass and only the `wrapped` half fails, so that half of the test holds
    nothing about tags at all. The `wrapped` half does catch a strip removed
    outright, so this is a bound left unstated rather than a guard that does not
    work. The test also restates the guard's own capture,
    `/[^\r\n]*controls?[^\r\n]*/i` at `test/page.test.js:760`, rather than
    reading it from one place, so changing what the guard quotes with leaves the
    test green against the old pattern.
  - **Goal**: State the bound in one span, as the item asked: a fixture with
    `<div class="controls-row">` wrapped round a row and a genuine
    `X - Show Controls` row beside it, asserting both that `/controls?/i` still
    matches - the real row is caught - and that the quoted match is
    `X - Show Controls` rather than the class. That arrangement is the only one
    in which quoting a tag is possible at all, which is what makes it the case
    worth writing. Confirmed to behave over that combined span, where
    `listRows` quotes `X - Show Controls`. Keep the existing `wrapped` fixture,
    which is what catches a tag strip removed outright. While there, have the
    guard and the test read one capture pattern rather than two copies of it, so
    the quote the guard makes and the quote the test checks cannot drift apart.
    The last `Changed` bullet of the `1.0.0-alpha.1.24.5` entry in
    `CHANGELOG.md` names this gap as open; correct that sentence once the case
    is stated.
  - From: Code Review Override - what the balanced span promises, and markup read as a row
