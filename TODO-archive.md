# TODO archive

Completed items rolled out of `TODO.md`, oldest first. Nothing reads
this file to decide what to work on: it is here so a finished item can
still be found by name.

## Archived 09-13-26

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
- [x] Add an element editor overlay that lists the placed elements, edits
  their ranges live, and regenerates the terrain from the algorithm
  - From: Environment Design
- [x] Report a gate that was missed rather than leaving the course silently
  stalled on it: once the aircraft is past a gate's plane outside the hoop,
  say so and let it be re-flown
  - From: Game Modes UI/UX `->` Improve Existing Game Modes `->` Flying through Loops
- [x] Point at the gate the course is waiting on while it is off screen, as a
  bearing and a distance on the HUD, so a course can be flown without the
  pilot having to remember which way it ran
  - From: Game Modes UI/UX `->` Improve Existing Game Modes `->` Flying through Loops
- [x] Time each stage and keep the best time per stage in `localStorage`, so
  a course already flown is something to beat rather than something to repeat
  - From: Game Modes UI/UX `->` Improve Existing Game Modes `->` Flying through Loops
- [x] Show the whole course before the stage begins - as an overlay on the
  minimap, or as a pass down the line of it - so the first gate is not the
  only one the pilot has ever seen
  - From: Game Modes UI/UX `->` Improve Existing Game Modes `->` Flying through Loops
- [x] Add an element editor overlay that lists the placed elements, edits
  their ranges live, and regenerates the terrain from the algorithm
  - **Issue**: The panel edits, but the terrain is never regenerated. Driven in
    a browser on the start screen and in a free flight, `HEIGHT MAX` under
    `MOUNTAIN` walked from `500` to `900` and the ground either side of the
    panel came back pixel for pixel identical both times. The cause is an
    aliased record: `editorPlacements` hands out the editor's live `config`
    object, `terrain.setEnvironment` keeps it as `this.built`, and
    `adjustEditorRange` then mutates it in place, so `sameWorld` compares the
    changed object against itself, reports the world unchanged, and no tile is
    ever drawn again. The generator is willing - built from the same placements
    directly, eight steps of `HEIGHT MAX` move the highest point from `578.2`
    to `904.9`
  - **Goal**: Resolve to [element-editor-terrain-redraw.prompt.md](.claude/prompts/element-editor-terrain-redraw.prompt.md)
  - From: Environment Design
- [x] A stage of a course cannot be flown out under test, so everything that
  only happens at the end of one is unverified
  - **Issue**: The card's report on a finished stage (`NEW BEST  ·  <time>`
    against `STAGE TIME  ·  <time>`), the next stage opening at `0:00.0`, a
    `BEST` surviving a reload, and the green mark moving on to the next gate
    all need a gate actually flown through. A 240 unit hoop reached 2600 units
    down its own axis cannot be hit by tapping the flight keys from a test:
    the aircraft opens lined up but climbs away at full throttle, and there is
    no seam - no exposed run state, no way to place the aircraft - for a test
    to fly the course any other way. The geometry underneath is covered by the
    suite (`test/game-modes.test.js` for the crossing rules,
    `test/best-times.test.js` for the board), but nothing checks that flying a
    gate writes the report onto the card
  - **Goal**: Give the loop course a seam a test can take - an exposed hook
    that reports a gate flown, or a way to open a stage with the aircraft on
    the gate's plane - and cover the finished-stage card with it, so the one
    line a pilot reads at the end of a stage is not the only part of the mode
    nothing checks
  - From: UI/UX Override - the ground the element editor never redraws
- [x] Cover the terrain's copy of the world it built, which nothing in the
  suite reaches
  - **Issue**: `terrain.setEnvironment` records a copy of the world it was
    asked for rather than the ask itself, which is the half of the redraw fix
    that lives outside the element editor. Backing that copy out of
    `js/terrain.js` - `this.built = asked` - and running `npm test` gives 807
    tests, 807 pass, 0 fail: the ground stops being drawn again and the suite
    says nothing. The editor's half is covered, by the two tests added to
    `test/element-editor.test.js`; this half is not. It cannot be reached the
    way the rest of `test/` works, because `js/terrain.js` imports `three` and
    the project carries no dependencies to import it from.
  - **Goal**: Give the record-and-compare its own seam outside the mesh, so it
    can be tested the way everything else here is: lift `sameWorld` and the
    copy taken beside it into a module that imports no Three.js - the shape of
    `js/world-tiles.js` next to `js/terrain.js` - and have `setEnvironment`
    call it. A test would then assert that a description handed over and then
    edited by its caller still reads to the recorder as a changed world: hand
    it a set of placements, keep the reference, step a range on it, and expect
    the next comparison to report a different world rather than the same one.
    Verified in the browser this run, but only in the browser.
  - From: UI/UX Override - the terrain's own copy of the world it built
- [x] Check the document's imports against the published surface, and not only
  the surface against the document
  - **Issue**: `test/docs.test.js` asserts every name `js/api/index.js`
    publishes is named somewhere in `docs/api.md`, and nothing asserts the
    other direction. A name the document presents as an export of
    `pilot-matter` that the entry point does not re-export passes the whole
    suite. This run put `flyStep` and `gateMissed` in the **Game modes** export
    table and `flyStep` in the worked example's `from 'pilot-matter'` import
    while `js/api/index.js` published neither, and 807 tests passed on it. A
    host copying that line got `SyntaxError: The requested module does not
    provide an export named 'flyStep'`. Both names are published now; the gap
    that let them ship unpublished is still open.
  - **Goal**: Add the reverse check to `test/docs.test.js`. Read the names out
    of the export tables' leading code spans and out of the
    `import { ... } from 'pilot-matter'` lines in `docs/api.md`, and assert
    each one appears in `publishedNames(apiIndex)` - the helper is already
    there, and it reads the surface off the source without loading the
    renderer half of it. Expect the first run to name any other claim the
    document makes that the entry point does not keep.
  - From: Code Review Override - the published surface and the copy beside it
- [x] Copy the whole ask in `setEnvironment`, or say that the placements are
  all that is copied
  - **Issue**: `js/terrain.js` records `{ ...asked, elements: <clone> }` and
    the comment above it says the world is recorded as a copy of the ask
    rather than as the ask itself. Only `elements` is copied. `base` and
    `runway` stay references into the caller's object, and `sameWorld`
    compares both of them with `JSON.stringify`, so a caller that went on
    editing its own `base` would hit the same self-comparison the elements
    copy was added to close: a world never seen to change, and ground never
    drawn again. Nothing reaches it today, because every `base` that gets to
    `setEnvironment` is a static stage or preset object that nothing mutates,
    so this is the comment claiming cover the code does not have rather than a
    defect a pilot can fly into.
  - **Goal**: Either take the copy the comment describes, which is
    `structuredClone` over the whole of `asked` since every field of it is
    JSON-shaped data, or narrow the comment to say the placements are what is
    copied and why the other fields do not need it.
  - From: Code Review Override - the published surface and the copy beside it
- [x] Hold the document's reverse check to the export tables it says it reads
  - **Issue**: the reverse check added to `test/docs.test.js` this run guards
    itself with `assert.ok(documented.length > 20)`, and the fifteen
    `import { ... } from 'pilot-matter'` lines in `docs/api.md` carry 25 unique
    names between them, so the guard is met by the imports alone. The table
    half of `documentedNames` matches on a header row of exactly
    `| Export | Is |` followed by a separator row, so a table reformatted, a
    column renamed, or the file saved with CRLF line endings drops every one of
    the nine export tables out of the scrape - and `documented` is still 25
    names, still over 20, and the suite is still green while nothing checks a
    table at all. That is the same silent pass the check was written to close,
    one level up from it.
  - **Goal**: Guard the read rather than the count. Count the
    `| Export | Is |` header rows in `docs/api.md` and assert the table pattern
    matched that many, so a table the scrape can no longer read fails the suite
    instead of quietly leaving it. The name assertions underneath are right as
    they stand and need no change.
  - From: Code Review Override - the guard on the document's reverse check
- [x] Bank the gates off the horizontal, so a loop has to be flown through at
  the angle it was laid at rather than upright every time
  - From: Game Modes UI/UX `->` Improve Existing Game Modes `->` Flying through Loops
- [x] **Landing Breakdown**: Score a landing rather than only counting it:
  touchdown point down the strip, sink rate at the moment of contact, distance
  off the centreline, and heading off the strip, shown as a breakdown once the
  aircraft has stopped
  - From: Game Modes UI/UX `->` Improve Existing Game Modes `->` Runway Landing
- [x] Add approach guidance that is withdrawn as the stages go on - an
  extended centreline and a threshold marker on the first stage, the marker
  alone on the second, and nothing at all by the last
  - From: Game Modes UI/UX `->` Improve Existing Game Modes `->` Runway Landing
- [x] Add on-screen touch controls so the simulator is playable on a phone
  or tablet without a keyboard
  - From: Game UI/UX
- [x] Fly by tilting the device: read the orientation sensors for pitch and
  roll, and make tilt the control the simulator opens in - but only on a
  phone or tablet with no keyboard, so a machine that has keys is still
  flown with them
  - From: Game UI/UX
- [x] **Landing Breakdown 1**: the card is never handed the strip a landing was
  made on, so the breakdown is never written
  - **Issue**: A landing flown onto `FINAL`'s strip in the browser touches down
    370.8 units down it, dead on the centreline, is judged `LANDED`, and rolls
    to a stop at 2.55s - and `#game-mode-report` stays `display:none` with no
    children throughout. `__sim.landing` is null on the touchdown frame and
    still null when the rollout ends. `js/aircraft.js:303` now hands the
    callback two arguments, `this.options.onLanding?.(this.runwayUnder(),
    contact)`, but `js/main.js:159` still registers
    `onLanding: () => this.onLanding()`. The arrow takes no parameters, so the
    strip and the contact are dropped; `onLanding(runway, contact)` runs with
    `undefined, undefined`; `scoreLanding` returns null for want of a strip;
    and `setLandingReport(null)` writes nothing and hides the block. Served with
    the one line rewritten to forward its arguments, every other part of the
    item is right - the five rows, the amber score line, the hold through the
    rollout, the stopped clock, the plausible figures, the ten second limit, the
    block coming off at the next stage and at a fresh attempt, and metres. The
    feature is whole; one line of wiring is not.
  - **Goal**: Forward the arguments at `js/main.js:159` -
    `onLanding: (runway, contact) => this.onLanding(runway, contact)` - and pin
    the seam so it cannot come apart again. `test/world-tiles.test.js` and
    `test/world-record.test.js` already read `js/main.js` as source text to
    cover call sites the suite cannot import; add a test in that shape
    asserting the `onLanding` handed to `new Aircraft` names the parameters it
    passes on, rather than being a zero-argument arrow. The 893 tests pass today
    with the breakdown never once reaching the screen, because every one of them
    exercises `scoreLanding` and `formatLandingReport` in isolation.
  - From: Game Modes UI/UX `->` Improve Existing Game Modes `->` Runway Landing
- [x] A sensor that reports nothing is read as a device held level, and takes
  the pitch and roll pads off a machine that has no keys
  - **Issue**: A browser with no gyroscope fires one `deviceorientation` event
    with `alpha`, `beta` and `gamma` all null, which is the specification's way
    of saying it has nothing to report. `TiltSensor.onReading` in
    `js/tilt-controls.js` passes `event.beta ?? 0, event.gamma ?? 0`, so that
    null becomes a reading of `{pitch: 0, roll: 0}`; `tiltFlying` goes true, and
    `touchPads(true)` takes `PITCH +`, `PITCH -`, `ROLL L` and `ROLL R` off the
    glass. Measured on an emulated phone with nothing driving the sensors: the
    one event captured is `{alpha: null, beta: null, gamma: null}`, the left
    cluster then holds 0 pads against the right's 4, and `tiltToInput` writes
    all four attitude controls false every frame. The aircraft cannot be
    pitched or rolled at all, on the one kind of machine that has no keys to
    fall back on. `js/tilt-controls.js` names this exact hazard in its own
    comment - "a set of pads taken off the glass for a tilt that never arrived
    would be an aircraft with no controls at all" - and a null reading is that
    arrival.
  - **Goal**: Treat a reading with no numbers in it as no reading. Have the
    listener ignore an event whose `beta` and `gamma` are both null rather than
    coercing them to zero, so `state.reading` stays null and the pads stay on
    the glass until a real orientation arrives. `applyTiltReading` should be
    the place it is decided, so the rule is testable in Node beside the rest of
    the module.
  - From: UI/UX Override - the landing the card is never told about
- [x] **Floated Readouts**: The floated attitude indicator is drawn over the
  readouts it is floated above
  - **Issue**: With the pads out, `#attitude.floated` is placed at the top
    centre. On a 393 pixel wide phone it occupies x 141.5 to 251.5 while the
    `#hud` block runs out to x 208.8 - 67 pixels of overlap - and the attitude
    element paints later at the same `z-index: 100`. It covers the right-hand
    end of four readouts at once: on screen they read "AIRSPEED: 80 kno",
    "ALTITUDE: 139", "V/S: +1260 ft/" and the heading behind the ladder's rim.
    The ladder was moved there because the corner it used to sit in is now under
    a thumb, and on a narrow screen the top centre is already taken.
  - **Goal**: Give the two of them the screen between them rather than the same
    part of it - either drop `#hud` below the floated ladder while the pads are
    out, or narrow the ladder and pin it clear of the readout block - so that
    nothing a pilot flies on is obscured at the widths a phone actually has.
  - From: UI/UX Override - the landing the card is never told about

## Archived 09-14-26

- [x] A landing stage opens pointed away from the strip it is about
  - **Issue**: `RUNWAY LANDING` `FINAL` opens 2400 units out from the middle of
    the runway with the card reading `HEADING: 005`, and held, that heading
    takes the aircraft past the side of the strip rather than onto it. Measured
    off the chart marker over 653 units of flight from the opening at
    `5165.0, -7469.3`: the strip lies on `5.09` degrees and the aircraft
    actually flies `355.08`, which is the same bearing mirrored and `10.01`
    degrees off. `bearingDirection` in `js/game-modes.js` returns
    `{ x: sin H, z: cos H }` while an aircraft on heading `H` flies
    `(-sin H, cos H)` through `headingToYaw` in `js/units.js`, and
    `approachOpening` places the aircraft with the first frame and points it
    with the second. `FINAL` sets `approach.heading: 0`, which is the stage
    saying it opens aimed at the strip. The same mismatch reaches the score: a
    touchdown that physically crossed the strip at `9.9` degrees was reported
    as `4`, because a runway's own `heading` field is in the mirrored frame
    too.
  - **Goal**: Resolve to [stage-opening-heading.prompt.md](.claude/prompts/stage-opening-heading.prompt.md)
  - From: UI/UX Override - the stage that opens pointed away from the strip

## Archived 09-15-26

- [x] Floated Readouts 1: the readouts dropped below the ladder land in the
  pads instead
  - **Issue**: `#hud.floated` starts at `top: 180px` and is six 16 pixel rows,
    `204.75` pixels of them, so it ends `384.8` pixels down. The pads take the
    bottom `172`, and `#touch-controls` is `z-index: 130` against `#hud`'s
    `100`, so they paint over the readouts. The two are clear of each other
    only above `557` pixels of viewport height. A phone held sideways - which
    `js/tilt-controls.js` calls the ordinary way this is flown - gives `393` at
    most and about `330` in a browser with a toolbar: at `330` the whole block
    is inside the pad band and `THROTTLE` and `CAMERA` are off the bottom edge
    entirely. On a 320 pixel phone in portrait, the width the
    `#audio-muted.floated` comment says the layout was measured at, Safari
    leaves `460` and the right-hand cluster at x `148`..`304` covers the
    right-hand end of `HEADING`, `THROTTLE` and `CAMERA`. The left-hand cluster
    empties only when tilt is flying, so a device with no gyroscope - the state
    the same turn's other fix exists to preserve - keeps `PITCH +`, `PITCH -`,
    `ROLL L` and `ROLL R` at x `16`..`172`, directly under them. Read off the
    stylesheet rather than measured in a browser; the same model reproduces the
    completed item's own browser measurement of `#hud` at x `208.8` exactly.
  - **Goal**: Resolve to [floated-readouts-height.prompt.md](.claude/prompts/floated-readouts-height.prompt.md)
  - From: UI/UX Override - the landing the card is never told about
- [x] **Landing Breakdown**: The landing breakdown is read off from under the pads
  - **Issue**: `#game-mode-report` is the bottom of a card pinned at
    `bottom: 20px`, `min-width: 260px` wide with `20px` of side padding and
    centred, so the report sits `28` to `114` pixels up from the bottom edge.
    Both pad clusters occupy the bottom `16` to `172` pixels, at x `16`..`172`
    and x `W-172`..`W-16`, and `#touch-controls` is `z-index: 130` against the
    card's `120`. On a 393 pixel phone the five rows are centred across x
    `89`..`304`, so every one of them runs `44` to `83` pixels into a cluster
    at each end - `OFF THE CENTRELINE  12 ft` is the widest and loses `83` off
    both, behind `ROLL R` on one side and `YAW L` on the other. The card's
    place is older than this turn. The breakdown is what this turn made appear,
    and until now there was nothing in that part of the card to be covered.
  - **Goal**: Give the breakdown somewhere on a touch screen that the pads are
    not. Lifting the card clear of the pad band while `#touch-controls` is
    shown is the smallest version, and the same `floated` idea `#hud` and
    `#attitude` already use, but the card is centred and the band is `172`
    pixels deep, so check what it meets on the way up before settling on it.
    Whatever it comes to, pin it in `test/page.test.js` the way the floated
    overlays are.
  - From: Code Review Override - the phone layout the two fixes left behind
- [x] Landing Breakdown 2: the lifted card lands under the LANDED notice on a
  phone held upright
  - **Issue**: The card clears the pads at every size checked - no line of it is
    behind a pad on 393x852, 320x568, 852x393, 852x330, 568x320, 393x578 or
    320x460 - but it does not clear `#landed`, which `js/hud.js` shows for the
    whole time the aircraft is stopped on the strip, which is the whole time the
    breakdown is up. `#landed` is centred at `top: 50%`, 112 pixels tall, with
    `background: rgba(0, 0, 0, 0.55)` at `z-index: 150` against the card's
    `120`, so it paints over it. One landing was flown out on `FINAL`, the frame
    held, and `#game-mode.floated` taken off and put back on it to separate the
    lift from what was already there. On 320x568 the notice takes 228-340, the
    lifted card 214-380 and the unlifted card 382-548: seven of the card's lines
    are behind the notice now and none of them were before, and the line lost is
    `LANDING  ·  <score>`, the headline of the breakdown. The same on 393x578,
    seven against none. On 320x460 it goes from one line to six. On 852x393 and
    852x330 the card is past the `max-width: 640px` the lift is written inside,
    does not move, and its two and four covered lines are older than this
    change. The request's own reading for 320x568 is "all five breakdown rows
    fully readable"; they are clear of the pads and they are not readable.
  - **Goal**: Resolve to [breakdown-under-landed-notice.prompt.md](.claude/prompts/breakdown-under-landed-notice.prompt.md)
  - From: Code Review Override - the phone layout the two fixes left behind

## Archived 09-16-26

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

## Archived 09-17-26

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

## Archived 09-19-26

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

## Archived 09-20-26

- [x] Card Clip 1: the card still clips through the middle of a line, in the
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

## Archived 09-21-26

- [x] Slow the orbiting camera's spin, and make the rate something a pilot sets
  - **Issue**: The drone-style orbit sweeps fast enough to be hard to read the
    world from, and the rate is a constant in the camera code rather than
    anything a pilot can reach.
  - **Goal**: Slow the default sweep, then expose the rate in the **Settings**
    panel beside the other camera options, so the new default is a starting
    point rather than a second hardcoded number. One change: the value and the
    control that owns it, in the same pass - splitting them means editing
    `js/camera.js` twice for one decision.
  - From: User Overrides
- [x] **Level Off**: `space` levels the flight off at `V/S: 0 ft/min`
  - **Issue**: Holding an altitude means trimming the vertical speed to zero by
    hand, which is a fiddle in the middle of everything else a landing asks
    for.
  - **Goal**: A `space` keypress sets vertical speed to zero and leaves pitch
    where the pilot put it, so the aircraft holds its altitude until the next
    input. Register it where the other keys are bound rather than as a special
    case, and say so in the controls list the **Controls** entry shows.
  - From: User Overrides
- [x] Low Altitude warns before the flight has started
  - **Issue**: The low altitude alert fires while the aircraft is still on the
    runway at the start of a flight. It is true and useless: altitude is low
    because nothing has taken off yet, and the first thing a pilot sees is a
    warning about the state the simulator just put them in.
  - **Goal**: Gate the alert on the flight having left the ground, so it only
    speaks about an altitude the pilot flew to. Takeoff is the condition, not a
    timer - a flight that never leaves the runway should never raise it.
  - From: User Overrides

## Archived 09-22-26

- [x] A takeoff that runs off the runway drives across the terrain
  - **Issue**: Running past the end of the runway does not end the attempt. The
    aircraft keeps going over the environment as though it were taxiing, so a
    failed takeoff has no outcome and the flight continues in a state the
    simulator has no rules for.
  - **Goal**: Leaving the runway surface while still on the ground registers a
    crash, through the same path any other crash takes, so the attempt ends and
    is recorded like one. Bound it to the runway area rather than to a distance
    from the start, so an overrun to either side counts the same as one off the
    end.
  - From: User Overrides
- [x] Placing elements can overlap the runway
  - **Issue**: Elements placed in the **Element Editor** sometimes land on or
    through the rendered runway, leaving the strip a flight starts from
    obstructed or visually broken.
  - **Goal**: Treat the runway as reserved ground that placement cannot enter:
    an element that would intersect it is refused or moved clear, and the
    editor says which. The runway is the one surface a flight depends on
    existing, so it is the one the editor may not edit around.
  - From: User Overrides
- [x] Clicking left of a value raises it
  - **Issue**: In the **Element Editor** and the **Settings** panel, clicking
    the left side of a value increases it. Every control of this shape reads
    left as down, so the click does the opposite of what it looks like, in two
    panels at once.
  - **Goal**: Left decreases and right increases, everywhere this control is
    used. One fix at the control rather than per panel, since both panels are
    wrong in the same direction and for the same reason.
  - From: User Overrides
- [x] Level Off 1 - the vertical speed reads zero while the aircraft still sits
      nose-up
  - **Issue**: `space` sets `V/S` to zero and nothing else moves. Altitude does
    hold, so the number is telling the truth, but pitch stays wherever the
    pilot left it: the horizon stays tilted, the attitude indicator keeps
    showing a climb, and the aircraft reads as still going up while the
    instrument says it is not. The two disagree on screen at the moment a pilot
    is trusting one of them. Seen in
    [level-off.gif](.support/level-off.gif).
  - **This is the earlier decision, not a missed case.** The item completed at
    `1.17.0-alpha` set vertical speed and deliberately left pitch alone, so
    every part of it worked as written. What it did not account for is that
    levelling off is something a pilot watches happen, and half of what they
    watch is the attitude.
  - **Goal**: One keypress brings the aircraft to level flight, and both the
    model and the instruments arrive there together. Pitch eases to level over
    a short interval rather than snapping, so the movement reads as the
    aircraft settling rather than as a jump, and the attitude indicator follows
    the model rather than being driven separately.
  - **Done when all three agree at rest**: `V/S` at `0 ft/min`, pitch within a
    degree of level, and the attitude horizon centred - checked after the ease
    has finished, not on the frame the key goes down. State the interval used
    so the next reader can change it without guessing at it.
  - **Where it lives**: the level-off path is in `js/aircraft.js` and the
    indicator is drawn in `js/attitude.js` from `#attitude-ball`,
    `#attitude-horizon` and `#attitude-ladder`. Keep the indicator reading the
    model's pitch rather than easing on its own - two easings of one value is
    how they come to disagree by a frame.
  - **Leave roll alone.** Nothing here asks for it, a wing-level is a separate
    decision, and rolling the aircraft on a keypress nobody pressed for it is
    the kind of surprise this item exists to remove.
  - From: User Overrides
- [x] The level off is still described as leaving the nose where the pilot put
      it, in the module it is bound in and in the test that covers the binding
  - **Issue**: `1.17.1-alpha` eased the nose to level and five documents were
    rewritten to say so, but the two comments nearest the binding were not.
    `js/input-map.js` line 34 tells a reader that `Space` "is an instruction to
    trim the climb out and leave the nose exactly where the pilot put it", and
    the doc comment above `test('space levels the flight off')` in
    `test/input-map.test.js` line 73 says it "leaves the nose where the pilot
    put it". Both now state the opposite of what the code does, and
    `js/input-map.js` is the file a reader opens to find what `Space` is bound
    to. `CHANGELOG.md` line 49 carries the same sentence and is correct there -
    it is the record of what `1.17.0-alpha` shipped - so leave that one alone.
  - **Goal**: Rewrite both comments around the nose easing to level, keeping
    what each comment is there for: the binding comment explains why the key
    sits beside reset rather than among the control surfaces, and the test
    comment explains what one press saves the pilot. Name `LEVEL_OFF_SECONDS`
    rather than writing the interval out as a number, so neither comment can
    go stale the next time it moves.
  - From: Code Review Override - the comments the level off left behind

## Archived 09-23-26

- [x] `.tmp/` is kept out of the repository by a personal global gitignore
      rather than by the repository's own
  - **Issue**: `git check-ignore -v .tmp/ui-ux/t6-probe.mjs` answers
    `C:\Users\<user>\.gitignore_global:11:.*`, so the 250-odd screenshots, logs
    and scratch `.mjs` files the UI/UX tester writes under `.tmp/ui-ux/` are
    excluded by a rule that lives on one machine rather than by the project.
    `.gitignore` already carries `test-results/` and `user-scripts/` under the
    heading "Verification output written by the UI/UX tester, which is a record
    of one run on one machine rather than anything the project ships", which is
    a description of `.tmp/` as well. On a clone without that global rule -
    another machine, or CI - the folder is untracked and visible, and a
    `git add -A` sweeps all of it into the repository.
  - **Goal**: Add `.tmp/` to `.gitignore` beside `test-results/` and
    `user-scripts/`, and confirm with `git check-ignore -v` that the answer now
    comes from the repository's own file rather than from a global one.
  - From: Code Review Override - the comments the level off left behind
- [x] The `1.17.2-alpha` changelog entry claims the ignore rules reach the
      project, and calls the half that does not something the repository cannot
      close
  - **Issue**: The entry ships in a tree that carries no `.gitignore`.
    `git add -An` lists the seven tracked files this turn changed and skips
    `.gitignore`, so the commit and the `v1.17.2-alpha` tag carry the entry
    without the file it describes. Its bolded lead, "`.tmp/` is ignored by the
    project rather than by one machine", is therefore not true of the release,
    and the same paragraph disclaims it further down - "which is every clone,
    the file being untracked" - so the bullet contradicts its own heading under
    a `### Fixed` list. The closing sentence, "That is the half of this the
    repository cannot close on its own", is wrong rather than overstated:
    `.nojekyll` is tracked here under the same global `.*` rule that hides
    `.gitignore`, so a dotfile in this repository can be force-added and one
    already has been. The run declined to, which is a decision about whose
    configuration is being worked around rather than a limit on the repository.
    `TODO.md` puts it correctly - "the call is the user's" - and only
    `CHANGELOG.md` puts it as an impossibility.
  - **Goal**: Reword the `1.17.2-alpha` entry's second `### Fixed` bullet so
    its heading claims only what the release contains: the rule is written into
    the repository's own `.gitignore`, which does not yet travel with the
    repository. Replace "cannot close on its own" with what is true, that
    force-adding the file is a call left to the user rather than one a run
    takes. Do not restate it as a fix that landed, and do not touch the first
    bullet or any earlier version's entry. If the release is already tagged
    when this is worked, correct it under an `Unreleased` heading rather than
    editing the tagged entry.
  - From: Code Review Override - the ignore file that never reaches a clone
- [x] **Glide Climb**: **Dead Stick**: the engine quits at altitude and the
  throttle is dead for the rest of the flight, with the runway far enough off
  that reaching it is a glide to be planned rather than a descent to be flown
  - From: Game Modes UI/UX `->` New Game Modes

## Archived 09-24-26

- [x] **Cargo Run**: land at one strip, then at the next, against a budget
  that only spends while the engine is open, so the route flown matters as
  much as the landings made
  - From: Game Modes UI/UX `->` New Game Modes

## Archived 09-25-26

- [x] **Search and Rescue**: find a marker placed somewhere in the world given
  only a bearing and a distance from the start, then get down beside it
  - From: Game Modes UI/UX `->` New Game Modes
