# TODO

Roadmap for Pilot Matter, a browser-based Three.js flight simulator with no
build step. Items under `## Current` are the next work queue; the remaining
level 2 sections group planned work by theme and state the version update
that applies when their items are completed.

## Current

- [ ] Extract pure math helpers (noise/fBm from `js/terrain.js`, smoothstep
  bump from `js/mountains.js`) into an importable module without DOM or
  Three.js dependencies so they can be unit tested in Node
  - From: Project Infrastructure
- [ ] Add a `npm run serve` convenience script to the manifest that starts a
  local static server for manual testing
  - From: Project Infrastructure
- [ ] Make throttle a target-based setting (0-100%) that speed converges
  toward, instead of Shift/Ctrl directly adding and subtracting speed, so
  `getThrottle()` reflects the setting rather than current speed
  - From: Flight Model & Controls
- [ ] Tie lift to airspeed: below `minSpeed` the aircraft sinks faster
  (stall) and at cruise speed level flight holds altitude, replacing the
  current constant-gravity sink
  - From: Flight Model & Controls
- [ ] Add a favicon-consistent page title ("Pilot Matter") to `index.html`,
  which currently reads "3D Flight Simulator"
  - From: Documentation & Polish

## Project Infrastructure

Foundation work so the automation can version, test, and release the
project. Completing items in this section applies a patch version update.

- [ ] Extract pure math helpers (noise/fBm from `js/terrain.js`, smoothstep
  bump from `js/mountains.js`) into an importable module without DOM or
  Three.js dependencies so they can be unit tested in Node
- [ ] Add a `npm run serve` convenience script to the manifest that starts a
  local static server for manual testing

## Flight Model & Controls

Deepen the arcade flight physics and complete the advertised control
surface. Completing items in this section applies a minor version update.

- [ ] Tie lift to airspeed: below `minSpeed` the aircraft sinks faster
  (stall) and at cruise speed level flight holds altitude, replacing the
  current constant-gravity sink
- [ ] Make throttle a target-based setting (0-100%) that speed converges
  toward, instead of Shift/Ctrl directly adding and subtracting speed, so
  `getThrottle()` reflects the setting rather than current speed
- [ ] Add crash detection: hitting terrain above a vertical-speed threshold
  triggers a brief crash state and auto-reset, instead of silently clamping
  to ground height
- [ ] Add pause (`P`) that stops the simulation clock and shows a paused
  indicator

## Camera & HUD

Complete the camera system and expand the instrument readout. Completing
items in this section applies a minor version update.

- [ ] Smooth the chase camera with positional lag/damping so turns and
  pitch changes feel less rigid
- [ ] Add a heading readout (compass degrees) and vertical speed indicator
  (ft/min) to the HUD in `index.html` and `js/hud.js`
- [ ] Add a low-altitude warning to the HUD that activates when height
  above terrain drops below a threshold

## World & Environment

Grow the procedural world beyond the single terrain tile. Completing items
in this section applies a minor version update.

- [ ] Handle the world edge: either wrap the aircraft position across the
  16000-unit terrain bounds or recenter terrain tiles around the aircraft
  so the fog-hidden edge can never be reached
- [ ] Integrate the weather system from the `local-weather` branch (clouds,
  rain, moon, sky styling) into main once its API stabilizes
- [ ] Add a day-night cycle in `js/sky.js` with gradual light, fog color,
  and sky color transitions
- [ ] Animate water: give below-water-level vertices a subtle wave motion
  and specular tint distinct from land shading

## Documentation & Polish

Keep the docs accurate and improve first-run experience. Completing items
in this section applies a patch version update.

- [ ] Replace the static "Loading Flight Simulator..." text with a simple
  progress/fade-in tied to first rendered frame
- [ ] Document the flight model (lift, stall, throttle behavior) in a
  README section once the Flight Model & Controls items land
- [ ] Add a favicon-consistent page title ("Pilot Matter") to `index.html`,
  which currently reads "3D Flight Simulator"

## Complete

- [x] Create `CHANGELOG.md` with a `1.0.0` baseline entry describing the
  current feature set, and add a minimal `package.json` manifest (name,
  version, description, license) so future runs have a version to update
  - From: Project Infrastructure
- [x] Add a zero-dependency test harness using `node:test` with unit tests
  for pure logic (unit conversions in `js/hud.js` math, input-to-state
  mapping in `js/aircraft.js`, mountain count formula in `js/mountains.js`),
  runnable via `node --test`
  - From: Project Infrastructure
- [x] Implement Q/E yaw input in `js/aircraft.js` so the aircraft matches
  the on-screen controls help in `index.html`
  - From: Flight Model & Controls
- [x] Implement C-key camera cycling in `js/camera.js` (CHASE, COCKPIT,
  ORBIT) and report the active mode through `getCurrentMode()` so the HUD
  camera readout in `index.html` is meaningful
  - From: Camera & HUD
- [x] Update the README controls table to match the in-game help once yaw
  and camera cycling exist (add `Q`/`E` and `C` rows)
  - From: Documentation & Polish
