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

- [ ] **Select more than one**: `Shift+Click` adds a placement to the
  selection or takes it out, a drag on empty ground draws a marquee that
  selects what it reaches, and the gumball moves, turns and scales the
  selection about its middle as one
  - The dock shows the rows the selection's placements share, a change applied
    to each. Erase and the outliner act on the whole selection. Shift already
    places a road free under Insert City; the two never meet, since Select is
    its own tool.
  - After: The outliner
  - From: Interactive Build Mode `->` Editor Workflow
- [ ] **Duplicate, copy and paste**: `Alt` held while dragging the gumball
  leaves a copy behind, as engines' editors do; `Ctrl+C` and `Ctrl+V` copy the
  selection and paste it under the pointer; `Delete` takes the selection away
  - A copy is a new placement with an id of its own and its name numbered; a
    pasted road snaps as a placed one does.
  - After: Select more than one
  - From: Interactive Build Mode `->` Editor Workflow
- [ ] **A world's own settings**: a WORLD section of the SAVE / LOAD dock
  setting the time of day a world is flown at and whether the day turns, its
  weather, its fog and its sea level, written to the environment file and
  applied when it is flown
  - Today these come from the pilot's settings alone. A world naming one
    outranks the setting for that world, and the Settings screen says so on
    each row it overrides.
  - From: Interactive Build Mode `->` Starter Worlds

### UI/UX Override - SAVE / LOAD's name field under a finger

#### Found Issues

- [ ] The comment over SAVE / LOAD's name field in the coarse block gives two
  figures the browser contradicts, in the rule this turn added
  - **Issue**: the comment above `.dock-text-row .dock-text, .dock-hex` inside
    `@media (pointer: coarse)` says the name is "140 x 24 at every width and
    156 once the columns above widen", and that its own `2 / -1` "would leave
    it the 84 px reading column and the 32 px mark beside it" - 120 px with
    the gap between them. Both figures are of the stylesheet as it stood
    before this turn. Read in Chromium on `LAKESIDE` with SAVE / LOAD open,
    at 320 x 664, at 390 x 844 and at the 900 x 700 side dock: the field is
    274 x 32 at 320 and in the side dock and 344 x 32 at 390, not 156 x 24.
    And with that one declaration put back to the base rule's `2 / -1` and
    nothing else changed, it is **238 px** starting 36 px in from the row's
    left edge - still under its label and not cut - because `-1` is the last
    line of the four column explicit grid, so `2 / -1` spans the trailing
    `1fr` as well: 84 + 32 + 114 and two 4 px gaps. The rule is worth 36 px of
    field and 36 px of left edge, not the 154 px the comment implies. This is
    the same shape of fault the turn was sent to fix - a figure in a comment
    that nothing measured - written into the fix itself.
  - **Goal**: rewrite both figures from a reading. The first paragraph wants
    the field's width now rather than before the rule, or wants saying that
    140 and 156 are what it was; the second wants the measured 238 px and the
    36 px the rule is worth, with the trailing `1fr` named as the third
    column `2 / -1` reaches. The 22 x 15 spinners and the 12 px picker bands
    lower down the same block were re-measured this run and both still hold,
    so it is these two figures alone.
  - From: UI/UX Override - SAVE / LOAD's name field under a finger
- [ ] The name field's own column is the one declaration of this change that
  no test reads
  - **Issue**: `test/page.test.js` derives the coarse `.dock-row`'s
    `grid-template-columns` and `grid-template-areas`, and asserts
    `.dock-row > .dock-label` is `grid-area: label` and
    `.dock-row > .dock-field` is `grid-area: reading`. Nothing asserts
    `.dock-text-row > .dock-text { grid-column: 1 / -1 }`. Proved by removing
    that rule from `index.html` and running the suite: 2,624 tests, 2,624
    pass, while the field narrows from 274 px to 238 and moves 36 px right -
    the reading above. The page was restored byte for byte afterwards. The
    rule's own `min-height` floor is held, and the block's source-order test
    reads `.dock-text-row .dock-text`, the descendant selector of the floor,
    rather than this one, so neither covers it.
  - **Goal**: one assertion beside the two the same test already makes, in
    `the dock's label column is what the stylesheet leaves it, under a mouse
    and under a finger`: `figure('.dock-text-row > .dock-text', 'grid-column',
    { inside: '(pointer: coarse)' })` is `1 / -1`, with the base rule's
    `2 / -1` named as what it displaces and why. It is arithmetic off the
    stylesheet, needs no browser, and would have failed on the turn that
    dropped the rule.
  - From: UI/UX Override - SAVE / LOAD's name field under a finger
- [ ] The coarse `.dock-row` comment counts six wrapped labels where the dock
  writes eight, and names the wrong four as fitting the old column
  - **Issue**: two figures in the comment over `.dock-row` inside
    `@media (pointer: coarse)` in `index.html`, both of them the panel-walk
    arithmetic this turn was sent to replace. First, "Six labels read as two
    lines in the 114 px column - the two above, `GIRTH RANGE MIN` and `MAX`
    and `TREE HEIGHT MIN` and `MAX`" leaves out `DUNE HEIGHT MIN` and `MAX`,
    which the desert element writes and which are 15 characters like the
    girth and tree pairs, so 114.03 px against the 114 px column. The turn's
    own `dockLabels()` walk finds eight labels over 114 px, not six - run it
    and filter on `text.length * 7.602 > 114`. The six is the LAKESIDE
    reading, and the comment's own paragraph credits the derived walk, so the
    one figure in it still taken off a canvas is the one a later reader would
    trust most. Second, "the first four of those read as one line in the 130
    it had" names `BUILDING HEIGHT MIN` and `MAX` among the four, and the
    sentence before it gives them as 19 characters and 144 px - over the 130.
    The four that fit 130 are the 15 character ones, which is the last four of
    the list as written, and the clause after it ("the widening caused four of
    the six") depends on that reading.
  - **Goal**: rewrite both from the walk rather than the canvas. The count
    wants the eight labels over 114 px with the desert pair named, or wants
    saying that six is what LAKESIDE shows and eight is what the dock can
    write; the second wants "the last four" with the 15 character pairs named,
    so it cannot be read as including the 19 character pair the sentence above
    it has just excluded. Six of the eight are then the widening's and two are
    older than it. The 274 px, the 130 px of clearance and the 19 character
    longest were all re-derived in review and hold, so it is these two figures
    alone.
  - From: UI/UX Override - SAVE / LOAD's name field under a finger
- [ ] The 45 px row the trade is quoted in is derived from nothing
  - **Issue**: the same comment prices the fix at "13 px a row, 45 against 32,
    which is 3.2 rows of the panel at 320 x 664 against 4.5", and the
    `CHANGELOG` entry repeats it. That figure is `line-height: 13px` on
    `.dock-row > .dock-label` plus the 32 px control row plus `row-gap: 0` on
    `.dock-row`, and no test reads any of the three - neither `row-gap` nor
    `line-height` appears in `test/page.test.js` at all. Drop `row-gap: 0` and
    every coarse row gains the base rule's 4 px gap - 49 px a row, 2.9 rows at
    320 x 664 - and the suite stays at 2,624 passing while the comment and the
    release note both state 45. This is the shape of fault the turn was sent
    to fix, on the figure the turn's own trade is argued from.
  - **Goal**: one assertion in `the dock's label column is what the stylesheet
    leaves it, under a mouse and under a finger` deriving the coarse row's
    height the way the column is derived beside it: the label's `line-height`,
    the `min-height` the controls are floored at and `row-gap` off the coarse
    `.dock-row`, summed to the 45 px the comment states, with the 32 px a
    mouse row comes to as the figure it is traded against. Arithmetic off the
    stylesheet, no browser, and it fails on any of the three being dropped.
  - From: UI/UX Override - SAVE / LOAD's name field under a finger

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
record, and anything left behind in the builder by a turn that closed - a
defect measured after the work that caused it was archived belongs here rather
than in a queue of new features.

- [ ] **Dock Label Column 2**: the two 19 character labels still read as two
  lines under a mouse, where the fix for a finger does not reach
  - **Issue**: the label column was given the whole row under
    `@media (pointer: coarse)`, which settles every label a finger meets. A
    mouse is not in that block, so `.dock-row` keeps `1fr 24px 84px 24px` and
    the label keeps the 130 px the row's three fixed columns and its three
    gaps leave it. `BUILDING HEIGHT MIN` and `BUILDING HEIGHT MAX` want 144.4
    px at 7.602 a character, so both read as two lines there. Measured in
    Chromium at 1280 x 800 on `LAKESIDE` with every `WORLD:` section open:
    the 76 other labels Select writes are one line, nothing is cut, and the
    row grows from 18 px to 24 to hold the second line rather than clipping
    it. This is the older half of the defect the coarse fix was queued for,
    and the only half left.
  - **Goal**: decide whether a mouse should pay for it, and record the
    decision either way rather than leaving the column undescribed. The row
    is 18 px under a mouse against 32 under a finger, so giving the label its
    own line there costs proportionally more and buys less: a 24 px row that
    reads correctly is not the same defect as a label that cannot be read.
    The three other ways are the same ones the coarse column had - restore
    the label's 16 px by narrowing something else, drop the label's
    letter-spacing to 0 and take 19 characters to 125.4 px, or keep the wrap
    and say so in the comment over the rule. The assertion in
    `every label the dock can write fits the column a finger is given` records
    the shortfall today and fails when it is settled, which is the prompt to
    close this item; whatever is chosen, that line is what has to be rewritten
    to the new state.

### Editor Workflow

The habits every game engine's level editor shares, which the builder still
lacks. Four of its six are built - undo and redo, the outliner, snapping and
framing the selection - and the last two, multi-select and duplicating, were
queued into `## Current` on 11.20.2026. What is listed below came from this
repository's feedback inbox on 11.21.2026: the ways a tool is reached without
pointing at it.

- [ ] `ctrl-holds-select`: Holding `Ctrl` on a canvas reaches Select without leaving the live tool
  - **Issue**: Select is only reached by pressing its tile in the palette, so
    picking a placement in the middle of a stroke or a run of road costs two
    presses to leave the tool and two to come back. `SELECT_TOOL` is named in
    `js/build-tools.js` and the live tool is `state.tool` in
    `js/build-mode.js`, written by a palette press in `js/main.js` and by
    nothing else: no held modifier on a canvas reads as a tool of its own.
  - **Goal**: `Ctrl` held on a canvas makes Select live for as long as it is
    down, and puts the tool that was live back when it is released, so a pick
    costs one press. The hold is a field beside `state.tool` rather than a
    write over it, so the tool it interrupted is not lost, and `canvasCursor`
    in `js/main.js` and the dock both follow whichever is live. The builder's
    undo and redo are `Ctrl+Z` and `Ctrl+Y` in `js/build-history.js`, and
    `Ctrl+C` and `Ctrl+V` are queued for Duplicate, copy and paste, so the hold
    stands only while no other key goes down with it. A switch for it and the
    key it is held on go in `js/builder-settings.js` under a heading of their
    own, and it gains a row in `js/controls-help.js`, mirrored in
    `CHEATSHEET.md`, `docs/cheatsheet.html` and `docs/controls/index.html`.
  - **Done when**: A test holds the key, reads Select live, releases it and
    reads the first tool back; a second holds the key with `Z` and reads an
    undo rather than a tool change; and the control list test holds the new row
    across the four files.
- [ ] `tool-hot-keys`: A key of its own for each tool on the palette
  - **Issue**: Every tool is chosen by pointing at its tile. `BUILD_TOOLS` in
    `js/build-tools.js` lists them in palette order and `js/build-palette.js`
    draws the marks, but nothing on a canvas answers a key with a tool:
    `BUILD_HELP_ROWS` in `js/controls-help.js` carries keys for moving,
    reframing, framing, undo, the builder settings, the help list and the
    photo, and not one for choosing a tool.
  - **Goal**: Each built tool carries a key, read on a canvas where no edit is
    in hand, and its tile shows that key beside the name it already carries on
    `title` and `aria-label`. The key is declared with the tool in
    `js/build-tools.js`, so a tool added later brings its own, and the set is
    held clear of what a canvas already answers to through
    `js/key-bindings.js` and `js/reserved-keys.js`. A switch and the key for
    each tool go in `js/builder-settings.js`, and each tool gains a row in
    `js/controls-help.js`, mirrored in `CHEATSHEET.md`, `docs/cheatsheet.html`
    and `docs/controls/index.html`.
  - **Done when**: A test presses each built tool's key and reads that tool
    live, a second reads no key colliding with the canvas keys already bound,
    and the control list test holds the new rows across the four files.

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
first day - and the quest mode's towns and airports are ready for it. The
first of them, a world's own settings, was queued into `## Current` on
11.20.2026, ahead of the sculpt tools the three worlds themselves are laid
with - it is the file and the dock rather than content, so it needs none of
them.

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

- [ ] `alt-click-turns-piece`: `Alt` held at a click turns the piece in hand instead of putting it down
  - **Issue**: A piece armed in Insert City is placed facing the way the view
    looks, to the nearest ten degrees: `insertObject` in `js/build-mode.js`
    takes its heading from `arrivalHeading(viewBearing(...))` in `js/main.js`,
    and a second click moves the piece in hand keeping the heading it had. So
    the only way to turn a piece before it is accepted is to orbit the camera
    round to the angle wanted, and the only way after is to accept it and
    reach for the gumball.
  - **Goal**: With Insert City live and a piece in hand, a click with `Alt`
    held turns that piece by one step where it stands rather than moving it, so
    a run of road or a row of houses is laid at the angle wanted without moving
    the view. The step follows the angle snap the dock's `ANGLE` switch holds,
    and the preview in `js/main.js` turns with it. `Alt` is free for this tool:
    it is the lasso's cut, the extrude region's cut and Erase's restore, none
    of which is live beside Insert City. A switch and the held key go in
    `js/builder-settings.js`, and the gesture gains a row in
    `js/controls-help.js` beside the two Insert City already has, mirrored in
    `CHEATSHEET.md`, `docs/cheatsheet.html` and `docs/controls/index.html`.
  - **Done when**: A test places a piece, clicks with `Alt` held, and reads the
    heading stepped with the piece still in hand at the point it was put down.
- [ ] `roads-own-section`: The road pieces fold under a section of their own on Insert City
  - **Issue**: The six road pieces carry `category: 'infrastructure'` in
    `js/prefabs.js`, so `INFRASTRUCTURE` on the Insert City dock opens on a
    grid holding a power station, a water tower, a substation, a fire station
    and a hospital with STRAIGHT, CURVE, T-JUNCTION, CROSSROADS, ROUNDABOUT and
    DEAD END among them. Roads are laid differently from everything else in
    that grid, snapping end to end unless `Shift` places one free, and laying a
    run of them means finding them again among the buildings every time.
  - **Goal**: A `roads` category of its own in `PREFAB_CATEGORIES` in
    `js/prefabs.js`, carrying the six pieces, so `DOCK_CITY` in
    `js/build-panel.js` folds a `ROADS` section beside `INFRASTRUCTURE` with
    nothing else to change: the dock builds its sections from the categories
    and `prefabsIn` already answers per category.
  - **Done when**: `test/city.test.js` reads the six road prefabs under the
    roads category and none of them under infrastructure, and
    `test/roads.test.js` still snaps them to each other.
- [ ] `interstate-road-pieces`: An interstate family of road pieces that join each other
  - **Issue**: Every road in `js/prefabs.js` is a single carriageway at
    `ROAD_WIDTH` 12, built from `asphalt`, `dashes` and `arc`: STRAIGHT, CURVE,
    T-JUNCTION, CROSSROADS, ROUNDABOUT and DEAD END. There is nothing to lay a
    trunk road with, so a city has streets inside it and no road running out of
    it.
  - **Goal**: A family of interstate pieces beside the six, each a `road` kind
    recipe whose `connectors` join the others of its family through `snapRoad`
    in `js/roads.js`: a divided straight and a divided curve, an entrance ramp
    and an exit ramp, an overpass standing clear of the piece crossing under
    it, and an interchange where two of them meet. They are drawn from the same
    `ribbon` parts the six are, at a width of their own with a median between
    the carriageways, and one piece tapers from that width to `ROAD_WIDTH` so
    the family meets the streets. Each is offered under the roads section of
    the catalogue.
  - **Done when**: `test/roads.test.js` snaps each piece of the family to every
    piece it should meet, and `test/city.test.js` reads the new recipes through
    `readRecipe` with bounds matching the footprints they declare.

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

## User Feedback

Feedback from this repository's `.user-feedback` inbox that no other section
of the roadmap holds, each item rewritten as work a run can do. Completing
items in this section applies a patch version update.

- [ ] `extrude-water-on-top`: Water drawn over an extrusion is buried under it rather than lying on its top
  - **Issue**: `ELEMENT_ORDER` in `js/environment/elements.js` lays `water`
    before `extrude`, so a water stroke drawn on an extruded top is composed
    into the ground the extrusion has not yet been raised from. `bankMeasure`
    in `js/environment/footprinted.js` settles the stroke's line from that
    lower ground, `drawWater` cuts the ground down to it, and the extrusion
    then levels and repaints every vertex over the top of it. Measured in Node
    on 11.21.2026: a 300 unit extrusion with a water stroke across its top
    comes out at height 328.7 in the extrusion's own grey, with the water line
    left at -1.5, so the water a renderer finds is 330 units under the surface
    it was drawn on.
  - **Goal**: A water stroke drawn over an extrusion rests on the extruded
    surface. The order is what decides it, and the two kinds of water are told
    apart rather than the whole order moved: a drawn body, the one
    `footprintSettles` names `waterLine`, is composed after the extrusions, so
    its bank and its cut read the raised ground, while a preset's sea keeps the
    place it has, since a sea laid after an extrusion would flood a building
    standing on a shore.
  - **Repro**: Open a canvas, extrude a shape, choose the cover tool's water
    and draw a stroke across the extruded top, then accept the edit.
  - **Evidence**: `.user-feedback/img/extrude-water-on-top.png` (local only;
    the stroke shown on the plateau while it is drawn, and the plateau dry with
    water on the lower ground beside it after the mouse is released)
- [ ] `extrude-paint-on-top`: A Free Paint stroke over an extrusion leaves no colour once it is released
  - **Issue**: Free Paint shows over an extruded top while the stroke is being
    drawn, through `strokeRibbon` in `js/build-overlay.js`, and the top is its
    own colour again once the mouse is released. The element pipeline is not
    the cause: measured in Node on 11.21.2026, a paint stroke over a 300 unit
    extrusion composes as painted, because `ELEMENT_ORDER` in
    `js/environment/elements.js` lays `paint` after `extrude`. So the stroke is
    either not being committed over an extruded surface or is committed
    somewhere the redraw does not read it, which puts it in `layStroke` in
    `js/build-mode.js` and the stroke gesture and redraw in `js/main.js`.
  - **Goal**: A Free Paint stroke drawn on an extruded surface keeps its colour
    once it is accepted, as a stroke on ordinary ground does, and the ground
    under it is redrawn in that colour while the draft is still in hand.
  - **Repro**: Open a canvas, extrude a shape, choose Free Paint and drag a
    stroke across the extruded top, then release.
  - **Evidence**: `.user-feedback/img/extrude-paint-on-top.png` (local only;
    the stroke shown in colour while it is drawn, and the extruded top back to
    its own grey after the mouse is released)
- [ ] `build-water-spot-removal`: Drawn water carries a repeating pale blotch instead of reading as water
  - **Issue**: The glint on water is laid per vertex. `waveSpecular` in
    `js/water.js` is a function of where a point is and what time it is, and
    `animateWater` reads it at the field's own vertices, which stand 80 units
    apart on a 16,000 unit canvas. `WAVE.wavelength` is 380, so one crest spans
    under five vertices, and the crossing train at `WAVE.angle` with
    `crossScale` 1.7 beats against that lattice. `WATER_SHEEN` is very nearly
    white and `SHEEN_STRENGTH` is 0.5, so a lit vertex becomes a pale blob a
    cell wide once it is interpolated across its triangles, and the blobs
    repeat in a fixed pattern rather than moving as light on water does.
  - **Goal**: Water reads as water: the glint broken up so nothing repeats at
    the sampling's own spacing, through a noise term in the phase or an offset
    per place so neighbouring vertices are not lit together; the sheen narrowed
    or weakened so a lit vertex is a glint rather than a patch; and the whole of
    it scaled by how open the water is, which `waterSurface` in
    `js/environment/elements.js` already measures and `animateWater` already
    reads for the swell. `WAVE`, `WATER_SHEEN`, `SHEEN_STRENGTH`,
    `waveSpecular` and `waterColor` in `js/water.js` are where it is decided,
    and the module is pure, so the pattern is measurable in Node.
  - **Done when**: A test reads the specular across a tile's vertices and finds
    no repeat at the sampling's spacing, and a canvas screen shot of a drawn
    pond reads as an even surface with glints on it.
  - **Evidence**: `.user-feedback/img/build-water-spot-removal.png` (local only;
    a drawn pond mottled with pale patches, the callouts marking them)
- [ ] `repo-content-skills`: Five repository skills that explain Pilot Matter and turn the explanation into narrated video
  - **Issue**: `.claude/skills/` holds twelve skills and one of them is about
    this project: `interactive-build-mode`, written for a run changing the
    builder's modules rather than for explaining the builder to somebody
    watching. Nothing in the repository gathers what it knows about the
    simulator itself, which is spread across `docs/api.md`,
    `docs/api-reference.html`, `docs/project-structure.html` and the `js/`
    modules, and nothing knows how to turn an answer into a script, a
    narration or a finished video. Every piece of outreach starts from the
    source again.
  - **Goal**: Five skills under `.claude/skills/`, each its own folder with a
    `SKILL.md`, in the shape `interactive-build-mode` already uses.
    `interactive-build-mode-expert` explains the builder to a viewer rather
    than to a run, from the module map and the tool list that skill already
    carries, and writes instructional scripts from it. `pilot-matter-expert`
    covers the simulator as a whole, the API in `docs/api.md`, the module
    layout, the pages under `docs/` and taking the project as a dependency,
    and writes educational scripts. `voice-actor` turns a script into
    narration in a lightly British voice that reads excited, informed or wry
    as the script asks, and names the narration route it drives as an input
    the owner supplies rather than assuming one is installed.
    `pilot-matter-content-creator` drives After Effects, Illustrator and
    Photoshop through the Adobe scripting skills already on this machine to
    cut a script and its narration into a video. `social-media-manager` plans
    what goes out and prepares each post for the owner to publish, holding no
    credential and publishing nothing itself, since no tool on this machine
    posts to a social account and the accounts themselves stay in the local
    inbox rather than in this file.
  - **Done when**: Each of the five folders holds a `SKILL.md` whose front
    matter names it and says when to use it, and
    `interactive-build-mode-expert` and `pilot-matter-expert` each produce a
    script for one feature of the repository from the repository alone.
- [ ] **User only**: `instructional-video-posts`: Narrated Interactive Build Mode videos go out on a settled cadence
  - **Issue**: Interactive Build Mode is the largest thing in the repository
    and the only account of it for somebody who has not read the code is
    `docs/terrain.html` and `CHEATSHEET.md`, both written to be read rather
    than watched. No routine takes a builder feature, writes a script for it,
    narrates it, cuts it and puts it in front of anybody, so each new tool
    lands with nothing explaining it.
  - **Goal**: A standing routine that produces one instructional video a cycle
    about a builder feature and leaves it ready to publish: the script from
    `interactive-build-mode-expert`, the narration from `voice-actor`, the cut
    from `pilot-matter-content-creator`, and the plan and the post copy from
    `social-media-manager`. The finished files land outside the repository, in
    the folder the owner names, nothing is published by a run, and the accounts
    to publish to stay in the local inbox rather than in this file.
  - **Decide first**: Two questions the repository cannot answer. The cadence:
    weekly builds an audience fastest and is a video a week to make; monthly
    sits alongside the roadmap without crowding it and reads as quiet; one per
    release ties each video to work already finished and leaves gaps as long as
    the release gaps. The reach: a short for every platform is the least edit
    and suits the builder's short gestures; one long video with shorts cut from
    it carries a whole workflow and doubles the edit; a single platform is the
    smallest commitment and the smallest result.
  - **After**: `repo-content-skills`
- [ ] **User only**: `educational-content-posts`: Educational posts about the simulator itself go out on a settled cadence
  - **Issue**: The repository explains itself only to a reader who opens it:
    `README.md`, `QUICKSTART.md` and the pages under `docs/` cover the API, the
    flight model and the project layout, and none of it reaches anybody who has
    not already found the repository. Nothing turns a module, an API call or a
    piece of the flight model into a post or a video, so the parts of the
    project that would interest somebody building on it are invisible from
    outside.
  - **Goal**: A standing routine that produces one educational piece a cycle
    about the simulator itself, a module, an API call, the flight model or
    taking the project as a dependency, and leaves it ready to publish: the
    script from `pilot-matter-expert`, the narration from `voice-actor`, the cut
    or the still from `pilot-matter-content-creator`, and the plan and the post
    copy from `social-media-manager`. The finished files land outside the
    repository, in the folder the owner names, nothing is published by a run,
    and the accounts to publish to stay in the local inbox rather than in this
    file.
  - **Decide first**: Two questions the repository cannot answer. The cadence,
    on the same three readings as the instructional videos, and whether the two
    share one calendar or keep their own: one calendar is a single decision and
    halves what goes out per subject; two calendars double the output and the
    work. The form: video for everything matches the instructional side and
    costs the most per piece; a still or a code card for the educational side is
    far cheaper and reaches a different reader; alternating keeps both and
    settles neither cadence cleanly.
  - **After**: `repo-content-skills`

## Complete

Everything already done, in the order it was finished, kept as the record of
how the simulator got here rather than as a list still to be worked.

> 454 earlier items in `TODO-archive.md`, newest last.

- [x] `js/build-panel.js` imports `committedPlacements` and never reads it
  - **Issue**: the import added at line 29 is unused - `outlinerSection`
    reads `state?.placements ?? []` directly - so the module declares a
    dependency it does not have.
  - **Goal**: drop the name from the import, or read the placements through it
    in `outlinerSection` if the copy was the intent.
  - **Settled**: dropped. `outlinerSection` reading the session's placements
    directly was the intent, and the same import now brings `confirmOpen` and
    `editPending`, which the bar's titles need.
  - From: UI/UX Override - the editor workflow's four additions
- [x] The dock's bar answers are under a fingertip on a touch phone
  - **Issue**: the coarse-pointer block in `index.html` now lifts the
    outliner's row controls to 32 px, taking that figure from
    `.dock-field .dock-value`, which the same block already lifts. The bar
    pinned under the panel heading - `UNDO`, `REDO`, `GRID`, `ANGLE`, the
    session's own four answers - was never named in that block, and measures
    74 x 22, 88 x 22 and 96 x 22 CSS pixels on an emulated touch phone
    (Chromium, `devices['iPhone 13']`, 390 x 664, a coarse pointer, Select
    live on a blank canvas). That is ten pixels under the floor the same
    stylesheet now sets for the rows below it in the same dock, and half the
    roughly 44 a fingertip wants. `button.dock-section`, the fold heading, is
    30 px tall for the same reason, though it spans the dock's whole width.
    `.dock-spin button` is 22 x 15 and is left alone: its 22 px column was
    settled deliberately when the dock's own spinners replaced the browser's.
  - **Goal**: Resolve to [dock-bar-touch-targets.prompt.md](.claude/prompts/dock-bar-touch-targets.prompt.md)
  - **Settled**: `.dock-bar-answer` and `button.dock-section` take
    `min-height: 32px` in the `@media (pointer: coarse)` block, the same figure
    the dock's own values and the outliner's rows already use. Measured in
    Chromium on 11-22-26 at 900, 390, 360 and 320 px wide: the four answers
    were 22 px tall at every one of them and the fold headings 30, and all six
    controls read 32 afterwards with the four still on one line at 320, their
    switch rings drawn clear of the words, and neither the dock nor its fields
    overflowing. The prompt's claim that the four sit "in a 276 px row" is the
    desktop dock's row and was not relied on: the row measures 344 px at 390
    and 274 at 320. `.dock-spin button` was left at its deliberate 22 px
    column, which a test now pins.
  - From: UI/UX Override - the dock's bar and the outliner's rows
- [x] The outliner row's coarse-pointer rule reaches wider screens than the
  reason written beside it covers
  - **Issue**: the comment on the new rule in `index.html` says the widened
    columns are what "a phone's dock has the room for - it is 340 to 370 px
    wide against the 300 of a desktop", but `@media (pointer: coarse)` is
    bounded by the pointer and not by the width, while the dock is widened to
    the screen only inside `@media (max-width: 640px)`. So a coarse pointer on
    a screen wider than that - a tablet in landscape, a touchscreen laptop -
    keeps the 300 px side dock and gets the 32 px columns anyway. Arithmetic
    off the stylesheet, with the global `box-sizing: border-box`: a 300 px dock
    is 274 px inside its border and its 12 px padding, so at `18px 1fr 22px
    22px` with 3 px gaps the name field is 274 - 62 - 9 = 203 px, which is the
    figure the row's own docstring in `js/panel-view.js` gives, and at `32px
    1fr 32px 32px` it is 274 - 96 - 9 = 169 px. The field loses 34 px on the
    one device class where the `title` this turn added to it cannot be
    hovered. Nothing overflows - `.dock-outliner-name` carries `min-width: 0` -
    and no figure here was measured in a browser.
  - **Goal**: settle which the rule is for and make the stylesheet and its
    comment say the same thing: either bound the rule the way the dock's own
    width is bounded, `@media (pointer: coarse) and (max-width: 640px)`, or
    keep it as it stands and write the comment to the pointer rather than to a
    phone's width. Measure the row on a coarse pointer wider than 640 px
    before choosing, since 169 px is arithmetic rather than a reading. The
    `CHANGELOG.md` entry for 1.0.0-alpha.1.67.1 carried the same claim and was
    corrected in place by this review, so only the comment is left.
  - **Settled**: measured first, as the goal asked. On a coarse pointer at
    900 x 700 the dock is the desktop's 300 px and the row's name field 169,
    which is the arithmetic confirmed as a reading, against 203 on a desktop
    and 239 on a 390 px phone; nothing is cut at 169 and nothing overflows.
    The rule is kept as it stands, on the pointer, and the comment is written
    to the pointer: a finger is the same size on a tablet, so bounding the rule
    by `max-width: 640px` would put a 22 px target under one on every
    touchscreen wider than a phone, which is the defect the rule exists to fix,
    to buy back 34 px of a field that is not cut and takes a caret on a tap.
    The row's docstring in `js/panel-view.js` now carries the coarse figures
    beside the 203 it already gave, and says `title` cannot be hovered there.
  - From: UI/UX Override - the dock's bar and the outliner's rows
- [x] `dockBar`'s docstring counts two reasons for a dimmed step where the
  code gives three
  - **Issue**: the docstring over `BAR_SNAP_TITLES` in `js/build-panel.js`
    reads "A step is dimmed for two quite different reasons - there is nothing
    to go back to, or there is and an edit is in hand". `barStepTitle`, eighteen
    lines below it, has three branches, and `historyReady` in
    `js/build-mode.js` refuses a step on `confirmOpen` as well as on
    `editPending` - which is why `BAR_CONFIRM_TITLE` is declared four lines
    under that very sentence. `CHANGELOG.md`, `docs/terrain.html` and the test
    in `test/build-history.test.js` all say three. The docstring is the one
    place that says two, and it is the place a reader of `barStepTitle` reads
    first, so the next model to work this module is as likely to read the
    confirm branch as surplus as to check it.
  - **Goal**: three, with the question on the canvas named beside the other
    two, in the one sentence that says otherwise. Nothing else about the
    docstring is wrong and no code changes.
  - **Settled**: the sentence names three and names the question on the canvas
    beside the other two; nothing else in the docstring and no code changed.
    The count is now pinned rather than kept by hand: a test in
    `test/build-history.test.js` reads `js/build-panel.js` as text and holds
    the sentence against the answers `barStepTitle` can give, so a fourth
    reason cannot be added without the sentence being read again. A mutation
    run caught the two-reason wording, the dropped third reason, and the
    confirm branch removed from the function.
  - From: UI/UX Override - the dock's bar and the outliner's rows
- [x] **Dock Label Column**: Five more of the dock's answers are under a fingertip, and the comment
  beside the new floor says there are none left
  - **Issue**: this turn lifted `.dock-bar-answer` and `button.dock-section`
    to 32 px in the `@media (pointer: coarse)` block of `index.html`, and the
    comment over that rule, `index.html:1669`, gives the two of them as "the
    other two answers in the dock a finger lands on". Five more are answers a
    finger lands on, none of them is named in that block, and none of them
    reaches 32. `.dock-step` (`index.html:1527`) is `min-height: 24px` and
    24 px wide, since `.dock-row` (`index.html:1477`) lays a row out as
    `1fr 24px 84px 24px`, and it is the mark that steps every switch, every
    choice and the `PAN` and `MOVE` nudges, so a pilot reaches it on more
    edits than the bar. `.dock-pick` (`index.html:1717`), the reading a press
    steps round, is 24. `.dock-text-row .dock-text` (`index.html:1688`), the
    name SAVE / LOAD writes a world under, is 24. `.dock-swatch`
    (`index.html:1876`) is 30. `.dock-dropper` (`index.html:1912`) is a fixed
    `height: 30px` rather than a floor, so a `min-height` added to the coarse
    block would not move it at all. Nothing is broken - a tap driven at the
    centre works, which is the reach-rather-than-function framing the
    outliner's own item used - but that sentence is what the next reader
    looking for what is left will read, and it says nothing is.
  - **Goal**: measure the five on a coarse pointer first, the way this turn
    measured the bar, then either lift them to the same 32 px or leave a
    figure where it is and say in the comment which figure and why - the way
    `.dock-spin button` is already left there with its reason. `.dock-step`
    and `.dock-pick` want the column widened as well as the floor raised, as
    `.dock-outliner-row` was, and `.dock-dropper` wants its `height` turned
    into a `min-height` before a floor can reach it. Either way the comment
    at `index.html:1669` must name what the block covers and what it
    deliberately leaves, rather than reading as though the dock were done.
  - **Settled**: measured first, on a coarse pointer at 900 x 700 and on an
    emulated touch phone at 390, 360 and 320 px wide, walking all twelve
    panels with every section open. The five read as the finding said -
    `.dock-step` 24 x 24 at every width, `.dock-pick` 84 x 24, SAVE / LOAD's
    name 140 x 24, a swatch 30 tall, the dropper a fixed 30 - and the walk
    turned up two more the finding had not named: `.dock-hex` at 20 and
    `.dock-slider` at 16. All seven are lifted to the same 32 px, with
    `.dock-row`'s two mark columns widened to 32 as the outliner's were; the
    label column pays 16 px, to 114 at 320 and on the side dock, and nothing
    is cut or wrapped there, the longest labels being 13 characters.
    `.dock-dropper`'s base rule is a `min-height` now, since a floor cannot
    lift a fixed height. Two things are left below the floor with the figure
    and the reason written beside the rules - the field's spinners at 22 x 15
    and the picker's bands at 12 - and the comment says so under a heading
    naming what the block deliberately leaves, with the walk's finding that
    nothing else in the dock is under 32. Found while fixing it: the coarse
    block sat in the middle of the dock's rules, so four of these floors
    would have lost to their own base rules on source order and done nothing;
    the block is moved to after every rule it lifts, its order against
    `@media (max-width: 640px)` unchanged.
  - From: Code Review Override - the dock's remaining touch targets
- [x] Three figures in the dock's prose the code no longer supports
  - **Issue**: two of them bless the 30 px this turn measured as two under
    the floor. The comment over `.dock-section`, `index.html:1492`, says a
    folding heading is "a button, marked open or shut, tall enough for a
    fingertip", and `test/page.test.js:4522` asserts `min-height: 30px;` with
    `'tall enough for a fingertip'` as its message - while
    `test/page.test.js:4007` and `index.html:1669`, both written this turn,
    say 30 is under the floor the same stylesheet gives the rows in the same
    dock. A model reading either of the first two first concludes the fold
    heading was already a fingertip target and the coarse rule is surplus,
    which is the trap the `dockBar` docstring item was queued for. The third
    is older: `js/panel-view.js:341` says "the row is 276 pixels wide", and
    the row is 274 - a 300 px dock less its 1 px border each side less the
    24 px of `#build-dock-fields`' padding - which is the figure the same
    docstring's own 203 is derived from, 274 - 62 - 9. This turn read the
    276 as the desktop row and wrote in its settle note that the row
    "measures 344 px at 390 and 274 at 320", so the two figures in one
    docstring still disagree by 2 px.
  - **Goal**: `index.html:1492` and `test/page.test.js:4522` say what 30 px
    is - the figure a mouse is given, with the fingertip's 32 in the coarse
    block - rather than calling it a fingertip's. `js/panel-view.js:341` says
    274. No code changes in any of the three.
  - **Settled**: all three are prose, and no code changed for them. The
    comment over `.dock-section` and the message on the `min-height: 30px;`
    assertion both say what 30 px is - the figure a mouse is given, lifted to
    the fingertip's 32 by the coarse block - and the fold-heading test now
    asserts the comment gives the figure and does not call it a fingertip's,
    so the wording cannot drift back unnoticed. The row docstring says 274,
    with the derivation beside it, and a new test works the row and the name
    field out of `#build-dock`'s width and border, `#build-dock-fields`'
    padding and the outliner row's own columns and gap, asserting the
    docstring names both and no longer carries 276.
  - From: Code Review Override - the dock's remaining touch targets
- [x] **Dock Label Column 1**: four of the dock's row labels wrap onto a second
  line in the 114 px column the widened mark columns leave them
  - **Issue**: the marks widened from 24 px to 32 take their 16 px out of
    `.dock-row`'s `1fr`, and the comment over the rule says that is affordable
    because "the longest labels the dock writes are 13 characters of 11 px
    Courier, `FIELD OF VIEW` and `CORNER RADIUS`, read across all twelve
    panels with every section open". The dock writes longer ones. Read in
    Chromium on a coarse pointer at 900 x 700 and on an emulated touch phone at
    320, both of which give the label 114 px, the same page measured twice -
    once as the stylesheet stands and once with one appended rule putting the
    mark columns back to 24 px, so the only thing between the readings is what
    this turn changed: `GIRTH RANGE MIN`, `GIRTH RANGE MAX`, `TREE HEIGHT MIN`
    and `TREE HEIGHT MAX`, 15 characters and 114.03 px each, are on **one**
    line in the 130 px column the 24 px marks left and on **two** in the 114 px
    column the 32 px marks leave. Each breaks after its second word:
    `GIRTH RANGE` over `MIN`. Nothing is cut - `scrollWidth` never passes
    `clientWidth` - and the row stays 32 px tall, two 12 px lines fitting
    inside the floor the same block gives `.dock-step`, so the cost is a label
    read as two lines rather than one. At 390 px the column is 184 and nothing
    wraps, so the defect is the 114 px column alone: 320 px wide, and the side
    dock a coarse pointer over 640 px keeps. The turn's own walk missed them
    for two reasons, both worth knowing before the fix is measured: it walked a
    **blank canvas**, whose `WORLD:` sections are grass alone against the eight
    a preset such as `LAKESIDE` carries, and it walked the panels **at rest**,
    where a drop tool draws no rows until something is in hand - `MOUNTAIN`
    drew none, and drops fifteen with a draft.
  - **Goal**: Resolve to [dock-label-column-wrap.prompt.md](.claude/prompts/dock-label-column-wrap.prompt.md)
  - **Settled**: option 1, the prompt's own recommendation, and the only one
    of the four that reaches every label. Under `@media (pointer: coarse)`
    `.dock-row` becomes two rows - `'label label label label'` over
    `'down reading up .'` on `32px 84px 32px 1fr` - which is the shape
    `.dock-row.dock-row-slider` already uses. The label takes the row's whole
    274 px at 320 and in the side dock, and 344 at 390; the trailing `1fr` is
    what gives it the row rather than the 156 px the three control tracks come
    to. `.dock-row > .dock-field` moves to the `reading` area and
    `.dock-text-row > .dock-text` to the whole row, so a figure's field and
    SAVE / LOAD's name are not left in a 32 px mark column. Measured in
    Chromium on `LAKESIDE` with every `WORLD:` section open: all 78 labels
    Select writes are one line at 320 x 664, at 390 x 844 and at the 900 x 700
    side dock, against six that wrapped before - the four this turn caused and
    the two older ones; nothing is cut, no two children of a row overlap, the
    marks are still 32 x 32 and the readings are still one column. It costs
    13 px a row, 45 against 32, which is 3.2 rows of the panel at 320 x 664
    against 4.5 and 13 of the side dock against 18.3. Options 2 and 3 were
    measured the same way and settle the six as well, but only together and
    with 4.6 px to spare on the longest label, against 129.6 for option 1.
  - From: Code Review Override - the dock's remaining touch targets
- [x] `WORLD: TOWN`'s two building height labels wrapped in the dock's label
  column before the marks were widened, and still do
  - **Issue**: `BUILDING HEIGHT MIN` and `BUILDING HEIGHT MAX`, 19 characters
    each, are on two lines in the 114 px column and were on two in the 130 px
    column as well, so the widening did not cause them - at the 7.602 px a
    character measured off `FIELD OF VIEW` they want 144.4 px, which neither
    column has. Read on `WORLD: TOWN` in
    Select's panel with the canvas opened on `LAKESIDE`, at 900 x 700 and at
    320. They break after `BUILDING`, read correctly as two lines, and are not
    cut. Nothing else in the 78 labels that panel writes wraps at either
    column.
  - **Goal**: the same fix as Dock Label Column 1, which is why it is recorded
    beside it rather than queued on its own: options 1 and 2 in
    [dock-label-column-wrap.prompt.md](.claude/prompts/dock-label-column-wrap.prompt.md)
    settle both, and option 3 settles only the 15 character labels, so this is
    the reading that tells the whole fixes from the partial one. Close it with
    that item if the fix taken covers it, and leave it open if option 3 is
    taken alone.
  - **Settled**: option 1 was taken, and it covers both readings this item was
    written from - `BUILDING HEIGHT MIN` and `MAX` are one line at 900 x 700
    and at 320, in the 274 px the label now has. The item's premise that
    option 2 would settle them does not hold and was not relied on: the 130 px
    column option 2 restores is 14.4 px short of their 144.4, which the same
    Chromium reading confirms. What the fix does not reach is a mouse, whose
    label column is that same 130 px and where the pair still reads as two
    lines; that half is queued on its own under `Closing the Builder's Gaps`,
    and the derived test in `test/page.test.js` records it so it cannot be
    settled silently.
  - From: UI/UX Override - the dock's label column
- [x] `figure()` in `test/page.test.js` escapes nothing, and reads a selector's
  top-level rule rather than the one asked for
  - **Issue**: the helper the new derivation test reads the stylesheet with has
    three faults, none of which its own three calls happen to reach, and the
    next run is told to build on it. Its escape, on line 3999, is
    ``rule.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')``: the character class
    closes at the `]` that follows `[\\`, so the pattern reads as "one of those
    characters, then two backslashes, then `]`" and matches nothing a selector
    contains - `.dock-outliner-row` goes through unescaped and its `.` matches
    any character - and the replacement would insert two backslashes rather
    than one if it ever fired. Its property match, `${property}: ([^;]+);`, is
    unanchored, so `figure('#build-dock', 'width')` would read a `min-width`
    declared above `width`, and `padding.match(/\s(\d+)px/)` takes a
    shorthand's second value, which is the vertical one in `12px 8px`. Worst
    for what comes next, its block pattern requires the eight space indent of a
    top-level rule, so `figure('.dock-row', 'grid-template-columns')` returns
    the base `1fr 24px 84px 24px` and can never return the
    `1fr 32px 84px 32px` the coarse block declares at twelve spaces - which is
    the one figure
    [dock-label-column-wrap.prompt.md](.claude/prompts/dock-label-column-wrap.prompt.md)
    asks the label column test to be derived from, "in the same style and the
    same file".
  - **Goal**: close the class as `` /[.*+?^${}()|[\]\\]/g `` with a `'\\$&'`
    replacement; anchor the property to the start of a declaration; take a
    shorthand's first value rather than its second; and let the caller name
    which rule of a selector it wants - an indent or an enclosing `@media`
    argument, or a second helper that reads inside a named block - before the
    two label column tests are written against it. Settle this first if the
    column's fix is measured by a derived test, since that test needs the
    coarse `.dock-row` the helper cannot reach today.
  - **Settled**: settled first, and by deletion rather than by repair. The file
    already carried a stylesheet parser - `styleRules`, `declarations` and
    `media`, used thirty-eight times - so `figure` is now four lines on top of
    it rather than a second reader built out of patterns: it takes an `inside`
    naming an `@media` condition, which is how a caller says which of a
    selector's rules it wants, and it throws rather than answering null. None
    of the three faults can recur, because none of the three mechanisms is
    there: `declarations` parses property names whole, so there is nothing to
    anchor; it finds a rule by its selector list, so there is nothing to
    escape; and `media` cuts the block out by counting braces, so indent is
    never read. `firstLength` and `boxSide` replace the two length readings -
    the first takes the front of a value and refuses one that does not open
    with a length, the second expands a box shorthand and is asked for a side
    by name. The faults were unreachable through `index.html`, which is how
    they survived three callers, so the reader is held by a test of its own
    against a stylesheet written to carry them, and four mutants prove it.
  - From: UI/UX Override - the dock's label column
- [x] The test that holds the coarse block's position checks seven of the
  twelve rules it lifts
  - **Issue**: `the coarse block sits after every dock rule it lifts` in
    `test/page.test.js` is the only thing holding the block below its base
    rules, which is what makes its floors win on source order at all. Its list
    names `.dock-row`, `button.dock-section`, `.dock-pick`,
    `.dock-text-row .dock-text`, `.dock-swatch`, `.dock-dropper` and
    `.dock-slider`, and leaves out `.dock-hex`, `.dock-step`,
    `.dock-outliner-row`, `.dock-bar-answer` and `.dock-field .dock-value`.
    `.dock-hex` is the nearest of them, declared about 30 lines above the
    block, so a rule added between the two is the realistic way a floor goes
    silently dead while the suite stays green - the exact failure the test was
    written for.
  - **Goal**: derive the list from the block rather than repeating it by hand -
    read the selectors the coarse block declares, and assert each one's own
    declaration sits above it - so a floor added later is covered without the
    list being remembered. The test's name is then true as written.
  - **Settled**: the list is read off the block with `media` and `styleRules`,
    which gives the nineteen selectors the block declares rather than the
    seven that were written down - `.dock-hex` and `.dock-step` among them,
    and the two rules this turn added. What is asserted of each is that no
    declaration of its own sits **below** the block, which is the failure
    itself rather than a roster of what is above it: a selector the page never
    declares has nothing to lose on source order, so the derived list carries
    `.dock-row > .dock-label` without needing a base rule invented for it. A
    floor count and ten named selectors keep an extraction that returns
    nothing from passing vacuously, and a mutant that moves `.dock-hex`'s base
    rule below the block - the exact case the hand-kept list could not see -
    now fails the test.
  - From: UI/UX Override - the dock's label column
