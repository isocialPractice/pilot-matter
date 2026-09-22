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

### Code Review Override - the dead stick's vertical, and what was written about it

- [ ] The cheatsheet's glide paragraph was edited without being rewrapped
  - **Issue**: `CHEATSHEET.md:207` runs to 96 characters inside a paragraph
    whose other lines wrap at about 75. The sentence `1.18.1-alpha` replaced
    was rewritten in place and the text after it was left where it sat, so one
    line of the paragraph is a third longer than the lines above and below it.
    Nothing reads wrong - `docs/cheatsheet.html` carries the same prose as one
    line per paragraph, which is why the suite did not notice.
  - **Goal**: Rewrap the paragraph at `CHEATSHEET.md:203-208` to the width the
    rest of the file uses, changing line breaks and nothing else.
  - From: Code Review Override - the dead stick's vertical, and what was written about it

#### Resolve Issues

- [ ] Glide Climb 2
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
- [ ] Pointer Wrap 1
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

> 122 earlier items in `TODO-archive.md`, newest last.

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
- [x] **Cargo Run**: land at one strip, then at the next, against a budget
  that only spends while the engine is open, so the route flown matters as
  much as the landings made
  - From: Game Modes UI/UX `->` New Game Modes
- [x] **Search and Rescue**: find a marker placed somewhere in the world given
  only a bearing and a distance from the start, then get down beside it
  - From: Game Modes UI/UX `->` New Game Modes
- [x] Glide Climb 1
  - **Issue**: A dead stick gains height when the nose is held up. From the
    settled glide at 4153 ft and 130 kt, holding `W` and touching nothing else
    puts the aircraft at 4302 ft - 151 ft of climb on no engine, with V/S
    reading positive for nine frames at up to +6520 ft/min. Entered from a dive
    it is far larger: nose down for two seconds, then nose up, climbs 2150 ft
    at up to +29600 ft/min and finishes 297 ft above where the dive began.
    `glideDescent(pitch)` itself is sound - swept across the whole attitude
    range in the browser it never comes out negative - but it describes the
    settled pair, and `js/aircraft.js` converges airspeed at `GLIDE_ACCEL` and
    `GLIDE_DECEL` while the nose moves at the control rate, so the aircraft
    spends seconds at an attitude its speed has not caught up with. At the
    speed a settled glide holds, any nose-up past about -0.19 radians climbs.
  - **Goal**: Resolve to [glide-climb.prompt.md](.claude/prompts/glide-climb.prompt.md)
  - From: Game Modes UI/UX `->` New Game Modes
- [x] **Pointer Wrap**: The objective card's pointer row wraps to two lines at
      260 pixels
  - **Issue**: On a phone held upright the card is drawn at its `min-width` of
    260 and the pointer row has 218 pixels to write in, which `↑ LEG 1  ·
    234°  ·  8560 ft` and `MARKER  ·  045°  ·  11810 ft` both run past. Both
    wrap to two lines, 30 pixels against the 37 the stylesheet declares for
    them. Nothing is clipped and nothing is written off the side - measured at
    320x800 and 393x852, and the row is one line at 852x330 where the card has
    369 - so the card is doing what `index.html` says it does, and this
    predates the three new modes: a `LOOP` pointer is the same length. The
    verification request asks for a row that is neither clipped nor wrapped at
    260, and the stylesheet deliberately budgets for the wrap, so the two
    disagree about what correct is.
  - **Goal**: Decide which of the two holds. Either accept the wrap and say so
    where the row is specified, or shorten what the row writes at that width -
    dropping the bearing's leading zero, the distance's unit, or the label to
    its number - so it fits 218 pixels on one line. Do not widen the card:
    `min-width: 260px` at `left: 50%` is what keeps it on a 320 screen at all.
  - From: UI/UX Override - the three new game modes
- [x] The Game modes API page mis-describes the row it added and mis-reports
      the strip in the example under it
  - **Issue**: Two defects in the section `1.18.0-alpha` added, in
    `docs/api.md` and the `docs/api-reference.html` generated beside it. The
    table row at `docs/api.md:810` and `docs/api-reference.html:810` reads
    "The three that answers with", which is not a sentence and does not say
    what the three answer with - the row above it, `runPointer`, is the one
    that has the description. And the route example at `docs/api.md:921` and
    `docs/api-reference.html:883` says `down at strip` followed by
    `nextStrip(run)`, inside `if (recordLanding(run, runway))` - which names
    the wrong strip every time, because `recordLanding` increments
    `state.leg` before it returns, so `nextStrip` is already pointing at the
    next stop. A two-strip route logs "down at strip 1" for the arrival at
    strip 0, and "down at strip -1" for the one that finishes it.
  - **Goal**: Give the pointer row a description that says what the three
    answer with - they are the three `runPointer` dispatches to, one per
    objective - and read the strip in the example before the landing is
    recorded rather than after it, or name it from the `runway` argument the
    handler was already given. Both files carry the same text and both need
    it; `docs/api-reference.html` is the published page.
  - From: Code Review Override - what the new modes were written down as
- [x] The glide guarantee is written down without the qualifier that makes it
      true
  - **Issue**: `CHANGELOG.md:35` says "there is no attitude in the range the
    aircraft clamps its pitch to that holds height on no engine", and
    `docs/flight-model.html:123` says "there is no attitude that holds height
    on no engine, which is the one way a dead stick could quietly stop being
    one". Both are true of `glideDescent(pitch)`, which the suite sweeps, and
    both are false of the aircraft the release ships: **Glide Climb 1** above
    measures 151 ft of climb from a settled glide and 2150 ft entered from a
    dive. `glideDescent` describes the settled pair, and `js/aircraft.js`
    converges airspeed at `GLIDE_ACCEL` and `GLIDE_DECEL` while the nose moves
    at the control rate, so the aircraft spends seconds at an attitude its
    speed has not caught up with - which is the gap neither sentence allows
    for. A reader of either is told the mode cannot do the thing it does.
  - **Goal**: Work this with **Glide Climb 1** rather than apart from it, since
    the two answers are one decision. If the glide is made a descent in the
    unsettled case too, both sentences become true and neither needs touching -
    say so. If it is not, qualify both to the settled glide the pure pair
    describes, and say what the aircraft does on the way to it. Do not leave
    them as they are: this is the shape of the `1.17.2-alpha` entry that was
    reopened for claiming what its release did not carry.
  - From: Code Review Override - what the new modes were written down as
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
