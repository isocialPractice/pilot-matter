# TODO

Roadmap for Pilot Matter, a browser-based Three.js flight simulator with no
build step. Items under `## Current` are the next work queue; the remaining
level 2 sections group planned work by theme and state the version update
that applies when their items are completed.

Within a section, an item is listed before the items that need it, and an item
that needs another names it on an **After** line; work the one it names first.
An item titled **Write plan** or **Implement plan** is too large for one run and
is worked as a plan, written to `.claude/prompts/` and implemented a phase at a
time, by the plan items rule in `.claude/constants.md`.

## Current

The work queued for the next run, copied here from the roadmap sections below.
Each item carries a nested `From:` line recording the section it came from, so
its context survives being archived.

- [ ] Write the request against the automation tool that `### Pruning the
  Roadmap` says to queue in place of a seventh pruning item
  - The record under that heading settled this on 10.29.2026: every run that
    completes a queued item leaves its roadmap original behind, so pruning is a
    pass that comes round rather than a job that finishes, and the fix belongs
    in the tool rather than in this file. The 10.31.2026 run met it three more
    times - the two mountain footprint items and the weather lift - and closed
    each original inline rather than writing an eighth, ninth and tenth pruning
    item for them.
  - What the request has to say: section 5 of the instructions copies an item
    into `## Current` and leaves the original in place, `todo.mjs` carries no
    notion of item identity across those two copies, and no rule covers the
    original once the copy archives. The archive already shows the cost - grep
    it for `**Mountain** length` and it answers twice, which is one item
    recorded as two pieces of finished work.
  - It is a request rather than a change: `MCP_TODO_HOME` is the user's own
    automation, and what shape the fix takes there is theirs to decide. Write
    it where the user will find it and name both halves - the copy that is left
    behind, and the archive that then double-counts it.
  - From: Documentation & Polish `->` Pruning the Roadmap

### Code Review Override - the derived cut nothing holds

#### Resolve Issues

- [ ] Derived Cut 1: the kept length can be written back as a figure of its own
  and the suite stays green
  - **Issue**: the module change is right and does what the item asked -
    `ELLIPSIS` names `'...'` once, `NAMED_ADDRESS_KEPT` reads as
    `NAMED_ADDRESS_LIMIT - ELLIPSIS.length`, and `namedAddress` appends that
    same constant. What is not held is the derivation itself. The line added
    to `test/assets.test.js:530`,
    `assert.equal(NAMED_ADDRESS_LIMIT - NAMED_ADDRESS_KEPT, '...'.length)`,
    sits three lines under `assert.equal(NAMED_ADDRESS_LIMIT, 120)` and
    `assert.equal(NAMED_ADDRESS_KEPT, 117)`, so given those two it reads
    `120 - 117 === 3` and can never be the assertion that fails - it is a
    tautology, not a hold. Run as a mutant: `NAMED_ADDRESS_KEPT` put back to a
    bare `117` leaves the whole suite at 2434 passing and 0 failing. The three
    mutants the item's **Settled** note reports as caught - a two dot
    ellipsis, the kept length restated as 116, the limit moved to 200 - are
    each caught by the two absolute pins that were already there before this
    run, not by the line added to hold the derivation. So the drift the item
    was raised to close is open in its new form: the figure is one decision
    today and nothing notices it becoming two again.
  - **Goal**: hold it the way the precedent it cites is held, and the way this
    file holds what a runtime cannot show. `test/footprints.test.js:529`
    asserts `SOFT_EDGE` against `FEATHER_SHARE / 2` - the imported constant,
    not a restated figure - which is only possible because both are exported;
    export `ELLIPSIS` and assert `NAMED_ADDRESS_KEPT` off
    `NAMED_ADDRESS_LIMIT - ELLIPSIS.length` so the test stops restating the
    mark as its own `'...'` literal, which is the second copy the item set out
    to remove. That still cannot tell a derived 117 from a written one, since
    the two are the same value at runtime, so add the pin this project already
    uses for exactly that: `test/assets.test.js:35` has a `source` helper and
    `:564` already matches `source('asset-fit.js')`, so an `assert.match` on
    the derivation line catches the revert the mutant above walks through.
    Either make the tautology at `:530` carry weight through the exported
    constant or drop it - as it stands it reports a hold the suite does not
    have.
  - From: UI/UX Override - the dock's scroll, read on a phone
- [ ] Derived Cut 2: the settled note credits the new line with a catch it
  cannot make
  - **Issue**: the **Settled** note on `Derived Cut` in `## Complete` says
    `test/assets.test.js` "gained the one line the figures had never said out
    loud ... which is what catches a kept length written back as a figure of
    its own". That is the one mutant the line cannot catch, and the suite is
    green through it, as `Derived Cut 1` shows. The archive is where this
    project reads its own precedent back - this very item cites
    `Held Feather 1` in `TODO-archive.md` as the convention it was following -
    so a note claiming a hold that is not there is read later as a hold that
    is, and the next run to touch these figures will trust it.
  - **Goal**: correct the clause to say what the line does, which is state the
    relationship between the two figures rather than catch a change to it, and
    let whatever `Derived Cut 1` lands be what the note credits. Leave the
    rest of the note as it is - the module description, the unchanged exports
    and the `docs/terrain.html:320` sentence are all accurate, that last one
    checked against the file and still reading "named as far as its first 117
    and an ellipsis". `CHANGELOG.md` needs no edit: it attributes the six
    catches to "the test named for it" and claims the suite-was-green-before
    property only for the first three, which is true as written.
  - From: UI/UX Override - the dock's scroll, read on a phone

## Game UI/UX

Player-facing interface and experience around the flight model, beyond the
raw instrument readout. Completing items in this section applies a minor
version update.

## Game Modes UI/UX

Flights that are played rather than flown: a world, an objective, and the
stages the objective is set at. Completing items in this section applies a
minor version update.

### New Game Modes

Five new modes, in the order they are best built: racing, which reuses the
loop course's gates; trick flying, which needs only the flight model; fighters,
which need opponents that fly themselves; then the open world, and the quest
mode on top of it, both worked as plans. An item that changes the builder - the
track builder, the trick planes' cards - is worked with the
`interactive-build-mode` skill, as `.claude/constants.md` says.

- [ ] **Racing**: a game mode of laps round a closed course of pylons and
  gates, flown against the clock and a ghost of the best lap - a missed gate a
  time penalty, a pylon touched a crash - its stages courses of rising
  difficulty, and its best laps kept as the other modes' best times are
  - Built on the gates `js/rings.js` and Flying through Loops already fly, and
    on `js/best-times.js`. The ghost is the best lap's path, recorded at a
    fixed rate and drawn as a faint copy of the aircraft.
- [ ] **The track builder**: a TRACK tool in the builder - a course drawn as a
  path over the world, gates and pylons placed along it and turned to face it,
  a start and finish line, and the laps a race is - saved with the world in its
  file, so the racing mode flies a track built by hand as well as its own
  courses
  - The course is a placement type, learned everywhere the skill's placement
    list says, and the first piece of the game mode builder under
    `### Interactive Build Game Mode`, whose plan reuses it.
  - After: Racing
- [ ] **Trick planes**: an aerobatic monoplane, short-winged and fast-rolling,
  and a stunt biplane with ailerons on all four wings, in `js/planes.js` - each
  with a symmetric wing, so inverted flight holds as upright flight does, and a
  `tricks` list of the figures its controls are mapped for, its roll and pitch
  rates to match
  - Original and generic, named for what they are, built from the same recipe
    parts as the five planes already there.
- [ ] **Trick pilot**: a game mode of figures flown and judged - loop, roll,
  barrel roll, Immelmann, split S, Cuban eight, hammerhead, snap roll, knife
  edge and inverted pass - each recognised from the flight's path and attitude
  and scored for how round, how level and how straight it was flown, its stages
  sequences of figures in rising categories
  - A pure recogniser in a new `js/tricks.js` cuts the attitude history into
    lines, loops, rolls and spins and matches them against each figure's
    pattern, held in Node by a recorded or written flight of every figure.
  - After: Trick planes
- [ ] **Trick planes in Insert Plane**: the trick planes as cards in Insert
  Plane's SELECT PLANE under an AEROBATIC heading of their own, each card
  listing the figures it is mapped for, and chosen for a world as any plane is
  - After: Trick planes
- [ ] **Tricks on a key combo**: `Ctrl+Shift+1` to `Ctrl+Shift+9` each fly one
  figure from the trick plane's `tricks` list - the controls driven through the
  figure, so the flight model flies it rather than an animation laid over it -
  any flight key handing control back, and every combo rebindable in the
  control settings
  - Read by `event.code`, `Digit1` to `Digit9`, since Shift turns the key
    itself into `!` to `(`. `Ctrl` with a digit alone switches browser tabs,
    so every combo keeps Shift. A test holds the combos off a table of the
    browsers' own shortcuts - `Ctrl+R`, `Ctrl+Shift+R`, `Ctrl+T`,
    `Ctrl+Shift+T`, `Ctrl+N`, `Ctrl+Shift+N`, `Ctrl+W`, `Ctrl+Shift+W`,
    `Ctrl+Shift+I`, `Ctrl+Shift+J`, `Ctrl+Shift+C` and `Ctrl+Shift+Delete`
    among them - and `js/reserved-keys.js` learns them, so a flight control
    cannot be bound onto one.
  - Shift is throttle up and Ctrl is throttle down in the default key map, so
    holding the two to reach a digit moves the throttle both ways. Whatever
    they changed between the first modifier going down and the digit is given
    back when the combo fires.
  - After: Trick pilot
- [ ] **Tricks flown by hand**: the recogniser reading figures flown with the
  ordinary controls, which are improved for them - rudder enough to hold a
  knife edge, a snap roll from full rudder and elevator together, and a roll
  rate the trick planes' figures can be flown at - so a figure counts whether
  a key combo flew it or the pilot did
  - After: Trick pilot
- [ ] **Trick combos**: tricks finished within a set time of each other -
  under a second to start, set in the control settings - chained into a combo,
  the chain's length multiplying each trick's score, the HUD showing the chain
  and its multiplier as it grows and the total when it breaks
  - Counts tricks from a key combo and flown by hand alike. A test feeds the
    chain timed tricks either side of the window.
  - After: Tricks on a key combo, and Tricks flown by hand
- [ ] **Piston fighter**: a single-seat piston-engine fighter in the look of
  the Second World War - elliptical wings, a long nose over its engine, a
  framed canopy and a tail wheel - in `js/planes.js`, with figures of its era:
  slower and lower than the jet, and quick in the turn
  - Original and generic, named for what it is, with no national markings.
- [ ] **Jet fighter**: a twin-engine, twin-tail, swept-wing jet fighter in the
  look every film about fighter pilots gives one - two canted fins, intakes
  under a bubble canopy, grey all over - faster than the jet already there,
  with an afterburner at full throttle
- [ ] **Spacecraft**: a small single-seat spacecraft - a delta-winged dart
  with a glowing engine - flown by the same flight model with figures past any
  plane's, its thrust enough to climb straight up
  - The flight model has no space above the air, so it flies in the world's
    air like every plane; leaving the air is a later item's.
- [ ] **Dogfight**: a game mode against opponents - bandits flown by a simple
  pilot that patrols, pursues with lead and lag and breaks away when it is
  hit - shot at with guns through a gunsight that leads the target, hits read
  against each aircraft's bounds, and stages of one bandit, two, a flight of
  four and an ace, flown in the piston fighter, the jet fighter or the
  spacecraft against their own kind
  - The bandits are pilots of the Pilot API, `createPilot` with the keyboard
    off and their input written each frame, which makes the mode a worked
    example of flying the flight model from code. The pursuit and the hits are
    a pure `js/dogfight.js`, held in Node.
  - After: Piston fighter, Jet fighter and Spacecraft
- [ ] **Write plan: Open world**: write
  `.claude/prompts/open-world-plan.prompt.md`, the plan for a mode where the
  pilot starts on foot, finds a plane, flies it, lands where they like and
  explores on foot again
  - Plan only: the run that writes this plan adds no Implement plan item. Its
    implementation is queued once the user has read the plan.
  - What the plan has to settle:
    - The person: a man or a woman, chosen in the settings, modelled at the
      quality of the first 3D home consoles - a few hundred triangles, flat
      colours, no textures.
    - Finding a plane parked on the world, getting in and out, the camera on
      foot, and what becomes of a plane left behind.
    - Walking through the Pilot API rather than beside it, a deliberately rough
      fit: a person as a pilot with no lift and its ground contact held, a walk
      of about 1.4 m/s and a run under 4, its heading turned by the controls
      and its pitch and roll taken from the ground under it rather than flown,
      so a hillside tilts it as it tilts the ground and never tips it over.
    - That walk documented in `docs/api.md` as a worked example of the API used
      for something other than flying.
    - Three to five phases, each a run's worth.
- [ ] **Write plan: Quest**: write `.claude/prompts/quest-plan.prompt.md`, the
  plan for a mode built on the open world, over ready-built towns and airports:
  the pilot lands at one, collects something in town A, carries it to town B,
  and each delivery is a numbered stage complete
  - Plan only, as Open world's is. Its implementation waits for open world's.
  - What the plan has to settle:
    - The world: towns of Insert City's buildings and roads and airports of
      runway templates, built with the builder and shipped as a starter world.
    - Stages numbered from 1 with no ceiling, each a pickup in one town and a
      delivery to another, taking further what Cargo Run already flies.
    - Driving, a mode of its own rather than a game mode, entered by getting
      into a vehicle: a car, a pickup and a van, original and low-poly, driven
      through the Pilot API, another deliberately rough fit. The controls
      never raise a vehicle; its height is set each frame to the ground under
      it plus its ride height, and its pitch and roll follow the road, so it
      stays flush to it.
    - Crashing switched off while driving, unless a vehicle is more than a set
      distance off any road - 100 yards (91 m) to start - with the check on by
      default, and its switch and distance in the settings.
    - Dirt roads among Insert City's road pieces, drawn in earth colours,
      drivable, and counted as road by that check.
    - Three to five phases, each a run's worth.
  - After: Write plan: Open world, whose walking and boarding it builds on

### Improve Existing Game Modes

#### Runway Landing

#### Flying through Loops

#### Canyon Run

## World & Environment

Grow the procedural world beyond the single terrain tile. Completing items
in this section applies a minor version update.

## Environment Design

Turn the fixed terrain pass into placeable, range-configured elements, in
the spirit of the lightest-weight level editor that could work, where every
element is rendered by algorithm instead of placed as an asset. Completing
items in this section applies a minor version update.

## Simulator API

Open the simulator up as two importable halves, so the flight model and the
world can each be used without the other. Completing items in this section
applies a minor version update.

## Simulator Configuration

Make the simulator start state and its options data the pilot can see and
change, rather than constants held in the flight code. Completing items in
this section applies a minor version update.

## Flight Controls

How the aircraft is flown rather than what it is flown over: what the keys
mean, how far the attitude may go, and which of that a pilot is allowed to
change. Completing items in this section applies a minor version update.

## Interactive Build Mode

The twelve-tool editor laid over the world, where ground is shaped by pointing
at it rather than by stepping numbers in a list. Every tool writes a placement,
so a built tile is a description like any other, generated by the same
algorithm a preset is and repeated as the pattern the endless world is drawn
from. Completing items in this section applies a minor version update.

The plan these items were broken out of is
`.claude/prompts/interactive-mode-plan.prompt.md`, named here rather than
linked as a goal because a completed item takes its goal file with it when it
is archived - and `.claude/` is untracked, so that copy is the only one. Read
it for what a tool is for and how its panel is generated; the items below are
the order the work unblocks itself in.

Work these items with the `interactive-build-mode` skill,
`.claude/skills/interactive-build-mode/SKILL.md`: the builder's module map, how
a tool, a dock panel and a placement type are added, the checks every change is
held to, and the traps that cost the most time. `.claude/constants.md` has
every run whose `## Current` items came from this section, or from a level 3
section under it, read the skill first.

The level 3 sections are in the order they are best worked: the gaps the last
plan left; the editor's own habits, so everything after them can be undone;
sculpting, which the worlds after it are shaped with; the starter worlds;
export, once there is that much to export; and the game mode builder, which
needs all of it.

### Closing the Builder's Gaps

What the Post Interactive Build plan finished without, each named in its
record.

- [ ] **Kept builds survive a reload**: the world ACCEPT AND EXIT keeps - its
  placements, start point, plane and the assets it uses - written to IndexedDB
  beside the asset library and put back when the page opens, so the world
  flown after a reload is still the one built
  - Today it lives only in the page, and closing the tab loses it unless it was
    saved to a file. Keep one world, the last kept, under a key of its own in
    the `pilot-matter` database `js/asset-store.js` opens, read before the
    first tile is drawn; the Settings environment row says the world flown is
    the kept one, with a way back to the preset.
- [ ] **The Matter API stands objects**: `createEnvironment` and
  `createTiledEnvironment` in `js/api/matter.js` stand a world's objects and
  roads as the simulator does, and answer `obstacleTop` for them, so a host
  loading a built world gets its buildings as well as its ground
  - Today the API draws a world's ground and leaves its objects out, so a
    host's aircraft flies through a city it cannot see. Reuse
    `standingObjects` and `objectGroup`; an `objects: false` option keeps
    today's drawing for a host that stands its own. A worked example in
    `docs/api.md` loads a built world's file under an external aircraft.
- [ ] **Select picks a roof**: a click on an object picks it by the object's
  own bounds under the pointer rather than by the ground point the pointer's
  ray meets, so a tall building is picked where it is seen
  - The ray ends on the ground today, so a click on a tower's upper floors
    picks whatever stands on the ground behind it, or nothing. Test the ray
    against each object's turned and scaled `recipeBounds`, nearest first,
    before the ground.
- [ ] **Every plane opens flying**: each plane in `js/planes.js` starts a
  flight at the start point above its own stall speed and trimmed level,
  rather than the jet opening slightly stalled
  - Give each recipe its own start speed and trim, held by a test that steps
    every plane a few seconds from the start point and expects it neither
    stalled nor sinking.
- [ ] **A pick reaches a summit narrower than the sampling**: `pickGround`
  finds the ground under the pointer on a region too small to raise more than
  one vertex, rather than stepping over it onto the flat ground beyond
  - The march steps half a cell, 40 units. A 200 unit extrusion is raised at
    one vertex of the 80 unit grid, so its sides fall about 5 units per unit
    while a ray at 55 degrees comes down 1.4: a ray aimed a pixel off the peak
    meets the flank 0.8 units from it, and the first step jumps from 3.5 units
    in front of the peak to 19 units past it. Driven in Chromium on 11-08-26,
    one 200 unit block alone on a blank canvas: the pick answers the peak when
    aimed at its exact point and answers the ground 450 units beyond for every
    pixel either side, so `EDIT EXTRUSION` cannot be pointed at its top.
    `.tmp/ui-ux/t28/top-and-rim.log`, phase C, is the measurement, and the 320
    unit block beside it in the same log is reached at every try.
  - The ceiling boundary is settled and is not this: a ray aimed at the peak
    is answered at the entry, which is what `PICK_SURFACE` is for. What is
    left is the step. Refining between the entry and the first step, or
    stepping by a share of the ray's own descent rather than of a cell, are
    the two shapes - and the cost is paid on every pointer move, since the
    hover outline asks the same question, so measure before choosing.

### Editor Workflow

The habits every game engine's level editor shares, which the builder still
lacks.

- [ ] **Undo and redo**: `Ctrl+Z` takes back the last change to the world - a
  placement added, moved, stepped or erased, a start point set or a plane
  chosen - and `Ctrl+Shift+Z` or `Ctrl+Y` puts it back, with UNDO and REDO on
  the dock's bar
  - A capped history of the session's world, a step pushed when an edit is
    accepted rather than at every move of a drag, so one gumball drag is one
    step; cleared when a world is loaded or the canvas opened afresh. A test
    walks a session through add, move, erase, undo and redo and expects each
    world back as it was.
- [ ] **The outliner**: a folding OUTLINER section in the dock listing every
  placement by name and type in the order drawn, where a row selects its
  placement, renames it, hides it from the canvas while building, or locks it
  against Select and Erase
  - Hidden and locked are building aids: a hidden placement is still flown,
    and both are saved in the file so a reopened world keeps them.
  - After: Undo and redo, so a rename or a lock is a step like any other
- [ ] **Select more than one**: `Shift+Click` adds a placement to the
  selection or takes it out, a drag on empty ground draws a marquee that
  selects what it reaches, and the gumball moves, turns and scales the
  selection about its middle as one
  - The dock shows the rows the selection's placements share, a change applied
    to each. Erase and the outliner act on the whole selection. Shift already
    places a road free under Insert City; the two never meet, since Select is
    its own tool.
  - After: The outliner
- [ ] **Duplicate, copy and paste**: `Alt` held while dragging the gumball
  leaves a copy behind, as engines' editors do; `Ctrl+C` and `Ctrl+V` copy the
  selection and paste it under the pointer; `Delete` takes the selection away
  - A copy is a new placement with an id of its own and its name numbered; a
    pasted road snaps as a placed one does.
  - After: Select more than one
- [ ] **Snapping**: a grid and an angle the gumball's moves and turns snap to,
  switched on the dock's bar with their sizes in the builder settings - 10 m
  and 15 degrees to start - the grid drawn faintly round the pointer while it
  is on
- [ ] **Frame the selection**: `F` turns and moves the builder's camera to
  frame the selection, or the whole world when nothing is selected, as
  engines' editors do
  - Check `F` against the key map and the reserved keys first: the builder
    reads its keys only while it is open, but a key the flight binds must not
    mean two things.

### Sculpt Environment

Shaping the ground by brush and by shape, the way a game engine's landscape
tools do. Every stroke is a placement like the rest - a tool, a path or a
region, and a brush - replayed in order over the ground, so a sculpted world is
still a description generated by algorithm and repeated on every tile. The first
three items build the tool group, its brush and its rows in the dock, and every
tool after them needs all three; the tools are in the order they are most used.

- [ ] **The sculpt tool group**: a SCULPT tile in the palette whose nested
  tools open in a flyout beside it - from a mark on the tile's corner or a long
  press, as engines' and paint programs' toolbars do - the tile showing the
  last tool chosen; and the dock's SCULPT panel leading with the same tools as
  icon cards in folding groups (Shape, Carve, Weather, Region), so a tool is
  chosen from either side
  - A new placement type, `sculpt`, of a tool, its path or region, its brush
    and its config, replayed in the order placed after the elements the ground
    is built from and before objects stand on it, so a building stands on the
    sculpted ground. Every handler of placements learns it, as the skill's
    placement list says.
  - Each nested tool has a mark of its own under `assets/builder/`, drawn as the
    palette's are, and a mode type, `Sculpt terrain<raise>` and the rest.
- [ ] **The sculpt brush**: radius, strength, falloff (smooth, linear, sphere
  or tip) and spacing, drawn on the ground as two rings under the pointer - the
  brush's reach and where its falloff starts - with `[` and `]` resizing it,
  `Shift+[` and `Shift+]` stepping its strength, `Ctrl` held inverting the tool
  and `Shift` held smoothing, as engines' landscape tools do, and a pen's
  pressure scaling the strength where the pointer reports one
  - The ground is sampled every 80 m, so a brush narrower than that reaches no
    sample at full strength; the radius is held to at least one sample, and its
    weight measured against the sampling rather than its own width.
  - After: The sculpt tool group
- [ ] **Sculpt rows in the dock**: the brush's rows under the tool cards, then
  the chosen tool's own, generated from ranges as every panel's are and gated
  with `when`; and a stroke picked by Select showing the rows it was made with,
  so stepping one sculpts the ground under it again
  - After: The sculpt brush
- [ ] **Raise and lower**: the brush lifts the ground it passes over by its
  strength, and lowers it with `Ctrl` held - the tool the others are measured
  against
- [ ] **Smooth**: the brush averages the ground under it toward its
  neighbours, taking out ridges and steps without moving its mean height, and
  `Shift` held reaches it from any other tool
- [ ] **Flatten**: the brush levels the ground to one height - the height
  under the stroke's first point, or one typed or picked from the ground -
  blended into the ground round it by the falloff
- [ ] **Dig**: a region dug into a pit of a set depth, with a flat floor and
  walls at a set slope, and the choice to fill it with water to a set level
- [ ] **Canyon**: a path drawn on the ground carved into a channel - its floor
  width, depth, wall steepness and how far its walls wander - the floor falling
  gently along the path
  - The `canyon` element carves a path it chose itself; this carves one drawn
    by hand, with the element's `carveProfile` and `widenPath`, so the two read
    alike.
- [ ] **Ridge**: a path raised into a crest - its height, how steep its flanks
  and how sharp its top - the canyon's inverse
- [ ] **Slope**: a ramp between two points clicked, the ground between them
  graded evenly from the first height to the second over a set width and
  blended into the ground beside it, as engines' ramp tools do
- [ ] **Hills**: a region filled with rolling hills - how many, their heights
  and widths as ranges, and a seed - lower, rounder and more of them than
  Mountain's one peak
- [ ] **Plateau**: a region raised flat-topped to a set height, with steep
  walls and a scree slope at their feet - a mesa, or a shelf on a mountainside
- [ ] **Terrace**: the ground under the brush stepped into level benches of a
  set height, its sharpness running from soft contours to cut steps
- [ ] **Crater**: a click making a bowl of a set width and depth with a raised
  rim and its spoil thrown out round it, under a seed so no two are alike
- [ ] **Cliff**: a line drawn on the ground made into a drop of a set height,
  the high side kept and the low side cut away
  - The ground is sampled every 80 m, so a cliff is as sheer as one sample's
    step; the panel says so rather than promising a vertical face.
- [ ] **River bed**: a path carved into a bed that falls along its length,
  filled with water and banked with sand, so a river is one stroke rather than
  a canyon, a water stroke and a sand stroke
  - After: Canyon, whose carve it reuses
- [ ] **Noise**: the brush roughening the ground with fractal noise - its
  scale, octaves, height and seed - for ground that reads as weathered rather
  than smoothed
- [ ] **Thermal erosion**: the brush slumping every slope steeper than a set
  angle of repose, ground moving downhill until it rests, over a set number of
  passes
- [ ] **Hydraulic erosion**: a region rained on - drops running downhill,
  cutting gullies and laying sediment in the valleys - for a set number of
  drops under a seed, bounded so one stroke finishes in a second or so
  - The costliest tool: work it once per stroke over the stroke's region and
    keep the answer, rather than raining again for every tile.
  - After: Thermal erosion
- [ ] **Dunes**: a region of sand ridged across a wind heading - the dunes'
  spacing, height and how far they wander - laid with sand as it is drawn
- [ ] **Grade to a road**: a road or runway over uneven ground, with the
  ground under it levelled along its length and sloped into the ground beside
  it at a set angle, as engines' landscape splines do, so a road no longer
  drapes over every bump
  - Pick the road, then the side slope; the graded ground moves with the road
    while it is moved.
- [ ] **Pinch and sharpen**: the brush drawing the ground toward its middle
  and sharpening the peaks and ridges it passes over, for crags no smoothing
  tool can make
- [ ] **Smudge**: the brush dragging the ground it starts on along the stroke,
  as a paint program's smudge drags colour
- [ ] **Stamps**: a library of landforms made by algorithm - a volcano, a
  butte, an atoll, a dune field and a crater field - placed by a click and
  scaled, turned and lifted by the gumball
- [ ] **Coastline**: a region kept as land and the ground beyond it lowered
  under the sea, with a beach of a set width falling to the water and sand laid
  on it, so an island is one stroke
- [ ] **Copy, paste and mirror ground**: a region's ground copied and pasted
  elsewhere, turned, or mirrored across a line, as engines' region tools do
  - After: Duplicate, copy and paste, under Editor Workflow, whose keys it
    shares

### Starter Worlds

Worlds shipped with the simulator as environment files, built with the
builder's own tools, so a pilot has something to fly and to take apart on the
first day - and the quest mode's towns and airports are ready for it.

- [ ] **A world's own settings**: a WORLD section of the SAVE / LOAD dock
  setting the time of day a world is flown at and whether the day turns, its
  weather, its fog and its sea level, written to the environment file and
  applied when it is flown
  - Today these come from the pilot's settings alone. A world naming one
    outranks the setting for that world, and the Settings screen says so on
    each row it overrides.
- [ ] **Starter worlds on SAVE / LOAD**: a STARTER WORLDS list on the SAVE /
  LOAD dock and the Settings environment rows, reading environment files
  shipped under `worlds/` - each with its name, a line saying what it is and a
  picture - and loading one as a file the pilot chose would load
  - The files are tracked, built and saved by the builder itself, and held by
    a test that reads every one through `readEnvironmentDocument` without a
    refusal.
  - After: A world's own settings
- [ ] **Valley airfield**: a starter world of an airfield in a river valley,
  a town of a dozen buildings and its roads beside it, fields of grass and
  paint, and hills all round
  - After: Starter worlds on SAVE / LOAD
- [ ] **Coastal towns**: a starter world of two towns on a coast, each with an
  airstrip, a road between them and islands off the shore - the ground the
  quest mode's first stages are flown over
  - After: Starter worlds on SAVE / LOAD
- [ ] **Mountain pass**: a starter world of a high airfield, a canyon through
  a range and a valley strip beyond it, for the canyon and the dead stick
  flying
  - After: Starter worlds on SAVE / LOAD

### Export Formats

A built world written out in formats other programs read, so it can be
finished, rendered or played elsewhere - a game engine above all. Each export
is written in the page from what the world is drawn with, and never sent
anywhere.

- [ ] **Export the world as glTF**: EXPORT GLB on the SAVE / LOAD dock writing
  the built world as one binary glTF 2.0 file - the ground of the canvas's
  extent in its covers' and paint's colours, its water, runways, roads,
  objects and the pilot's own models - through three's `GLTFExporter`, each
  piece a named node (`ground`, `water`, `runway/<name>`,
  `objects/<prefab>/<n>`) and the objects of one recipe sharing one mesh
  - glTF is metres with +Y up by its own definition, which is what the
    builder draws in, so nothing is converted. Blender and Godot open it as it
    is, Unity through its glTF package, and Unreal Engine 5 through its glTF
    importer.
  - Held by reading the file back with `GLTFLoader` and comparing its nodes
    and triangles with the world's, and by the Khronos glTF Validator where it
    is to hand.
- [ ] **Export the ground as a heightmap**: EXPORT HEIGHTMAP writing the
  ground as a 16-bit greyscale PNG and a raw `.r16`, with a JSON sidecar of the
  metres per sample, the lowest and highest heights and the scale an engine's
  landscape is given to rebuild it; and the covers - grass, sand, snow, water
  and paint - as one weight-map PNG to a layer, for an engine's landscape paint
  layers
  - Sized to a resolution engines' landscapes take - Unreal's 505, 1009, 2017
    or 4033 square, Unity's 513, 1025, 2049 or 4097 - chosen on export, the
    ground resampled to fit. A canvas writes 8 bits, so the 16-bit PNG is
    written chunk by chunk, deflated with `CompressionStream`.
  - Held by reading the PNG back - its header, its depth and samples across
    it - against the ground.
- [ ] **Export the placements**: EXPORT PLACEMENTS writing every object, road
  piece, runway and the start point as JSON and CSV - its name, prefab or
  asset, position, heading and scale - in the frame the chosen engine uses:
  Unreal's centimetres with +Z up, Unity's metres with +Y up on its
  left-handed axes, or glTF's own, so a host can stand its own models where the
  builder's stood
  - A test turns a placement into each frame and back again.
- [ ] **Export for a game engine**: an EXPORT FOR ENGINE step on the SAVE /
  LOAD dock choosing Unreal Engine, Unity, Godot or Blender, writing the glTF,
  the heightmap, its weight maps and the placements at that engine's
  resolutions and in its frame, into a folder the pilot picks - one download to
  a file where the browser has no folder picker - with a short `README.txt` of
  the import steps for that engine
  - After: Export the world as glTF, Export the ground as a heightmap, and
    Export the placements
- [ ] **The export guide**: a docs page, `docs/export.html`, walking through
  the import into each engine on a placeholder world - Unreal Engine 5 (the
  glTF importer for the meshes, a Landscape imported from the `.r16` at the
  sidecar's scale, and the placements stood by a short editor script), Unity
  (its glTF package and a Terrain import), Godot 4 and Blender - linked from
  the features page
  - After: Export for a game engine

### Interactive Build Game Mode

A sibling to the builder where a new game mode is made rather than a world: a
world chosen or built, the objective's pieces placed on it, its stages set, and
the mode saved and played from GAME MODES. It is too large for one run, so it
is worked as a plan, by the plan items rule in `.claude/constants.md`.

- [ ] **Write plan: Interactive Build Game Mode**: write
  `.claude/prompts/game-mode-builder-plan.prompt.md`, the plan for a GAME MODE
  BUILDER beside the builder, where a mode is made, saved to a file and played
  - What the plan has to settle:
    - Where it opens - the builder's palette, the GAME MODES menu, or both -
      and how a mode's world is chosen: a preset, the kept build, a file, a
      starter world, or one built on the spot with the builder's own tools.
    - The objective's pieces as placements - gates and rings, checkpoints, a
      landing target, pickup and drop points, a search marker, corridor walls
      and a survey landmark - reusing the objectives `js/game-modes.js`
      already runs rather than inventing new ones, and the track builder's
      course.
    - A mode's stages and what each is passed or failed on: its time, its
      budget, its engine live or dead, and its weather and time of day.
    - The game mode file: a format of its own beside the environment file,
      with a schema, carrying its world or naming it, read back whole or
      refused with its first problem named as the environment file is.
    - Where a made mode is played: a CUSTOM heading under GAME MODES, its best
      times kept as the built-in modes' are.
    - Export, as far as it goes: the mode and its world as glTF, every
      objective piece an empty named node carrying its settings in glTF
      `extras`, beside the game mode file, so an engine can rebuild the mode.
      Blender and Godot keep `extras` on import; the plan finds out what
      Unreal's importer keeps, and carries what it drops in the placements
      export instead.
    - Three to five phases, each a run's worth, in the order they unblock each
      other.
  - After: Export for a game engine, under Export Formats, and The track
    builder, under `Game Modes UI/UX`, whose course tool it builds on
- [ ] **Implement plan: Interactive Build Game Mode**: implement
  `.claude/prompts/game-mode-builder-plan.prompt.md` a phase at a time, by the
  plan items rule in `.claude/constants.md` - its session recorded in the plan
  when it is first queued, one phase to a run with the `handle-big-tasks`
  skill, no code review until its last phase lands, then a review in a session
  of its own from the context file that last phase writes
  - Make the built game mode and its world exportable to a game engine, as the
    plan settles it.
  - After: Write plan: Interactive Build Game Mode

## Post Interactive Build

Polish for the interactive build mode, and the three things it was missing: a
plane and a start point of the world's own, a city, and a way to save a built
world to a file and load it, with models of the pilot's own. Completing items
in this section applies a minor version update.

The plan these items were broken out of is
`.claude/prompts/post-interactive-build-plan.prompt.md`, named here rather
than linked as a goal because a completed item takes its goal file with it
when it is archived - and `.claude/` is untracked, so that copy is the only
one.

## Documentation & Polish

Keep the docs accurate and improve first-run experience. Completing items
in this section applies a patch version update.

### Pruning the Roadmap

Section 5 of the automation copies a roadmap item into `## Current` and leaves
the original where it was, so a section goes on listing work the repository has
long since built. The 10.25.2026 pass read the five sections that were in that
state - `## Flight Controls`, `## Simulator Configuration`,
`## Environment Design`, `## Simulator API` and `## World & Environment` - and
nothing built is left listed under any of them: `## Environment Design` and
`## World & Environment` hold the outstanding work, and the other three hold
nothing at all, keeping their headings and opening paragraphs as the record of
that area of work.
No figure for the queue is kept in this paragraph on purpose: a count of a
moving queue is stale by the time anybody reads it, so
`node todo.mjs --pending` is the thing to ask rather than a number written
down here.

Pruning is one item per section because the judgment is per item: each has to be
read against the source before it is called finished, which is a different
question from doing the next piece of work and should be answered deliberately
rather than as a side effect of refilling a queue. Nothing is deleted. A built
item is checked off and archived with its `From:` path, the way finished work
has always left this file, so the record of what was built survives in
`TODO-archive.md`. An item that turns out not to be built stays unchecked and
in place, and the pruning item says which ones those were.

- [ ] Write the request against the automation tool that `### Pruning the
  Roadmap` says to queue in place of a seventh pruning item
  - The record under that heading settled this on 10.29.2026: every run that
    completes a queued item leaves its roadmap original behind, so pruning is a
    pass that comes round rather than a job that finishes, and the fix belongs
    in the tool rather than in this file. The 10.31.2026 run met it three more
    times - the two mountain footprint items and the weather lift - and closed
    each original inline rather than writing an eighth, ninth and tenth pruning
    item for them.
  - What the request has to say: section 5 of the instructions copies an item
    into `## Current` and leaves the original in place, `todo.mjs` carries no
    notion of item identity across those two copies, and no rule covers the
    original once the copy archives. The archive already shows the cost - grep
    it for `**Mountain** length` and it answers twice, which is one item
    recorded as two pieces of finished work.
  - It is a request rather than a change: `MCP_TODO_HOME` is the user's own
    automation, and what shape the fix takes there is theirs to decide. Write
    it where the user will find it and name both halves - the copy that is left
    behind, and the archive that then double-counts it.

## Complete

Everything already done, in the order it was finished, kept as the record of
how the simulator got here rather than as a list still to be worked.

> 413 earlier items in `TODO-archive.md`, newest last.

- [x] A `.glb` naming an external image loads instead of being refused
  - **Issue**: loading a `.glb` whose JSON names an external image opens the
    step after loading as though the model were sound - headed LOADED ASSET,
    `glTF binary, 12 triangles`, no refusal drawn - and the model is kept
    untextured with nothing said to the pilot. The other three ways of
    reaching outside the file are all refused: a `.gltf` naming a buffer or an
    image is refused by name, and a `.glb` naming a buffer is refused with the
    address `scene.bin`. `embeddedOnly` does fire for the image, and nothing
    leaves for the network - that half holds - but three catches the thrown
    `AssetRefused` inside its texture loading, drops the texture and resolves
    the parse, so `readModel` answers with a model. `test/assets.test.js`
    checks this area by reading `js/asset-loader.js` as text, so it passes
    with the defect in place.
  - **Goal**: Resolve to [glb-external-image.prompt.md](.claude/prompts/glb-external-image.prompt.md)
  - **Settled**: the GLB's own JSON is read before it is parsed, which is the
    fix the prompt recommended. `glbJson` in `js/asset-fit.js` returns the
    first chunk parsed, or null for bytes that are not a GLB, so the check a
    `.gltf` already went through covers a `.glb` too and does not depend on
    what three swallows. The pure half moved to `js/asset-fit.js` to be
    testable at all - `js/asset-loader.js` cannot be imported in Node - taking
    `selfContained` with it and gaining `outsideAddress`, so the refusal names
    the address the way the `.glb` buffer case already did. `embeddedOnly`
    stays exactly as it was: it is the backstop that holds a field a later
    extension adds a `uri` to, and it is what stops the fetch. Settled in
    Chromium over a textured triangle built in the page: the external image is
    refused naming the address and makes no request, while the same bytes
    through a bare `GLTFLoader` do fetch it; a `.glb` with its image in the BIN
    chunk and one with it as a `data:` uri both still read textured
    (`.tmp/ui-ux/t29/glb-external-image.mjs`). Eight mutants caught, the
    dropped `glb` branch among them.
  - From: UI/UX Override - a .glb that points at another file
- [x] **Brush Crossover**: `docs/terrain.html` says a hard and a soft brush
  come to the same band at the ordinary zoom, which the figures do not support
  - **Issue**: the Free Paint paragraph now ends "on a brush 640 units across
    or narrower, which at the ordinary zoom is every brush the slider offers,
    the two edges come to the same band and the axis reads only on a stroke
    laid from far enough out to be wider than that". The 640 unit crossover is
    right - `test/footprints.test.js` pins it - but the clause about the zoom
    is not. `SIZE` is 5 to 400 screen pixels (`PAINT_BRUSH` in
    `js/build-tools.js`) and a brush is laid at `unitsPerPixel(distance, fov,
    viewHeight)`. On the default 16,000 unit canvas `createBuildCamera` opens
    at its furthest, 15,200, which is 26.6 units a pixel across an 800 pixel
    view: 640 units is reached at 24 px, so the default 25 px brush is already
    665 units and the slider's widest is 10,643. The whole slider stays under
    640 units only within 914 of the target, the innermost 4% of the 320 to
    15,200 zoom range. So the sentence tells a reader the EDGE axis does
    nothing in ordinary use when at the opening view it reads for all but the
    smallest brushes, and "from far enough out" points the wrong way, since
    the opening view is the furthest out there is.
  - **Goal**: state it in the units the crossover is in and let the zoom
    follow - a hard edge and a soft one come to the same band on a stroke 640
    units across or narrower, which is a small brush at the opening view and
    most of the slider once zoomed in. `CHANGELOG.md` already words it that
    way, in world units with no claim about the zoom; leave that entry alone.
  - **Settled**: the crossover is stated in world units and the zoom follows
    it - "on a stroke 640 units across or narrower the two edges come to the
    same band, and the axis reads only on a wider one", then the brush being
    set in pixels and laid in units, so at the opening view of a 16000 unit
    canvas, where a pixel is 27 units, it is a brush under 24 of the slider's
    5 to 400, and zoomed in far enough it is every brush the slider offers.
    Every figure re-measured against `createBuildCamera(16000)` and
    `unitsPerPixel`: 15200 units out, 26.608 a pixel, the crossover at 24.1 px,
    the whole slider under it within 914 of the target - 4.0% of the 320 to
    15200 range. The 1.0.0-alpha.1.54.0 changelog entry was left as it was.
  - From: UI/UX Override - a .glb that points at another file
- [x] `selfContained` accepts a `blob:` address, which its docstring says it
  does not
  - **Issue**: `js/asset-loader.js` reads both uses of an address through one
    predicate, `embeddedAddress`, whose rule is `/^(?:data|blob):/i`. `blob:`
    belongs in the manager, where three hands an embedded texture to the image
    loader as a blob the page made from the file's own bytes. It does not
    belong in `selfContained`, which reads the file's own JSON: a `.gltf`
    carrying `"images": [{ "uri": "blob:https://example.com/abc" }]` passes a
    check documented as "True for a glTF whose buffers and images are all
    inside it", and a blob address can never be inside a file, since only the
    page that made one can name it. Nothing escapes - the manager allows the
    same two schemes and no request leaves for a blob the page did not make -
    so this is the early, named refusal reading wider than it says rather than
    an exposure.
  - **Goal**: give `selfContained` the `data:`-only rule its docstring states
    and leave `blob:` to the manager, or keep the one predicate and say in the
    docstring why `blob:` is in it. Verifying it needs the Chromium harness or
    a vendored `three`: `js/asset-loader.js` cannot be imported in Node, since
    `three` is CDN-only, which is why `test/assets.test.js` reads it as source
    text.
  - **Settled**: the first option - the one predicate is now two, each named
    for whose rule it is. `insideFile` in `js/asset-fit.js` is `/^data:/i`,
    what a *file* may name, and `selfContained` reads through it; the manager's
    `EMBEDDED_ADDRESS` stays `/^(?:data|blob):/i`, what the *page* may ask for
    while it reads a model it was handed. Both docstrings say why they differ
    and point at each other, since the names are close enough to be swapped by
    mistake. A `.gltf` or a `.glb` carrying a `blob:` image is now refused
    early and by name where it used to pass the check and be stopped at the
    manager, so nothing widened. Verified in the same Chromium harness as the
    item above, which reads both predicates in the page, and pinned in Node now
    that `insideFile` and `selfContained` are importable - a mutant widening
    the file's rule back to `blob:` is caught.
  - From: UI/UX Override - a .glb that points at another file
- [x] Brush Crossover 1: the paragraph's slider figure leaves a 24 pixel brush
  on the wrong side of the crossover
  - **Issue**: the `FREE PAINT` paragraph in `docs/terrain.html` now reads "at
    the opening view of a 16000 unit canvas, where a pixel is 27 units, it is a
    brush under 24 of the slider's 5 to 400". A 24 pixel brush is inside the
    crossover, not outside it. Drawn in Chromium at 1280x800 on a blank canvas,
    the brush taken to each size by the panel's own `SIZE` slider and each
    stroke measured alone off its draft's footprint through `footprintWeight`:
    at 23 px a stroke is 612 units across and the two edges come to the same
    band, 152.847 either way; at 24 px it is 639 units and they are still the
    same, 159.75 either way; at 25 px it is 665 units and they part, 159.932
    hard against 166.25 soft. A pixel is 26.608 units there, so the 640 unit
    crossover is reached at 24.05 px and the bound is 24 or under, not under
    24. The item's own settled note has the right figure in it - "the crossover
    at 24.1 px" - so the measurement was sound and only the rounding to a whole
    brush went the wrong way; 640 / 27 is 23.7, and the paragraph divides by
    the figure it rounded rather than the one it measured. Everything else in
    the paragraph holds: 665 units at the default brush, 27 units a pixel, the
    two edges differing there, and both of them coming to 3.5 units zoomed all
    the way in, where even the slider's widest 400 px brush is 224 units across
    and inside the crossover.
  - **Goal**: Resolve to [brush-crossover-figure.prompt.md](.claude/prompts/brush-crossover-figure.prompt.md)
  - **Settled**: the prompt's first option, which keeps the per-pixel figure
    round and hedges it - "where a pixel is a little under 27 units, it is a
    brush of 24 or under of the slider's 5 to 400". The hedge is what makes the
    two figures agree: 640 / 27 is 23.7 and 640 / 26.608 is 24.05, so dividing
    by the rounded figure is what moved the bound by a whole brush. Nothing
    else in the paragraph moved, and the 1.0.0-alpha.1.54.0 changelog entry was
    left alone as the completed item before this one left it. The figure is now
    held rather than written down: a new test in `test/site.test.js` reads the
    Free Paint paragraph and compares the brush it names with what
    `createBuildCamera(16000)`, `unitsPerPixel` at an 800 pixel view and
    `paintStamp` actually give against the crossover read off the footprint
    hold - 26.60788 units a pixel, 639 units at 24 px and 665 at 25, so the
    widest brush inside 640 is 24. It reads the direction of the bound as well
    as the number, since the number was never what was wrong, and takes either
    phrasing as the same inclusive maximum so the wording can still change.
    Three mutants caught: the bound back as "under 24", the bound at 23, and
    the per-pixel figure stated as a round 27 with no hedge. The paragraph's
    figures are an 800 pixel view's - the bound is 18 px in a 600 px view and
    27 at 900 - which the paragraph does not say and did not say before; the
    test names the view it holds them at.
  - From: UI/UX Override - a .glb that points at another file
- [x] A `.gltf`'s refusal names no address, and the asset table says it does
  - **Issue**: the `.glb` / `.gltf` row of the formats table in
    `docs/terrain.html` now says the refusal "names the address it points at -
    a `.gltf` is that JSON, and a `.glb` carries the same JSON in its first
    chunk, so the two are held to it alike". Read off the dock in Chromium, a
    `.glb` does name it - "the model points at another file,
    `https://example.com/textures/apron.png`; everything it uses has to be
    inside it" - while a `.gltf` naming the same image says "the glTF points at
    other files; save it with its buffers and images inside it, as a .glb or as
    `data:` addresses", which names no address at all. The rule is held alike:
    all four files are refused before the parse, nothing leaves for the
    network, and every refusal is drawn in the refused amber at 11.46:1 without
    clipping. It is the sentence that is not. `selfContained`'s docstring in
    `js/asset-fit.js` still carries the reasoning behind the older `.gltf`
    wording - a pilot "is told which file rather than being told about an
    address they never wrote" - which the `.glb` branch no longer follows.
  - **Goal**: Resolve to [gltf-refusal-address.prompt.md](.claude/prompts/gltf-refusal-address.prompt.md)
  - **Settled**: the prompt's first option - the `.gltf` names the address too,
    so the table needs no edit and the two formats say one thing. Both branches
    now go through one `refuseOutside(json)` in `js/asset-loader.js`, handed a
    `.gltf`'s own JSON or a `.glb`'s first chunk through `glbJson`, and all
    three places an outside address is found - those two and the loading
    manager behind them - throw one `outsideFileRefusal`, so the sentence is
    written once and cannot drift again. `selfContained` went with it rather
    than keeping a corrected docstring: it was the predicate form of
    `outsideAddress` and had no caller left once both branches wanted the
    address rather than a yes or no, so the reasoning the prompt quoted is gone
    rather than reworded. Its assertions in `test/assets.test.js` are now
    `outsideAddress`'s and say which address was found. Settled in Chromium in
    33 checks over all four files that reach outside themselves, read off the
    dock through the builder's own route: each is refused before the step
    opens, names its address, no longer steers the pilot at a `.glb`, draws in
    the refused amber at 11.46:1 without clipping, and makes no request - and
    shaped by replacing the file and the address, all four sentences are now
    one (`.tmp/run1110/refusals.mjs`). Five mutants caught in Node, including
    a second wording put back for a `.gltf`.
  - From: UI/UX Override - a .glb refused in the dock, and the brush figure beside it
- [x] The dock's status line is drawn below the fold on a short phone, so a
  refused file looks like nothing happened
  - **Issue**: the SAVE / LOAD dock writes what the last save, load or refusal
    came to as the ENVIRONMENT section's status line, inside the fields that
    scroll. Under 640px wide the dock takes the foot of the screen at
    `top: max(60vh, palette bottom + 10px)`, and on a short phone the palette's
    foot wins that `max`: at 360x640 the fields come to 62px, which holds the
    ENVIRONMENT heading and the NAME row and nothing else. Read off the page in
    Chromium through the builder's own route with a file that is refused, the
    refusal is drawn at 541-598 in a window of 470-532 with `scrollTop` left at
    0 - so the dock looks exactly as it did before and the pilot is told
    nothing. The same at 375x667, where the window is 470-559. The boundary is
    a viewport 708px tall at 360 wide: at 704 the refusal is below the fold, at
    708 it is read. It is not the refusal's doing - measured before any file is
    handed over, the empty status slot is already below the fold - and it costs
    the same for every status the dock writes; the refusal is only the one that
    matters most. Everything else on the dock holds at these sizes: the four
    answers stay pinned, on screen and reachable, every palette tile is
    reachable, ASSETS is reached by scrolling, and at 390x844 the refusal reads
    perfectly - 3 lines, inside the dock, amber at 11.46:1.
  - **Goal**: Resolve to [dock-status-below-the-fold.prompt.md](.claude/prompts/dock-status-below-the-fold.prompt.md)
  - **Settled**: the line is brought into the fields' window when its words
    have just changed - the smallest of the prompt's two options, the dock's
    status keeping the place in the ENVIRONMENT section it belongs to.
    `statusLines` and `statusToShow` are exported from `js/panel-view.js`,
    since which line changed and which of two changed lines to show are both
    decidable without a browser, and `PanelView.update` reads them before it
    writes the lines - writing one is what takes it out of being news.
    `showStatus` puts the line's first line at the top of the window rather
    than reaching for `scrollIntoView({ block: 'nearest' })`, which on a 62px
    window leaves a four line refusal reading as the end of a sentence whose
    start is missing. Three redraws are deliberately not news, so the scroll
    cannot take back a view the pilot set by hand: a line unchanged, a line
    gone empty, and the line a section opens on - the second of the prompt's
    two questions, answered by what each section always says rather than by
    which section it is. The phone pass is at 121 passing and 0 failing where
    it was at 117 and 4, the height sweep's boundary at 704 is gone, and seven
    new checks read the three that are not news.
  - From: UI/UX Override - a refusal a short phone never shows
- [x] The address cut in a refusal is held by no test, only by a browser check
  - **Issue**: `namedAddress` in `js/asset-loader.js` cuts an address over 120
    characters to 117 and `...`, and every refusal a pilot reads is built
    through it. `test/assets.test.js` reads the module as text and pins the
    sentence's shape and that `namedAddress` is called in it, but asserts
    nothing about 120, 117, the trailing `...`, or the tail of the sentence
    surviving the cut. Run as a mutant rather than argued:
    `address.slice(0, 117)` changed to `address.slice(0, 17)` leaves the suite
    at 2426 passing and 0 failing. The rule was verified instead by driving the
    dock in Chromium over files built for it - 120 drawn whole, 121 and 180 cut
    to 117 and `...`, a `.gltf` and a `.glb` cut alike, and
    `; everything it uses has to be inside it` surviving each cut, 53 checks
    all passing - which means it is checked when this agent runs and at no
    other time. The reason is structural: `js/asset-loader.js` imports Three.js
    so the suite cannot import it, and `namedAddress` is private inside it.
  - **Goal**: Resolve to [address-cut-untested.prompt.md](.claude/prompts/address-cut-untested.prompt.md)
  - **Settled**: `namedAddress` and the sentence it is written into moved to
    `js/asset-fit.js` as `namedAddress` and `outsideFileSentence`, with
    `NAMED_ADDRESS_LIMIT` and `NAMED_ADDRESS_KEPT` naming the two figures.
    `outsideFileRefusal` keeps the `AssetRefused` class in
    `js/asset-loader.js` and takes its words from there, so the sentence is
    asserted by value rather than pinned as the shape of a line of source, and
    the source-text assertions follow it: the sentence is counted once in
    `js/asset-fit.js` and asserted absent from `js/asset-loader.js`. All six
    of the prompt's assertions are in `test/assets.test.js`, and four mutants
    name the test that catches them - the cut at 17, the limit at 1200, `>`
    as `>=`, and the slice taken on the finished sentence rather than the
    address.
  - From: UI/UX Override - a refusal a short phone never shows
- [x] A `.glb` that is really glTF JSON skips the refusal before the parse
  - **Issue**: `assetFormat` in `js/asset-fit.js` reads the format off the
    filename's extension alone, so a glTF JSON file named `scene.glb` is read
    down the `.glb` branch. There `refuseOutside(glbJson(bytes))` refuses
    nothing: `glbJson` answers null for any bytes without the `glTF` magic, and
    `refuseOutside` passes a null through by design. Measured in Node on the
    bytes of `{"asset":{"version":"2.0"},"images":[{"uri":"https://example.com/textures/apron.png"}]}`
    - `glbJson` answers null while `outsideAddress` on the same JSON answers
    the address - so the check that is meant to catch both formats catches
    neither for this one file. The loading manager is then the only guard left.
    It stops the fetch, so nothing leaves for the network; but the docstring on
    `embeddedOnly` records why that is not enough on its own - three catches an
    image's throw inside its own texture loading, drops the texture and resolves
    the parse anyway - which is the whole reason the check before the parse
    exists. If three parses such a file, the formats table at
    `docs/terrain.html:320` promises "one pointing at another file is refused"
    and the pilot instead gets an untextured model with nothing said on the
    dock. The behaviour is not new - the branch this turn rewrote handled null
    the same way - but nothing exercises it, and the turn's five mutants all pin
    the source's shape rather than what such a file does.
  - **Goal**: settle first whether three's `GLTFLoader` falls back to parsing a
    non-GLB `ArrayBuffer` as JSON text. It cannot be answered in Node - `three`
    is CDN-only, `import('three')` answers `ERR_MODULE_NOT_FOUND`, and that is
    why the suite reads `js/asset-loader.js` as source text - so read it in the
    browser through the builder's own route, with a `.gltf` renamed `.glb`
    naming an outside image and another naming an outside buffer. If it parses:
    on the `.glb` branch, when `glbJson` answers null and the bytes still decode
    as a glTF object, read the refusal off that object, so one `refuseOutside`
    covers both formats and the sentence does not change. If it refuses the
    bytes outright, the gap is only in the wording and the table's promise
    holds - say so where `glbJson`'s null case is already described. Either way
    pin the premise in Node, where it is cheap: `glbJson` answers null for glTF
    JSON text.
  - **Settled**: it parses. Read in Chromium on 11.11.2026, three's
    `GLTFLoader` handed the bytes of a `.gltf` renamed `.glb` as an
    `ArrayBuffer` answered a box of one mesh, and the same file through the
    builder's own route opened the step headed LOADED ASSET with the model
    drawn untextured, nothing on the dock and one console line from three.
    The buffer variant was refused by the manager, as a buffer always is, so
    the image was the whole of the gap - which is the case the backstop cannot
    cover. So the first branch of the goal: the `.glb` branch now reads
    `gltfJson` in `js/asset-fit.js`, which answers a GLB's first chunk or, for
    bytes that are not a GLB, the bytes read as the JSON text a `.gltf` is.
    One `refuseOutside` covers all three cases and the sentence is unchanged.
    The premise is pinned in Node as asked - `glbJson` answers null for glTF
    JSON text while `outsideAddress` on the same bytes answers the address -
    and two mutants name the test that catches them. The promise at
    `docs/terrain.html:320` now holds for a file named `.glb` as well, and the
    paragraph says so.
  - From: UI/UX Override - a refusal a short phone never shows
- [x] `showStatus` is held by regex pins, not by anything that runs it
  - **Issue**: `PanelView.showStatus` in `js/panel-view.js` is the whole of
    what a pilot sees in this turn's fix - it is what puts a refusal at the
    top of a 62px window instead of at 541-598 below it.
    `test/panel-view.test.js` holds it by reading the module as text and
    pinning three of its lines with `assert.match`, which is the only way this
    project can hold a module that touches the DOM. A pin catches a line that
    is edited or deleted; it cannot catch a guard no pin names. Both of the
    method's early returns are in that class, run as mutants against the whole
    suite rather than argued: `if (box.height === 0) return;` deleted leaves
    2432 passing and 0 failing, `if (!line || !this.fields) return;` deleted
    leaves 2432 passing and 0 failing, and swapping the two guards so a line
    with no height is scrolled to leaves 2432 passing and 0 failing. The
    second is not cosmetic - without that guard, `showStatus` called for a
    section whose line was never drawn reaches `getBoundingClientRect` on
    `undefined` and throws inside `update`, which runs on every frame the dock
    is open. The fix itself was verified and passed on every count this run:
    30 checks at 360x640, 375x667 and 390x844, 13 on the scroll that must not
    fight the pilot, 16 on the `.glb` that is really glTF text, 17 on the
    address cut.
  - **Goal**: Resolve to [show-status-untested.prompt.md](.claude/prompts/show-status-untested.prompt.md)
  - **Settled**: the method is executed rather than read. `PanelView` is
    already exported and `showStatus` touches no global, so
    `PanelView.prototype.showStatus.call(stub, 'environment')` runs under Node
    against a stub whose `drawn` and `fields` answer boxes - seven assertions
    in `test/panel-view.test.js` covering the window the phone measured: a
    line already inside it left where it is, the 541-598 refusal coming up by
    71 to the window's own top, a line taller than the window landing first
    line first rather than foot on the fold, one above it coming down by a
    negative step, a line of no height left alone, a section with no line
    drawn left alone rather than throwing, and a view with no fields having
    nothing to scroll. The three source pins stay as they are - they hold what
    a stub cannot, which is that the page's own scroll is read off
    `this.fields` and that `scrollIntoView` is never reached for. All three
    mutants the issue names are now caught, each by the new test alone and
    each having left the suite green before it: the height guard deleted, the
    drawn-and-fields guard deleted, and the height guard moved below the
    scroll so a line with no height is scrolled to. The fourth mutant the
    prompt recorded as equivalent was not spent.
  - From: UI/UX Override - the dock's scroll, read on a phone
- [x] **Derived Cut**: The address cut states both of its figures instead of deriving one
  - **Issue**: `js/asset-fit.js` exports `NAMED_ADDRESS_LIMIT` as 120 and
    `NAMED_ADDRESS_KEPT` as 117, two independent figures whose whole
    relationship is the width of the `...` that joins them - a cut address
    comes back exactly `NAMED_ADDRESS_LIMIT` characters long, which is the
    invariant `test/assets.test.js` asserts twice ("121 comes back 120 long",
    "however long it was") without anything in the module saying it. Nothing
    is wrong today, and the test would catch either figure moved on its own;
    the drift is against a convention this repository settled on 11.08.2026
    for exactly this shape, where `SOFT_EDGE` was changed from a stated 0.5 to
    a derived `FEATHER_SHARE / 2` so that the constant could no longer
    disagree with the rule that bounds it - see `Held Feather 1` in
    `TODO-archive.md`.
  - **Goal**: name the ellipsis once and read the kept length off the limit -
    `NAMED_ADDRESS_KEPT = NAMED_ADDRESS_LIMIT - ELLIPSIS.length`, with
    `namedAddress` appending that same `ELLIPSIS` - so the figure a refusal is
    cut to is one decision rather than two that have to agree. Leave both
    exports and both of their asserted values as they are: 120 and 117 are
    what the pilot reads and what the tests pin, and this changes only where
    the 117 comes from.
  - **Settled**: `ELLIPSIS` names `'...'` once in `js/asset-fit.js`,
    `NAMED_ADDRESS_KEPT` reads as `NAMED_ADDRESS_LIMIT - ELLIPSIS.length`, and
    `namedAddress` appends that same constant instead of a second literal. Both
    exports stay, both values stay 120 and 117, and what a pilot reads is
    unchanged - `docs/terrain.html:320` still states the behaviour correctly
    and needed no edit. `test/assets.test.js` gained the one line the figures
    had never said out loud, that the limit less the kept length is the width
    of the ellipsis, which is what catches a kept length written back as a
    figure of its own. Held by three mutants, all caught: a two dot ellipsis,
    the kept length restated as 116, and the limit moved to 200 with the kept
    length following it.
  - From: UI/UX Override - the dock's scroll, read on a phone
