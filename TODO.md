# TODO

Roadmap for Pilot Matter, a browser-based Three.js flight simulator with no
build step. Items under `## Current` are the next work queue; the remaining
level 2 sections group planned work by theme and state the version update
that applies when their items are completed.

## Current

The work queued for the next run, copied here from the roadmap sections below.
Each item carries a nested `From:` line recording the section it came from, so
its context survives being archived.

- [ ] **A way back to the element editor**: the panel that moves an
  environment's own ranges across the whole world, reachable again now that
  `L` opens the builder
  - From: Interactive Build Mode
- [ ] **Footprints wrap**: a region drawn over one edge of the canvas continuing
  across the opposite one, so the built tile meets itself
  - From: Interactive Build Mode
- [ ] **Footprinted elements**: an element drawn only where a footprint reaches,
  by compositing a draft field, so no generator in the registry is changed
  - From: Interactive Build Mode
- [ ] **The built tile as a pattern**: a placement landing at the same canvas
  coordinate on every tile, continuous across the seams, with anything levelled
  to the ground levelled on the tile it is drawn on
  - From: Interactive Build Mode

### UI/UX Override - the builder's way in, and the flight under a canvas

#### Resolve Issues

- [ ] The canvas 1: leaving a canvas puts the paused flight back at its start
  - **Issue**: a flight paused mid-air, taken into the builder and onto any
    canvas, comes back to the pause card with the aircraft returned to the
    start of the flight. Driven in Chromium with the flight paused either side
    of the session, so nothing but the session could have moved it: the
    aircraft went from `-85.3, 455.8, 154.3` yaw `-0.665` to `0, 423.8, 0` yaw
    `0`, a shift of 179 units, and again from `-76.4, 449.0, 112.1` to the same
    place on a second run. A session that opens the picker and leaves it
    without starting a canvas is the control and loses nothing at all, so what
    moves the aircraft is the canvas being put back rather than the builder
    being opened. Everything else about leaving was verified correct in the
    same run - nine tiles, the right environment, the fog, the far plane, the
    chase camera in place on the first frame, and ground under the aircraft on
    that frame. `leaveBuilder()` calls `refreshWorld()`, which resets the
    aircraft whenever `buildWorld()` reports a rebuild, and restoring the
    flight's ground after a canvas always reports one.
  - **Goal**: Resolve to [canvas-leave-resets-the-flight.prompt.md](.claude/prompts/canvas-leave-resets-the-flight.prompt.md)
  - From: Interactive Build Mode
- [ ] The builder in the menus 1: the title screen keeps the builder's entry
  while a game mode is chosen, where it opens nothing
  - **Issue**: a game mode can be chosen from the title screen's own `GAME
    MODES` panel before any flight has begun, and `startRun` makes
    `isRunning(this.run)` true from that moment. The pause menu answers for
    this and drops the row; the title screen does not. Observed on the title
    screen with `RUNWAY LANDING` chosen: the start menu still reads `START
    FLIGHT, GAME MODES, CONTROL SETTINGS, SETTINGS, INTERACTIVE ENVIRONMENT
    BUILDER` while `builderReady()` reports false, and both choosing that row
    and pressing `L` leave `builder.screen` null with no picker drawn. That is
    the dead row the pause menu's own comment calls the one thing a row under
    the cursor should never be.
  - **Goal**: hold the start menu's entry to the same predicate the pause menu
    is held to. `js/menu.js` already has `pauseMenuEntries(ready)` filtering on
    `BUILDER_ENTRY_ID`; a matching reading of `START_MENU_ENTRIES` built the
    same way, rebuilt from `syncPauseMenu`'s one place rather than a second
    one, is the shape - and `setMenuEntries` already clamps a cursor left past
    the end, which was verified holding on the pause menu. Leaving the row
    drawn and giving it something to open is the other answer, but it is a
    larger decision than this item: a mode brings its own ground, which is the
    reason the builder is refused in the first place.
  - From: Interactive Build Mode

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

- [ ] **A way back to the element editor**: the panel that moves an
  environment's own ranges across the whole world, reachable again now that
  `L` opens the builder
  - `1.0.0-alpha.1.34.0` moved `L` onto the builder, which was the only way
    into the element editor. The panel, its state module, its tests and its
    place in `index.html` are untouched and still do the one thing the builder
    does not yet offer; nothing reaches them.
  - The plan's answer is a section of Select's panel under the camera fields,
    so there is one editor with two scopes rather than two editors - and that
    waits on **One properties panel** and on **Select panel**. The plan listed
    it as open rather than taken, because it retires the entry point of a
    feature that has shipped.
  - So the decision is whether to wait. Either name a way in that holds until
    Select carries it, or say the panel stays unreachable until then and let
    this item close when **Select shows what is selected** does.
- [ ] **Footprints wrap**: a region drawn over one edge of the canvas continuing
  across the opposite one, so the built tile meets itself
- [ ] **Footprinted elements**: an element drawn only where a footprint reaches,
  by compositing a draft field, so no generator in the registry is changed
- [ ] **The built tile as a pattern**: a placement landing at the same canvas
  coordinate on every tile, continuous across the seams, with anything levelled
  to the ground levelled on the tile it is drawn on
- [ ] **Build mode state**: the twelve tools, the draft, and the rule that an
  accept always commits while a cancel always discards, as a pure module with
  its own tests
- [ ] **Build camera**: a target, a distance, a yaw and a pitch, with the wheel
  zooming and dragging orbiting and panning
- [ ] **Select panel**: the camera written out as the fields the tour shows -
  camera, target, rotate, zoom, pan, field of view and move - reading back what
  a gesture just did and writing what is typed into it
- [ ] **Ground picking**: the canvas point under the pointer, raycast against
  the ground rather than projected onto a plane, so a tilted view still lands on
  what it is pointing at
- [ ] **Select a built element**: the placement under the pointer, found through
  the footprints rather than off the scene because a built element has no mesh
  to hit, with the one on top winning where two overlap, a click told from an
  orbit by how far it travelled, and a click on bare ground dropping the pick
  but never the lasso
- [ ] **Selection highlight**: the hovered placement outlined lightly and the
  chosen one firmly, on the overlay the lasso already draws on, so hovering and
  picking rebuild no ground
- [ ] **The gumball**: the two handle sets the artwork declares, one for
  elements with a height and one for those without, drawn at the placement's
  centre with its axes projected from the camera
- [ ] **Gumball bindings**: each handle writing one declared value and nothing
  else, clamped to the bounds the panel clamps to, so a drag and a typed number
  are two ways into the same schema, with the centre moving the element on both
  gumballs
- [ ] **Re-edit a committed element**: a draft that knows what it stands on, so
  accepting swaps the placement it replaces and cancelling puts that placement
  back rather than deleting it
- [ ] **Builder art in the repository**: the marks, panels and thumbnails the
  builder ships copied into `assets/builder/` from an explicit list, renamed on
  the way in, so the site and CI have every file the markup names
- [ ] **Tool palette**: the two-column palette down the left, carrying the marks
  from `assets/builder/` with the live tool reading as live
- [ ] **Hide the tool palette**: the palette collapsing to a chevron and coming
  back on a click, so the canvas is clear while a handle is being dragged near
  where it sits
- [ ] **One properties panel**: the element editor's row builder lifted into a
  module of its own and the editor pointed at it, so there is one panel
  generated from declared ranges rather than one drawn per tool
- [ ] **Panel field kinds**: a toggle, a choice and a gate that disables a row
  while its toggle is off, named for what `js/config.js` already calls them, so
  the configurable features still queued are a registry edit rather than a
  panel edit
- [ ] **Panel conformance**: a test walking every tool and every range it
  declares, so a kind with no renderer fails the suite on the commit that
  declares it rather than drawing an empty row later
- [ ] **Tool controls panel**: the shared panel docked on the right, pointed at
  one draft placement, with its accept and its cancel, and the split that sends
  each value to the config or to the footprint
- [ ] **Lasso mode**: the sub-palette of ten shape tools in the rows the artwork
  groups them into, with the chosen tool's own fields under it and a deselect
  that is there only while something is selected
- [ ] **Lasso shapes**: the ten tools resolving to the seven footprint kinds, by
  two input gestures - a drag for the shapes and a click per vertex for the
  polylines and curves - rather than ten handlers
- [ ] **Parametric shapes**: a regular figure held as its centre, radius, sides
  and star ratio, so changing the number of sides reshapes what was drawn
  instead of asking for it again
- [ ] **Curved selections**: a boundary of curve segments, flattened once per
  pass rather than once per vertex, with the control points kept so the curve
  stays editable
- [ ] **Clipping to a selection**: the product of the tool's weight and the
  lasso's, so a clipped edge keeps both feathers and a tool that does not mind
  the lasso costs nothing
- [ ] **The active selection**: session state drawn as a dashed outline lying on
  the ground, surviving a tool change and cleared only by deselect
- [ ] **Drawing against a selection**: a shape added to it with `shift`, cut out
  of it with `alt`, or drawn inside it with neither, read once at the press, so
  every tool that minds the lasso shares one rule for combining with it
- [ ] **Shift at the press, shift in the drag**: the key that adds a shape to a
  selection when it is held at the press, and keeps the shape square or round
  when it is pressed after the drag has begun
- [ ] **Placed mountains**: a mountain dropped at a click, each one placement,
  each edited alone
- [ ] **Build Grass, Sand, Water and Snow**: one cover tool, pointed at any of
  the four, laying it by dragging a rounded-rectangle stamp swept whole along
  the stroke, whose width, depth and corner are on the panel in pixels and
  stored in world units once the stroke is laid
- [ ] **Cover density**: how much of a stroke grass, sand, water or snow covers,
  through noise that stays put when a tile is drawn again, defaulting to full
  cover so every preset renders as it does today, with water and snow starting
  full so their strokes are not drawn with gaps
- [ ] **Back to the built world**: the builder reopening straight onto what was
  built rather than on the picker, with every earlier batch still a placement
  that can be picked up and changed
- [ ] **Select shows what is selected**: the picked-up placement's own rows on
  Select's panel beneath the camera fields, so a committed batch's density and
  colour can still be changed
- [ ] **A stroke's band is its ground**: a ground cover drawn with a footprint
  painting all of the ground under it and graded across that ground's own
  relief, worked out on each tile rather than once
- [ ] **Water drawn above the sea**: a water line kept per vertex beside the
  sea's one level, so water drawn on high ground is water where it was drawn and
  nowhere else on the tile, and a runway is lifted clear of the water actually
  under it
- [ ] **Drawn water lies in the ground**: the line set at the lowest bank within
  the stroke's half-width and the ground cut down to it, with the colour running
  from the bank to the middle, so a stroke drawn downhill is a stream and its
  dark end shows wherever it rests
- [ ] **Drawn snow settles where it is drawn**: the snow line put under the
  stroke's lowest ground on each tile, and the depth running from a thin,
  shadowed edge to white in the middle, so snow drawn on low ground shows and
  both colour ends show on any ground
- [ ] **Coarse steps**: `shift` and a click, or `shift` and an arrow, moving any
  panel row by ten points or ten steps, in every panel including the element
  editor's
- [ ] **Drags keep the pointer**: every stroke, lasso and handle drag capturing
  the pointer at the press, so the palette and the camera never see it
- [ ] **Placed runway**: a strip inserted where it was asked for rather than
  where the site search found room, graded to the ground under it on each tile
  and lifted clear of any water, with width, length and a rotation about its
  own centre
- [ ] **Runway templates**: basic and commercial runways and airports as groups
  of placements the registry already has, copied into the placement when it is
  inserted so a template improved later leaves built worlds as they were
- [ ] **Insert a template**: a card chosen on the panel, its outline carried
  over the ground and written only on the click, arriving lined up with the
  view to the nearest ten degrees, then turned and sized on the panel or by the
  gumball
- [ ] **The strip a flight starts on**: a placed strip outranking a searched
  one, so a flight reset onto a runway opens on the strip the pilot built
- [ ] **Free paint**: an element that writes colour and no height, so an
  accepted stroke is ground rather than a decal standing over it
- [ ] **Paint panel**: the colour swatches, the custom picker, the eye dropper
  and the hex field, with the brush as a tip and an edge rather than a list of
  named presets
- [ ] **Brush sizing**: a brush measured in screen pixels while painting and
  stored in world units once the stroke is laid, so a stroke does not change
  size when the camera moves
- [ ] **Strokes land as they are drawn**: each pointer sample projected to the
  ground as it is taken, so the stroke on screen while painting is the stroke
  that gets committed
- [ ] **Paint blending**: a stroke that takes the brush's hue and keeps the
  ground's own lightness, so a painted hillside is still lit from the same side
  rather than going flat
- [ ] **Deselect from anywhere**: the panel row every tool gets while a
  selection exists, and a right click on the selection itself, both going
  through the same place
- [ ] **A panel that scrolls**: the fields scrolling while the heading and the
  accept and cancel stay pinned, with the wheel going to the panel under the
  pointer and to the camera everywhere else
- [ ] **Erase**: free paint inverted - a stroke cut out of the footprints of the
  elements laid before it, any one element or all of them, preset or built, at a
  strength, and with `alt` held putting back what an earlier stroke took
- [ ] **Erasing water and runways**: the sea held per vertex so a hole erased in
  a lake is dry ground, and a strip erased whole and only when it is the target
  named
- [ ] **Shape vocabulary**: the shape tools built once over the seven footprint
  kinds, with each mode declaring the subset it offers, so Lasso's ten and
  Extrude's seven are one implementation
- [ ] **Extrude stages**: the draw, extrude and surface stages with one action
  button reading its label and its enabled state off the stage it is in
- [ ] **Extrude**: a shape drawn on the ground, levelled to it, then pulled up
  by the gumball or by a number, previewing on the overlay and writing the field
  once on release
- [ ] **Sum of shapes**: several shapes drawn before the extrude lifted to one
  height as a single region, with two that overlap reading as one solid
- [ ] **Extrude a selection**: a live selection taken as the region to lift, so
  the button is ready on arrival, and drawn in red while Extrude is the tool so
  it reads as the thing that will be lifted rather than as a clip
- [ ] **Extrusion surfaces**: a top and a wall colour, with a click on either
  pointing the panel at that declared value and outlining it on the overlay,
  and the surface panel's apply keeping a change where its back drops it
- [ ] **Extrusions settle into the ground**: each surface taking the ground's
  own lightness, and the wall's colour fading to the ground's across the band
  its height already eases over
- [ ] **The camera from inside a tool**: a held pan that suspends the live tool
  rather than changing it, putting the tool back on release so a half-drawn
  shape is not committed by moving the view
- [ ] **Derived ranges are hidden**: a range the footprint already determines
  taken off the panel rather than shown and ignored, and given the value the
  footprint implies - the count going away while a selection is live, a ground
  cover's band going away when it is drawn, and drawn water's level with it
- [ ] **Accept and exit**: the two confirms the artwork names, accepting the
  pending edit and then saving and leaving, with the first skipped when nothing
  is pending and the first returning to the editor rather than running on into
  the second, so committing work never doubles as leaving
- [ ] **A tool change asks**: picking another tool with a draft pending asking
  `ACCEPT EDITS` before the tool or its panel changes, with yes committing, no
  discarding, and `Escape` staying where it was, so leaving a tool never decides
  what happens to the work on it
- [ ] **Builder settings**: a settings screen for the builder's own
  preferences, declared and stored the way the game's two settings screens are,
  with a reset to defaults, and read by nothing that generates ground, so a
  built world comes out the same whoever's preferences were on
- [ ] **Builder settings from the builder**: a gear in the palette's header and
  the `O` key opening the screen over the canvas, suspending the live tool the
  way a pan does so a stroke still pending is not committed by it
- [ ] **Builder settings from Settings**: a `BUILDER SETTINGS` row on the game's
  settings screen opening the same screen, with `BACK` returning to whichever
  screen opened it
- [ ] **Auto accept**: a setting that commits a pending draft at the next press
  and at the accept tool instead of asking, never on release, so the stroke just
  drawn stays editable and leaving asks only whether to save, switched on the
  builder's settings screen as a group with `ALL` over it
- [ ] **Auto accept merges**: a draft the setting commits joined to the
  placement before it when nothing about it changed, so auto accept adds a
  placement only where the pilot changed something
- [ ] **Back where it came from**: build mode returning to the title screen or
  to the pause menu, whichever opened it
- [ ] **Re-seat the aircraft**: a flight resumed over ground that changed under
  it put back on top of that ground before the first frame is scored, so a
  mountain built where it was parked is not a crash on resume
- [ ] **Build mode controls help**: the bindings written where they can be found
  rather than learned

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

> 297 earlier items in `TODO-archive.md`, newest last.

- [x] **Weather Guards**: the two assertions that hold the weather layer to
  building once pass on text that is not the code they name
  - **Issue**: both are in
    `test('the weather is built once and drawn down to the condition in force')`
    in `test/page.test.js`, and each is satisfied by something other than the
    line it was written for. `/this\.rain\.count\s*=/` at line 1478 matches the
    `this.rain.count === 0` comparison in `updateRain`, so deleting the
    `this.rain.count = Math.min(...)` assignment in `setPrecipitation` leaves
    the suite green - proven by renaming it to `this.rain.tally`, which keeps
    `test/page.test.js` at 97 pass and 0 fail. `/PRECIPITATION_MOST/` at line
    1476 matches the import and the two constructor references, so `addRain`
    sizing itself with a literal `const count = 5200` passes as well, which is
    the one regression the test's own comment names.
  - **Goal**: bound each pattern to the statement it is about - an assignment
    rather than a comparison, and the figure `addRain` actually sizes itself
    with - and prove each by mutation before accepting it, the way the three
    assertions beside them in the same file were proven.
  - From: UI/UX Override - the weather clock on a slow machine
- [x] **Bulk Three**: the bulk mode is documented as reaching all three
  footprint ranges and reaches two of them
  - **Issue**: `const stretch = config.girthRange.on;` at
    `js/environment/elements.js:467` does not read `config.bulk`, so the mode
    throws `width` and `length` and leaves `girthRange` alone. The behaviour is
    right and `test/environment-elements.test.js` pins it, but three places say
    otherwise: the comment at `js/environment/elements.js:444` ("reads the three
    gated ranges as on"), `docs/api.md:1338` ("every footprint range at once"),
    and `docs/terrain.html` ("randomizes all three at once"). A host that reads
    the API doc and sends `{ bulk: true, girthRange: [0.2, 0.9] }` gets no girth
    variation at all, and the doc's own example at `docs/api.md:1348` says both
    halves of it - "The three footprint ranges randomized together" one line
    above "`girth` is spent".
  - **Goal**: say two rather than three wherever the count is given, and keep
    the reason the third is untouched: under the mode `length` holds the long
    axis, so a girth has nothing left to decide either way. `CHEATSHEET.md` and
    `docs/cheatsheet.html` carry the same "over all three" phrasing, and
    `docs/api-reference.html` is generated from `docs/api.md`, so run
    `npm run docs:api` after editing it.
  - From: UI/UX Override - the weather clock on a slow machine
- [x] Weather Lift 1
  - **Issue**: the cloud deck mirrors nothing. `createCloudDeck` gives about
    half of the 95 clouds `facing: -1` and `js/weather.js:106` spends it as
    `sprite.scale.set(cloud.width * cloud.facing, cloud.height, 1)`, but a
    sprite's size in Three.js r160 - the version `index.html` pins - is
    `scale.x = length(vec3(modelMatrix[0].xyz))` in its own vertex shader, and
    `length` discards the sign. So every cloud draws the same unmirrored
    texture and the deck reads as one shape repeated across the sky, which is
    the outcome `js/weather-math.js:253` says the flip is there to prevent.
    `test/weather-math.test.js:136` pins the deck data rather than the render,
    so the suite is green either way.
  - **Goal**: put the mirror where a sprite can show it - a second
    `SpriteMaterial` over a canvas drawn with `ctx.scale(-1, 1)`, picked by
    `cloud.facing` - and carry the condition's opacity and the hour's colour to
    both materials, since `setPrecipitation` and `updateClouds` each write to
    one today. Settle it on a screenshot rather than on the suite: whether a
    deck stops reading as one repeated shape is not a claim source text can
    hold.
  - **Settled**: built as the goal describes - two `SpriteMaterial`s over two
    canvases, the second drawn through `ctx.scale(-1, 1)` after a translate
    that keeps it on the canvas, picked by `cloud.facing`, with the opacity and
    the colour written to both. Confirmed on the running page rather than in
    the suite: the two textures are each other reversed pixel for pixel, no
    sprite carries a negative scale any more, and a 95-cloud storm drew 38
    clouds from one material and 57 from the other. The source-text half of the
    claim is held by a new assertion in `test/page.test.js`, proven by mutation;
    how the sky reads is for the GUI test this run requested.
  - From: World & Environment
- [x] **Deck Comment**: the comment on `facing` still says the deck is drawn
  from one texture and mirrored on x, which is the bug that was just removed
  - **Issue**: `createCloudDeck` in `js/weather-math.js:272` carries "Every
    cloud is drawn from one texture, so mirroring half of them on x is the
    cheapest way to stop a deck reading as one shape repeated across the sky."
    Both halves are now false. `addClouds` builds two `SpriteMaterial`s over
    two textures, and `facing` picks between them rather than mirroring
    anything on x - mirroring on x is exactly what `sprite.scale.set(cloud.width
    * cloud.facing, ...)` did, which `js/weather.js:100-107` and the assertion
    at `test/page.test.js:1486` now both say is a sprite not mirrored at all.
    A reader working from this comment is told to do the thing the release
    stopped doing, and this is the comment the completed item's own issue
    pointed at as the statement of intent the renderer was failing.
  - **Goal**: say what `facing` now is - which of the two cloud textures a
    cloud is drawn from - and keep the reason it exists, which is the only part
    still true: half a deck reversed stops it reading as one shape repeated
    across the sky. Leave the mechanism to `js/weather.js`, where it is
    described at length already, rather than restating it in a pure module
    that draws nothing.
  - From: Code Review Override - the comments the cloud mirror left behind
- [x] **Deck Cost**: the second cloud material is costed at one more draw call,
  and a sprite is already a draw call of its own
  - **Issue**: `js/weather.js:109` reads "The cost is one more 256 by 162
    texture and one more draw call for the deck". The texture is right; the
    draw call is not a figure the renderer supports. A `THREE.Sprite` in r160
    is pushed into the render list as an object of its own and drawn with its
    own call, so a 95-cloud deck is 95 calls whether the sprites share one
    material or two. What the second material actually adds is material state
    changes, and because the deck is transparent and therefore depth-sorted,
    the two materials interleave down the sorted list - so it is many bindings
    rather than one call. A reader sizing a third texture off this line would
    budget it wrongly in both directions.
  - **Goal**: cost it as what it is - one more texture, and the material
    bindings an interleaved sort costs - or drop the figure rather than carry
    an unmeasured one. Nothing in the repository reads
    `renderer.info.render.calls`, so settle it there if a number is wanted:
    draw a 95-cloud storm and read the count with one material and with two.
  - From: Code Review Override - the comments the cloud mirror left behind
- [x] **The builder in the menus**: `INTERACTIVE ENVIRONMENT BUILDER` last on
  the title screen and on the pause menu, dropped from the pause menu while a
  game mode is running, and opened through the one function `L` uses too
  - From: Interactive Build Mode
- [x] **Blank Canvas**: a sixth environment for the editor to start from, flat
  ground under grass and nothing else, declared beside `ENVIRONMENTS` rather
  than in them so it is a thing to build on rather than a thing to fly over
  - From: Interactive Build Mode
- [x] **Start picker**: the six cards the editor opens on, read off the
  environment registry rather than written out, with Highlands the default and
  a way back out
  - From: Interactive Build Mode
- [x] **The canvas**: one tile drawn rather than nine, at the size the world was
  before the endless grid replaced it, with the camera held over it and nothing
  about the flight's own edges touched
  - From: Interactive Build Mode
- [x] **Footprints**: a region on a placement, as the five kinds a pointer can
  draw - a disc, a ring, a stroke, a rectangle and an ellipse - in the canvas's
  own frame, with the weight function every later item reads
  - From: Interactive Build Mode
