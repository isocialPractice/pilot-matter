# TODO

Roadmap for Pilot Matter, a browser-based Three.js flight simulator with no
build step. Items under `## Current` are the next work queue; the remaining
level 2 sections group planned work by theme and state the version update
that applies when their items are completed.

## Current

The work queued for the next run, copied here from the roadmap sections below.
Each item carries a nested `From:` line recording the section it came from, so
its context survives being archived.

- [ ] Rename the **Controls** entry to **Control Settings**, and make what it
  opens a panel of settings rather than a list
  - From: Simulator Configuration
- [ ] Toggle pitch and roll between inverted and directional, independently
  - From: Flight Controls
- [ ] Allow a full 360 in pitch and in roll, without breaking the controls at
  the limit
  - From: Flight Controls
- [ ] Propose seven control settings worth having, as items in the **Flight
  Controls** section
  - From: Flight Controls

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
  with **Controls** and **Settings** entries
- [ ] Show the controls list under the start screen **Controls** entry, so it
  matches the pause menu entry of the same name
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

> 145 earlier items in `TODO-archive.md`, newest last.

- [x] The rename to mark reached one more test and stopped four short
  - **Issue**: `test/minimap.test.js` still says gate for what the chart now
    draws as a mark, in the four tests covering `coursePoints` and `courseLine`
    at 165-193: the names `a course is drawn where the chart puts each of its
    gates`, `a gate past the edge of the chart is held at that edge and says
    so`, `a gate that never carried its number is numbered by where it sits` and
    `a course is one line through its gates, in the order they are flown`, the
    comment at 175, the `gate` local at 183, and the message `and a course with
    no gates draws nothing` at 193. Those are the same two pure functions the
    mark-named tests from 200 down exercise through `setCourse`, and a course
    point is now a gate on a loop, a strip on a route or a search's one marker,
    so the file names one thing two ways with the seam between them falling in
    the middle of a section. Nothing fails; the item the run worked was scoped
    to the single test between them, which is why the drift outlived it.
  - **Goal**: Finish the rename across those four tests - names, comment, local
    and message - leaving the seam tests from 334 down alone, because they say
    gate where a gate is what is meant, for `nextGate` and the hoops a loop
    course lights. Nothing but text changes, so the suite should still report
    1039 passing. The `1.19.1-alpha` entry in `CHANGELOG.md` says in as many
    words that the rename is unfinished and that these four are what is left, so
    amend that sentence when it is done rather than leaving it describing a
    state the file has moved past.
  - From: Code Review Override - the held mark's reading and the rename left half done
- [x] Nothing records that the chart's published pages were checked against the
  fix
  - **Issue**: The completed item `The pages written for the chart describe a
    held mark keeping a reading it gives up` closed with a Goal that asked, if
    the stroke were made to carry the reading, for the run to say so rather than
    edit the pages. The stroke does carry it and the pages are correctly
    untouched - `docs/controls/game-modes.html:221` and `:233` and
    `docs/controls/instruments.html:117` all read true against the stylesheet as
    it now stands, checked in review - but neither the `1.19.1-alpha` entry in
    `CHANGELOG.md` nor anything else in the tree says so. The item is checked
    off in `TODO-archive.md` under `## Archived 09-27-26`, so a later reader
    finding those paragraphs claiming green and hollow together cannot tell from
    any record whether they were verified or simply never revisited, which is
    the question the item existed to settle.
  - **Goal**: Add a sentence to the `1.19.1-alpha` entry saying the pages
    written for the chart in `docs/controls/game-modes.html` and
    `docs/controls/instruments.html` are true as written now that a held mark
    keeps its reading, and that they needed no edit. No documentation changes -
    the pages are already right, and the gap is in what the release says about
    them.
  - From: Code Review Override - the held mark's reading and the rename left half done
- [x] Nothing in the suite pins the wider stroke a held mark is drawn with
  - **Issue**: a mark held at the edge of the chart reads by three declarations
    at once - `fill: none`, `stroke-width: 0.9` and the colour - and the suite
    pins two of them. `a mark held at the edge of the chart keeps the colour of
    the hoop it stands for` in `test/page.test.js` now resolves the colour and
    the hollow fill through `cascaded` for all three held readings, and no test
    in the project mentions a stroke width at all. Measured in Chromium against
    the running page, all three held readings resolve `stroke-width: 0.9px`,
    which `.minimap-mark.off-map` takes off `.minimap-mark`'s `0.4` on the same
    one-more-class the colour rules win on - so a rule that dropped the width,
    or a later one that overrode it, would leave a held mark the same weight as
    an unheld one with the suite reporting 1039 passing
  - **Goal**: one more assertion inside the loop that already runs over the
    three held readings, beside the `fill: none` one that is there:
    `assert.equal(cascaded(indexHtml, classes, 'stroke-width'), '0.9')`, so the
    wider stroke is settled through the cascade the way the other two are
  - From: UI/UX Override - the chart's held readings
- [x] A route's later stages cannot be reached by any automated check
  - **Issue**: item 3 of the request asked for the two held readings at
    `CARGO RUN` / `LONG HAUL`, and this run could not read them on the glass.
    A run opens at its first stage and there is no way to open it at another, so
    the only route to the second is landing at both of `SHORT HAUL`'s strips:
    `js/main.js:1128` clears a reported landing on the next frame the aircraft
    is airborne, which is right for a takeoff and means an arrival cannot be
    handed to the app from outside while it is flying, and both flown attempts
    at that leg - one in an earlier run, one this run - failed. This run
    overflew it,
    closest 3560 units along the strip, the stage then resetting. Every other
    mode has reached its second stage in an earlier run - a course, a dead stick
    and a search all have - because a route is the only one whose stage asks for
    a second arrival thousands of units from the first. What was confirmed
    instead is the geometry, read off the app's own
    `stageStart` and `tileBounds`: `LONG HAUL` opens at (8301, 3504) with both
    its strips in the tile west of it, so both marks are held the moment it
    opens, and `THREE STOPS` opens inside its strips' tile and holds neither
  - **Goal**: a way to open a run at a chosen stage, so a check can reach the
    later stages of a mode without flying every stage before them
  - From: UI/UX Override - the chart's held readings
- [x] The stylesheet's own note says the held block wins without the order
  being touched
  - **Issue**: the comment over the held rules, `index.html:219-228`, ends
    "Three classes beat two, so these win on specificity without the order being
    touched". That is false for the one declaration in the block that competes
    with anything. `.minimap-mark.off-map` at line 229 carries two classes, the
    same as `.minimap-mark.next` at 216, so its `fill: none` beats that rule's
    `fill: #00ff44` on written order alone. The two rules that do win on three
    classes against two are the strokes at 230 and 231, and a stroke never
    competes with a fill. Moving line 229 above line 216 - which the comment
    says costs nothing - fills a held next mark green and drops the hollow that
    is what says it is past the edge. Confirmed this run by making that move:
    `a mark held at the edge of the chart keeps the colour of the hoop it stands
    for` in `test/page.test.js` fails on it, that reading having been settled
    through the cascade for `1.19.2-alpha`, so the sheet is now pinned by a test
    whose reason its own comment denies
  - **Goal**: correct the comment's last sentence to what holds - the two stroke
    rules win on specificity, `fill: none` wins on order, so the block has to
    stay below `.minimap-mark.next` and `.minimap-mark.flown` - and say that the
    order is pinned by the held-mark reading in `test/page.test.js` rather than
    only by the comment. `index.html` is otherwise sound and needs no edit
  - From: UI/UX Override - the chart's held readings
- [x] Nothing in the suite reaches the line that opens the run an address asks
  for
  - **Issue**: `openingRun` itself is covered - `test/game-modes.test.js` runs
    five cases over it and four more over `startRun`'s new stage argument - but
    nothing in the project reaches `js/main.js`, where the feature is actually
    connected to the page. The call at `js/main.js:302`,
    `this.openRequestedRun(window.location.search)`, and the
    `openRequestedRun` method at `js/main.js:981` are named by no test.
    Replacing line 302 with a comment and running `npm test` was tried this
    review: it reports 1049 of 1049 passing, the same count as with the line
    there. So the whole feature can be disconnected - `?mode=cargo-run&stage=2`
    silently opening free flight at stage 1 - with the suite reporting a clean
    run. That line is the one the completed item exists for, since a check
    reaching a later stage reaches it through that call and nothing else, and
    the pure function below it passing is no evidence the page ever asks.
    `js/main.js` imports Three.js and cannot be constructed in Node, which is
    why four test files already read it as source text through a `mainSource`
    regex: `test/landing-score.test.js:258`, `test/minimap.test.js:332`,
    `test/page.test.js:1306` and `test/world-tiles.test.js:120`
  - **Goal**: Pin the wiring the way the rest of `js/main.js` is pinned, in the
    `mainSource` idiom those four files use - that the constructor calls
    `openRequestedRun` with `window.location.search`, that the method hands
    `openingRun`'s `modeId` and `stageIndex` to `startRun`, and that a request
    carrying a `problem` is refused rather than opened. Bound each source span
    with `[^}]*?` the way `test/input-map.test.js` bounds its spans, so neither
    can run past the method it is anchored on
  - From: Code Review Override - the address opener's wiring
- [x] **Traffic Pattern**: a full circuit flown to a pattern - takeoff, climb
  out, downwind, base, and final - judged on holding each leg's altitude and
  heading rather than only on the landing at the end of it
  - From: Game Modes UI/UX `->` New Game Modes
- [x] **Canyon Run**: fly the length of a canyon under a ceiling and between
  its walls, with the ceiling coming down and the cut narrowing stage by stage
  - From: Game Modes UI/UX `->` New Game Modes
- [x] **Photo Survey**: photograph a list of named landmarks, each counting
  only when it is caught from inside a height, range, and heading window
  - From: Game Modes UI/UX `->` New Game Modes
- [x] Drop the stand-down branch at the top of the ignore-rules check in
  `test/site.test.js` so the guard applies on every tree, now that the user has
  tracked `.gitignore`, and say in that run's changelog entry that the rules
  reach a clone
  - From: Documentation & Polish
