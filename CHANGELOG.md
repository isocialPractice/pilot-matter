# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
