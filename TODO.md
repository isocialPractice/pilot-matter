# TODO

Roadmap for Pilot Matter, a browser-based Three.js flight simulator with no
build step. Items under `## Current` are the next work queue; the remaining
level 2 sections group planned work by theme and state the version update
that applies when their items are completed.

## Current

- [ ] Add crash detection: hitting terrain above a vertical-speed threshold
  triggers a brief crash state and auto-reset, instead of silently clamping
  to ground height
  - From: Flight Model & Controls
- [ ] Document the flight model (lift, stall, throttle behavior) in a README
  section once the Flight Model & Controls items land
  - From: Documentation & Polish
- [ ] Add a heading readout (compass degrees) and vertical speed indicator
  (ft/min) to the HUD in `index.html` and `js/hud.js`
  - From: Camera & HUD
- [ ] Add a low-altitude warning to the HUD that activates when height
  above terrain drops below a threshold
  - From: Camera & HUD
- [ ] Smooth the chase camera with positional lag/damping so turns and
  pitch changes feel less rigid
  - From: Camera & HUD

## Flight Model & Controls

Deepen the arcade flight physics and complete the advertised control
surface. Completing items in this section applies a minor version update.

- [ ] Add crash detection: hitting terrain above a vertical-speed threshold
  triggers a brief crash state and auto-reset, instead of silently clamping
  to ground height

## Game UI/UX

Player-facing interface and experience around the flight model, beyond the
raw instrument readout. Completing items in this section applies a minor
version update.

- [ ] Add a title screen overlay shown before the first flight, with the
  game name and a "press any key to start" prompt
- [ ] Add a pause menu built on the pause state, with Resume, Reset Flight,
  and Controls entries selectable by keyboard
- [ ] Add a controls-help toggle (`H`) that collapses the on-screen control
  list down to a single hint line
- [ ] Add a HUD visibility toggle (`Tab`) for clean flying, persisting the
  choice in `localStorage` across sessions
- [ ] Add an attitude indicator to the HUD with a pitch ladder and bank
  angle marks
- [ ] Add a minimap in a screen corner showing aircraft position and heading
  within the terrain bounds
- [ ] Add engine and wind audio that track throttle and airspeed, with a
  mute toggle (`M`)
- [ ] Add a settings panel (`O`) for control sensitivity, fog density, and
  HUD units (knots/mph, ft/m)
- [ ] Add on-screen touch controls so the simulator is playable on a phone
  or tablet without a keyboard
- [ ] Add a photo mode (`F2`) that hides every overlay for one frame and
  downloads the rendered canvas as a PNG

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
- [x] Start gameplay with an **AIRSPEED** value of `0 knots`
  - From: `version.control = null`
- [x] Add **Game UI/UX** (*underneath `Flight Model & Controls`*) section, and
  create 10 todo items for it
  - From: `version.control = null`
- [x] Add pause feature, using keypress `P`
  - From: Game UI/UX
- [x] Update `index.html` GitHub Pages demo to reflect current status of application
  - From: `version.control = null`
- [x] Extract pure math helpers (noise/fBm from `js/terrain.js`, smoothstep
  bump from `js/mountains.js`) into an importable module without DOM or
  Three.js dependencies so they can be unit tested in Node
  - From: Project Infrastructure
- [x] Add a `npm run serve` convenience script to the manifest that starts a
  local static server for manual testing
  - From: Project Infrastructure
- [x] Make throttle a target-based setting (0-100%) that speed converges
  toward, instead of Shift/Ctrl directly adding and subtracting speed, so
  `getThrottle()` reflects the setting rather than current speed
  - From: Flight Model & Controls
- [x] Tie lift to airspeed: below `minSpeed` the aircraft sinks faster
  (stall) and at cruise speed level flight holds altitude, replacing the
  current constant-gravity sink
  - From: Flight Model & Controls
- [x] Add a favicon-consistent page title ("Pilot Matter") to `index.html`,
  which currently reads "3D Flight Simulator"
  - From: Documentation & Polish
