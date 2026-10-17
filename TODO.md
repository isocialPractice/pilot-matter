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

### Code Review Override - the reserved-key notices in the docs are held to nothing

- [ ] Five documents write the reserved-key refusal out by hand and no test
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

> 189 earlier items in `TODO-archive.md`, newest last.

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
- [x] A key the game reads for something else is still a key the map will take
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
- [x] Two of the menu keys are the map's to take, and three places say they are
  not
  - **Issue**: `Enter` and `NumpadEnter` are `MENU_SELECT_KEYS` in
    `js/menu.js:32` and are on no binding, so `rebind` in `js/key-bindings.js`
    takes both - including the `Enter` that armed the row, pressed a second
    time. Measured over `defaultBindings()`: `rebind` returns `bound` for
    `Enter` and for `NumpadEnter`, and `taken` for the other seven menu keys,
    which are refused because another row holds them rather than because they
    walk a menu. Three places state the opposite.
    `test/key-bindings.test.js:158` is named "the keys that walk the panel are
    not the map's to move" and asserts nothing about the map: its loop
    `for (const code of walking) rebind(bindings, 'yawLeft', code)` leaves
    `yawLeft` on `['NumpadEnter']`, and the two assertions after it compare
    `MENU_UP_KEYS` and `MENU_SELECT_KEYS` against written-out lists, so the test
    passes identically with the loop deleted. `MENU_DOWN_KEYS` is spread into
    `walking` and never asserted at all. `docs/controls/index.html:122` says
    "The keys that walk a menu are not among them and never move", and
    `docs/controls/control-settings.html:189` says "The menu keys are not
    rebindable and never move". The consequence both draw - that the panel stays
    reachable from any map - is true, and true for a different reason: the
    capture listener at `js/main.js:739` reads the menu's own codes ahead of the
    flight whatever the map says. The release note carried the same premise and
    has been corrected in place. The suite is green at 1314.
  - **Goal**: Settle this with the reserved-key question above rather than ahead
    of it, because its answer decides which sentence is true: if the keys the
    game reads outside the map become reserved, the menu keys belong in that
    list and all three statements stand as written; if they do not, the three
    come out and the test is renamed for what it holds. Either way, give
    `test/key-bindings.test.js:158` assertions about what `rebind` returns for
    each menu key rather than about the contents of `MENU_UP_KEYS` and
    `MENU_SELECT_KEYS`, and either assert `MENU_DOWN_KEYS` or stop spreading it
    into `walking`. A test named for a guarantee is where the next run looks to
    find out whether the guarantee holds, and this one answered that question
    wrongly for the review above.
  - From: UI/UX Override - a control can be bound onto a key the game already reads
- [x] Three keys can never be bound and three comments call it two
  - **Issue**: `BINDING_CANCEL_KEYS` is `['Escape']` and `BINDING_CLEAR_KEYS` is
    `['Delete', 'Backspace']` at `js/key-bindings.js:77` and `:78`, so three
    keys can never be on a row: `bindArmedKey` hands `Backspace` to
    `clearBinding`, which refuses every row but `RESET FLIGHT` and returns
    `needed`, so no row can hold it either. Three comments write the count as
    two. `js/main.js:869` says "a row that waits for any key at all keeps back
    exactly two - the way out of the wait and the way to clear - and a third key
    that did something else instead would be a third key nothing can be bound
    to", and `test/control-settings.test.js:956` repeats it with "a third key
    that took a picture instead"; `F2` would be the fourth. `js/key-bindings.js:74`
    says "the reason the two chosen are the two nothing here flies with" and
    then names `Backspace` in the next sentence, so a reader gathering the
    reserved keys from the prose rather than the constants misses one - which is
    exactly what the item above asks a later run to do.
    `docs/controls/control-settings.html:187` has the count right and the naming
    wrong: "Those two keys and `Delete` are therefore the three that cannot be
    bound to anything", where the sentence before it names one key and a row.
    `test/key-bindings.test.js:134` is the one place that reads both lists
    instead of a number, and it is correct. Nothing fails - comments do not run.
  - **Goal**: Say three, or say two roles without calling the next key a third.
    Which of those the author meant is theirs to pick, so pick one and write it
    the same way in all four places: `js/main.js:869`,
    `test/control-settings.test.js:956`, `js/key-bindings.js:74` and
    `docs/controls/control-settings.html:187`. The doc sentence also needs the
    keys named rather than counted, since the sentence it leans on names
    `Esc` and an action rather than two keys.
  - From: UI/UX Override - a control can be bound onto a key the game already reads
- [x] Four of the eleven menu keys are asserted by nothing in the test that was
  renamed for them
  - **Issue**: `test/key-bindings.test.js:245` builds `walking` from
    `MENU_UP_KEYS`, `MENU_DOWN_KEYS` and `MENU_SELECT_KEYS`, which is seven of
    the eleven keys a menu works with. `MENU_LEFT_KEYS` and `MENU_RIGHT_KEYS` are
    menu keys by the code's own reckoning - `isMenuControlKey` at `js/menu.js:107`
    is `isMenuKey(code) || isMenuAdjustKey(code)`, and the capture listener at
    `js/main.js:749` reads the keys it holds back through that function, not
    through `isMenuKey` - and they are neither imported at
    `test/key-bindings.test.js:41` nor reached by the loop. Measured over
    `defaultBindings()`: `ArrowLeft` and `KeyA` return
    `{ result: 'taken', conflict: 'rollLeft' }` and `ArrowRight` and `KeyD`
    return `{ result: 'taken', conflict: 'rollRight' }`, so all four behave the
    way the test's own docblock says they do and nothing establishes it. The
    docblock at `:236` counts them in - "Nine of the eleven are refused because a
    row already holds them" - and the figures are right about the code: eleven
    menu keys, nine held, `Enter` and `NumpadEnter` free. The closing assertion
    at `:272` then reads the narrower list, so "the keys that choose a row are
    the only menu keys the map can take" is a claim about eleven keys measured
    over seven. Nothing fails, and nothing would: the free filter over all
    eleven is `['Enter', 'NumpadEnter']` in that same order, so widening
    `walking` leaves the `deepEqual` passing. The completed item asked for
    assertions "about what `rebind` returns for each menu key", and four of them
    still get none.
  - **Goal**: Import `MENU_LEFT_KEYS` and `MENU_RIGHT_KEYS` at
    `test/key-bindings.test.js:41` and spread both into `walking`, which brings
    the four adjust keys through the loop that already asserts a `taken` result
    against the row that holds it. That is the whole fix - the loop needs no new
    branch, since the adjust keys take the `holder != null` path the other nine
    take, and the closing `deepEqual` keeps its current expectation. Then the
    eleven the docblock counts and the eleven the test reads are the same eleven,
    which is what a test named for a guarantee is read to settle.
  - From: Code Review Override - the cheatsheet keeps the old refusal and the adjust keys go unasserted
- [x] The cheatsheet still names one refusal, in both of the files that carry it
  - **Issue**: `CHEATSHEET.md:168` and `docs/cheatsheet.html:235` carry the same
    sentence, which enumerates what happens at a waiting row: "A key row waits
    for a key once it is chosen. A key another row holds is refused and the row
    says which row holds it; `Esc` is the way out of the wait; `Delete` leaves
    `RESET FLIGHT` on no key at all, which is the only row allowed to be on
    none." That was the complete account before this release and is now one
    refusal short of it. Measured through `bindArmedKey` over a row armed on
    `ROLL RIGHT`, each of the eight reserved keys is refused with a notice of its
    own and leaves the row waiting: `TAB IS INSTRUMENTS`, `P IS PAUSE`,
    `H IS CONTROL LIST`, `M IS MUTE`, `O IS SETTINGS`, `L IS ELEMENT EDITOR`,
    `F2 IS PHOTO` and `C IS CAMERA`. A pilot reading the cheatsheet for whether
    `P` can be bound gets a list in which only a row-held key is refused, and
    `P` is held by no row, so the sentence reads as a yes. `README.md:124`,
    `docs/controls/index.html:122` and `docs/controls/control-settings.html:185`
    were all brought up to the new behaviour this turn and these two were not,
    so the cheatsheet pair is the one place left describing the panel the release
    replaced. Nothing fails - a cheatsheet does not run. Neither file is
    generated: `tools/` holds `build-api-reference.mjs` and `serve.mjs`, and
    nothing in `tools/` or `.github/` names the cheatsheet, so both files are
    edited by hand and both need the edit.
  - **Goal**: Add the second refusal to the same sentence in both files, in the
    register the cheatsheet already uses - one clause, not the paragraph
    `docs/controls/control-settings.html` carries. Something to the effect that a
    key the game reads for itself is refused the same way and the row says what
    the key already does, with one example rather than the list of eight, since
    the eight are enumerated on the controls page and a cheatsheet that repeats
    them is a second copy to keep in step. Keep the two files' wording identical
    to each other, as they are today, and keep `docs/cheatsheet.html` in `<kbd>`
    and `<code>` markup where `CHEATSHEET.md` uses backticks.
  - From: Code Review Override - the cheatsheet keeps the old refusal and the adjust keys go unasserted
