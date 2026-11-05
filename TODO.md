# TODO

Roadmap for Pilot Matter, a browser-based Three.js flight simulator with no
build step. Items under `## Current` are the next work queue; the remaining
level 2 sections group planned work by theme and state the version update
that applies when their items are completed.

## Current

The work queued for the next run, copied here from the roadmap sections below.
Each item carries a nested `From:` line recording the section it came from, so
its context survives being archived.

- [ ] **Extrusion surfaces**: a top and a wall colour, with a click on either
  pointing the panel at that declared value and outlining it on the overlay,
  and the surface panel's apply keeping a change where its back drops it
  - **A colour row is there.** Since `1.0.0-alpha.1.51.0` `color` is a range
    kind, drawn on the dock as swatches, the picker, an eye dropper and a hex
    field; `topColor` and `wallColor` declared with it are drawn the same way.
  - **The stage is there.** Since `1.0.0-alpha.1.53.0` `EDIT EXTRUSION` puts the
    gumball away and the panel is `TOP COLOR` and `WALL COLOR` under `APPLY`,
    which keeps a change as it comes back - see `EXTRUDE_STAGES` in
    `js/extrude.js`. What is left is the click on a surface pointing the
    panel at one, its red outline, and `BACK` dropping a change.
  - From: Interactive Build Mode
- [ ] **Extrusions settle into the ground**: each surface taking the ground's
  own lightness, and the wall's colour fading to the ground's across the band
  its height already eases over
  - **The blend is there.** Since `1.0.0-alpha.1.51.0` `tintColor` in
    `js/environment/elements.js` gives a colour the ground's own luminance,
    which is the first half of this.
  - **The fade is half there.** Since `1.0.0-alpha.1.53.0` an extrusion paints
    the band at its footprint's edge its wall colour, and the compositor
    blends it into the ground by the band's weight, so the wall already fades
    toward the ground at its foot; what is left is both surfaces through
    `tintColor`.
  - From: Interactive Build Mode
- [ ] **The camera from inside a tool**: a held pan that suspends the live tool
  rather than changing it, putting the tool back on release so a half-drawn
  shape is not committed by moving the view
  - From: Interactive Build Mode
- [ ] **Derived ranges are hidden**: a range the footprint already determines
  taken off the panel rather than shown and ignored, and given the value the
  footprint implies - the count going away while a selection is live, a ground
  cover's band going away when it is drawn, and drawn water's level with it
  - **The mountain's count already goes.** A mountain dropped at a click is one
    whether or not a selection is live, so since `1.0.0-alpha.1.42.0` its count
    is a `derived` value on the tool, left off the panel by `panelRanges` for
    any placement carrying `at`. What is left is the cover band and drawn
    water's level, which a footprint rather than a click settles.
  - **The cover band goes too.** Since `1.0.0-alpha.1.48.0` `panelRanges` leaves
    off a range the element's `footprintSettles` names for a placement with a
    footprint, and the cover tool's own panel carries only density, the stamp
    and the colours. What is left is drawn water's level.
  - **Everything it names now goes.** Since `1.0.0-alpha.1.49.0` a placement
    with a footprint shows neither what its element's `footprintSettles`
    works out nor what its `footprintIgnores` - drawn water's level and
    flatten - beside the count and the band. Its run is checking nothing else
    is shown and ignored, and settling it.
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

- [ ] **Extrusion surfaces**: a top and a wall colour, with a click on either
  pointing the panel at that declared value and outlining it on the overlay,
  and the surface panel's apply keeping a change where its back drops it
  - **A colour row is there.** Since `1.0.0-alpha.1.51.0` `color` is a range
    kind, drawn on the dock as swatches, the picker, an eye dropper and a hex
    field; `topColor` and `wallColor` declared with it are drawn the same way.
  - **The stage is there.** Since `1.0.0-alpha.1.53.0` `EDIT EXTRUSION` puts the
    gumball away and the panel is `TOP COLOR` and `WALL COLOR` under `APPLY`,
    which keeps a change as it comes back - see `EXTRUDE_STAGES` in
    `js/extrude.js`. What is left is the click on a surface pointing the
    panel at one, its red outline, and `BACK` dropping a change.
- [ ] **Extrusions settle into the ground**: each surface taking the ground's
  own lightness, and the wall's colour fading to the ground's across the band
  its height already eases over
  - **The blend is there.** Since `1.0.0-alpha.1.51.0` `tintColor` in
    `js/environment/elements.js` gives a colour the ground's own luminance,
    which is the first half of this.
  - **The fade is half there.** Since `1.0.0-alpha.1.53.0` an extrusion paints
    the band at its footprint's edge its wall colour, and the compositor
    blends it into the ground by the band's weight, so the wall already fades
    toward the ground at its foot; what is left is both surfaces through
    `tintColor`.
- [ ] **The camera from inside a tool**: a held pan that suspends the live tool
  rather than changing it, putting the tool back on release so a half-drawn
  shape is not committed by moving the view
- [ ] **Derived ranges are hidden**: a range the footprint already determines
  taken off the panel rather than shown and ignored, and given the value the
  footprint implies - the count going away while a selection is live, a ground
  cover's band going away when it is drawn, and drawn water's level with it
  - **The mountain's count already goes.** A mountain dropped at a click is one
    whether or not a selection is live, so since `1.0.0-alpha.1.42.0` its count
    is a `derived` value on the tool, left off the panel by `panelRanges` for
    any placement carrying `at`. What is left is the cover band and drawn
    water's level, which a footprint rather than a click settles.
  - **The cover band goes too.** Since `1.0.0-alpha.1.48.0` `panelRanges` leaves
    off a range the element's `footprintSettles` names for a placement with a
    footprint, and the cover tool's own panel carries only density, the stamp
    and the colours. What is left is drawn water's level.
  - **Everything it names now goes.** Since `1.0.0-alpha.1.49.0` a placement
    with a footprint shows neither what its element's `footprintSettles`
    works out nor what its `footprintIgnores` - drawn water's level and
    flatten - beside the count and the band. Its run is checking nothing else
    is shown and ignored, and settling it.
- [ ] **Builder settings**: a settings screen for the builder's own
  preferences, declared and stored the way the game's two settings screens are,
  with a reset to defaults, and read by nothing that generates ground, so a
  built world comes out the same whoever's preferences were on
- [ ] **Builder settings from the builder**: a gear in the palette's header and
  the `O` key opening the screen over the canvas, suspending the live tool the
  way a pan does so a stroke still pending is not committed by it
  - **The header is there.** Since `1.0.0-alpha.1.45.0` the palette is headed
    by a white band carrying the chevrons that fold it, drawn by `drawPalette`
    in `js/main.js`; the gear goes on it beside them. A gear drawn in the
    repository goes in `assets/builder/` beside the copied art -
    `tools/sync-builder-assets.mjs` never prunes, so a later sync leaves it.
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
- [ ] **Re-seat the aircraft**: a flight resumed over ground that changed under
  it put back on top of that ground before the first frame is scored, so a
  mountain built where it was parked is not a crash on resume
  - **Until then a changed world starts the flight again.** Since
    `1.0.0-alpha.1.42.0`, leaving from the pause menu with a built world kept
    passes `changed` to `leaveBuilder`, and the flight goes back to its start
    rather than resuming in moved ground. This item is what lets it resume.
- [ ] **Build mode controls help**: the builder's control list, grown by each
  item as it added a binding, carried into the docs and the cheat sheet beside
  the flight's and held to the code there the way the flight's is

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

> 361 earlier items in `TODO-archive.md`, newest last.

- [x] **Strokes land as they are drawn**: each pointer sample projected to the
  ground as it is taken, so the stroke on screen while painting is the stroke
  that gets committed
  - **The cover tool's do.** Since `1.0.0-alpha.1.48.0` `dragCover` in
    `js/main.js` stands each sample on the ground as it is taken, every six
    pixels, and the trail on the overlay is drawn through them.
  - **Settled**: the samples were already stood on the ground; the width was
    not. The trail was a line the brush's pixels wide through them, the width
    the stroke has only where it was pressed. A stroke being drawn - either
    tool's - is now `strokeRibbon` in `js/build-overlay.js`: the region the
    footprint will cover, worked out in world units from the samples and the
    stamp at the press's scale, then stood on the ground and projected, filled
    in the paint's own colour or the cover trail's blue. Held in Node against
    the footprint's own measure, over bends, stamps of one point, and round
    and square tips; `strokeTrail` is gone.
  - From: Interactive Build Mode
- [x] **Paint blending**: a stroke that takes the brush's hue and keeps the
  ground's own lightness, so a painted hillside is still lit from the same side
  rather than going flat
  - **Settled**: `tintColor` in `js/environment/elements.js` is the W3C
    compositing spec's Color blend in Rec. 709 luminance: every channel
    shifted by the same amount to the ground's luminance, then drawn in toward
    its own grey where that takes a channel past what one holds. The plan's
    sketch, which scales the paint to the ground's luminance and clips, loses
    it: a deep blue on pale ground is clipped back to the deep blue it was,
    and black divides by nothing. A tinted colour has the ground's luminance
    exactly, the paint's hue, and as much of its saturation as that lightness
    can carry; a colour with no hue is the ground's grey.
  - From: Interactive Build Mode
- [x] **Deselect from anywhere**: the panel row every tool gets while a
  selection exists, and a right click on the selection itself, both going
  through the same place
  - **The lasso's own is there.** Since `1.0.0-alpha.1.46.0` `DESELECT` is on
    the lasso's panel while something is selected, through `deselect` in
    `js/build-mode.js`; this item puts the same answer on every tool's panel
    and on a right click on the selection.
  - **Free Paint has none yet.** Since `1.0.0-alpha.1.51.0` Free Paint minds
    the lasso and its panel is three sections with no answer of their own; a
    `DESELECT` there goes under `actions` beside the batch's `ACCEPT` and
    `CANCEL`, as on the lasso's, and the `paint` walkthrough's right click is
    on the selection drawn over a paint stroke.
  - **Settled**: `dockContent` in `js/build-panel.js` puts `DESELECT` among
    every panel's answers while something is selected, after the edit's own,
    and the lasso's once; a tool with no panel yet - Mountain before a drop -
    shows its heading over `DESELECT` alone. It is an answer rather than the
    plan's `when: { 'ctx.lasso': true }` row, since the lasso's was one
    already and a gated range would have to be declared on every tool's
    ranges. A right click on the selected ground - a right press that did not
    travel, without `shift`, with no drag or stroke under way - opens
    `#build-popup` at the pointer, carrying the same answer through
    `deselect`. The popup is session state, `openDeselectPopup`,
    `deselectPopup` and `closeDeselectPopup`, and is shut by a press anywhere
    off it - on the canvas the press goes no further - by `Esc` before
    anything else, by a tool change, by any question once it is answered, and
    by a new canvas; no brush is drawn under it. The control list reads
    `Right Click - Offer Deselect, on the Selection`.
  - From: Interactive Build Mode
- [x] **Erase**: free paint inverted - a stroke cut out of the footprints of the
  elements laid before it, any one element or all of them, preset or built, at a
  strength, and with `alt` held putting back what an earlier stroke took
  - **`alt` is the builder's.** Since `1.0.0-alpha.1.47.0` `AltLeft` and
    `AltRight` are swallowed while a canvas is open, and the lasso reads `alt`
    once at the press through `lassoOp`; Erase's `alt` is read the same way.
  - **The stroke is shared.** Since `1.0.0-alpha.1.51.0` the cover tool and
    Free Paint are the stroke tools: `isStrokeTool`, `strokeValues`,
    `layStroke` and `strokeStamp` in `js/build-tools.js` and
    `js/build-mode.js` serve any tool marked `cover` or `paint`, and
    `strokeRibbon` shows a stroke as it is drawn. Erase's stroke is a third
    through the same, its brush `PAINT_BRUSH`'s tip, edge and size.
  - **Settled**: `js/environment/erase.js`. An erase batch is
    `{ type: 'erase', config: { target, strength, restore }, footprint, clip }`
    and is applied to nothing: `buildEnvironment` hands the placements, once
    templates are expanded, to `resolveErasures`, which gives each placement a
    batch after it reaches a `cut` - the regions taken, their strengths, and
    the put-back batches after each that hand part back. The compositor weighs
    what the cut leaves beside the footprint rather than inside it, after the
    footprint has settled what it settles, so a cover's band and drawn
    water's line come from the footprint as drawn; that is why there is no
    `WHOLE` footprint, as the plan sketched - a preset's placement goes through
    the copy on its cut alone. A cut leaves `1 - strength * taken`, and a
    put-back batch takes `1 - strength * putBack` off what it hands back. The
    first stroke of a batch says what it is - `alt` held at its press makes one
    that puts back - and a stroke the other way within a batch is cut out of
    it through `addToPlaced`'s `subtract`, so an overshoot is put right before
    an accept. `TARGET` is `ALL` and every registry id, read off it. Erase is
    on the palette, its `element` the batch's type, with its own ranges
    through `toolRanges`, the paint brush, and the panel `TARGET`, `STRENGTH`,
    `TIP`, `EDGE` and `SIZE`; a stroke is drawn red, or green with `alt`. A
    batch is picked by its strokes, carries the Flat gumball, and is edited by
    its own rows. A placement erased whole is still picked where it stood,
    since its reach is its own.
  - From: Interactive Build Mode
- [x] **Erasing water and runways**: the sea held per vertex so a hole erased in
  a lake is dry ground, and a strip erased whole and only when it is the target
  named
  - **The line is there.** Since `1.0.0-alpha.1.49.0` `field.water.line` holds
    one height a vertex beside the sea's level, and `waterSurface` reads a
    vertex as wet only where it lies under its own line - so a hole erased in a
    lake is the line set to `NaN` there.
  - **Settled**: the sea already wrote its line wherever it reached; the
    compositor now carries a line back through what a cut leaves, so a hole
    taken out of the sea has none and is dry ground, its basin uncut, and the
    sea's level comes across from a sea drawn through a cut alone, being the
    sea's still. `waterUnder` reads the highest line under a strip rather than
    the sea's level wherever there is a line, so a strip over a dry hole is not
    lifted - every preset's sea writes its level into the line under every
    strip, so no preset strip moved. The `runway` element declares
    `erasedWhole`: a strip any of whose vertices a cut reaches is not drawn at
    all, record and grading with it. `ALL` leaves a strip, and only a placed
    one - carrying `at` - can be taken by name, since a searched strip is laid
    when the world is flown and never on the canvas the stroke was drawn over.
    Found on the way: a placed template's strip was laid on all nine tiles of a
    flown world, `tileElements` taking off only placements typed `runway`; a
    group comes off every tile but the middle one now too.
  - From: Interactive Build Mode
- [x] **Shape vocabulary**: the shape tools built once over the seven footprint
  kinds, with each mode declaring the subset it offers, so Lasso's ten and
  Extrude's seven are one implementation
  - **The seven kinds are there.** Since `1.0.0-alpha.1.47.0`
    `FOOTPRINT_KINDS` reads all seven, and the lasso's ten tools draw them
    through `lassoFootprint` in `js/lasso.js` from one table of kinds and
    gestures; this item is that table shared with Extrude's seven.
  - **Settled**: `js/shapes.js` is the vocabulary - ten shapes, each a
    footprint kind and a gesture, with their own fields - and
    `shapeFootprint` and `reshapeShape` what a gesture comes to. A mode
    declares the shapes it offers through `modeTools`, under its own ids,
    labels, rows and art: the lasso all ten, as it did, and Extrude seven, a
    Circle the lasso's ellipse and a Polycurve its curved polyline.
    `js/lasso.js` keeps every export it had, drawn through the vocabulary, and
    main's gesture draws the shape of whichever mode is live - see
    `liveShapeTool` - differing only in what is done with the region.
    Extrude's icons are cut from its panel's art, as the lasso's are.
  - From: Interactive Build Mode
- [x] **Extrude stages**: the draw, extrude and surface stages with one action
  button reading its label and its enabled state off the stage it is in
  - **Settled**: `js/extrude.js` declares the three stages and the one button:
    `EXTRUDE`, greyed until the region covers ground; `EDIT EXTRUSION`; and
    `APPLY`, which the surfaces return by. The stage is carried on the draft,
    as the plan has it; while drawing, the draft is shown over the canvas and
    is not ground - `builtPlacements` leaves it out - and the panel offers
    `CANCEL` and no `ACCEPT`, nothing being lifted to keep. A disabled answer
    is drawn greyed, its label and state written without the panel being
    built again. The surfaces stage's panel is the two colour rows under
    `APPLY`; telling `BACK` from `APPLY`, and choosing a surface by clicking
    it, are the next item's. Picking another shape with an extrusion lifted
    keeps it, asking nothing, and is back at drawing - the stages' way out. A
    shape picked while drawing keeps what was drawn, so the plan's `KEEP
    DRAWING` has nothing to undo.
  - From: Interactive Build Mode
- [x] **Extrude**: a shape drawn on the ground, levelled to it, then pulled up
  by the gumball or by a number, previewing on the overlay and writing the field
  once on release
  - **The airport templates wait on it too.** Their buildings are extrusions
    over rects at fixed distances from the strip's edge and ends - see
    `RUNWAY_TEMPLATES` in `js/templates.js` - so they move out as the strip
    widens.
  - **And on it alone.** Since `1.0.0-alpha.1.51.0` `paint` is in the
    registry, so `extrude` is the last element the airports wait on; their
    aprons are `paint` rects at `blend: 'normal'` in the strip's grey.
  - **An erase leaves the level it had.** Since `1.0.0-alpha.1.52.0` a cut is
    weighed after a footprint settles what it settles, so an extrusion's level
    worked out through `footprintSettles` is the drawn shape's, and erasing
    part of it leaves the rest where it stood. A strip's `erasedWhole` is the
    pattern for anything else that is all or nothing.
  - **Settled**: `extrude` is in the registry beside `town`, before snow:
    `height`, `flatten`, `topColor`, `wallColor` and `level`, which a
    footprint settles as its ground's mean on each tile through a new `mean`
    settler, and `drawn: 'edge'` - the region's weight - which paints the
    band at its edge the wall and what it wholly covers the top. The blue
    arrow lifts a scalar height, a `lift` beside the mountain's `raise`. While
    it is pulled the ground is left alone: the overlay draws the region's
    outline on the ground and at the height reached, from the top it stood at
    when the drag began, and the field is written on release. The airports
    are laid out with it - a strip, a `paint` apron and `extrude` buildings,
    each a lot kept at its distance from the paving as the strip widens, the
    whole held on the canvas by its farthest lot and picked by any of it.
  - From: Interactive Build Mode
- [x] **Sum of shapes**: several shapes drawn before the extrude lifted to one
  height as a single region, with two that overlap reading as one solid
  - **The union is there.** Since `1.0.0-alpha.1.47.0` a `combine` footprint
    with `union` weighs as the larger of its parts, so two shapes that overlap
    already read as one region; this item lifts one to a single height.
  - **Settled**: shapes drawn before `EXTRUDE` are one placement's footprint,
    joined in a `placed` frame by the op their press read - `lassoOp`, the
    lasso's own rule: added with nothing selected or with `shift`, cut out
    with `alt`, and drawn within a selection with neither. `addToPlaced` takes
    `intersect` for that. A shape that leaves the region covering no ground
    is refused. One `height` lifts the region whole, and two shapes that
    overlap read as one block.
  - From: Interactive Build Mode
- [x] **Extrude a selection**: a live selection taken as the region to lift, so
  the button is ready on arrival, and drawn in red while Extrude is the tool so
  it reads as the thing that will be lifted rather than as a clip
  - **Settled**: with a selection live and nothing drawn, `extrudeRegion` is
    the selection, so `EXTRUDE` is ready on arrival and lifts it as it stands
    - as a region, carrying no clip. The overlay draws the selection solid
    red while Extrude is the tool, and once shapes are drawn into it the
    region they come to is filled red under a red dashed edge, the selection
    no longer drawn beside it.
  - From: Interactive Build Mode
