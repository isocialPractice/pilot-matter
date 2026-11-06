# TODO

Roadmap for Pilot Matter, a browser-based Three.js flight simulator with no
build step. Items under `## Current` are the next work queue; the remaining
level 2 sections group planned work by theme and state the version update
that applies when their items are completed.

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

### UI/UX Override - a refused file row says why in a colour it cannot be read in

#### Found Issues

- [ ] The Settings file row's refusal is amber on the selection's green, at
  1.34:1
  - **Issue**: `#settings-menu li.refused::after` writes the reason a file was
    refused in `#ffb000`, and `li.selected` fills the row `#0f0` with black
    text. A row is only ever refused just after it was pressed, and a row is
    pressed where the cursor is, so the two always land together: the reason
    is drawn amber on bright green. Measured in Chromium at 1.34:1 over 10
    pixel text, where the row's own label manages 15.3:1 on the same fill -
    below the 4.5:1 small text needs, and close enough to 1:1 that the line
    reads as a texture rather than as words. Driven three times over
    `LOAD ENVIRONMENT...` in Settings with a JSON file whose `format` is not
    `pilot-matter.environment`; the reason itself is right
    (`could not load not-a-world.json: the file is not an environment file`).
    Stepping the cursor one row down makes the same text legible at 11.46:1,
    so the message is only unreadable in the one state it appears in. The
    builder's own SAVE / LOAD dock is not affected - its refusal is the same
    amber on the dock's dark fill at 11.46:1 - so this is the Settings list
    alone.
  - **Goal**: give a row that is both selected and refused a fill the warning
    amber reads against, rather than the ordinary green selection. A rule
    after the two existing ones - `#settings-menu li.selected.refused` with a
    dark fill and an amber border, keeping `::after` at `#ffb000` - clears
    4.5:1 and keeps the warning reading as a warning; the green selection fill
    is what has to go on that row, not the amber. Check the same pairing on
    `#settings-start`, `#settings-options` and `#settings-builder`, which
    share the `li.selected` rule, and hold whatever is chosen with a contrast
    assertion in `test/page.test.js` beside the existing `li.refused` one.
  - From: UI/UX Override - a refused file row says why in a colour it cannot be read in

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

> 395 earlier items in `TODO-archive.md`, newest last.

- [x] **Insert Plane**: the tool and its mark, with SELECT PLANE's cards and
  SELECT STARTING POINT's rows as two sections, the chosen plane saved with
  the world and flown on it
  - **Settled**: `plane` joins `BUILT_TOOLS`, and its dock is `DOCK_PLANE`
    headed `INSERT PLANE`: SELECT PLANE, five named cards with the chosen one
    pressed, and SELECT STARTING POINT, `AT X`, `AT Z`, `HEADING` and `HEIGHT
    FEET` or `HEIGHT METERS` in the settings' altitude unit, or a line saying
    to click the ground while there is none, with `CLEAR` pinned under them
    and not pressable until there is something to take. Each section carries
    its mode type off the tool. The plane chosen rides the world as the start
    point does, as `plane` in the file, and `refreshWorld` puts the pilot in it
    through `flyPlane`. The control list gains `Click (Insert plane) - Put the
    Start Point There` and `Drag (Insert plane) - Turn the Start Point by Its
    Knob`.
  - From: Post Interactive Build
- [x] **Objects on the ground**: a placement drawn as a mesh standing on the
  ground rather than as ground, repeated on every tile on that tile's own
  ground, fogged like the ground, solid to the aircraft - any touch on one a
  crash, roofs included, while an extrusion's top is still landed on as
  ground - picked by Select and taken whole by Erase
  - **Settled**: an object is a placement of type `object` - `{ prefab,
    recipe, config: { at, heading, scale } }` - and `js/objects.js` lays it
    out. `buildEnvironment` leaves objects out, so the ground is drawn as
    without them; each tile then stands them with `standingObjects`, once its
    ground is joined to its neighbours, at the same canvas point on every tile:
    on the highest ground under the footprint, over a plinth to the lowest.
    The footprint is a hard-edged rect round the recipe, scaled and turned to
    the heading. `js/object-mesh.js` draws one `InstancedMesh` to a recipe and
    one for the plinths, in the ground's own held material, so fog takes them
    as it takes the ground. `Terrain.obstacleTopAt` asks the tile under a point
    and the tiles beside it; `Aircraft.update` takes it as `obstacle` and
    crashes at any touch, read before the ground so a roof is never landed on,
    while the ground - an extrusion's top included - is landed on as before; a
    recipe marked `solid: false` is flown over. Select picks it inside its
    footprint, over the ground it stands on; its outline is the footprint
    traced; the Flat gumball moves it, turns it by its arc and scales it evenly
    by its two ground squares; its panel is `HEADING` and `SCALE` under its
    prefab's name. Erase taking everything takes it whole when a stroke's region
    reaches its middle at all, and a put-back there gives it back - the last
    batch to reach it deciding. The file reads it with its recipe and holds its
    heading and scale.
  - From: Post Interactive Build
- [x] **Prefabs**: a building as a recipe of primitives in its own frame,
  copied into the placement as a template's members are, merged and instanced
  per prefab
  - **Settled**: `js/prefabs.js` holds recipes of boxes, cylinders, cones
    and wedges - a wedge's ridge down its middle or along its +x edge, a
    cylinder narrowing to a `top` - each part standing its base on `at`, turned
    about its upright by `turn` degrees, with a `0xrrggbb` colour.
    `recipeGeometry` merges them into one list of triangles, every face wound
    outward from its part and its normal worked from its own corners, colours
    turned from sRGB to the linear light a vertex colour is read in.
    `placeObject` copies the recipe in, so a prefab changed later leaves a
    built world alone; `recipeKey` groups placements of one recipe into one
    instanced mesh. `readRecipe` takes a file's recipe whole or refuses it,
    naming where. The catalogue starts with two - COTTAGE and WATER TOWER -
    under the six categories Insert City will fold; the city's own buildings
    are the next run's.
  - From: Post Interactive Build
- [x] **City buildings**: five skylines, three factories, nine residential,
  five commercial and five infrastructure buildings, original and generic, in
  the catalogue a test holds to the counts asked
  - **Settled**: the catalogue in `js/prefabs.js` holds 27 buildings - five
    skylines, three factories, nine residential, five commercial and five
    infrastructure - generic and original, built with small helpers: `block`
    and `drum` give a box or a round tower a band of windows at every floor,
    `front` puts a house's door and windows on its `+z` wall. Every card's
    footprint was measured off its recipe and is held to it; a skyline is two
    to five towers by the places something 25 metres tall stands. A test holds
    each category's count to the range asked and the names to the plan's, every
    building solid on the usual plinth, nothing below the ground it stands on,
    and no recipe past 3000 triangles. Roads, the infrastructure category's
    second half, are the next run's.
  - From: Post Interactive Build
- [x] **Parks**: seven parks of trees, paths, water and fields, drawn as
  objects with no roof
  - **Settled**: seven parks - LAWN, WOODLAND, POND PARK, PLAYGROUND, SPORTS
    FIELD, PLAZA and FORMAL GARDEN - each `solid: false`, laid on a lawn of its
    own the size of its card, with trees, paths, benches, water and a pitch's
    lines as meshes. A recipe may now name its `plinth` colour, read and held
    by the file and the schema, and `js/object-mesh.js` colours each plinth
    instance with it, so a park on falling ground reads as a grassy terrace
    rather than a concrete one.
  - From: Post Interactive Build
- [x] **Roads that snap**: six road pieces laid over the ground, each with
  connectors at its open ends, snapping end to end to an open connector within
  30 metres while previewed, and placed free with `shift`
  - **Settled**: a recipe gains a `ribbon` part - a flat strip along a
    line, cut every `RIBBON_STEP` (10 m), turned to face up - and two fields:
    `drape`, which lays every corner on the ground under it `DRAPE_LIFT` over
    it rather than standing the recipe on a plinth, and `connectors`, each a
    point and the heading leading out. Six road pieces under INFRASTRUCTURE,
    after its buildings - STRAIGHT, CURVE, T-JUNCTION, CROSSROADS, ROUNDABOUT
    and DEAD END - 12 m wide with a dashed centre line, flown over. A tile lays
    its roads into one mesh with `drapedGeometry`, pulled toward the camera by
    a polygon offset. `js/roads.js` is the pure arithmetic: a connector where
    its piece's heading and scale put it, two joined when they meet face to
    face, the open ones those no other meets, and `snapRoad`, which moves and
    turns a piece so its nearest end meets the nearest open one within 30 m.
    The file and the schema read ribbons, drapes and connectors.
  - From: Post Interactive Build
- [x] **Insert City**: the tool and its mark, a folding section per category
  of named cards, a chosen card previewed under the pointer and placed by a
  click, and turned by the gumball
  - **Settled**: `city` joins `BUILT_TOOLS`, so every tool declared is built.
    Its dock, `DOCK_CITY`, is a folding section for each category with only
    the last opened open, each a grid of named cards, Infrastructure's roads a
    row of their own. A card arms it; the pointer carries the card's footprint
    lined up with the view, outlined green where a road would snap; a click
    places it as the edit in hand with `HEADING` and `SCALE` over `ACCEPT` and
    `CANCEL`, a second click moves it - snapping again - and another card
    swaps the piece in hand. `shift` places a road free. A free point is held
    to a tenth of a metre. Auto accept for drawing keeps the piece in hand at
    the next click. The control list gains `Click (Insert city)` and
    `Shift+Click (Insert city)`, which needed the list to write a held key
    before a click. The browser check found a row of six cards running off
    both sides of the dock under the canvas, so a row of tiles now wraps.
  - From: Post Interactive Build
- [x] **Load an asset**: a GLB, glTF, OBJ, STL or SVG read in the page and
  never sent anywhere, then a step that sets its scale, up and facing and says
  which insert menus it fits, from its bounds, with the reason where it does
  not
  - **Settled**: `LOAD ASSET…` on SAVE / LOAD reads a file with
    `file.arrayBuffer()` - refused past 25 MB before it is read, and by its
    name where it is no GLB, glTF, OBJ, STL or SVG - and `js/asset-loader.js`
    reads it with three's own loaders, fetched with three: a `.gltf` only when
    every buffer and image is a `data:` address, an SVG parsed as text and
    extruded, never put into the page, and any model past 300,000 triangles
    refused. `LOADED ASSET` shows it on the canvas, the camera brought in to
    it, with MODEL - `NAME`, `SCALE`, `UP`, `FACING`, `COLOR` for a format
    with none, `HEIGHT` for a plan - and USE AS - a switch for each use, held
    shut with why where `assetFit` in the pure `js/asset-fit.js` says it does
    not fit, `FLIES LIKE` and `SECTION`. glTF is taken as metres, its own
    unit, and only OBJ and STL are guessed as millimetres past 2000 units; a
    runway's least length is the strip's own 600 m, not the 400 the plan
    first said, since it is placed over a real strip of its size.
  - From: Post Interactive Build
- [x] **Loaded assets kept**: the assets in IndexedDB, surviving a reload,
  listed with what each is used as and removable, and carried inside an
  environment file that uses them so it opens on another computer
  - **Settled**: `js/asset-store.js` keeps each asset in IndexedDB,
    database `pilot-matter`, store `assets`, by an id drawn from the SHA-256
    of its bytes, so the same file is one asset wherever it comes from. The
    page reads them back once it is up and draws each model in place of the
    box that stood for it. ASSETS lists them with what each is used as;
    `REMOVE ASSET` asks `REMOVE THE ASSET`, with `YES` and `CANCEL`, when the
    canvas uses the one chosen, and takes what used it with it. A saved
    environment carries every asset it uses once, in `assets`, as base64;
    loading one checks each against its hash, keeps the ones not held, and
    refuses the file where a placement or the plane refers to one it does not
    carry.
  - From: Post Interactive Build
- [x] **Inserting loaded assets**: a loaded plane flown as a card of Insert
  Plane, a loaded building placed as an object in its Insert City section, and
  a loaded runway placed over a real strip of its size
  - **Settled**: a loaded plane is a card on SELECT PLANE, flown through
    `Aircraft.setModel` anchored at its bounds' middle, with the figures of
    the plane it flies like and a chase scaled by its size. A loaded building
    is a card in its Insert City section, placed as an object whose recipe is
    `{ asset, size }` - a reference, not a copy - drawn as a copy of the read
    model sharing its geometry, or as a box of its size until then. A loaded
    runway is a card on Insert Runway, placed as a group of a real strip of
    its length and width and the model as an object over it, facing the way
    the strip does, so landing, scoring and takeoff work on the strip as they
    do on any.
  - From: Post Interactive Build
