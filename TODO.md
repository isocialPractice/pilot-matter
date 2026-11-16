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

- [ ] **Undo and redo**: `Ctrl+Z` takes back the last change to the world - a
  placement added, moved, stepped or erased, a start point set or a plane
  chosen - and `Ctrl+Shift+Z` or `Ctrl+Y` puts it back, with UNDO and REDO on
  the dock's bar
  - A capped history of the session's world, a step pushed when an edit is
    accepted rather than at every move of a drag, so one gumball drag is one
    step; cleared when a world is loaded or the canvas opened afresh. A test
    walks a session through add, move, erase, undo and redo and expects each
    world back as it was.
  - From: Interactive Build Mode `->` Editor Workflow
- [ ] **The outliner**: a folding OUTLINER section in the dock listing every
  placement by name and type in the order drawn, where a row selects its
  placement, renames it, hides it from the canvas while building, or locks it
  against Select and Erase
  - Hidden and locked are building aids: a hidden placement is still flown,
    and both are saved in the file so a reopened world keeps them.
  - After: Undo and redo, so a rename or a lock is a step like any other
  - From: Interactive Build Mode `->` Editor Workflow
- [ ] **Snapping**: a grid and an angle the gumball's moves and turns snap to,
  switched on the dock's bar with their sizes in the builder settings - 10 m
  and 15 degrees to start - the grid drawn faintly round the pointer while it
  is on
  - From: Interactive Build Mode `->` Editor Workflow
- [ ] **Frame the selection**: `F` turns and moves the builder's camera to
  frame the selection, or the whole world when nothing is selected, as
  engines' editors do
  - Check `F` against the key map and the reserved keys first: the builder
    reads its keys only while it is open, but a key the flight binds must not
    mean two things.
  - From: Interactive Build Mode `->` Editor Workflow

### UI/UX Override - the hover over a built canvas

#### Found Issues

- [ ] **The hover reads every object's ground on every pointer move**, so a
  canvas with a few hundred objects on it has got heavier to hover over
  - **Issue**: `pickPlacementAt` runs on every pointer move with Select live,
    and `objectRayAt` builds every object's box before testing any of them
    against the ray. One box is `objectBox` `->` `footprintGround`, which
    samples the ground 25 times, so 300 objects is 7,500 terrain reads a move
    with the ray's direction playing no part in any of them. Measured in
    Chromium on a blank canvas with objects 300 m apart, the view 50 degrees
    over the ground: 20.0 fps while the pointer is swept, against 60.2 fps for
    the same scene with the mountain tool live so no pick runs, and 19.8 again
    on a second sweep with Select. One move's pick is 52.2 ms against the
    24.4 ms the reading it replaced cost on the same rays, both paths built
    out of the same modules. It is linear in the object count - 25 objects
    4.6 ms, 100 objects 17.9 ms at 53.8 fps, 300 objects 52.2 ms at 20.0 fps.
    The ground half is exactly as the item claimed and is not the cost: solved
    on the grid it reads the ground 6 times against the march's 27. Every one
    of the 27.7 ms added is the box pass.
    `.tmp/ui-ux/t34/c5-hover.log` is the measurement.
  - **Goal**: Resolve to [hover-reads-every-box.prompt.md](.claude/prompts/hover-reads-every-box.prompt.md)
  - From: UI/UX Override - the hover over a built canvas
- [ ] **A Node test that counts what a pick reads**, so the cost of the box
  pass is held by the project's own suite rather than by a browser sweep
  - **Issue**: nothing in `npm test` notices how many times a pick reads the
    ground. The 11 new tests in `test/build-picking.test.js` hold the solved
    reading's own reads, and the walk's cell limit is held by counting them -
    but `objectRayAt` has no such test, which is why a pass that reads 7,500
    heights a pointer move shipped with a full suite behind it.
  - **Goal**: in `test/build-select.test.js`, hand `objectRayAt` a counting
    `groundAt` and a list of objects of which the ray can reach one, and
    expect the reads to be a function of what the ray could reach rather than
    of how long the list is. It needs no browser, and it is the assertion the
    code above fails and its fix passes.
  - From: UI/UX Override - the hover over a built canvas

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

## Complete

Everything already done, in the order it was finished, kept as the record of
how the simulator got here rather than as a list still to be worked.

> 428 earlier items in `TODO-archive.md`, newest last.

- [x] **Kept builds survive a reload**: the world ACCEPT AND EXIT keeps - its
  placements, start point, plane and the assets it uses - written to IndexedDB
  beside the asset library and put back when the page opens, so the world
  flown after a reload is still the one built
  - Today it lives only in the page, and closing the tab loses it unless it was
    saved to a file. Keep one world, the last kept, under a key of its own in
    the `pilot-matter` database `js/asset-store.js` opens, read before the
    first tile is drawn; the Settings environment row says the world flown is
    the kept one, with a way back to the preset.
  - **Settled**: a `worlds` store beside `assets` in the `pilot-matter`
    database, at version 2, holding the one last-kept world as the text of its
    environment file - read back through `readEnvironmentDocument`, so a world
    a later version would refuse in a file is refused here too. IndexedDB is
    answered after the page is up rather than before the first tile, as the
    asset library already is, so the world arrives while the title is holding
    and the ground is laid again under it. The chosen preset's row reads
    `BUILT_WORLD_NOTE` while a build is on it, and pressing it again releases
    the build - the one environment press that used to answer nothing.
  - From: Interactive Build Mode `->` Closing the Builder's Gaps
- [x] **The Matter API stands objects**: `createEnvironment` and
  `createTiledEnvironment` in `js/api/matter.js` stand a world's objects and
  roads as the simulator does, and answer `obstacleTop` for them, so a host
  loading a built world gets its buildings as well as its ground
  - Today the API draws a world's ground and leaves its objects out, so a
    host's aircraft flies through a city it cannot see. Reuse
    `standingObjects` and `objectGroup`; an `objects: false` option keeps
    today's drawing for a host that stands its own. A worked example in
    `docs/api.md` loads a built world's file under an external aircraft.
  - **Settled**: `generate` now puts a description through the same three
    steps `buildEnvironment` does - groups expanded, erasures resolved,
    objects left out of the field - which is what the goal needed and more
    than it asked: before it, a built world's first object, template or erase
    batch threw `Unknown environment element` rather than being quietly left
    out. `objects` and `obstacleTop(x, z)` are on the world and on an
    assembly, and `OBJECT_REACH` moved to `js/objects.js` so the tiles and an
    assembly read one figure.
  - From: Interactive Build Mode `->` Closing the Builder's Gaps
- [x] **Select picks a roof**: a click on an object picks it by the object's
  own bounds under the pointer rather than by the ground point the pointer's
  ray meets, so a tall building is picked where it is seen
  - The ray ends on the ground today, so a click on a tower's upper floors
    picks whatever stands on the ground behind it, or nothing. Test the ray
    against each object's turned and scaled `recipeBounds`, nearest first,
    before the ground.
  - **Settled**: `objectBox`, `rayEntersBox` and `objectRayAt` in
    `js/build-select.js`, asked by `pickPlacementAt` in `js/main.js` before
    the ground and by the hover through the same call. The ground under a
    footprint is read once, by `footprintGround`, so the box is where the
    building was drawn.
  - From: Interactive Build Mode `->` Closing the Builder's Gaps
- [x] **Every plane opens flying**: each plane in `js/planes.js` starts a
  flight at the start point above its own stall speed and trimmed level,
  rather than the jet opening slightly stalled
  - Give each recipe its own start speed and trim, held by a test that steps
    every plane a few seconds from the start point and expects it neither
    stalled nor sinking.
  - **Settled**: a `startSpeed` per recipe, raised to as a floor rather than
    replacing the pilot's `START AIRSPEED`, with the throttle raised to hold
    it and the trim worked out from the plane's own figures. `planeStart` is
    applied in `Aircraft.startState`, where the start is read, so a plane
    chosen under a start nobody touched is flown on its own figures.
  - From: Interactive Build Mode `->` Closing the Builder's Gaps
- [x] **A pick reaches a summit narrower than the sampling**: `pickGround`
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
  - **Settled**: neither shape the item named works, measured - stepping by a
    share of the ray's descent reaches the same one aim of 185, and refining
    the first stretch out of the ceiling fixes only a summit at the highest
    ground. Told the grid, `pickGround` walks the ray cell by cell and solves
    each cell's own quadratic, which has the summit's vertex in it as a
    corner: all 185 aims across the face, and a third of the ground reads. The
    stepped walk is kept for a caller that names no grid.
  - From: Interactive Build Mode `->` Closing the Builder's Gaps
- [x] **Kept builds survive a reload**: the world ACCEPT AND EXIT keeps - its
  placements, start point, plane and the assets it uses - written to IndexedDB
  beside the asset library and put back when the page opens, so the world
  flown after a reload is still the one built
  - Today it lives only in the page, and closing the tab loses it unless it was
    saved to a file. Keep one world, the last kept, under a key of its own in
    the `pilot-matter` database `js/asset-store.js` opens, read before the
    first tile is drawn; the Settings environment row says the world flown is
    the kept one, with a way back to the preset.
  - **Settled**: a `worlds` store beside `assets` in the `pilot-matter`
    database, at version 2, holding the one last-kept world as the text of its
    environment file - read back through `readEnvironmentDocument`, so a world
    a later version would refuse in a file is refused here too. IndexedDB is
    answered after the page is up rather than before the first tile, as the
    asset library already is, so the world arrives while the title is holding
    and the ground is laid again under it. The chosen preset's row reads
    `BUILT_WORLD_NOTE` while a build is on it, and pressing it again releases
    the build - the one environment press that used to answer nothing.
  - From: Interactive Build Mode `->` Closing the Builder's Gaps
- [x] **The Matter API stands objects**: `createEnvironment` and
  `createTiledEnvironment` in `js/api/matter.js` stand a world's objects and
  roads as the simulator does, and answer `obstacleTop` for them, so a host
  loading a built world gets its buildings as well as its ground
  - Today the API draws a world's ground and leaves its objects out, so a
    host's aircraft flies through a city it cannot see. Reuse
    `standingObjects` and `objectGroup`; an `objects: false` option keeps
    today's drawing for a host that stands its own. A worked example in
    `docs/api.md` loads a built world's file under an external aircraft.
  - **Settled**: `generate` now puts a description through the same three
    steps `buildEnvironment` does - groups expanded, erasures resolved,
    objects left out of the field - which is what the goal needed and more
    than it asked: before it, a built world's first object, template or erase
    batch threw `Unknown environment element` rather than being quietly left
    out. `objects` and `obstacleTop(x, z)` are on the world and on an
    assembly, and `OBJECT_REACH` moved to `js/objects.js` so the tiles and an
    assembly read one figure.
  - From: Interactive Build Mode `->` Closing the Builder's Gaps
- [x] **Select picks a roof**: a click on an object picks it by the object's
  own bounds under the pointer rather than by the ground point the pointer's
  ray meets, so a tall building is picked where it is seen
  - The ray ends on the ground today, so a click on a tower's upper floors
    picks whatever stands on the ground behind it, or nothing. Test the ray
    against each object's turned and scaled `recipeBounds`, nearest first,
    before the ground.
  - **Settled**: `objectBox`, `rayEntersBox` and `objectRayAt` in
    `js/build-select.js`, asked by `pickPlacementAt` in `js/main.js` before
    the ground and by the hover through the same call. The ground under a
    footprint is read once, by `footprintGround`, so the box is where the
    building was drawn.
  - From: Interactive Build Mode `->` Closing the Builder's Gaps
- [x] **Every plane opens flying**: each plane in `js/planes.js` starts a
  flight at the start point above its own stall speed and trimmed level,
  rather than the jet opening slightly stalled
  - Give each recipe its own start speed and trim, held by a test that steps
    every plane a few seconds from the start point and expects it neither
    stalled nor sinking.
  - **Settled**: a `startSpeed` per recipe, raised to as a floor rather than
    replacing the pilot's `START AIRSPEED`, with the throttle raised to hold
    it and the trim worked out from the plane's own figures. `planeStart` is
    applied in `Aircraft.startState`, where the start is read, so a plane
    chosen under a start nobody touched is flown on its own figures.
  - From: Interactive Build Mode `->` Closing the Builder's Gaps
- [x] **A pick reaches a summit narrower than the sampling**: `pickGround`
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
  - **Settled**: neither shape the item named works, measured - stepping by a
    share of the ray's descent reaches the same one aim of 185, and refining
    the first stretch out of the ceiling fixes only a summit at the highest
    ground. Told the grid, `pickGround` walks the ray cell by cell and solves
    each cell's own quadratic, which has the summit's vertex in it as a
    corner: all 185 aims across the face, and a third of the ground reads. The
    stepped walk is kept for a caller that names no grid.
  - From: Interactive Build Mode `->` Closing the Builder's Gaps
