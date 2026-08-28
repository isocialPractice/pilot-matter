# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.12.0-alpha] - 2026-08-28

### Added

- **A world with no edge.** The world was one square with nothing outside it,
  and carrying the aircraft round at the bounds kept the ground from running out
  without keeping the edge from being reached: the seam where the world stopped
  could still be flown at, and crossing it moved the flight rather than
  continuing it. The square is now one tile of an endless grid of them, each
  tile the same description of a world seeded from its own place in that grid,
  and the tiles around the aircraft are drawn out as far as the camera is drawn
  at - so the ground the fog was promising is actually there and there is nothing
  left to reach. The tile at a given place is that ground every time it is laid,
  so a country worth flying back to is still there on the way back, and the
  middle tile is the description untouched, which leaves every stored seed, every
  course, and every runway exactly where it was
- `js/world-tiles.js`, the arithmetic of that grid and nothing else: which tile a
  place is in, where a tile sits, which tiles have to be drawn for an aircraft
  somewhere in it, and which are worth holding on to. Pure, so the promise it
  makes - that from any position the ground runs further in every direction than
  the camera can see - is a property the tests check across the whole of a tile
  rather than a claim about one position
- **Every menu answers to the mouse**, not only the two the flight opens on. The
  modes panel and all three lists of the settings panel now follow the pointer
  and choose on a click, and a click does whatever choosing that row does: picks
  a world, steps an option on to its next setting, or turns a box over. The
  control list takes the pointer too, so a click collapses it and a click on what
  is left opens it again, which is the way back off it for a pilot who never
  reached for `H`

### Changed

- **A menu takes its keys back off the flight behind it.** Every key that works a
  menu also works a control surface, and only the start screen was taking them,
  so walking the pause menu or the settings panel was also pitching and rolling
  the aircraft under it. A menu on screen now reads the cursor and adjust keys
  ahead of the flight and stops them there; every other key is read as it always
  was, so `F2` still takes a picture of a paused world and `Esc` still closes a
  panel. Both sets of keys the cursor answers to are named on every card that
  carries a menu, because a pilot who reaches for the arrows and is told only
  about `W`/`S` reads the arrows as not working
- The chart in the corner is fitted to the tile being flown over rather than to a
  world that no longer has bounds to draw. Crossing into the next tile moves the
  marker to the edge it came in over and the chart on to the new square, which
  says where in the country the aircraft is instead of pinning it to an edge
- Menu entries are read down their left edge rather than about their middle, so
  entries of different lengths line up under each other, and every one of them
  reads as something to click. The settings panel's headings are set large,
  underlined, and over the left edge of the list each heads, so a panel long
  enough to scroll reads as three sections rather than one run of rows
- The ground is laid a tile at a time, one per frame, so changing world costs a
  few slow frames rather than one long stall - and the tile the aircraft is
  actually over is always drawn before it is flown over, never on a budget

### Fixed

- `tileSeed` gave a place and the place opposite it the same seed, because taking
  one coordinate against the other is only as good as its symmetries: an endless
  world laid out from it would have been folded in half about its middle, with
  the country north-east of the start laid out again to the south-west. The two
  coordinates are now stirred together rather than combined, and no two places in
  a grid share a seed. The middle tile is still the seed itself, so a world laid
  as one square of a grid and the same world laid on its own remain the same
  ground

## [1.11.0-alpha] - 2026-08-27

### Added

- **Worlds that tile**, so an environment can be one square of a larger one
  rather than the whole of what there is. A world told which square of a grid it
  is - `tile: { x, z }` - is generated in the world's coordinates rather than in
  its own: its vertices stand where its place in the grid puts them, its sampler
  answers for that square and nothing outside it, and its mesh is drawn where its
  field says it is, so a host flying across an assembly passes the world position
  it already has rather than converting into and out of each square's own
  coordinates. Because the ground is shaped from noise read off the world rather
  than off the square, the base ground now runs on across a join instead of
  starting again at it
- `join(...neighbours)` and `matchEdges(fields)`, which close what the base
  ground cannot. A peak that ended at one square's edge knows nothing about the
  ground its neighbour laid against it, so every place two or more squares put a
  vertex is settled on one height and one colour - the average of what they all
  had there - and each square is walked back to what it was over the next few
  vertices in, which leaves the join seamless without flattening the country
  behind it. A vertex four squares meet at is settled against all four at once
  rather than twice against two of them, so a corner closes as exactly as an edge
  does, and settling a join that is already settled changes nothing
- `createTiledEnvironment`, which builds a whole grid: every square generated,
  every join settled in one pass before anything is drawn, one set of lights over
  the assembly rather than one per square, and a sampler, an aircraft contract,
  and a water pass that all work across the grid rather than one square at a
  time. It answers the terrain contract the way a single environment does, so the
  Pilot API flies over the whole assembly without knowing it is one
- **A day to fly through**. The world was lit one way all flight, which is a
  world with one hour in it. A cycle now carries a phase from midnight through
  dawn, noon, and dusk and back round, and the sky the world fades to, the fog
  tinted with it, the colour and the strength of the sun, and the fill light
  under it are all read off that phase as the blend between the two moments
  either side of it - so a sunrise is a gradual thing rather than a switch thrown
  at a threshold. The sun walks an arc across the sky and is held a little over
  the horizon after it sets, so the ground keeps its shape after dark and it is
  the colour and the strength of the light that say what time it is. Midday is
  exactly the light the world was drawn in before it had a day, and time the
  flight does not spend flying - paused, held behind the title screen, or under a
  panel - is time the day does not spend passing
- **Moving water**, which is the one part of the ground that was never still and
  the one part that shines. Every vertex at or under the water line now rides a
  swell of two wave trains crossing at an angle, and catches a sheen on the face
  of each crest - a colour the land is never painted, so water reads as water
  rather than as blue ground. The swell is held down to nothing at the bank, so
  the surface meets the shore it was poured against rather than lapping over it,
  and the sheen is scaled by how much daylight there is to throw back, so a lake
  goes flat and dark at night. Both are functions of where a point is in the
  world and what time it is, which is what lets two squares of an assembly work
  out the same surface at the place they meet without agreeing on anything
- `js/day-night.js` and `js/water.js`, both pure and both published:
  `createDayNight`, `advanceDayNight`, `daylightAt`, `sunPositionAt`,
  `wrapPhase`, and `clockAt` for the day, and `waveHeight`, `waveSpecular`,
  `waterColor`, `animateWater`, and `waterSurface` for the water. A host can
  drive its own sky and move its own water from them with no renderer loaded at
  all, or read the hour without drawing one
- `examples/host.html`, a host page working both halves of the API side by side:
  the Pilot API flying over ground the page generated itself, with no terrain of
  Pilot Matter's loaded at all, beside the Matter API carrying an aircraft the
  page built and flies with a model of its own, over an assembly of four squares,
  running the day and moving its own water. It imports by the specifier the
  manifest publishes, which is what a host page installing the package would
  write, and the suite checks it against both halves it is meant to prove
- `setDaylight(phase)` and `updateWater(dt, light)` on an environment and on an
  assembly, `tileOrigin`, `fieldBounds`, `tileSeed`, `SEAM_BLEND`, and a
  `boundsFromSize` that takes the middle of the square as well as its size

### Changed

- A field now carries where it sits in the world - `originX` and `originZ` - and
  every element places what it draws against that origin rather than against the
  middle of the world. A world nobody placed is the square in the middle, which
  is the field the simulator has always built, so nothing about the bundled
  worlds moves
- The document no longer says that two tiles laid side by side meet at a seam a
  host has to fly with enough fog to cover. They meet at matched heights and
  matched colours

## [1.10.0-alpha] - 2026-08-26

### Added

- **The mouse**, on the two menus a flight is started and paused from. The
  pointer moving onto an entry puts the cursor there and a click chooses the one
  it landed on, so `START FLIGHT` is one click from the page loading and a flight
  paused with a hand on the mouse is resumed with the same hand. It is the cursor
  the keys already moved rather than a second one beside it: a click chooses what
  the pointer is over whatever the keys had last walked to, and the keys carry on
  from wherever the pointer left off, so the two are never pointing at different
  entries. Both cards go on letting the mouse through to the flight behind them -
  only the menu drawn on each takes the pointer back, and a click beside the
  entries falls on the world rather than on the card over it
- `applyMenuPointer`, the pointer's half of the selection rules, written as a
  pure function beside `applyMenuKey` and tested the same way: an entry the
  pointer is over, whether it was clicked there, and the id of whatever that
  chose. An index naming no entry - the gap between two rows, or a row left over
  from a menu that has changed under it - moves nothing and chooses nothing
- `MenuList.followPointer`, which hands a drawn list to the mouse. A list nobody
  hands to it listens for nothing, which is how the settings and Game Modes
  panels stay worked by the keys alone, and a list that draws part of a menu
  reports an entry's place in the whole menu rather than its row on screen, so a
  filtered list clicks the entry the cursor would have walked to

### Changed

- Both menus now say what works them rather than which keys do: the start screen
  and the pause card read `W/S OR MOUSE TO SELECT` and `ENTER OR CLICK TO CHOOSE`

## [1.9.1-alpha] - 2026-08-25

### Fixed

- The first stage of **Runway Landing** now opens close enough that the strip
  is clearly visible ahead of the aircraft. The previous approach distance put
  the runway so far through the scene's exponential fog that it read as bare
  ground rather than a marked strip; the opening distance has been halved and
  the starting altitude brought down to match, so the threshold markings are
  prominent from the first frame and the approach angle is manageable

## [1.9.0-alpha] - 2026-08-25

### Added

- A **runway** element, which makes the world somewhere a flight can end as well
  as somewhere it happens. It is an element like any other - a length range, a
  width range, a heading range, the height band a strip may be built in, and the
  reach of the apron either side - but it is the one element that chooses where
  it goes rather than being scattered: sites are drawn from the world's own
  seeded stream, each measured across the whole footprint of the strip rather
  than under the middle of it, and the flattest wins, because what a runway needs
  is not a particular place but ground that does not move under it. A site
  outside the band is charged for the part of it that lies outside rather than
  thrown away, so a world whose ground never quite fits still gets the best
  ground it has instead of getting no runway at all. The pavement is levelled
  dead flat and the apron eases back into whatever was there, so a strip sits in
  the country rather than on a plinth, and it is painted with a stripe down each
  shoulder and a bar across each threshold so it can be picked out from the air
- **Landing**, as an outcome in its own right rather than as the absence of a
  crash. A strip does not raise the bar for how hard an arrival may be so much as
  give it somewhere to be something else: on one, an arrival soft enough and
  square enough - inside the sink rate, the bank, the pitch, and the heading a
  landing is flown at - is a landing, a firmer one still rolls out because
  prepared ground takes more than a hillside does, and only past the runway's own
  threshold is it a crash. Either direction down the strip counts, because a
  runway has two thresholds rather than a start and a finish. Only the frame the
  aircraft arrives on is judged: a rollout is not a second arrival, and judging
  every frame of one would turn a landing into a crash as the airspeed bled away
  underneath it. The outcome is one state the HUD and the game modes both read
- A **START STATE** setting choosing the condition a flight opens in, as two rows
  only one of which can be in force: **Start off flying**, the airborne start the
  simulator has always had, or **Runway takeoff**, stopped at a threshold with the
  nose level, the engine idling, and the strip running away in front. A takeoff
  takes nothing from the airborne fields but the camera, because an aircraft held
  on the ground has no airspeed, no altitude, and no climb of its own to set
- A **RUNWAY** box beside it, saying whether the generated world carries a
  landable strip at all. Unchecked, no runway is drawn and there is nowhere to
  land. A runway takeoff holds it on and greys it out for as long as that start
  is chosen, because a start that asked to roll out of a world with no strip in
  it is not a start anything could honour - and the moment the start is put back
  to flying, the box is back where the pilot left it
- A **Game Modes** panel, reached from the start screen and the pause menu the
  same way Controls and Settings are, listing free flight and every mode there
  is and marking the one being played
- The first two **game modes**, each four stages long and each getting harder at
  exactly the thing it is about. **Runway Landing** opens in the air over open
  country with one strip in it: the first stage puts the strip under the nose
  over flat ground, and each one after it opens further out, further off the line
  back to it, over a shorter strip, in higher country. **Flying through Loops**
  opens lined up on the first gate of a course laid across a shallow valley, and
  each stage lays more gates, tighter, closer together, on a course that bends
  more. A gate is tested against the step the aircraft flew rather than against
  where it ended up, because a hoop is thinner than the distance covered in a
  frame; only the gate the course is up to counts, because the objective is the
  course in order; and a crash puts the stage back to its beginning rather than
  ending the run
- Two thin worlds for the modes to be played over - open country with a strip in
  it, and a valley with the air over it left clear - kept out of the settings
  panel because a mode brings its own ground with it. A stage builds its preset
  with a seed of its own, mixed rather than added, because two seeds a few apart
  open the generator's shift register on much the same value and four stages laid
  from those would have been four goes at the same course
- `js/game-modes.js` and `js/rings.js`: the modes, the stages, the run state, the
  course geometry, and the gate test as one pure module with no DOM or Three.js
  dependency, and the hoops that course is drawn with as another. Unit tests
  cover the stage progression, the run, the course, the gate from both sides and
  across a step long enough to jump it, and every stage of every mode opening on
  a start the configuration can actually hold
- `runway` and `seed` as Matter API options, `runways` on both halves, `landed`
  in the telemetry, `onLanding` and `runwayImpactSpeed` on the Pilot API, and the
  touchdown rules, the strip geometry, and the whole of the game modes published
  from the entry point, so a host can land on its own strips and play the bundled
  modes against its own renderer

### Changed

- A flight start now carries where over the world it opens and whether it opens
  on the ground, so a start is a condition and a place rather than a condition
  over the middle of the world
- The world and the start are now worked out in one place from the run and the
  settings together, so a new world resets the flight, a new start waits for one,
  and nothing has to know which kind of choice was made
- An environment is generated without a runway unless one is asked for, and the
  same description can be built as different ground by asking for a seed, which
  is what lets one preset stand behind four stages of a mode

## [1.8.0-alpha] - 2026-08-24

### Added

- `js/config.js`, holding the condition a flight opens in as one object rather
  than as constants scattered through the flight code. Every field is declared
  twice over: once as the value it opens on, and once as what it is allowed to
  be - its range, the step it moves by, and the units it is read in - which is
  what lets a panel offer the start without knowing anything about flight, and
  a host offer it its own way
- A `START STATE` half of the settings panel, setting the airspeed, altitude,
  climb, heading, throttle, and camera a flight opens in, each remembered in
  `localStorage` for the next session. Edited before launch the aircraft is put
  straight into the new start, so the world behind the panel shows what was set;
  edited mid-flight it waits for the next reset, because a start is the next
  flight's condition rather than this one's
- An option can now be a number stepped along a range as well as a value
  stepped through a list. A range stops at its ends rather than wrapping round
  them, because the ends of a range mean something a list's do not: past the
  fastest a flight can open at is not the slowest
- A world with no outside. Flying at an edge no longer reaches it: the aircraft
  is carried round and comes back in over the opposite edge, at the same
  distance past it, at the same altitude, on the same heading, and at the same
  airspeed. Only the horizontal position moves, and the two axes are carried on
  their own, so a corner crossed diagonally comes back in at the opposite corner
- Photo mode on `F2`, which takes every overlay off the screen for the one frame
  the picture is taken in and downloads the view as a PNG named for the moment
  it was taken. The overlays were never in the picture - a rendered frame holds
  the world and nothing that sits over it on the page - but a photo mode whose
  screen still carried a HUD would be one that lied about the file it wrote. The
  frame is read back inside the same pass that drew it, because a browser clears
  a drawing buffer once its frame has been composited
- `docs/api.md`, writing out the whole API surface: every option and everything
  that comes back for both halves, the contracts, the configured start, the
  worlds and the elements, the edge rule, a worked host page for each half, and
  a stability guarantee saying what holds within a major API version and what -
  the tuning numbers, the rendered look, and anything not exported from the
  entry point - explicitly does not
- `js/world-edge.js` and `js/photo.js`, pure modules holding the crossing and
  photo mode's state and filenames with no DOM or Three.js dependency, with unit
  tests covering the crossing at every edge and corner, the state a held key
  leaves behind, and a frame that refuses to be read
- `wrap` and `onReset` as Pilot API options: the first turns the crossing off
  for a host whose own world continues past the bounds it declared, and the
  second reports a reset - by the menu, by the reset key, or by a crash - to a
  host that wants to hear about it
- `setStart()` on the Pilot API, changing what a reset resets to without
  resetting, and the configured start and the edge rule published from the entry
  point so a host can offer the same start state and match the same crossing

### Changed

- A reset now restores the whole configured start, the camera it opens in
  included, whether it came from the pause menu, the reset key, or a crash
- The settings panel's cursor scrolls the panel to keep itself in view, for a
  window too short to hold three lists of entries at once
- `js/flight-state.js` no longer declares the start, it resolves one: the
  `INITIAL_` constants are the configured defaults read through the conversions
  once, and a flight can be built from any other start the same way
- The minimap's red off-map reading is now only reachable through the Pilot API
  over a host's own world with the crossing turned off, because the bundled
  simulator can no longer be flown out of its world

## [1.7.0-alpha] - 2026-08-23

### Added

- A minimap in the top right corner, drawn north-up the way a chart is read:
  the world's +Z axis runs up the face, +X runs across it, and the marker turns
  under a fixed card rather than the card turning under the marker. It is
  refitted to whichever environment is being flown, so the marker means the
  same thing after a world is changed as it did before, and an aircraft flown
  out past the edge holds the edge it left through and turns red rather than
  being drawn somewhere it is not
- Engine and wind audio. The engine note and its loudness are read off the
  throttle lever, and the wind rises over it with airspeed - faster than the
  airspeed itself, so a standstill is silent and a dive is loud. `M` mutes and
  unmutes both, marked by an `AUDIO MUTED` line above the artificial horizon
  and remembered in `localStorage` for the next session. The sound is built on
  the key that starts the flight, because a browser will not run an audio
  context created before a key was pressed at the page, and it fades to silence
  rather than being torn down, so unmuting picks it back up where it was
- An `OPTIONS` half of the settings panel, holding control sensitivity, fog
  density, and the scales the instruments read on - knots or mph for airspeed,
  feet or metres for the altimeter and the climb rate with it. Each option is a
  value stepped through a list rather than a slider, so no combination of keys
  can land one between two settings, and every choice is remembered for the
  next session on its own: one setting this version cannot read does not cost
  the others their memory
- `O` as a key of the settings panel's own, opening it from the flight, the
  pause menu, or the start screen, and closing it again. The panel holds the
  simulation clock while it is up, so a setting is changed by looking at the
  world rather than by flying into it while looking
- A loading screen carrying the game's name, a progress bar, and a line naming
  the work in hand, which fades off on the strength of a frame the renderer has
  actually drawn rather than on a timer, replacing the static
  "Loading Flight Simulator..." line
- `js/minimap.js`, `js/audio.js`, and `js/loading.js`, pure modules holding the
  chart projection, the engine and wind mix, and the start-up progress with no
  DOM or Three.js dependency, with unit tests covering the projection and its
  edge behaviour, the mix at every throttle and airspeed, the mute and its
  stored choice, and progress that only ever moves forward
- `controlRates()` in `js/flight-model.js`, giving the pitch, roll, and yaw
  rates at a sensitivity setting, with the rates themselves lifted out of
  `js/aircraft.js` and named. A host embedding the Pilot API can set the same
  sensitivity through `flight.sensitivity`
- A second scale for every reading in `js/units.js`, as a conversion of the
  first rather than a second set of tuning numbers, so the flight model never
  learns which scale is on the dial and the two can never drift apart

### Changed

- A menu list can be given a filter and then draws only the entries it keeps
  while still answering to the cursor of the whole menu, which is what lets the
  settings panel split one set of entries across two headings without splitting
  the cursor that walks them
- An entry carrying its own text is drawn as that rather than as its label,
  which is how an option shows the setting it is on
- `Tab` clears the minimap along with the rest of the instruments, because they
  are one set of instruments rather than three overlays that happen to share a
  screen
- The fog is retuned in place rather than replaced when its density is changed,
  so nothing handed the old fog is left holding one the world has stopped using

## [1.6.0-alpha] - 2026-08-22

### Added

- A configured start state, replacing the standing start: every flight now
  opens at 80 knots and 1390 ft, climbing at 1260 ft/min on a heading of 000,
  with the throttle at 20% and the chase camera selected. The two values that
  have to be flown rather than declared are derived rather than guessed - the
  throttle setting is the one asking for exactly 80 knots, and the pitch is the
  angle that covers both the climb and the sink the wing loses at that airspeed
  - so the flight holds its opening condition instead of settling out of it.
  `R` and Reset Flight put the aircraft back into the same condition
- A start screen menu over the title, offering Start Flight, Controls, and
  Settings, worked with the same keys the pause menu uses. The Controls entry
  puts the control list on screen over the title, where nothing had shown it
  before the first flight
- A Settings entry on the pause menu, opening the same panel the start screen
  opens. The panel is the one overlay that clears the screen it was opened
  from, because the point of picking an environment is seeing it
- Ten environment elements - mountain, canyon, desert, grass, sand, water body,
  river, forest, town, and snow - each declaring the ranges it can be
  configured through and the algorithm that draws it. Nothing in the world is a
  placed asset: rivers and canyons wander on three waves whose lengths share no
  common multiple, forests are outlined by three lobes that share none either,
  dune crests are pushed off their axis by noise, and every colour is a
  light-to-dark gradient of one base hue so nothing shifts hue across the ground
  it covers
- Five assembled environments - Highlands, River Basin, Canyon Country, Dune
  Sea, and Lakeside - selectable from the settings panel, regenerated in place
  in a few tens of milliseconds, and remembered in `localStorage` for the next
  session. Each is a name, a seed, and a set of elements rather than any
  geometry, so the same preset lays out the same world every time it is flown
- A simulator API under `js/api/`, with `js/api/index.js` as the one module a
  host page imports. The **Pilot API** flies the aircraft against a
  caller-supplied scene, terrain sampler, aircraft asset, and keybinding map,
  and reports a fixed telemetry shape an external HUD can be written against.
  The **Matter API** hands over an assembled environment as one detachable
  group, with a height sampler, a contract any external aircraft can be checked
  against, caller-supplied meshes placed by the generator, and the world's fog
  and sky as a standalone effect
- `js/environment/elements.js` and `js/environment/presets.js`, pure modules
  holding the registry, the field, every generator, and the five worlds, with
  unit tests covering the ranges, the seeded layout, the carve profile, and what
  each generator does to the ground it is placed in
- `js/api/contract.js`, a pure module holding the option defaults, the aircraft
  contract, and the telemetry shape, which imports no renderer so a host can
  check its own options and its own aircraft with nothing loaded
- `js/settings.js` and `js/units.js`, pure modules holding the settings panel's
  choices and the conversions between world units and instrument readings in
  both directions, with unit tests covering the round trips, the stored choice,
  and a storage that refuses outright

### Changed

- The title screen is answered by its menu rather than by any key, so the
  screen the game opens on can be read and configured before anything flies
- The terrain is built from an assembled environment rather than a fixed noise
  pass followed by a mountain pass, and can be rebuilt in place when a different
  world is chosen
- The keybindings are a map rather than a switch, published as an interface a
  host can remap or replace with an input source of its own
- The aircraft accepts an external model flown from a declared control anchor,
  its own input state, and overrides for the start state and the flight model,
  so the game and the Pilot API fly the same class

### Removed

- The fixed height-to-colour ramp in `js/terrain-math.js`. Every band it drew -
  water, sand, grass, rock, and snow - is now an element with a configurable
  range of its own

## [1.5.0-alpha] - 2026-08-21

### Added

- A title screen the game opens on, carrying the name and a prompt to press
  any key. The simulation clock is held at zero behind it, so the aircraft
  waits on the prompt rather than gliding toward the terrain, and the key
  that answers it is swallowed rather than passed on to the controls. A
  modifier pressed on its own is not an answer, so a hand resting on `Shift`
  leaves the title up
- A pause menu over the frozen frame, offering Resume, Reset Flight, and
  Controls. The cursor moves on the same keys the aircraft pitches with,
  wraps round both ends, opens on Resume every time, and `Enter` or `Space`
  chooses the entry under it
- A controls-help toggle on `H` that collapses the on-screen control list
  down to a single hint line naming the key that brings it back, which the
  pause menu's Controls entry can also reopen
- A HUD visibility toggle on `Tab` that clears the instruments off the screen
  for clean flying, remembered in `localStorage` for the next session. A
  browser that refuses storage costs the choice its memory and nothing else
- An attitude indicator in the bottom right corner: an artificial horizon
  whose ball rolls against the bank and whose ladder slides against the
  pitch, with a labelled rung every 10 degrees out to 60 either side, bank
  marks at 10, 20, 30, 45, and 60 degrees around the rim, and the aircraft
  drawn across the middle of the face
- `js/title-screen.js`, `js/menu.js`, `js/controls-help.js`, and
  `js/hud-visibility.js`, pure modules holding the rules behind each of those
  overlays, with unit tests covering the latching toggles, the wrapping
  cursor, and a stored choice that outlives the session which made it
- `js/attitude.js`, holding the artificial horizon's angles and geometry with
  no DOM or Three.js dependency, with unit tests covering the pitch and bank
  it reads, the ladder it builds, and the face it draws them on
- `getAttitude()` on the aircraft, reporting where the nose and the wings
  point rather than the angles behind them, so the indicator shows what the
  aircraft is doing rather than what it was asked to do

### Changed

- Every overlay is now placed from the state that drives it in a single pass,
  and starts hidden in the stylesheet, so a page whose scripts never arrive
  shows an honest nothing rather than a HUD reading zero over an empty world
- The warnings stay quiet while the simulation is frozen by the title screen
  as well as by a pause: there is nothing to be done about either one while
  the world is holding still
- The on-screen control list gained its `Tab` and `H` rows

## [1.4.0-alpha] - 2026-08-20

### Added

- Crash detection: flying into terrain faster than 30 units/s wrecks the
  aircraft rather than clamping it silently to the ground height, killing the
  controls behind a `CRASHED` banner for two and a half seconds and then
  resetting the flight. A gentler arrival is still a landing, so an
  engine-out settle onto a hillside survives, and `R` skips the countdown
- `js/crash.js`, a pure module holding the impact threshold, the crash
  countdown, and the ground clearance the aircraft keeps, with unit tests
  covering what separates a landing from a crash and the single reset a
  countdown asks for
- Heading and vertical speed on the HUD: a three-digit compass bearing with
  the nearest of the eight compass points, counting clockwise from north, and
  a signed climb rate in feet per minute rounded to the nearest 10 so the
  readout settles instead of flickering
- A `LOW ALTITUDE` warning that blinks over the middle of the screen within
  200 ft of the terrain directly below the aircraft, measured against the
  ground rather than sea level, so a run up a valley warns while the same
  altitude out over water does not
- `js/camera-math.js`, a pure module holding the framerate-independent
  damping behind the chase camera's lag, with unit tests covering
  convergence, the frozen clock, and the snap distance
- A `How the Flight Model Works` README section covering the throttle lever,
  airspeed-driven lift, the stall penalty, and the crash threshold, and an
  `Instruments` section listing every HUD readout and warning

### Changed

- The chase camera now trails its offset behind the aircraft rather than
  riding it exactly, easing into position each frame so turns and pitch
  changes swing the view instead of snapping it. The point it looks at
  follows more tightly than the camera itself, so the aircraft leads the
  frame through a turn, and a jump too wide to have been flown - a reset, a
  crash recovery, or a return from another camera mode - cuts across rather
  than flying the whole way
- The crash and low altitude warnings give the middle of the screen up to
  the paused indicator, and a paused frame holds the crash countdown where
  it stands

## [1.3.0-alpha] - 2026-08-19

### Added

- `js/flight-model.js`, a pure module holding the arcade physics rules -
  throttle lever travel, speed convergence, lift, and the stall penalty -
  with unit tests
- `js/terrain-math.js`, a pure module holding the world's math - value
  noise, fractal Brownian motion, the plains/peaks height curve, the
  smoothstep mountain bump, and the height-to-colour ramp - with unit tests
  covering range, determinism, and falloff
- `npm run serve`, a zero-dependency static server for manual testing that
  serves the project root on port 8080, with the port overridable by
  argument or the `PORT` variable, and unit tests for its request path and
  content type rules

### Changed

- Throttle is now a setting rather than a speed: `Shift` and `Ctrl` move a
  0-100% lever over two seconds, airspeed converges toward the speed that
  lever asks for, and the HUD throttle readout reports the setting instead
  of the current speed
- Lift is now read off airspeed, replacing the constant gravity sink: below
  the stall speed the aircraft sinks up to twice as hard, easing off as
  speed builds, and at cruise speed lift cancels gravity so level flight
  holds altitude
- The page title is now "Pilot Matter" rather than "3D Flight Simulator",
  matching the favicon beside it in the browser tab
- `js/terrain.js` and `js/mountains.js` now import their shared math and
  colour ramp from `js/terrain-math.js` instead of each carrying a copy
- Starting flight state gained a closed throttle, so a reset returns the
  lever to 0% along with the 0-knot airspeed

## [1.2.0-alpha] - 2026-08-18

### Added

- Pause with the `P` key: the simulation clock latches at zero, a `PAUSED`
  indicator appears over the frozen frame, and pressing `P` again resumes
  without applying the time spent paused
- `js/pause.js`, a pure module holding the pause toggle rules (latch on
  keydown, ignore key release and auto-repeat) and the frozen simulation
  delta, with unit tests
- `js/flight-state.js`, a pure module defining the starting condition
  gameplay begins from and `R` resets back to, with unit tests asserting
  flight starts at an airspeed of 0 knots
- `P - Pause` row in the on-screen controls help and the README controls
  table, and a page description for link previews of the demo page

### Changed

- The aircraft constructor and `reset()` now read their starting position,
  rotation, and speed from `js/flight-state.js` instead of repeating literal
  values, so the 0-knot start has a single source of truth

## [1.1.0-alpha] - 2026-08-18

### Added

- Q/E yaw input so the aircraft responds to every control listed in the
  on-screen help
- C-key camera cycling through CHASE, COCKPIT, and ORBIT modes, with the
  active mode reported on the HUD camera readout
- Zero-dependency unit test harness using `node:test` (`npm test` or
  `node --test`) covering HUD unit conversions, keyboard input-to-state
  mapping, and the mountain count formula
- `package.json` manifest and this changelog

### Changed

- Keyboard input mapping extracted into the pure module `js/input-map.js`,
  and HUD unit conversions and the mountain count formula exposed as pure
  functions, so all three are testable in Node without a browser
- README controls table updated with the yaw (`Q`/`E`) and camera cycling
  (`C`) keys

## [1.0.0-alpha] - 2026-08-18

### Added

- Baseline release: arcade flight model with pitch, roll, coordinated
  banking turns, throttle, and gravity
- Procedural terrain from multi-octave fractal Brownian motion noise with
  height-based vertex coloring (water, sand, grass, rock, snow)
- Random mountain placement covering roughly 10% of the terrain surface
  using smoothstep radial bumps
- Atmospheric fog and sky lighting
- Chase camera and HUD readout of airspeed, altitude, throttle, and camera
  mode
- Zero build step: runs directly in the browser via ES modules and an
  import map
