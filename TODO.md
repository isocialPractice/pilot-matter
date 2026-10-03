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

> 154 earlier items in `TODO-archive.md`, newest last.

- [x] Drop the stand-down branch at the top of the ignore-rules check in
  `test/site.test.js` so the guard applies on every tree, now that the user has
  tracked `.gitignore`, and say in that run's changelog entry that the rules
  reach a clone
  - From: Documentation & Polish
- [x] The chart's wiring test matches a character it meant to match literally
  - **Issue**: `test/minimap.test.js` builds its `runWorld` assertions as
    `new RegExp(` plus a template literal reading `${mark}: this\.${mark}`.
    Inside a template literal `\.` is not an escape, so it collapses to a bare
    `.` before the `RegExp` constructor ever sees it, and the pattern reads
    `course: this.course` with the dot matching any character. The assertion
    passes on text it was written to reject - `course: thisXcourse` satisfies it
    - and every other span in the file is escaped correctly, so this one reads as
    a slip rather than a choice.
  - **Goal**: Escape the dot, `this\\.`, or use a regex literal the way the rest
    of the file does.
  - From: Code Review Override - the circuit's masts and the corridor's air
- [x] **Traffic Pattern 1**: a mast stands on the runway at both ends of the
  strip
  - **Issue**: `standingMarks` in `js/main.js` maps every leg of the circuit onto
    a mast, and two of the five legs end on the strip itself - `TAKEOFF` at the
    departure threshold and `FINAL` at the approach threshold, which is what `a
    circuit closes on the threshold it opened from` in `test/pattern.test.js`
    pins. Built in Node off the mode's own seed, so this is the strip the stage
    actually lays: `TRAFFIC PATTERN` / `WIDE CIRCUIT` puts its runway at
    (-6766, -619) on heading 304, and the takeoff and final masts stand 0.0 units
    from its two thresholds, 130 units tall with a lit head on each. The takeoff
    roll ends at one of them and the landing is flown onto the other. Nothing
    crashes - `js/crash.js` reads the terrain height and knows nothing about
    meshes, so the aircraft passes through the pole rather than into it - but the
    reason the code gives for the mast, that "a turn in a circuit is a place in
    empty air with nothing drawn at it", is true of the three middle turns and
    false of these two, which are the ends of a drawn strip the approach guidance
    already marks.
  - **Goal**: Put masts only at the turns that are not on the strip. The catch is
    `beacon.setNext`, which is handed `chartNext(this.run)` - for a circuit that
    is `nextLeg`, a leg index - while `RescueMarker.setNext` lights `this.heads`
    by position, so dropping two marks lights the wrong head from then on. Decide
    that first: either carry the leg index on the mark and light by it, or keep
    five entries and let a mark say it draws nothing.
  - From: Game Modes UI/UX `->` New Game Modes
- [x] **Traffic Pattern 2**: the final leg is read every frame and the reading is
  thrown away
  - **Issue**: the item asked for a circuit judged on holding each leg, and four
    of the five are. `trackPattern` in `js/main.js` samples whatever
    `nextLeg(this.run)` answers, which is `FINAL_LEG` for the whole of the
    approach, so `this.pattern.legs[4]` fills up with the height and heading
    error flown down final. Nothing ever closes it: `trackLegs` returns on
    `!step.turned`, and `recordPatternLeg` refuses the final leg by design, so
    `completeLeg` is never called for index 4 and `state.flown[4]` stays empty.
    The pilot gets `HELD n` on the card for `TAKEOFF`, `CLIMB OUT`, `DOWNWIND`
    and `BASE`, and nothing at all for `FINAL`. `patternScore` and `flownLegs` -
    the two functions that say what the whole circuit came to - are called by
    `test/pattern.test.js` and by nothing in `js/`, so the circuit never reports
    a mark of its own either.
  - **Goal**: Decide which of the two the mode means and make it say so. If the
    landing score is the final leg's mark, as `js/pattern.js`'s own header
    implies when it calls the landing "the last fifth" of the circuit, stop
    sampling the final leg rather than filling a tally nothing reads. If the
    approach is held like the other four, close it where `recordLanding` closes
    the leg - in `onLanding` - and report it. Either way the circuit wants
    somewhere to show `patternScore`, which today is a published export the game
    never asks.
  - From: Game Modes UI/UX `->` New Game Modes
- [x] **Canyon Run 1**: the least-air guard is measured at the middle of a cut
  and the walls are where the air runs out
  - **Issue**: `MIN_HEADROOM` in `js/corridor.js` is declared as the least room a
    stage may leave between the ceiling and the ground under a section, and
    `buildCorridor` applies it as `floor + Math.max(plan.ceiling, MIN_HEADROOM)`
    where `floor` is `sample(x, z)` at the section's centre line and nowhere
    else. A cut whose centre falls in a gully gets its lid measured off the gully
    floor while the ground at the posts is far higher. Built in Node off the
    mode's own seed: `CANYON RUN` / `THE SLOT`, cut 5 sits at (-1599, 336) with a
    centre floor of -152.4 and a lid at 77.6, and the ground at the left post -
    155 units across, which is that stage's `halfWidth` - stands at 37.2. That is
    40.4 units between the ground and the beam, against a declared minimum of 70.
    It is flyable, because the middle of that cut has 225 units of air in it, and
    nothing in the formula stops the number going negative on another seed, which
    is the impossible cut the constant exists to refuse.
  - **Goal**: Measure the headroom across the span the cut is actually open over
    rather than at one point on its centre line, and raise the lid to clear the
    worst of it. Note what it costs: `the ceiling is held over the ground under
    each section rather than at one height` and `a stage cannot ask for a cut
    with no air in it` in `test/corridor.test.js` both read the ceiling off the
    centre floor, so both want rewriting against whatever the new rule is, and
    the shipped stages' numbers move with it.
  - From: Game Modes UI/UX `->` New Game Modes
- [x] **Canyon Run 2**: a run opens at a height read off ground a full spacing
  away from where it opens
  - **Issue**: `corridorOpening` in `js/game-modes.js` puts the aircraft at
    `first.x - first.dirX * run`, a full `spacing` back from the first cut, and
    sets its altitude to `(first.floor + first.ceiling) / 2` - the midpoint of
    the air at the cut, over ground sampled at the cut. The two places are a
    whole spacing apart and the ground between them is not flat. Built in Node
    off the mode's own seed: `CANYON RUN` / `THE SLOT` opens at (6980, -805)
    where the ground is 259.3, at an altitude of 283.5 units, which is 24.3 units
    of clearance - and `GROUND_CLEARANCE` in `js/crash.js` is 5, so the stage
    opens about four of its own clearances off the deck at cruise speed. The
    first cut's floor is 167.1, 92 units below the ground the aircraft is
    actually put over, and that difference is the whole of the error. All four
    shipped stages clear the ground today - the other three by 161 units or more
    - so nothing fails, but the sign of the margin is up to the seed.
  - **Goal**: Read the opening height against the ground at the opening point as
    well as at the first cut, and take whichever is higher. `corridorOpening` is
    handed only `stage` and `corridor` today, so a height sampler has to reach
    it - `stageStart`'s `world` is the one place it could come from, and that is
    an interface `docs/api.md` describes, so decide how it is threaded before
    changing the formula.
  - From: Game Modes UI/UX `->` New Game Modes
- [x] Nothing tells the lid rule's two halves apart
  - **Issue**: `buildCorridor` in `js/corridor.js` now holds the lid at
    `Math.max(floor + plan.ceiling, crest + MIN_HEADROOM)` - the stage's own
    headroom over the centre line, or the least room over the highest ground the
    cut is open over, whichever is higher. `docs/api.md:1087` states that rule in
    as many words, and the comment over the formula gives it as the reason the
    gully case was wrong. No test distinguishes it from
    `Math.max(crest + plan.ceiling, crest + MIN_HEADROOM)`, which measures both
    halves off the crest and is a materially different canyon: over the test
    file's own `STEEP` ground it raises every lid by `crest - floor`, hundreds of
    units on the steeper cuts. Confirmed by making that substitution and running
    the suite: 1160 passing, 0 failing, with the probe then reverted. The three
    tests that read the lid each stop short of it - `over level ground the
    stage's headroom is the whole of the lid` runs on a world where
    `crest === floor`, so the two rules agree; `the lid clears the highest ground
    across the cut` asserts `ceiling - height >= MIN_HEADROOM` and
    `ceiling - floor > 400`, both of which the crest version satisfies more
    generously; and `a stage cannot ask for a cut with no air in it` runs with
    `ceiling: 1`, where `MIN_HEADROOM` wins on both sides. The completed item
    `Canyon Run 1` asked for those first two to be "rewritten against whatever
    the new rule is" - they were rewritten, and what they pin is the crest half
    and the level-ground case rather than the rule.
  - **Goal**: One case over ground that is not level across the cut, asserting
    the lid against the formula rather than against a bound it clears -
    `assert.ok(Math.abs(section.ceiling - Math.max(section.floor + 400, section.crest + MIN_HEADROOM)) < 1e-9)`
    over `ROLLING` or `STEEP`, which fails on the crest version wherever
    `floor + 400` is the winning half. Worth a plan whose `ceiling` is large
    enough against the slope that the floor half wins on at least one cut, since
    on `STEEP` as it stands the crest half may win everywhere and the assertion
    would hold for both rules.
  - From: UI/UX Override - the corridor's opening and its lid
- [x] Two of `docs/api.md`'s enumerations do not carry what this run added to them
  - **Issue**: the file lists each module's exports in a table and each shape's
    fields inline, and both listings are exhaustive everywhere else. `docs/api.md:1029`
    gives a leg as `{index, label, fromX, fromZ, fromFeet, x, z, altitudeFeet,
    heading, dirX, dirZ, run}` and `buildPattern` now puts `onStrip` on every leg
    - the one field a host has to read to draw the circuit without standing a
    mast on the runway, and the prose two paragraphs below describes it. The
    corridor section's parallel listing at `:1084` was updated with `crest`, so
    the two shapes now document themselves to different standards. `docs/api.md:856`
    gives the corridor module's constants as `CORRIDOR_REACH`, `MIN_HEADROOM`,
    and `HEADROOM_SAMPLES` is now exported beside them and imported by
    `test/corridor.test.js`. Both propagate to the published page through
    `tools/build-api-reference.mjs`.
  - **Goal**: Add `onStrip` to the leg shape at `docs/api.md:1029` and
    `HEADROOM_SAMPLES` to the constants row at `:856` with a phrase saying what
    it is - how many points across a cut the ground under it is read at - then
    `npm run docs:api` to carry both to `docs/api-reference.html`. While in the
    entry, the `1.22.0-alpha` sentence in `CHANGELOG.md` reading "`patternScore`
    was a published export the game never asked" is missing its last word.
  - From: UI/UX Override - the corridor's opening and its lid
- [x] A source-text assertion claims a bound its span does not have
  - **Issue**: `the landing closes the final leg, and reports the circuit with it`
    in `test/pattern.test.js` ends by matching `onLanding` for
    `/this\.closeFinalLeg\(\);/` under the message "the final leg is closed by
    the arrival, inside the guard that counts it". The span is the whole method
    body, so it says nothing about the guard. Moved above
    `if (recordLanding(this.run, runway))` in `js/main.js` the call still
    matches, and a landing anywhere earlier in the circuit - the takeoff roll, or
    a pass down the strip a go-around leaves, both of which `recordLanding`
    refuses by design - would close `FINAL` and report a circuit the pilot never
    flew out, with the suite green. The sibling assertions in the same file bound
    their spans to one method for exactly this reason.
  - **Goal**: Anchor the assertion on the guard rather than on the method:
    match `recordLanding\(this\.run, runway\)\)\s*\{[^}]*?this\.closeFinalLeg\(\);`
    against the `onLanding` body, bounded with `[^}]*?` the way
    `test/input-map.test.js` bounds its spans, so the call has to sit inside the
    block that counts the arrival.
  - From: UI/UX Override - the corridor's opening and its lid
- [x] A corridor opening is held clear of the ground under it and nothing holds
  it clear of the lid over it
  - **Issue**: `corridorOpening` in `js/game-modes.js` now puts the aircraft at
    `(Math.max(first.floor, ground) + margin)` where `margin` is half the air at
    the first cut. The `Math.max` is the floor side of the guard and there is no
    ceiling side, so the opening rises with the ground at the opening while the
    lid it has to stay under does not move. The module's own header says what
    that would cost in as many words - "a run that opened over the lid it is
    meant to stay under would open with its first section already failed" - and
    nothing now stops it. Read in Chromium off the corridor each stage actually
    drew, with `stageStart` handed that corridor: `OPEN REACH` opens 281.7 units
    under its first lid, `NARROWS` 225.8, `THE RIM` 158.5 and `THE SLOT` 22.1.
    The three roomy ones are the three whose opening ground sits at or below the
    first cut's floor; `THE SLOT` is the one where it stands above it, by 92.1
    units against a margin of 115.0. The remaining 22.9 is the whole of the
    clearance, and it is the seed's to decide: ground 115 units over that floor
    instead of 92 opens the stage level with its own lid, and anything above
    that opens over it. Flown this run, all four stages are fine - every cut of
    every stage was counted and `THE SLOT` was flown out to `MODE COMPLETE` - so
    this is the guard being half there rather than a stage that fails today.
  - **Goal**: Hold the opening under the first cut as well as over the ground,
    so the two bounds are a band rather than one floor. Something of the shape
    `Math.min(first.ceiling - clearance, Math.max(first.floor, ground) + margin)`
    - the height wanted, but never nearer the lid than a stated clearance. State
    what that clearance is and why, the way `MIN_HEADROOM` states its own, and
    note that a cut with less air in it than the clearance asks for is already
    refused by `MIN_HEADROOM`, so the two cannot fight. `a run opens over the
    ground at its opening, not the ground at the first cut` in
    `test/game-modes.test.js` is where the new bound wants a case of its own: a
    corridor whose opening ground stands higher over the floor than half the
    cut's air, which today opens above the ceiling and should not.
  - From: UI/UX Override - the corridor's opening and its lid
