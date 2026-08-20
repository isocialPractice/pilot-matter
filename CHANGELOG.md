# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
