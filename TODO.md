# TODO

Roadmap for Pilot Matter, a browser-based Three.js flight simulator with no
build step. Items under `## Current` are the next work queue; the remaining
level 2 sections group planned work by theme and state the version update
that applies when their items are completed.

## Current

The work queued for the next run, copied here from the roadmap sections below.
Each item carries a nested `From:` line recording the section it came from, so
its context survives being archived.

- [ ] **Dead Stick**: the engine quits at altitude and the throttle is dead
  for the rest of the flight, with the runway far enough off that reaching it
  is a glide to be planned rather than a descent to be flown
  - From: Game Modes UI/UX `->` New Game Modes
- [ ] **Cargo Run**: land at one strip, then at the next, against a budget
  that only spends while the engine is open, so the route flown matters as
  much as the landings made
  - From: Game Modes UI/UX `->` New Game Modes
- [ ] **Search and Rescue**: find a marker placed somewhere in the world given
  only a bearing and a distance from the start, then get down beside it
  - From: Game Modes UI/UX `->` New Game Modes

### UI/UX Override - the card's rows are bounded at one mode's line heights

#### Resolve Issues

- [ ] Card Clip 1: the card still clips through the middle of a line, in the
  other mode
  - **Issue**: The bounds are sums of the row heights declared on `#game-mode`,
    and each of those is a single line of that row's type. The card is
    `min-width: 260px` with `20px` of side padding and a `1px` border, so a row
    has 218 pixels to be written across at the card's narrowest and a longer one
    wraps to two lines. `RUNWAY LANDING` fits: its name, objective, status and
    clock lay out at 14, 20, 15 and 15 pixels, which is what they declare, and
    all six screens are clean in both readings. `FLYING THROUGH LOOPS` does not:
    the same four lay out at 28, 36, 27 and 15, and the pointer at 37 against
    the 19 it declares. So in ordinary flight, pads out, no landing and no gate
    involved, `FLY THROUGH EVERY LOOP` runs 277 to 309 against a clip ending at
    287 on 320x460 and is cut by 22 pixels - most of the row, on the shortest
    screen a browser leaves, which is the screen the completed item is named
    for. `THREE GATES  ·  STAGE 1 OF 4  ·  LOOP 1 OF 3` is cut by 1 on 320x568
    and the `TIME` line by 6 on 393x578. 393x852, 852x330 and 568x320 are clean,
    because the card is past its minimum width there and nothing wraps. Nothing
    fails: `npm test` is 937 passing, and `CARD_STATES` in `test/page.test.js`
    models the card the way the stylesheet does, one declared height per row, so
    the model and the stylesheet agree about a height neither of them measures.
  - **Goal**: Resolve to [card-rows-wrap-past-their-declared-heights.prompt.md](.claude/prompts/card-rows-wrap-past-their-declared-heights.prompt.md)
  - From: UI/UX Override - the card's clip falls through a line

## Game UI/UX

Player-facing interface and experience around the flight model, beyond the
raw instrument readout. Completing items in this section applies a minor
version update.

## Game Modes UI/UX

Flights that are played rather than flown: a world, an objective, and the
stages the objective is set at. Completing items in this section applies a
minor version update.

### New Game Modes

- [ ] **Dead Stick**: the engine quits at altitude and the throttle is dead
  for the rest of the flight, with the runway far enough off that reaching it
  is a glide to be planned rather than a descent to be flown
- [ ] **Traffic Pattern**: a full circuit flown to a pattern - takeoff, climb
  out, downwind, base, and final - judged on holding each leg's altitude and
  heading rather than only on the landing at the end of it
- [ ] **Cargo Run**: land at one strip, then at the next, against a budget
  that only spends while the engine is open, so the route flown matters as
  much as the landings made
- [ ] **Canyon Run**: fly the length of a canyon under a ceiling and between
  its walls, with the ceiling coming down and the cut narrowing stage by stage
- [ ] **Search and Rescue**: find a marker placed somewhere in the world given
  only a bearing and a distance from the start, then get down beside it
- [ ] **Photo Survey**: photograph a list of named landmarks, each counting
  only when it is caught from inside a height, range, and heading window

### Improve Existing Game Modes

#### Runway Landing

#### Flying through Loops

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
- [ ] Add a **Settings** entry to the pause menu that opens the same panel
  the start screen opens
- [ ] Add an environment selection to the settings panel, defaulting to the
  current generated terrain
- [ ] Add 5 assembled environments, each a named preset of the Environment
  Design elements, selectable from the environment setting

## Documentation & Polish

Keep the docs accurate and improve first-run experience. Completing items
in this section applies a patch version update.

## Complete

Everything already done, in the order it was finished, kept as the record of
how the simulator got here rather than as a list still to be worked.

> 103 earlier items in `TODO-archive.md`, newest last.

- [x] The right-hand pad cluster is drawn off the edge of a 320 pixel screen
  - **Issue**: With the pads out at 320x568 and at 320x460, the left cluster
    occupies x 16..172 and the right one x 172..328 on a screen 320 wide, so
    `YAW R` is drawn at x 280..328 and eight pixels of it are outside the
    viewport. `#touch-controls` is a flex row with `padding: 0 16px 16px` and
    `justify-content: space-between`, and each `.touch-cluster` is
    `repeat(3, 48px)` with `gap: 6px`, so the two come to 16 + 156 + 156 + 16 =
    344 and do not fit 320: `space-between` has no space to distribute, packs
    from the left, and the right cluster runs off the end. At 360 wide the two
    are clear at 16..172 and 188..344, and every wider size is clear. 320 is the
    width the stylesheet's own comments reason about and the width the two
    completed items were modelled at - both of them put the right cluster at
    x 148..304, which is where `space-between` would place it if it fitted.
  - **Goal**: Fit the two clusters inside the narrowest screen rather than
    letting one overflow it - a smaller cell or gap below 288 pixels of cluster,
    or less side padding, whichever reads better under a thumb - so that no pad
    is drawn outside the viewport at 320 CSS pixels. Pin the widths in
    `test/page.test.js` beside the floated overlays.
  - From: UI/UX Override - the card lifted onto the notice
- [x] The muted notice sits in the pad band on a screen held sideways
  - **Issue**: `#audio-muted.floated` is placed at `top: 140px` and is 22 pixels
    tall, so it occupies y 140..162 at every size. With the pads out the band
    starts at 158 on an 852x330 screen and at 148 on a 568x320 one, so the
    notice runs 4 and 14 pixels into it and overlaps `PITCH +`, which paints
    over it at `z-index: 130`. On 393x852 the band starts at 680 and the notice
    is clear. Named in the run's own request as a known limit left out of scope
    and to be reported rather than fixed.
  - **Goal**: Give the notice what the readouts were given - moved into the band
    between the two clusters on a screen too short for the left edge, or taken
    up under the ladder - so it is not under a thumb at the sizes a phone held
    sideways actually gives.
  - From: UI/UX Override - the card lifted onto the notice
- [x] The pitch keys carry the nose the opposite way to what the controls say
  - **Issue**: From a steady cruise, holding `W` for 1.2 seconds took the
    altimeter from 1073 to 860 ft with the vertical speed reading -20950 ft/min
    and the attitude ladder's horizon moving from `translate(0 14.91)` to
    `translate(0 -100.60)`; holding `S` put both back. The ladder agrees with
    the world, so what is inverted is the binding rather than the instrument:
    `js/aircraft.js` raises `rotation.x` for `pitchUp`, and `pitchForClimb` in
    `js/flight-model.js` states in its own comment that "a positive rotation
    about +X - the axis out of the left wing - carries that nose down".
    `docs/controls/index.html` reads "W / up - Pitch up (nose up)",
    `CHEATSHEET.md` names `PITCH +` and `PITCH -` as "Nose up / down", and
    `PITCH +` is a label on the glass on the touch layout, so the claim is made
    on screen as well as in the documentation. A run before this one saw the
    same sign and left it alone on the grounds that the in-game control list
    claims no direction; the documentation and the pad label do claim one.
  - **Goal**: Make the binding and what is written about it agree. Flipping the
    two pitch cases in `js/aircraft.js` so `pitchUp` lowers `rotation.x` is the
    smaller change to what a pilot reads, and `js/tilt-controls.js` maps a
    device tilted back to the same `pitchUp` and has to be checked with it.
    Changing the documentation and the pad labels instead is the other way, and
    is a decision rather than a repair.
  - From: UI/UX Override - the card lifted onto the notice
- [x] The one compass frame is still written down two ways
  - **Issue**: This release makes east the world's `-X` and says so in
    `js/units.js`, `js/minimap.js` and `docs/controls/instruments.html`. The
    tiled-world example in `docs/api.md` was not taken with them: lines 416 and
    417 still name the tile at `x: -0.5` `west` and the one at `x: 0.5` `east`,
    which is the mirror of the frame the release just settled, so the two pages
    of the same site now contradict each other on which way the x axis runs.
    `docs/api-reference.html` carries the same two lines at 473 and 474 because
    it is generated from that markdown, and `test/environment-tiles.test.js`
    names `tile(0, 0)` west and `tile(1, 0)` east at lines 90, 165 and 196.
    Nothing fails and the suite passes - a join is a join whichever name the
    variable carries - but a host building an assembly from the example ends up
    with every compass name in it reversed, and the example is the one place
    the API says anything about the axis at all.
  - **Goal**: Swap the two names in `docs/api.md` so the tile at the lower x is
    the east one, regenerate the page with `npm run docs:api`, and rename the
    three pairs in `test/environment-tiles.test.js` to match. `test/site.test.js`
    renders the reference again and fails if what is committed is not what the
    markdown comes to, so the regeneration is checked rather than trusted.
  - From: UI/UX Override - the card lifted onto the notice
- [x] The module that owns the compass frame misdescribes its own reverse
  - **Issue**: `directionToBearing` in `js/units.js` is documented as coming
    back "in whole degrees from 0 to 359", which is the phrasing of
    `headingDegrees` thirty lines above it, but only `headingDegrees` rounds -
    this one returns whatever `Math.atan2` gave it. Every caller happens to
    cover for it, so nothing reads wrong today: `js/hud.js:105` rounds the gate
    bearing before drawing it, and `courseOpening` hands its result to
    `snapStartValue`. A caller added later that takes the sentence at its word
    draws `HEADING: 037.48312`. The same docstring also says `Math.atan2` of
    two zeros gives a NaN. It gives `0`, so the sentence credits a guard that
    neither exists nor is needed - what actually makes `directionToBearing(0, 0)`
    read as north is the wrap on the line below.
  - **Goal**: Make both sentences true. Either round the return and keep the
    claim, or drop "whole" and say it comes back fractional; and delete the NaN
    claim rather than rewording it. This module is the one place the release
    designates as the authority for the frame, so its description of itself is
    what the next caller builds on.
  - From: UI/UX Override - the card lifted onto the notice
- [x] A test helper left behind by the rewrite it was rewritten out of
  - **Issue**: `colorAt` at `test/runway.test.js:327` has no callers. Its only
    one was `the strip is painted so it can be picked out from the air`, which
    this run rewrote to read every vertex through `paintBands` and `colorOf`
    instead of sampling three places. The helper was left where it was.
  - **Goal**: Delete `colorAt`, or call it from the sampling the rewrite kept
    if one is still wanted.
  - From: UI/UX Override - the card lifted onto the notice
- [x] The objective card is drawn over the floated readouts on a phone
  - **Issue**: `#game-mode` is `z-index: 120` against `#hud`'s `100` and is a
    panel with `background: rgba(0, 0, 0, 0.5)` behind its text, so where the
    two meet it is the readouts that are lost. On **852x330** - a phone held
    sideways in a browser with a toolbar - three seconds into an ordinary
    flight, with no landing and nothing on the card but the stage and the
    clock, the card sits at x `296`..`556`, y `228`..`310` and the floated
    readouts are in the band between the clusters at y `268`..`314`, so
    `AIRSPEED`, `ALTITUDE` and `HEADING` are behind it: the word `AIRSPEED:`
    and `+3620 ft/min` are all that is left readable of the stack. Both
    placements are recent and neither was checked against the other - the
    readouts were moved into that band for being the one empty part of a short
    screen, and the card is past the `max-width: 640px` the lift is written
    inside, so at 852 wide it keeps the desktop placement. The landing
    breakdown makes it worse rather than causing it: at 320x568 the card
    covers `ALTITUDE`, `V/S`, `HEADING`, `THROTTLE` and `CAMERA` with the
    breakdown up against `THROTTLE` and `CAMERA` without it, at 393x578 four
    against two, and at 320x460 `AIRSPEED`, `ALTITUDE`, `V/S`, `HEADING` and
    the lower part of both instruments against three. 393x852 is clear either
    way, which is why a tall phone never showed it. The card's own nine lines
    are readable at every size, so this is the other side of the collision
    this release fixed rather than that one again.
  - **Goal**: Resolve to [card-over-floated-readouts.prompt.md](.claude/prompts/card-over-floated-readouts.prompt.md)
  - From: UI/UX Override - the band the card and the readouts were both given
- [x] **Card Clip**: The objective card clips through the middle of a line on 320x460
  - **Issue**: the card is bounded in pixels taken off the screen and its rows
    are whatever height the type comes to, so on the shortest screen a browser
    leaves the two do not line up and the clip lands part way down a row. In
    ordinary flight `FINAL  ·  STAGE 1 OF 4` runs 280 to 292 against a clip
    ending at 287, so five pixels of it are cut and the rest is drawn sliced
    through the glyphs; with the breakdown up the same happens to
    `DOWN THE STRIP`, four pixels cut. Clipping there is right and intended -
    there are 108 pixels between the chart and the pads - but clipping between
    rows and clipping through one are not the same thing, and a half-drawn line
    reads as a rendering fault. The other five screens are clean.
  - **Goal**: Resolve to [card-clipped-through-a-line.prompt.md](.claude/prompts/card-clipped-through-a-line.prompt.md)
  - From: UI/UX Override - the card's clip falls through a line
- [x] The readouts stand down on screens the card was never bounded against
  - **Issue**: `#game-mode.floated.reporting ~ #hud.floated` in `index.html` is
    written outside every media query, so it fires wherever the pads are out.
    The bound it pays for is not: `#game-mode.floated` is given a
    `max-height` by `(max-width: 640px)`, by `(min-width: 641px) and
    (max-width: 679px)`, and by `(max-height: 540px) and (min-width: 500px)`,
    and by nothing at all above 679 pixels of width on a screen taller than
    540. On a tablet flown from the glass at 1024x768 the card sits at
    x 382..642 and the readouts at x 20..228, y 180..385, so the two never
    meet - and the whole stack, `AIRSPEED` through `CAMERA`, goes invisible
    for as long as a breakdown is up and comes back with nothing gained. The
    rule's own comment says "on a screen this size", which is a size the rule
    never names. The card is also unclipped there: no `max-height` and no
    `overflow`, so the bound the CHANGELOG describes as everywhere is not.
  - **Goal**: Give the stand-down the same screens the bound has - scoped to
    the widths where the card is actually bounded against the stack - or bound
    the card above 679 pixels of width so the trade is paid for wherever it is
    taken. Pin whichever it is in `test/page.test.js` beside the six sizes.
  - From: Code Review Override - the stand-down past the bound it pays for
- [x] No screen wider than the card's narrow case is measured
  - **Issue**: `MEASURED_SCREENS` in `test/page.test.js` is 393x852, 320x568,
    393x578, 320x460, 852x330 and 568x320. Four are 640 or narrower and the
    other two are 540 or shorter, so every one of them resolves through either
    `(max-width: 640px)` or `(max-height: 540px) and (min-width: 500px)`. The
    `(min-width: 641px) and (max-width: 679px)` block this turn added - the
    421 and the 196 it declares - is read by no check at all, and neither is
    the case above 679 where the card carries no bound. A wrong number in that
    block, or the bound dropped from it, fails nothing.
  - **Goal**: Add a screen in the 641..679 band on a height above 540 and one
    wider than 679 to `MEASURED_SCREENS`, so the two arrangements this turn
    wrote are measured the way the other six are. Note that the band check
    reads a missing `max-height` as unmeasurable rather than as clear, so the
    wider screen wants the bound question settled first.
  - From: Code Review Override - the stand-down past the bound it pays for
