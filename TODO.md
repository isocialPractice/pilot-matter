# TODO

Roadmap for Pilot Matter, a browser-based Three.js flight simulator with no
build step. Items under `## Current` are the next work queue; the remaining
level 2 sections group planned work by theme and state the version update
that applies when their items are completed.

## Current

The work queued for the next run, copied here from the roadmap sections below.
Each item carries a nested `From:` line recording the section it came from, so
its context survives being archived.

- [ ] Add an element editor overlay that lists the placed elements, edits
  their ranges live, and regenerates the terrain from the algorithm
  - From: Environment Design
- [ ] Report a gate that was missed rather than leaving the course silently
  stalled on it: once the aircraft is past a gate's plane outside the hoop,
  say so and let it be re-flown
  - From: Game Modes
- [ ] Point at the gate the course is waiting on while it is off screen, as a
  bearing and a distance on the HUD, so a course can be flown without the
  pilot having to remember which way it ran
  - From: Game Modes
- [ ] Time each stage and keep the best time per stage in `localStorage`, so
  a course already flown is something to beat rather than something to repeat
  - From: Game Modes
- [ ] Show the whole course before the stage begins - as an overlay on the
  minimap, or as a pass down the line of it - so the first gate is not the
  only one the pilot has ever seen
  - From: Game Modes

## Game UI/UX

Player-facing interface and experience around the flight model, beyond the
raw instrument readout. Completing items in this section applies a minor
version update.

- [ ] Add on-screen touch controls so the simulator is playable on a phone
  or tablet without a keyboard
- [ ] Fly by tilting the device: read the orientation sensors for pitch and
  roll, and make tilt the control the simulator opens in - but only on a
  phone or tablet with no keyboard, so a machine that has keys is still
  flown with them

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

- [ ] Score a landing rather than only counting it: touchdown point down the
  strip, sink rate at the moment of contact, distance off the centreline, and
  heading off the strip, shown as a breakdown once the aircraft has stopped
- [ ] Add approach guidance that is withdrawn as the stages go on - an
  extended centreline and a threshold marker on the first stage, the marker
  alone on the second, and nothing at all by the last

#### Flying through Loops

- [ ] Time each stage and keep the best time per stage in `localStorage`, so
  a course already flown is something to beat rather than something to repeat
- [ ] Point at the gate the course is waiting on while it is off screen, as a
  bearing and a distance on the HUD, so a course can be flown without the
  pilot having to remember which way it ran
- [ ] Report a gate that was missed rather than leaving the course silently
  stalled on it: once the aircraft is past a gate's plane outside the hoop,
  say so and let it be re-flown
- [ ] Bank the gates off the horizontal, so a loop has to be flown through at
  the angle it was laid at rather than upright every time
- [ ] Show the whole course before the stage begins - as an overlay on the
  minimap, or as a pass down the line of it - so the first gate is not the
  only one the pilot has ever seen

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
- [ ] Add an element editor overlay that lists the placed elements, edits
  their ranges live, and regenerates the terrain from the algorithm
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

- [x] Create `CHANGELOG.md` with a `1.0.0` baseline entry describing the
  current feature set, and add a minimal `package.json` manifest (name,
  version, description, license) so future runs have a version to update
  - From: Project Infrastructure
- [x] Add a zero-dependency test harness using `node:test` with unit tests
  for pure logic (unit conversions in `js/hud.js` math, input-to-state
  mapping in `js/aircraft.js`, mountain count formula in `js/mountains.js`),
  runnable via `node --test`
  - From: Project Infrastructure
- [x] Implement Q/E yaw input in `js/aircraft.js` so the aircraft matches
  the on-screen controls help in `index.html`
  - From: Flight Model & Controls
- [x] Implement C-key camera cycling in `js/camera.js` (CHASE, COCKPIT,
  ORBIT) and report the active mode through `getCurrentMode()` so the HUD
  camera readout in `index.html` is meaningful
  - From: Camera & HUD
- [x] Update the README controls table to match the in-game help once yaw
  and camera cycling exist (add `Q`/`E` and `C` rows)
  - From: Documentation & Polish
- [x] Start gameplay with an **AIRSPEED** value of `0 knots`
  - From: `version.control = null`
- [x] Add **Game UI/UX** (*underneath `Flight Model & Controls`*) section, and
  create 10 todo items for it
  - From: `version.control = null`
- [x] Add pause feature, using keypress `P`
  - From: Game UI/UX
- [x] Update `index.html` GitHub Pages demo to reflect current status of application
  - From: `version.control = null`
- [x] Extract pure math helpers (noise/fBm from `js/terrain.js`, smoothstep
  bump from `js/mountains.js`) into an importable module without DOM or
  Three.js dependencies so they can be unit tested in Node
  - From: Project Infrastructure
- [x] Add a `npm run serve` convenience script to the manifest that starts a
  local static server for manual testing
  - From: Project Infrastructure
- [x] Make throttle a target-based setting (0-100%) that speed converges
  toward, instead of Shift/Ctrl directly adding and subtracting speed, so
  `getThrottle()` reflects the setting rather than current speed
  - From: Flight Model & Controls
- [x] Tie lift to airspeed: below `minSpeed` the aircraft sinks faster
  (stall) and at cruise speed level flight holds altitude, replacing the
  current constant-gravity sink
  - From: Flight Model & Controls
- [x] Add a favicon-consistent page title ("Pilot Matter") to `index.html`,
  which currently reads "3D Flight Simulator"
  - From: Documentation & Polish
- [x] Add crash detection: hitting terrain above a vertical-speed threshold
  triggers a brief crash state and auto-reset, instead of silently clamping
  to ground height
  - From: Flight Model & Controls
- [x] Document the flight model (lift, stall, throttle behavior) in a README
  section once the Flight Model & Controls items land
  - From: Documentation & Polish
- [x] Add a heading readout (compass degrees) and vertical speed indicator
  (ft/min) to the HUD in `index.html` and `js/hud.js`
  - From: Camera & HUD
- [x] Add a low-altitude warning to the HUD that activates when height
  above terrain drops below a threshold
  - From: Camera & HUD
- [x] Smooth the chase camera with positional lag/damping so turns and
  pitch changes feel less rigid
  - From: Camera & HUD
- [x] Add a title screen overlay shown before the first flight, with the
  game name and a "press any key to start" prompt
  - From: Game UI/UX
- [x] Add a pause menu built on the pause state, with Resume, Reset Flight,
  and Controls entries selectable by keyboard
  - From: Game UI/UX
- [x] Add a controls-help toggle (`H`) that collapses the on-screen control
  list down to a single hint line
  - From: Game UI/UX
- [x] Add a HUD visibility toggle (`Tab`) for clean flying, persisting the
  choice in `localStorage` across sessions
  - From: Game UI/UX
- [x] Add an attitude indicator to the HUD with a pitch ladder and bank
  angle marks
  - From: Game UI/UX
- [x] Add a new level 2 section called **Simulator API**, and create 14 todo
  items for it
  - From: `version.control = null`
- [x] Add a new level 2 section called **Simulator Configuration**, and
  create 9 todo items for it
  - From: `version.control = null`
- [x] Add a new level 2 section called **Environment Design**, and create 21
  todo items for it
  - From: `version.control = null`
- [x] Configure the simulator with the initial starting controls below,
  replacing the current standing start
  - From: Simulator Configuration
  - Starting controls: airspeed 80 knots, altitude 1390 ft, V/S +1260 ft/min,
    heading 000 deg N, throttle 20%, camera chase
- [x] Add a start screen menu with **Controls** and **Settings** entries, and
  add **Settings** to the pause menu
  - From: Simulator Configuration
- [x] Add environment elements that are placed and adjusted through
  configurable ranges and rendered by algorithm rather than asset placement
  (mountain, grass, sand, water body, river, forest, canyon, desert, town,
  snow)
  - From: Environment Design
- [x] Add 5 assembled environments that can be piloted over, selectable from
  the settings menu
  - From: Simulator Configuration
- [x] Add a simulator API with a **Pilot API** (aircraft controls usable with
  external environments and external aircraft assets) and a **Matter API**
  (environments usable with external aircraft, foreign control APIs, and
  external assets)
  - From: Simulator API
- [x] Add a minimap in a screen corner showing aircraft position and heading
  within the terrain bounds
  - From: Game UI/UX
- [x] Add a settings panel (`O`) for control sensitivity, fog density, and
  HUD units (knots/mph, ft/m)
  - From: Game UI/UX
- [x] Add engine and wind audio that track throttle and airspeed, with a
  mute toggle (`M`)
  - From: Game UI/UX
- [x] Replace the static "Loading Flight Simulator..." text with a simple
  progress/fade-in tied to first rendered frame
  - From: Documentation & Polish
- [x] Add a configuration module (`js/config.js`) that holds the simulator
  defaults as one exported object, so start state is data rather than
  scattered literals
  - From: Simulator Configuration
- [x] Let the settings panel edit the start state fields before launch, and
  persist the choices in `localStorage` across sessions
  - From: Simulator Configuration
- [x] Handle the world edge: either wrap the aircraft position across the
  16000-unit terrain bounds or recenter terrain tiles around the aircraft
  so the fog-hidden edge can never be reached
  - From: World & Environment
- [x] Add a photo mode (`F2`) that hides every overlay for one frame and
  downloads the rendered canvas as a PNG
  - From: Game UI/UX
- [x] Document the API surface in `docs/api.md`, including the stability
  guarantee and a worked example for each half
  - From: Simulator API
- [x] Add a `## Game Modes` level 2 section to this document, directly
  beneath `## Game UI/UX`, with an intro paragraph stating that completing
  its items applies a minor version update, and two level 3 subsections:
  - `### New Game Modes`: modes not yet built
  - `### Improve Existing Game Modes`: improvements to modes already built,
    grouped under one level 4 header per mode, the header text being the
    mode name (e.g. `#### Runway Landing`), with that mode's improvements
    listed beneath it
  - From: `version.control = null`
- [x] **Runway**: add a runway to the element registry in
  `js/environment/elements.js`, generated by algorithm like every other
  element, declaring configurable length, width, and heading ranges, and
  placed on ground flat enough to be landed on
  - From: Environment Design
- [x] **Runway landing**: treat a touchdown inside the runway bounds as a
  landing rather than a crash when it falls within the vertical speed and
  attitude thresholds in `js/crash.js`, and report the outcome as a state
  the HUD and the game modes can both read
  - From: Game UI/UX
- [x] **Start Flight**: add a start-state setting choosing the condition a
  flight opens in, as a radio group where selecting one option clears the
  other:
  - **Start off flying** (*default*): the airborne start already configured
  - **Runway takeoff**: stationary on the runway, throttle at idle
  - Declared in `js/config.js` and edited in the settings panel's
    `START STATE` half, persisting with the other start-state fields
  - From: Simulator Configuration
- [x] **Toggle Runway**: under **Start off flying**, offer a checkbox that
  includes or omits the runway in the generated environment; unchecked, no
  runway renders and the environment has no landable strip. The checkbox is
  disabled and forced on under **Runway takeoff**, which requires one
  - From: Simulator Configuration
- [x] **Game Modes menu**: add a **Game Modes** entry to both the start
  screen menu and the pause menu, alongside the existing **Controls** and
  **Settings** entries, listing the available modes and selecting one
  - From: Simulator Configuration
- [x] Add the first 2 **game modes**, each opening in flight over a
  lightweight environment:
  - **Runway Landing**: landing on the runway is the objective, growing
    progressively harder at:
    - finding the runway
    - reading the terrain around it well enough to get down
  - **Flying through Loops**: flying the aircraft through a course of loops
    is the objective
  - From: Game Modes
- [x] Write 6 further **game mode** ideas as todo items under
  `### New Game Modes` in the new `## Game Modes` section of this document
  - From: `version.control = null`
- [x] Write 2 improvement items for the **Runway Landing** game mode under a
  `#### Runway Landing` header nested in `### Improve Existing Game Modes`
  - From: `version.control = null`
- [x] Write 5 improvement items for the **Flying through Loops** game mode
  under a `#### Flying through Loops` header nested in
  `### Improve Existing Game Modes`
  - From: `version.control = null`
- [x] **Matter API**: allow an environment to act as one tile of a larger
  assembled environment, matching heights and materials at shared edges
  - From: Simulator API
- [x] Add an example host page that imports the Pilot API with an external
  environment and the Matter API with an external aircraft, proving both
  directions work
  - From: Simulator API
- [x] Add a day-night cycle in `js/sky.js` with gradual light, fog color,
  and sky color transitions
  - From: World & Environment
- [x] Animate water: give below-water-level vertices a subtle wave motion
  and specular tint distinct from land shading
  - From: World & Environment
- [x] Add mouse events to the pause and opening menu
  - **Issue**: Mouse events are only applied to the inital menu
  - **Goal**: Apply mouse events to nested menus e.g. "Game Modes", "Controls",
    "Settings"
  - From: Simulator Configuration
- [x] Handle the world edge: either wrap the aircraft position across the
  16000-unit terrain bounds or recenter terrain tiles around the aircraft
  so the fog-hidden edge can never be reached
  - **Issue**: World edge can be reached
  - **Goal**: Duplicate tile using a seed algorithm that redraws tile so edge is
    not reachable
    - **Hold Goal Context**:
      - **Nested Goal**: Add a todo item to create a test to verify the edge
        algorithm, placing it in the **World & Environment** section
      - **Nested Goal**: Add a todo item to make a smart algorithm so that the
        edge algorithm seeds new tiles seemlessly, blending them as a seemless
        tile pattern, placing it in the **World & Environment** section
      - **Nested Goal**: Add 2 new todo item to reassemble existing environments
        relative to the edge algorithm
        - First when seed algorithm redraws tiles, creating endless environment
        - Second whenn smart algorithm is complete to create seemless endless
          environment
    - *Release Goal Context*
  - From: World & Environment
- [x] **Menus** (the pause menu, the opening menu, and the nested menus);
  update styles
  - From: Simulator Configuration
- [x] **Menus** (the pause menu, the opening menu, and the nested menus);
  improve UX like:
  - Allow keydown of the "up arrow key" and the "down arrow key" to navigate
    the menu list items
  - From: Simulator Configuration
- [x] Add a todo item to **Game UI/UX** to use device tilt controls, and set
  the use of tilt controls to default; but **only** when the simulator is
  played on a phone or tablet without a keyboard
  - From: User Overrides `->` Overrides
- [x] Plan the site: where the documentation lives, which tool builds it, the
  design language derived from the repository's own artwork, the pages the
  README splits into, and where the menu goes
  - From: Create and Deploy GitHub Pages Override
- [x] Write `DESIGN_LANGUAGE.md` from the palette and the forms in `logo.png`,
  with the contrast ratio checked for every text and background pair
  - From: Create and Deploy GitHub Pages Override
- [x] Add the Pages deploy workflow and the `.nojekyll` the site needs to be
  served whole
  - From: Create and Deploy GitHub Pages Override
- [x] Split the README's sections into site pages under `docs/`, moving the
  full text rather than summarizing it, with a fixed side menu matching the
  folder structure
  - From: Create and Deploy GitHub Pages Override
- [x] Write `QUICKSTART.md` and `CHEATSHEET.md`, and the site pages carrying
  them
  - From: Create and Deploy GitHub Pages Override
- [x] Cut `README.md` back to a front door: what it is, how to run it, the
  controls, and a link from every section heading to its page on the site
  - From: Create and Deploy GitHub Pages Override
- [x] Nothing holds the ground out as far as the camera is drawn
  - **Issue**: `TILE_REACH` in `js/world-tiles.js` is 12000 and the camera's
    far plane in `js/main.js` is 12000, and the two are matched by a comment
    rather than by anything that fails when they drift apart. The promise the
    whole grid rests on - that the ground always runs further than the camera
    can see - breaks the moment either is changed on its own, and it breaks
    back into the void edge this run removed
  - **Goal**: Tie the two together, either by drawing the far plane from
    `TILE_REACH` or by a test that fails once the far plane outruns the reach
  - From: Code Review Override - the world with no edge
- [x] A stage opening is still carried round one square
  - **Issue**: `stageStart` in `js/game-modes.js` wraps a stage's opening
    position into a single 16000-unit square, explaining that the world has no
    outside so the opening is carried round it "the same way a flight is". A
    flight is no longer carried round: the tile grid replaced `wrapInside` in
    `js/main.js`, so a wrapped opening is now a different place rather than the
    same one. Nothing reaches it yet - all four Runway Landing stages open at
    the bearing and distance they ask for - but `DOWNWIND` opens 184 units
    inside the line the wrap fires at, so a stage given a longer
    `approach.distance`, or a runway sited nearer a tile edge, would open the
    aircraft on the far side of the strip at a bearing and a distance the stage
    never asked for
  - **Goal**: Drop the wrap from `stageStart` now that the ground continues
    past the tile, let an opening stand where its bearing and distance put it,
    and correct the comment justifying it. Cover it with a test that a stage
    opens at the distance and bearing it asked for from a runway sited anywhere
    in the tile
  - From: Code Review Override - the world with no edge
- [x] The site's API reference is a file the browser downloads
  - **Issue**: `docs/api.md` is 934 lines and is the deepest reference the
    project has, and the site links it as "full API reference" from the footer
    of all twenty-one pages, from a card on `docs/index.html`, and from the
    body of `docs/api.html`. GitHub Pages serves `.md` as `text/markdown`,
    which a browser downloads rather than renders, so the most-linked
    destination on the site is the one destination that is not a page. Every
    other link on the site reaches styled HTML
  - **Goal**: Give the reference a page of its own - `docs/api-reference.html`
    - carrying `docs/api.md` in full under the same head, menu, and prev/next
    chain the other pages use, and point the footers, the home card, and
    `docs/api.html` at it. Leave `docs/api.md` where it is: `test/docs.test.js`
    reads it, and the README links it for a reader on GitHub rather than on
    the site
  - From: Code Review Override - the documentation site
- [x] Nothing checks the site's pages against the code they describe
  - **Issue**: `test/docs.test.js` reads the source and holds `docs/api.md`
    and `README.md` to it - every published API name, every telemetry field,
    every `START_FIELD_IDS` entry, every environment id. `test/site.test.js`
    imports nothing from `js/`, so the twenty-one pages are checked for
    structure and for a handful of hardcoded strings and nothing else. Adding
    a field to `START_FIELDS` in `js/config.js` fails `docs.test.js` because
    `docs/api.md` must name it, while `docs/controls/settings.html`, which
    lists all eight start fields by label, and `docs/cheatsheet.html` go stale
    with nothing failing
  - **Goal**: Have `test/site.test.js` read the same modules `docs.test.js`
    does and assert the pages carrying that material stay current: the start
    field labels on `docs/controls/settings.html`, and the environment and
    game mode labels on `docs/terrain.html`,
    `docs/controls/game-modes.html`, and `docs/cheatsheet.html`
  - From: Code Review Override - the documentation site
- [x] A line the reference builder cannot parse hangs it rather than failing it
  - **Issue**: `markdownToHtml` in `tools/build-api-reference.mjs` treats a
    line beginning with `|` as a table only when the line after it is the
    `|---|---|` rule. A `|` line that is not - a table whose rule row is
    mistyped, a one-row pipe line, a paragraph that happens to open with one -
    matches no branch, so it falls through to the paragraph branch, whose own
    guard stops it on the same `|`. That leaves the paragraph empty, `at--`
    undoes the loop's `at++`, and the same line is read forever, appending an
    empty `<p></p>` each pass until the process runs out of memory. Adding
    `| a | b |` to `docs/api.md` with no rule under it hangs both
    `npm run docs:api` and `npm test`, and `npm test` is what CI runs, so the
    hang lands in a GitHub Actions job that has no output to say why
  - **Goal**: Make every branch of the loop consume at least the line it was
    entered on, so an unparseable line is emitted as the text it is rather than
    read again. Cover it with a test that a `|` line with no rule under it
    renders and returns
  - From: Code Review Override - the reference page
- [x] The link check rejects a directory the browser would open
  - **Issue**: `every document the site links is one the browser opens rather
    than downloads` in `test/site.test.js` reads a target's extension and
    requires it be one of `RENDERED`. A link to a directory has no extension -
    `posix.extname('controls/')` is `''` - so `href="controls/"` fails a test
    meant to catch `text/markdown`, even though a browser opens it as the
    folder's index. No page links one today, so the test passes; the first page
    that does is failed for a link that works
  - **Goal**: Let a target with no extension, or one ending in `/`, pass as the
    directory index it is, and keep failing the extensions a browser downloads
  - From: Code Review Override - the reference page
- [x] `docs/testing.html` names two of the three checks this release added
  - **Issue**: The "What is covered" paragraph was extended with "the
    converter that builds it and the line it has no rule for" and "the link
    check that tells a page the browser opens from a file it downloads", but
    not `no page gives the same id to two things` in `test/site.test.js`,
    which is the check behind the first and longest entry in the
    `1.12.2-alpha` changelog. The paragraph reads as the whole list and
    nothing holds it to the suite, so the page under-reports the release it
    was edited for
  - **Goal**: Name the duplicate id check in that sentence, in the voice of
    the two beside it
  - From: Code Review Override - the reference page's own checks
- [x] The duplicate id check reads sample markup as markup
  - **Issue**: `no page gives the same id to two things` in
    `test/site.test.js` matches `/\sid="([^"]+)"/g` against each page's raw
    source, while every other check in that file reads `linkable()` first,
    whose own comment says why: the reference page prints a host page's own
    markup, and a sample is something to read rather than something the page
    does. `escapeHtml` in `tools/build-api-reference.mjs` escapes `<`, `>`,
    and `&` but not quotes, so an `id` inside a fenced block reaches the page
    as the literal text ` id="app"` and the regex matches it. `docs/api.md`
    already prints host page markup in a fence, and `examples/host.html` -
    the host its worked examples describe - carries `id="panes"`,
    `id="pilot-pane"`, and `id="pilot-readout"`. A worked example printing
    two of those, or one that matches a heading's slug, fails `npm test` over
    text that is not an id, on a page whose ids are all unique
  - **Goal**: Read the ids out of `linkable(source)` rather than `source`,
    the way the checks around it do. Lift the scan into a named function the
    way `opensInBrowser` was lifted, so a sample block that repeats an id and
    a page that repeats one can each be held by a case of their own rather
    than by whatever the site happens to print that day
  - From: Code Review Override - the reference page's own checks
- [x] Two headings can still be handed the same anchor
  - **Issue**: `anchors()` in `tools/build-api-reference.mjs` counts how
    often a slug has been asked for and appends that count, without asking
    whether the anchor it just built is itself already taken. Headings
    `Options`, `Options`, and `Options 1` come to `options`, `options-1`, and
    `options-1` - the defect this release set out to remove, returned by the
    fix for it. No such heading is in `docs/api.md`, and the duplicate id
    check above fails the build rather than letting it ship, so this is a
    build that stops rather than a page that misleads
  - **Goal**: Carry the suffix on until it names an anchor no heading on the
    page has taken. Hold it with a test of `anchors()` itself, which is
    exported and which nothing exercises directly
  - From: Code Review Override - the reference page's own checks
- [x] The `1.12.3-alpha` entry is ordered against the file's own convention
  - **Issue**: It heads `### Fixed` before `### Changed`. Every other entry in
    `CHANGELOG.md` carrying both puts `### Changed` first - `1.12.1-alpha` and
    `1.12.0-alpha` each run Added, Changed, Fixed - which is the Keep a
    Changelog order the file's own header cites
  - **Goal**: Move the `### Changed` section above `### Fixed` in the
    `1.12.3-alpha` entry, leaving both bodies as they are
  - From: Code Review Override - the checks the id fix left behind
- [x] The duplicate id check reads sample markup as markup
  - **Issue**: The fix taught `no page gives the same id to two things` to read
    `linkable()` first, and the comment it was given says the scan does that
    "the way every other check here does". The check above it does not: `every
    anchor a page links to is an id that page has` still asks whether the
    unstripped source `includes` the literal text `id="<fragment>"`, so
    `test/site.test.js` now holds two answers to what an id is. On a page whose
    only `id="app"` sits inside a printed sample, `idsOn()` says the page hands
    out no such address and the anchor check says it has one. Give `docs/api.md`
    a worked example printing `<div id="app">` and a line linking `#app`, and
    `npm test` passes on a link that scrolls nowhere. No page prints an id
    today, so nothing reaches it yet, which is why it was left rather than fixed
  - **Goal**: Resolve a fragment against `idsOn(target_source)` rather than
    against the raw source, lifting `idsOn` above the check that uses it, and
    hold it with a case of its own: an anchor into a sample block is not an
    address the page offers
  - From: Code Review Override - the reference page's own checks
- [x] The case added for the anchor fix holds its parts rather than the check
  - **Issue**: The fix itself is right - `every anchor a page links to is an id
    that page has` resolves through `idsOn()` now, so a page whose only
    `id="app"` sits inside a printed sample no longer answers a link to `#app`.
    What was added to hold it does not. `an anchor into a sample block is not an
    address the page offers` asserts on `idsOn()` and `sameePageAnchors()`
    directly and never on the check that reads them, so putting that line back
    to the raw `includes` it used before leaves all 28 checks in
    `test/site.test.js` passing and the fix silently gone. Verified by making
    that edit and running `node --test test/site.test.js`: 28 pass, 0 fail. This
    is the third release running to move this pair of checks, and nothing yet
    fails when they come apart, which is the reason they keep coming apart
  - **Goal**: Hold the check rather than the helpers under it. Lift the
    per-anchor resolution out of the loop into a named function, the way
    `opensInBrowser` and `idsOn` were each lifted, and point the existing case
    at it: a fragment a page only prints does not resolve, and one a heading on
    that page carries does. The case passing while the check reads the raw
    source again is what it has to stop
  - From: Code Review Override - the case that holds the anchor check
- [x] The case added for the anchor fix holds its parts rather than the check
  - **Issue**: The lift is right and holds half of what comes apart. Editing
    `resolvesOn` at `test/site.test.js:224` back to
    ``source.includes(`id="${fragment}"`)`` now fails `an anchor into a sample
    block is not an address the page offers`, verified: 27 pass, 1 fail. The
    line that calls it is still unheld, and it is the line this pair has come
    apart on. Replacing `test/site.test.js:241` with
    ``assert.ok(target_source.includes(`id="${fragment}"`),`` leaves
    `resolvesOn` defined, unused, and read only by the case, which goes on
    passing: verified 28 pass, 0 fail, the fix silently gone for the fourth
    release running. Before `1.12.4-alpha` the raw read sat at exactly that
    call site, so this is the shape it reverts to
  - **Goal**: Give the resolution one home the case runs end to end. Lift the
    per-anchor loop out of `every anchor a page links to is an id that page
    has` into a named function taking a page, its source, and a way to read a
    linked page - returning the anchors that resolve nowhere - so the check
    becomes a call on it and the case can run that same function over the
    synthetic sample page and assert `#app` comes back unresolved while a
    heading's own fragment does not. Then there is no line left between the
    check and the case for a raw read to move back into. Correct the comment
    at `test/site.test.js:260` and the `1.12.5-alpha` note, both of which
    record this gap as open
  - From: Code Review Override - the case that holds the anchor check
- [x] The case runs the anchor resolution without ever letting it read a linked
  page
  - **Issue**: The lift is right and the case now runs the whole resolution, so
    a raw read put anywhere inside `unresolvedAnchors` fails it - verified by
    replacing `test/site.test.js:244` with
    ``target_source.includes(`id="${fragment}"`)``: 27 pass, 1 fail, and the one
    that fails is the case. One branch of that resolution is outside what the
    case reaches. `unresolvedAnchors` takes `readPage` so a case can answer it,
    which the comment at `test/site.test.js:227` states outright, and the case
    answers with `nothingOffPage` at `test/site.test.js:285`, which asserts the
    reader is never called. Every anchor on its synthetic page is a same-page
    one, so `test/site.test.js:242` always takes the `path === here` branch and
    a case has never once run the half that reads another page's ids. What runs
    it is the site: `docs/controls/settings.html:99` links
    `../terrain.html#environments` and `docs/controls/instruments.html:115`
    links `../terrain.html#the-edge-of-the-world`, and those are the only two
    cross-page anchors on twenty-two pages. Replacing `test/site.test.js:242`
    with `const target_source = source;`, which resolves every anchor against
    the page that links it rather than the page it points at, leaves the case
    passing and fails only `every anchor a page links to is an id that page
    has`, verified: 27 pass, 1 fail. So that branch is held by two links in the
    documentation rather than by anything in the suite, and an edit that drops
    the fragment from both leaves it held by nothing
  - **Goal**: Hold the linked-page branch the way `a folder is a page the
    browser opens, and a document is still a download` holds a form no page
    carries yet, rather than waiting on the site to keep carrying it. Give the
    case a second page to link and a `readPage` that returns that page's source:
    an anchor into a sample block the linked page prints comes back unresolved,
    and one into a heading the linked page really carries does not. Then
    `readPage` is a seam a case takes rather than one it asserts is never taken,
    and resolving a fragment against the wrong source fails the case rather than
    only the check
  - From: Code Review Override - the linked page the anchor resolution never reads
