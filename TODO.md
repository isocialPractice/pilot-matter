# TODO

Roadmap for Pilot Matter, a browser-based Three.js flight simulator with no
build step. Items under `## Current` are the next work queue; the remaining
level 2 sections group planned work by theme and state the version update
that applies when their items are completed.

## Current

The work queued for the next run, copied here from the roadmap sections below.
Each item carries a nested `From:` line recording the section it came from, so
its context survives being archived.

- [ ] **Traffic Pattern**: a full circuit flown to a pattern - takeoff, climb
  out, downwind, base, and final - judged on holding each leg's altitude and
  heading rather than only on the landing at the end of it
  - From: Game Modes UI/UX `->` New Game Modes
- [ ] **Canyon Run**: fly the length of a canyon under a ceiling and between
  its walls, with the ceiling coming down and the cut narrowing stage by stage
  - From: Game Modes UI/UX `->` New Game Modes
- [ ] **Photo Survey**: photograph a list of named landmarks, each counting
  only when it is caught from inside a height, range, and heading window
  - From: Game Modes UI/UX `->` New Game Modes
- [ ] Drop the stand-down branch at the top of the ignore-rules check in
  `test/site.test.js` so the guard applies on every tree, now that the user has
  tracked `.gitignore`, and say in that run's changelog entry that the rules
  reach a clone
  - From: Documentation & Polish

### UI/UX Override - the chart the pointer row hands off to

#### Found Issues

- [ ] A mark held at the edge of the chart keeps none of its three readings
  - **Issue**: `.minimap-mark.off-map` in `index.html` carries the same
    specificity as `.minimap-mark.next` and `.minimap-mark.flown` and is
    written after both, so it wins outright: a mark held at the edge of the
    square is drawn `fill: none; stroke: #ffb000; stroke-width: 0.9`
    whichever of the three readings it carries. `markClass` in `js/minimap.js`
    still puts the right class on the element; nothing on the glass says which.
    That cost nothing while the chart drew only a loop course, whose gates are
    laid inside the tile they are flown over, and costs something now that a
    route's strips are drawn on the same terms - as the comment above the rule
    says in as many words. Measured in the running app at 393x740 and 640x745
    with the pointer row stood down: `CARGO RUN` / `SHORT HAUL` opens at
    (-8675, 1626), 675 units the wrong side of the tile boundary at x = -8000,
    with both its strips in the tile east of it, so both are held at the edge
    at -50,0.87 and -50,-35.18 and both read `fill: none`,
    `stroke: rgb(255, 176, 0)`, `stroke-width: 0.9px` - the leg being flown and
    the leg still ahead identical. Hands off that lasts 7.5 seconds, until the
    aircraft crosses into the tile the strips are in and the marks read green
    and amber correctly. `LONG HAUL` opens 301 units the wrong side of
    x = 8000 and does the same for a shorter beat. A search is untouched in
    substance: it draws one mark, so there is nothing to tell apart.
  - **Goal**: Resolve to [edge-held-mark-readings.prompt.md](.claude/prompts/edge-held-mark-readings.prompt.md)
  - From: UI/UX Override - the chart the pointer row hands off to
- [ ] The pages written for the chart describe a held mark keeping a reading it
  gives up
  - **Issue**: Both paragraphs added to `docs/controls/game-modes.html` this run
    compose "marked green" with "held hollow at the edge", which the stylesheet
    the item above describes makes mutually exclusive. The route paragraph has a
    route drawn "with the leg you are flying marked green and the ones behind
    you dim, with a strip past the edge of the square held hollow at that edge";
    the search paragraph has the marker "green the way a gate being waited on
    is, and held hollow at the edge of the square once it lies past the ground
    the chart covers - which on a long leg is most of the flight". As shipped a
    held mark is amber whichever reading it carries, so on the very case each
    paragraph names as the ordinary one - `CARGO RUN` / `SHORT HAUL` for its
    first 7.5 seconds, a search for most of a long leg - the published page
    names a colour the glass never shows. `docs/controls/instruments.html` puts
    the three readings and the hollow edge in consecutive sentences and reads
    the same way without claiming it outright.
  - **Goal**: Work this with the item above rather than apart from it, since the
    two answers are one decision. If the stroke is made to carry the reading as
    that item's prompt proposes, all three paragraphs are true as written and
    none needs touching - say so. If the decision goes the other way, qualify
    each to say a held mark gives its reading up for the hollow edge.
  - From: UI/UX Override - the chart the pointer row hands off to
- [ ] The chart test keeps the vocabulary the rename took out of everything
  around it
  - **Issue**: `test/minimap.test.js` was moved from gate to mark throughout
    this run except in `a chart fitted to new ground draws the course against
    that ground` at 295-310, whose comment still reads "puts every gate
    somewhere else on the face", whose locals are `gates` and `gate` against the
    `marks` and `mark` the tests either side of it now use, and whose message
    still says "the gate being waited on" for a course that may now be a route's
    strips. Nothing fails; the file says both words for one thing. In the same
    file the new seam test writes `const [body] = [method[1]];` at 347, an array
    built and destructured in place to bind the one value `const body =
    method[1]` binds directly.
  - **Goal**: Finish the rename in that test - its comment, its locals and its
    message - and bind `body` directly. `npm test` should still report 1038
    passing.
  - From: UI/UX Override - the chart the pointer row hands off to

## Game UI/UX

Player-facing interface and experience around the flight model, beyond the
raw instrument readout. Completing items in this section applies a minor
version update.

## Game Modes UI/UX

Flights that are played rather than flown: a world, an objective, and the
stages the objective is set at. Completing items in this section applies a
minor version update.

### New Game Modes

- [ ] **Traffic Pattern**: a full circuit flown to a pattern - takeoff, climb
  out, downwind, base, and final - judged on holding each leg's altitude and
  heading rather than only on the landing at the end of it
- [ ] **Canyon Run**: fly the length of a canyon under a ceiling and between
  its walls, with the ceiling coming down and the cut narrowing stage by stage
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

- [ ] Drop the stand-down branch at the top of the ignore-rules check in
  `test/site.test.js` so the guard applies on every tree. The check skips
  itself where the repository carries no `.gitignore`, because a personal
  global rule kept the file out and `actions/checkout` fetched a tree without
  it. The user has since tracked it - `git ls-files .gitignore` answers - so
  the branch now guards nothing and hides the check on any tree that loses the
  file. Say in that run's changelog entry that the rules reach a clone

## Complete

Everything already done, in the order it was finished, kept as the record of
how the simulator got here rather than as a list still to be worked.

> 131 earlier items in `TODO-archive.md`, newest last.

- [x] **User todo**: force-add `.gitignore`, or narrow the global rule that
  hides it, so the repository's own ignore rules reach a clone
  - **Issue**: The file exists in the working copy and nothing tracks it.
    `git ls-files .gitignore` comes back empty, `git show HEAD:.gitignore` says
    it "exists on disk, but not in 'HEAD'", and `git check-ignore -v .gitignore`
    answers with a `.gitignore` rule in a personal global ignore file, so it has
    never been staged and cannot be by an ordinary `git add`. Nothing in the
    repository therefore carries `test-results/`, `user-scripts/`, or the
    `.tmp/` added in `1.17.2-alpha`: a clone gets no `.gitignore` at all. It
    reaches the deploy too - `actions/checkout` in
    `.github/workflows/workflow.yml` fetches a tree without the file, and the
    workflow runs `npm test` against it, so the guard in `test/site.test.js`
    skips itself there rather than failing the deploy for a thing the deploy
    cannot fix.
  - **Goal**: Either force-add the file once with `git add -f .gitignore`, or
    narrow the rule excluding it in the global ignore file so this repository's
    copy stops being caught by it. Both are the user's call, which is why this
    is a user item and no run attempts it: what excludes the file is the user's
    own global configuration rather than anything this repository owns.
    `.nojekyll` is tracked here under that same global rule, so force-adding a
    dotfile is a route this repository has already taken once.
  - Once it is tracked, the other half is ordinary work a run can take: drop the
    stand-down branch at the top of the `test/site.test.js` check so the guard
    applies on every tree, and say in that run's changelog entry that the rules
    now reach a clone. Queue that only after the file is tracked - until then it
    has nothing to apply to.
  - From: Current
- [x] The cheatsheet's glide paragraph was edited without being rewrapped
  - **Issue**: `CHEATSHEET.md:207` runs to 96 characters inside a paragraph
    whose other lines wrap at about 75. The sentence `1.18.1-alpha` replaced
    was rewritten in place and the text after it was left where it sat, so one
    line of the paragraph is a third longer than the lines above and below it.
    Nothing reads wrong - `docs/cheatsheet.html` carries the same prose as one
    line per paragraph, which is why the suite did not notice.
  - **Goal**: Rewrap the paragraph at `CHEATSHEET.md:203-208` to the width the
    rest of the file uses, changing line breaks and nothing else.
  - From: Code Review Override - the dead stick's vertical, and what was written about it
- [x] Glide Climb 2
  - **Issue**: A dead stick still does not always come down. `Space` is the
    level off, and `levelOff` in `js/aircraft.js:487` does not read
    `this.engine`, so pressing it once on a dead engine sets `holdingAltitude`
    and `js/aircraft.js:406` writes `this.position.y = startY` on every frame
    after it - which throws away the `glideDescentAt` the line above it just
    worked out. Start `DEAD STICK`, press `Space` while airborne, and touch
    nothing else: the altitude never falls, `V/S` reads `0 ft/min` because it
    is measured from the same two altitudes, and the stage never ends. Only
    `pitchUp`, `pitchDown`, `throttleUp` and `throttleDown` end the hold
    (`VERTICAL_CONTROLS` in `js/input-map.js:26`), so roll and yaw steer the
    aircraft to the strip at a fixed height with nothing pulling it.
    **The hold predates this release and is not what `1.18.1-alpha` broke.**
    What `1.18.1-alpha` did is declare the case closed: `js/flight-model.js`
    now says "no pair the aircraft can be in comes out climbing",
    `docs/controls/game-modes.html:189` says "the one thing that holds height
    is speed rather than attitude", and `CHANGELOG.md:58` names "the one case
    that does hold height". The trim hold is a second case, and all three
    sentences say there is not one.
  - **Goal**: Decide what the level off means with no engine, then make the
    three sentences above say it. Refusing the hold in `levelOff` while
    `this.engine` is false is the smaller of the two answers and keeps the
    mode's promise; letting it stand and qualifying the prose is the other,
    and needs saying why a glide can be trimmed to hold height. Whichever is
    taken, `js/aircraft.js` is not testable in Node - there is no `three` to
    import - so the check belongs where `glideDescentAt` is checked: a pure
    function the frame calls, swept the way the plane is swept now, rather
    than another regex over the source. Record the fix under an `Unreleased`
    heading in `CHANGELOG.md`, since `1.18.1-alpha` is cut.
  - From: Game Modes UI/UX `->` New Game Modes
- [x] Pointer Wrap 1
  - **Issue**: The comment the item left behind names a mechanism the
    stylesheet does not have. `index.html:408` says "Wrapped is not clipped -
    the bound is summed from the wrapped height, so both lines are drawn
    whole", and `CHANGELOG.md:82` repeats it as "`--card-pointer` declares the
    wrapped height and the bound is summed from it". Nothing sums
    `--card-pointer`. The four bounds written as row sums - `index.html:1054`,
    `1073`, `1095` and `1099`, which are what `summedFromRows` in
    `test/page.test.js:1086` matches - add `--card-edges`, `--card-name`,
    `--card-objective` and `--card-score`, and the two media queries holding
    them, `(max-height: 551px)` and `(max-height: 479px)`, are both narrower
    and shorter than `@media (max-width: 640px) and (max-height: 745px)` - so
    `index.html:1153` applies there too and has already taken the pointer row
    off with `display: none`. Where the wrapped row is drawn - pads out, width
    at or under 640, height 746 or more - the card is bounded by the room it has,
    `calc(100vh - ...)`, which `index.html:1138` calls out as the opposite
    kind of bound. The row survives because nothing adds it up, not because
    something does.
  - **Goal**: Say what actually keeps the two lines whole: the card is bounded
    by the room under the readouts rather than by a sum of its rows, and below
    746 pixels of height the row comes off altogether rather than wrapping in
    a card too short for it - which `index.html:1138` already explains and the
    new comment should point at instead of restating. Correct
    `index.html:408`, and correct `CHANGELOG.md:82` in place, since the
    sentence describes `1.18.1-alpha`'s own reasoning rather than claiming a
    fix the tag does not carry. `js/hud.js:127` is sound and needs nothing.
  - From: UI/UX Override - the three new game modes
- [x] The frame's `heldAltitude` call is no longer held to passing the hold
  itself
  - **Issue**: The rewrite in `test/input-map.test.js` swapped one tight
    assertion for three loose ones. `this.holdingAltitude && this.airborne)
    this.position.y = startY` used to be matched whole; what replaced it,
    at lines 167, 170 and 173, checks the call shape, `airborne:
    this.airborne` and `engine: this.engine`, and nothing checks `holding:
    this.holdingAltitude`. No other test ties the frame's hold flag to the
    altitude write either - `heldAltitude` is given its state directly by its
    own unit tests, so it cannot see what the frame passes it. Editing
    `js/aircraft.js:417` to read `holding: true` leaves all 1033 tests
    passing and pins every airborne powered aircraft to the altitude it
    opened the frame at, so free flight can neither climb nor descend.
    Confirmed by making that edit and running `npm test`.
  - **Goal**: Add a fourth assertion beside the two it belongs with, matching
    `holding:\s*this\.holdingAltitude` inside the `heldAltitude` call. While
    there, bound the three `[\s\S]*?` spans to the call's own braces: each
    searches to the end of `js/aircraft.js` as written, so a field deleted
    from the call still matches if the same text appears anywhere below it.
  - From: Code Review Override - the field the frame's hold test stopped checking
- [x] **Bounded Span Reason**: The comment justifying `[^}]*?` states its
      hazard as present fact
  - **Issue**: `test/input-map.test.js:161-163` says a span free to reach the
    end of `js/aircraft.js` "finds the same text somewhere below the call and
    passes a field that has been deleted from it". It does not, in the source
    as it stands: `holding:  this.holdingAltitude`, `airborne: this.airborne`
    and `engine:   this.engine` each occur exactly once in the whole file, so
    deleting any one of them fails its assertion under `[\s\S]*?` just as it
    does under `[^}]*?`. The `CHANGELOG.md` entry for the same change states
    the hazard conditionally - "as soon as the same text appears anywhere
    below it" - and that is the true version. The bound is worth keeping; only
    the reason written beside it overstates, and a comment is the one part of
    a module no test reads.
  - **Goal**: Reword the comment to the conditional the changelog already
    uses, so it describes the hazard the bound forecloses rather than one the
    file currently carries. Keep it a reason rather than shortening it away:
    this comment is the only account in the repository of why this test uses
    `[^}]*?` where the other nineteen source-matching spans across `test/`
    use `[\s\S]*?`, so it is what a later reader weighs before keeping or
    reverting the divergence.
  - From: Code Review Override - the reason written for the bounded span
- [x] A short screen drops the objective's bearing with nothing left saying it
  - **Issue**: Below 746 pixels of height on a narrow screen the objective card
    drops its pointer row, and the `@media (max-width: 640px) and
    (max-height: 745px)` rule in `index.html` gives its reason as "the chart in
    the corner is left to say which way the gate lies - which it is drawing
    already". The `@media (max-height: 540px) and (min-width: 500px) and
    (max-width: 771px)` rule below it says the same. Measured in the running
    app at 393x740, that holds for one of the three modes that write the row
    and not the other two: `FLYING THROUGH LOOPS` draws three gates and the
    course polyline with the next gate marked, while `CARGO RUN` and
    `SEARCH AND RESCUE` draw no gates and an empty course line, leaving the
    face, the grid, the `N` label and the aircraft marker - none of which says
    where the objective is. The chart only ever gets a course: `js/main.js`
    builds one under `mode?.objective === LOOP_OBJECTIVE` and hands every other
    objective an empty array. So a route loses `LEG 1 · 234° · 8570 ft` and a
    search loses `MARKER · 045° · 11810 ft` with no replacement, which the
    comment over `runPointer` in `js/game-modes.js` argues against directly: "A
    strip is not: it is a grey mark on grey country, several miles off, and a
    pilot looking straight at one has no way of knowing it. So a route's
    pointer stays up."
  - **Goal**: Resolve to [pointer-row-short-screen-fallback.prompt.md](.claude/prompts/pointer-row-short-screen-fallback.prompt.md)
  - From: UI/UX Override - the chart behind the pointer row
- [x] Nothing in the suite pins the two halves of the engine rule in `js/aircraft.js`
  - **Issue**: `test/flight-model.test.js` sweeps `heldAltitude` and
    `test/input-map.test.js` pins the three fields the frame hands it, so the
    rule the frame applies is covered. The two paths that normally set the flag
    are not. Deleting `if (!this.engine) return false;` from `levelOff` and
    `if (!this.engine) this.endLevelOff();` from `setEngine` was tried this run:
    `npm test` reported 1033 of 1033 passing with both gone, the same count as
    before they were removed. The first puts the level off's own refusal back
    to what it was before the fix, and the second lets `isHoldingAltitude` keep
    reporting a trim the frame has already stopped honouring. Both were
    verified in the browser this run because `js/aircraft.js` imports `three`
    and cannot be constructed in Node, so a regression in either would reach a
    release with nothing in the suite to catch it.
  - **Goal**: Add two assertions to the existing `the aircraft holds the
    altitude it was levelled at` test in `test/input-map.test.js`, in the
    `aircraftSource` idiom the rest of that test already uses and with the same
    `[^}]*?` bound so neither span can run past its own method: one that
    `levelOff` refuses without an engine, and one that `setEngine` ends the
    level off when it is handed a dead one.
  - From: UI/UX Override - the chart behind the pointer row
- [x] The hold test's own levelling span is unbounded against the reason written
  above it
  - **Issue**: `test/input-map.test.js:176` matches
    `/levelOff\(\)\s*\{[\s\S]*?this\.levelling = \{/`, the one source-matching
    span in that test still free to run to the end of the file. The comment at
    156-168 says the three `heldAltitude` spans below it are bounded with
    `[^}]*?` "rather than the `[\s\S]*?` the source-matching tests elsewhere in
    this folder use", and gives the reason as the day a matched text is written
    a second time below the call. That span is open to the same day and sits
    four lines under the reason: anchored on `levelOff() {` at
    `js/aircraft.js:506` it searches to the end of the file for
    `this.levelling = {`, which occurs once after the anchor today, at line 510
    inside `levelOff`. Delete line 510 and write `this.levelling = {` anywhere
    below it and the assertion passes on the second occurrence while `levelOff`
    no longer brings the nose to level - `endLevelOff` at 519 and the frame loop
    at 357-360 already assign `this.levelling`, so an edit reseeding the ease is
    the plausible one. `levelOff` holds no `}` between its opening brace and
    line 510, so the same bound fits without changing what the assertion matches
    now. As written the comment's "elsewhere in this folder" also reads as though
    this file were uniformly bounded, which the span four lines down contradicts
  - **Goal**: Bound that span the way the three below it are bounded,
    `/levelOff\(\)\s*\{[^}]*?this\.levelling = \{/`, and widen the comment's
    second paragraph so it speaks for every source-matching span in the test
    rather than only the three the frame hands `heldAltitude`. `npm test` should
    still report 1033 passing
  - From: UI/UX Override - the chart behind the pointer row
- [x] Bounded Span Reason 1
  - **Issue**: The `CHANGELOG.md` entry written for the reworded comment ends
    "this is the only account in the repository of why this test bounds its
    spans where the source-matching tests elsewhere in `test/` do not". The same
    file contradicts that thirty lines above, where the third `### Fixed` entry
    under `## Unreleased` already gives the account: "all three spans are
    bounded to the call's own braces with `[^}]*?` rather than running to the end
    of the file with `[\s\S]*?` - an unbounded span passes a field deleted from
    the call as soon as the same text appears anywhere below it". The new entry
    cites that very sentence as "the conditional the entry above already used",
    so one entry both points at the earlier account and denies it exists. The
    comment in `test/input-map.test.js` claims nothing of the kind and is correct
    as written; only the changelog overstates, which is the class of defect this
    item existed to remove
  - **Goal**: Narrow the clause in the `### Changed` entry to what holds - the
    comment is the only account a reader of the test finds, the changelog being
    the record of the change rather than something the test carries - or drop the
    clause and keep the sentence saying why the comment stays a reason. Leave the
    `### Fixed` entry as it is
  - From: Code Review Override - the reason written for the bounded span
