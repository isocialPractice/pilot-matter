# TODO

Roadmap for Pilot Matter, a browser-based Three.js flight simulator with no
build step. Items under `## Current` are the next work queue; the remaining
level 2 sections group planned work by theme and state the version update
that applies when their items are completed.

## Current

The work queued for the next run, copied here from the roadmap sections below.
Each item carries a nested `From:` line recording the section it came from, so
its context survives being archived.

- [ ] Fly by tilt, or by keys, whichever the pilot wants rather than whichever
  the machine has
  - From: Flight Controls
- [ ] Set how far the device is turned before it asks for anything
  - From: Flight Controls
- [ ] Accept typed values in the **Element Editor** and the **Settings** panel
  - From: Simulator Configuration
- [ ] Pin the way a cut is drawn against the way a cut is tested, so the two
  cannot drift apart
  - From: Game Modes UI/UX `->` Improve Existing Game Modes `->` Canyon Run

### UI/UX Override - a control can be bound onto a key the game already reads

#### Found Issues

- [ ] A key the game reads for something else is still a key the map will take
  - **Issue**: the `KEYS` list refuses a key another row holds and nothing
    else, because that is all `rebind` in `js/key-bindings.js` checks - the ten
    bindings in the map. Every key the game reads outside that map is invisible
    to it, so a control surface can be bound onto one and one press then does
    both things. Measured in a browser, each key bound from the panel and then
    held over a flight, reading the aircraft's `input` off the live model and
    the overlays off their computed `display`: `Tab` onto ROLL LEFT rolled left
    and hid the instruments; `P` onto ROLL RIGHT rolled right and paused the
    flight; `H` onto YAW LEFT yawed left and collapsed the reference list; `M`
    onto YAW RIGHT yawed right and muted; `O` onto THROTTLE UP throttled up and
    opened Settings; `L` onto THROTTLE DOWN throttled down and opened the
    element editor. All six were taken with nothing said - the row read
    `ROLL RIGHT  ·  P` and the rest in kind, with no refusal and nothing in the
    note to say the key was already spoken for. `F2` is the seventh key of the
    same kind and was not exercised, the shutter writing a file. Two listeners
    read one press and neither knows of the other - `js/main.js:758` for the
    pause, the mute, the instruments, Settings and the editor, and
    `js/aircraft.js:293` for the control surface - so the fix belongs where the
    binding is accepted rather than in either handler. Nothing in `test/`
    reaches this: `test/key-bindings.test.js` settles the menu keys deliberately
    and in the map's favour, in "the keys that walk the panel are not the map's
    to move", and says nothing about the keys that are not menu keys. The suite
    is green at 1313.
  - **Goal**: Resolve to [reserved-key-bindings.prompt.md](.claude/prompts/reserved-key-bindings.prompt.md)
  - **Note**: the two readings disagree and the prompt says so rather than
    choosing. The UI/UX request that drove the panel expected `Tab` and `P` to
    bind - over an armed row they "should be read as the key being bound (or
    refused, for one another row holds)", and that parenthetical allows refusal
    only for a key another row holds - so the binding may be deliberate. What
    is not deliberate is that it is silent: a pilot gets an aircraft that pauses
    itself when it rolls right, with nothing on the row that said so. Refusing
    the key or saying what it costs are both answers; leaving it silent is not.
  - From: UI/UX Override - a control can be bound onto a key the game already reads

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

> 184 earlier items in `TODO-archive.md`, newest last.

- [x] The widened fixture reads `[0]` off a match it never established
  - **Issue**: `test/page.test.js:793` is
    `assert.match('H - Hide Key List'.match(nameRow(widened))[0], ...)`, and
    `String.prototype.match` returns `null` when nothing matches, so `[0]`
    throws rather than asserting. The state that reaches it is the regression
    the test exists to catch: drop the flags from `nameRow()` - `name.flags`
    mistyped as `name.flag`, or hardcoded back to `''` - and
    `(?:controls?|key list)` no longer matches the capitals in
    `H - Hide Key List`, `.match()` returns `null`, and the test dies with
    `TypeError: Cannot read properties of null (reading '0')` instead of its own
    message, "and a row found by its second branch is still quoted whole rather
    than as the bare name". Measured: that exact `TypeError` is what `name.flag`
    produces. The test still fails, so nothing ships broken - what is lost is
    the sentence that says which of the two derivations gave way, on the one
    failure where the row is not quoted at all. The same `[0]` at line 860 is
    guarded, by `assert.match(both, SECOND_NAME, ...)` on line 858 establishing
    the match first, so this is the only unguarded one in the file.
  - **Goal**: Establish the match before reading it, the way line 858 does for
    line 860. Assert the row matches `nameRow(widened)` first, then read `[0]`
    off it - or hold the result in a `const`, `assert.ok` it with a message
    naming the dropped flags, and assert on `[0]` after. Either way the two
    halves of the derivation keep separate messages on every failure, which is
    what the fixture pair was added for.
  - From: Code Review Override - the helper was generalised and its comment was not
- [x] The derivation comment states a suite count the file no longer has
  - **Issue**: `test/page.test.js:778` reads "writing the capture out beside the
    name again - either half of it - passes all 1247 tests", inside a comment
    that opens in the present tense: "The derivation above is correct and,
    measured against today's name, unable to fail". The suite is 1248 and has
    been since `1.0.0-alpha.1.24.7`, whose own `CHANGELOG.md` entry records it as
    "green at 1248, one more than `1.0.0-alpha.1.24.6`". Measured both ways:
    `node --test` reports 1248 at `HEAD` and 1248 in the working tree, and the
    count of `test(` declarations in this file is identical in the two, so no
    test was added or removed this turn. 1247 was the count at
    `1.0.0-alpha.1.24.6`, before the run that wrote the sentence added the test
    the sentence introduces, so the number is the suite as it stood one test
    before the comment shipped. It is worse than stale by one: the counterfactual
    is now false rather than merely out of date, because the two fixtures stated
    directly below the sentence are the tests that fail under it. Writing the
    capture out by hand today makes `nameRow(tightened)` return the hand-written
    pattern, so `assert.doesNotMatch('X - show controls', nameRow(tightened))` at
    `:792` fails, which is the whole reason those fixtures were added. Nothing
    fails today: comments do not run.
  - **Goal**: Put the claim in the tense it is true in. Say that writing the
    capture out passed all 1247 tests before these two fixtures were added, and
    that the pair below the sentence is what catches it now. That keeps the point
    the paragraph is making, which is why a derivation that cannot fail against
    today's name still needed fixtures of its own, rather than dropping the
    measurement that makes the point. Consider carrying no number at all, since a
    bare suite count in a comment goes stale on the next test added and this is
    the file's only one. Leave the matching 1247 in the `1.0.0-alpha.1.24.7`
    entry of `CHANGELOG.md` where it is: that entry is a dated record of the state
    at the time, and the count is correct for the suite it describes.
  - From: Code Review Override - a comment measures against a suite one test smaller
- [x] **Pair Antecedent**: The entry's account of what the pair catches has a clause that does not parse
  - **Issue**: `CHANGELOG.md:25` closes its first sentence with the appositive
    "the tests that writing the capture out is what fails", which merges two
    constructions - "the tests that writing the capture out fails" and "writing
    the capture out is what fails them" - and leaves `fails` with no object, so
    the clause does not parse. What it is claiming is true: the capture written
    out in full, as `1.0.0-alpha.1.24.6` shipped it - literal `'i'` and no
    `(?:...)` group - fails both halves of the pair, measured by mutation. The
    wording is the only fault, and it has a second part: the clause calls the
    two halves "the tests" three words after `CHANGELOG.md:23` calls the block
    "the one test", where the rest of the entry says "fixture" throughout, as
    `CHANGELOG.md:36` does in "fails the tightened fixture only". A reader
    meeting "the one test ... the tests" in one breath reads a contradiction in
    the one sentence whose point is that exactly one test made the difference.
    Nothing fails: a changelog entry does not run.
  - **Goal**: Say it once, in the entry's own vocabulary - the pair of fixtures
    standing directly below the sentence is what writing the capture out fails.
    Keep "the one test" for the block, since that is the count the suite moved
    by and the sentence's whole point, and keep "fixture" for the two halves to
    match the rest of the entry. Leave every number where it is: 1247, 1248,
    and the mutation results were each checked against `node --test` and by
    mutating both halves of `nameRow()` against both fixtures, and all of them
    are correct.
  - From: Code Review Override - the release note renames the fixtures mid-sentence
- [x] Pair Antecedent 1
  - **Issue**: the appositive is gone, but the relative clause that replaced it
    attaches to the wrong noun. `CHANGELOG.md:54` now reads "the one test that
    made the difference is the pair of fixtures standing directly below the
    sentence, which writing the capture out fails", and a comma-introduced
    relative takes the immediately preceding noun phrase, which is "the
    sentence" rather than the intended "the pair of fixtures" - separated from
    it by only the participial "standing directly below". So the default
    reading is that writing the capture out fails *the sentence*. That
    misreading is not absurd here, which is what makes it reachable: the same
    entry's opening paragraph says of this very sentence that adding the test
    "did not date the sentence, it falsified it" at `CHANGELOG.md:44`, so a
    reader has already been told the sentence is a thing that fails. The item's
    own **Goal** supplied phrasing with no such gap - "the pair of fixtures
    standing directly below the sentence is what writing the capture out
    fails", where "is what" fixes the pair as the object - and the run chose a
    relative clause instead. The new entry then asserts the swap was neutral:
    `CHANGELOG.md:24` says "a relative clause carries the same claim", which
    under the default parse it does not. Nothing fails: a changelog entry does
    not run.
  - **Goal**: Make the pair the object beyond doubt, in the entry's own
    vocabulary. The cleft the item already wrote is the smallest way - "the
    pair of fixtures standing directly below the sentence is what writing the
    capture out fails" - and moving the relative off the noun it should not
    take would do as well. Then correct the `1.0.0-alpha.1.24.10` entry's
    account of its own fix at `CHANGELOG.md:24-25`, since it both quotes the
    relative clause and claims it carries the same claim; whichever wording is
    chosen, the quote beside it has to be that wording. Leave every number
    where it is: 1247, 1248, the `test/page.test.js:791` citation and the
    mutation results were each re-checked this review and are correct, and the
    suite is green at 1248.
  - From: Code Review Override - the relative clause takes the nearer noun, and the summary names the wrong artifact
- [x] The new entry's summary puts the appositive in the file it was not in
  - **Issue**: `CHANGELOG.md:10-12` opens "`1.0.0-alpha.1.24.9` corrected the
    suite count a derivation comment measured against, and closed the sentence
    it corrected on an appositive that merged two constructions". "The sentence
    it corrected" is the comment sentence in `test/page.test.js`, and that
    sentence carries no appositive: it reads "writing the capture out beside the
    name again - either half of it - passed all 1247 tests, which was the suite
    as it stood before the pair below was added. That pair is what catches it
    now" at `test/page.test.js:777-779`, which parses cleanly and is what
    `1.0.0-alpha.1.24.9` left there. The appositive was in the release note's
    own account of that correction - the sentence the item cited as
    `CHANGELOG.md:25` when the entry shipped, now at `CHANGELOG.md:53-55` and
    rewritten by this run. So a reader following the summary goes to the test
    file to find the fault and finds nothing wrong, in an entry whose whole
    subject is where a fault was. The `### Changed` bullet below it is
    correct - it names "the release note's account" in its own first words - so
    only the summary misplaces it. Nothing fails: a changelog entry does not
    run.
  - **Goal**: Say the appositive was in the entry rather than in the comment:
    that `1.0.0-alpha.1.24.9` corrected the comment's suite count, and closed
    its own account of that correction on an appositive. Keep the rest of the
    paragraph, which is accurate - the claim was right, the numbers were right,
    and the clause both failed to parse and renamed the pair.
  - From: Code Review Override - the relative clause takes the nearer noun, and the summary names the wrong artifact
- [x] Remember whether the control reference list is open
  - From: Flight Controls
- [x] Choose which controls hand the aircraft back after a level off
  - From: Flight Controls
- [x] Read tilt through the axis settings the keys are read through
  - From: Flight Controls
- [x] Rebind any control to a key of the pilot's own
  - From: Flight Controls
- [x] Rebind the keys that are not control surfaces
  - From: Flight Controls
