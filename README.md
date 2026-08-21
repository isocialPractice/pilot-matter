# Pilot Matter ![favicon](favicon.png)

`Ctrl + click` to [play](https://isocialpractice.github.io/pilot-matter/index.html)

A browser-based 3D flight simulator built with [Three.js](https://threejs.org/). Fly over a procedurally generated landscape with mountains, plains, beaches, and snow-capped peaks — all rendered in real time with no build step required.

![screenshot placeholder](banner.png)

## Features

- **Arcade flight model** — pitch, roll, and bank through coordinated turns, with a throttle lever the airspeed chases
- **Airspeed-driven lift** — hold cruise speed and level flight holds altitude; let the speed decay and the wing stalls and drops
- **Crash detection** - settle onto a hillside gently and you have landed; fly into it and the aircraft is wrecked, the controls go dead, and the flight resets itself
- **Procedural terrain** — multi-octave fractal Brownian motion (fBm) noise generates a unique landscape every time
- **Random mountains** — a dedicated algorithm scatters mountains across ~10% of the terrain surface using smooth radial bumps
- **Height-based vertex colouring** — water, sand, grass, rock, and snow rendered purely through vertex colours, no textures needed
- **Atmospheric fog** — exponential fog fades the world to sky blue in the distance, hiding terrain edges and giving the illusion of an infinite world
- **Three camera modes** — chase, cockpit, and orbit views, cycled with the `C` key
- **Trailing chase camera** - the chase view lags behind the aircraft instead of riding a fixed offset, so turns and pitch changes swing the frame around
- **HUD** — live readout of airspeed (knots), altitude (ft), climb rate (ft/min), compass heading, throttle (%), and camera mode
- **Attitude indicator** - an artificial horizon with a pitch ladder and bank marks, reading the aircraft's own nose and wings rather than the controls behind them
- **Low altitude warning** - a blinking caution over the terrain below, measured against the ground rather than sea level
- **Title screen** - the game opens on its name and waits for a key, with the flight held on the ramp until one arrives
- **Pause menu** - `P` freezes the simulation behind a keyboard menu offering Resume, Reset Flight, and Controls
- **A screen you can clear** - `H` collapses the control list to a single hint line and `Tab` clears the instruments off entirely for clean flying, remembered for the next session
- **Zero build step** — runs directly in the browser via ES modules and an import map

## Getting Started

### Prerequisites

A modern browser with ES module support (Chrome, Firefox, Edge, Safari). No Node.js, no bundler, no install needed — Three.js is loaded from a CDN.

### Running locally

Because ES modules require a server context, open the project with any static file server. The bundled one needs no install and no dependencies:

```bash
npm run serve           # http://localhost:8080
npm run serve -- 3000   # or pick another port (the PORT variable works too)
```

Any other static server works just as well:

```bash
# Python
python -m http.server 8080

# Node (npx, no install)
npx serve .

# VS Code
# Install the "Live Server" extension and click "Go Live"
```

Then open `http://localhost:8080` in your browser.

## Controls

| Key | Action |
|-----|--------|
| `W` / `↑` | Pitch up (nose up) |
| `S` / `↓` | Pitch down (nose down) |
| `A` / `←` | Roll left |
| `D` / `→` | Roll right |
| `Q` | Yaw left |
| `E` | Yaw right |
| `Shift` | Throttle up (hold to open the lever) |
| `Ctrl` | Throttle down (hold to close it) |
| `C` | Cycle camera (chase, cockpit, orbit) |
| `P` | Pause / resume, and open the pause menu |
| `H` | Collapse the control list to a hint line, and open it again |
| `Tab` | Show or hide the instruments |
| `R` | Reset aircraft to starting position |

In the pause menu, `W`/`S` or `↑`/`↓` move between entries and `Enter` or `Space` chooses one.

**Tip:** Flight begins at 0 knots with the throttle closed, which is a stall — open the throttle straight away. `Shift` and `Ctrl` move a lever rather than the speed itself, so the HUD throttle reads the setting you asked for while airspeed catches up to it over the next second or two. Once the needle reaches cruise speed the wing carries the aircraft and level flight holds altitude; climb with the nose, and watch the airspeed while you do, because pulling up too hard bleeds the speed the lift depends on. Keep an eye on the terrain too: a gentle arrival is a landing, but flying into a hillside wrecks the aircraft. The rules behind all of it are written out in [How the Flight Model Works](#how-the-flight-model-works).

### Starting a flight

The game opens on its title screen, with the clock held at zero: the aircraft waits on the prompt rather than gliding toward the terrain behind it. Any key starts the flight, apart from a modifier pressed on its own, which is half of a shortcut rather than an answer to the prompt. The key that starts the flight is swallowed by the title screen, so it does not also move a control surface on the way past.

### Pausing

`P` latches the simulation clock at zero: the flight model, gravity, and the orbit camera all stop, the last frame stays on screen, and a menu opens over it. Pressing `P` again resumes from exactly where the flight left off, with the time spent paused discarded rather than applied in one jump.

The menu is flown the way the aircraft is. `W`/`S` or `↑`/`↓` move between the entries, wrapping round both ends, and `Enter` or `Space` chooses the one under the cursor:

| Entry | Does |
|-------|------|
| `RESUME` | Unpauses and flies on |
| `RESET FLIGHT` | Puts the aircraft back at its starting condition and unpauses |
| `CONTROLS` | Opens the control list back up, for a screen it has been collapsed on |

The cursor starts on `RESUME` every time the menu opens, so resuming is always one key press away from a paused flight.

### Clearing the screen

Two keys take the overlays off the view. `H` collapses the control list in the bottom left corner down to a single `H - CONTROLS` line, and pressing it again brings the list back - as does the pause menu's `CONTROLS` entry, for a list whose key has been forgotten. `Tab` clears the instruments off entirely, the artificial horizon included, for a clean view out of the window; that choice is stored, so a flight that ends with the instruments off starts the next one the same way. A browser that refuses storage costs the choice its memory and nothing else.

The warnings are not part of what those keys hide. `LOW ALTITUDE` and `CRASHED` still appear over a cleared screen, because they are the two things a pilot needs to be told about whatever the view is set to.

### Instruments

The HUD in the top left corner reads:

| Readout | Shows |
|---------|-------|
| `AIRSPEED` | Current speed in knots |
| `ALTITUDE` | Height above sea level in feet |
| `V/S` | Climb or descent rate in feet per minute, signed, rounded to the nearest 10 |
| `HEADING` | Compass bearing in degrees with the nearest of the eight compass points, counting clockwise from north |
| `THROTTLE` | The lever setting as a percentage, not the speed it has reached |
| `CAMERA` | The active camera mode |

The attitude indicator in the bottom right corner is the artificial horizon. The ball rolls against the bank so its horizon stays where the real one is, and the ladder slides against the pitch, carrying a labelled rung every 10 degrees with a tick between them, out to 60 degrees either side. The marks around the rim read the bank angle at the index on top of the face, at 10, 20, 30, 45, and 60 degrees either side of level, and the amber wings across the middle are the aircraft itself.

It reads the direction the nose and the wings are actually pointing rather than the pitch and roll angles behind them, so the ladder shows what the aircraft is doing rather than what it was asked to do.

Two warnings sit over the middle of the screen. `LOW ALTITUDE` blinks whenever the aircraft is within 200 ft of the terrain directly below it, which is measured against the ground rather than sea level, so a run up a valley warns while the same altitude out over water does not. `CRASHED` appears when the ground has been hit hard enough to wreck the aircraft, and stays up until the flight resets itself. Both stay quiet while the simulation is frozen, whether by the pause menu or by a title screen that has not been answered yet: there is nothing to be done about either warning while the world is holding still.

## Project Structure

```
pilot-matter/
├── index.html          # Entry point — overlay markup, import map, styles
├── js/
│   ├── main.js         # Scene setup, render loop, keys, and overlay state
│   ├── aircraft.js     # 3D model, and the frame loop the flight model drives
│   ├── flight-model.js # Pure throttle, speed convergence, lift and stall math
│   ├── flight-state.js # Pure starting conditions (0 knots, 300 units up)
│   ├── crash.js        # Pure impact threshold and crash countdown
│   ├── input-map.js    # Pure keyboard-to-input-state mapping
│   ├── pause.js        # Pure pause toggle and frozen simulation clock
│   ├── title-screen.js # Pure start rules and the held pre-flight clock
│   ├── menu.js         # Pure keyboard menu, and the pause menu list
│   ├── controls-help.js# Pure collapse toggle for the on-screen control list
│   ├── hud-visibility.js # Pure instrument toggle and its stored choice
│   ├── terrain-math.js # Pure noise, fBm, height curve, and mountain bump math
│   ├── terrain.js      # Procedural fBm terrain with vertex colours
│   ├── mountains.js    # Random mountain placement algorithm (~10% coverage)
│   ├── camera-math.js  # Pure framerate-independent camera damping
│   ├── camera.js       # Chase, cockpit, and orbit cameras
│   ├── sky.js          # Lighting and atmospheric fog
│   ├── attitude.js     # Pure artificial horizon geometry, and its SVG face
│   └── hud.js          # On-screen instrument display and warnings
├── tools/
│   └── serve.mjs       # Zero-dependency static server behind `npm run serve`
└── test/               # Zero-dependency node:test unit tests
```

## Testing

Unit tests cover the pure logic (unit conversions, heading and climb rate
readouts, the low altitude warning, the artificial horizon's angles and
ladder, input mapping, starting flight state, throttle and lift math, the
crash threshold and countdown, camera damping, pause toggling, the title
screen's start rules, pause menu selection, the control list and instrument
toggles, terrain noise and mountain formulas, page metadata, and the static
server's path and content type rules) and run on Node 18+ with no
dependencies to install:

```bash
npm test        # or: node --test
```

## How the Flight Model Works

The physics is arcade, not aerodynamic: there is no angle of attack, no drag polar, and no engine model. Four rules carry the whole thing, and all four live in `js/flight-model.js` and `js/crash.js` as plain functions with no Three.js dependency, so they can be unit tested in Node.

Speeds below are given in world units per second, with the HUD reading in knots at two knots per unit.

### The throttle is a setting, not a shove

`Shift` and `Ctrl` move a lever between 0 and 100%, at a rate that takes two seconds to sweep the whole travel. The lever picks a target speed - 100% asks for 200 units/s, 50% asks for 100 - and airspeed then converges on that target rather than jumping to it. The engine pulls harder than drag pushes back, so speed builds faster than it bleeds off.

This is why the HUD throttle reads the setting you asked for while the airspeed needle is still catching up, and why a closed throttle is a request for a dead stop rather than a request to coast.

### Lift is read off airspeed

Lift rises with the square of airspeed and is capped at the weight of the aircraft, so:

- **At or above cruise speed (120 units/s)** lift cancels gravity exactly, and level flight holds altitude. Extra speed never lifts on its own, so a fast pass stays level instead of ballooning; climbing is done with the nose.
- **Below cruise speed** lift only covers part of the weight, and the aircraft sinks by the difference.
- **At a standstill** there is no lift at all and the full weight pulls down.

Climbing is therefore a trade rather than a free gain: pulling the nose up spends airspeed, and spending too much of it costs the lift the climb depends on.

### Below the stall speed the wing gives up

Under 40 units/s the wing is stalled and the sink rate is multiplied on top of the lost lift, easing in from no penalty at the stall speed up to double at a dead stop. The penalty eases rather than snapping on, so a stall is a mush and a sag rather than a switch being thrown.

Every flight starts stalled, at 0 knots with the lever closed, which is what makes opening the throttle the first thing to do.

### The ground is not a floor

Arriving at the terrain is only a crash if it is arrived at hard. Coming down slower than 30 units/s is a landing: the aircraft keeps its 5 units of ground clearance and flies on, which means an engine-out settle onto a hillside survives, because the worst the flight model can sink without the nose pointing down is the 24 units/s of a dead-stop stall.

Coming down faster than that - which takes a dive, since it can only be reached by pointing the nose at the ground and adding speed to it - wrecks the aircraft. The controls go dead, the throttle and airspeed drop to zero, the wreck stays where it hit for two and a half seconds behind a `CRASHED` banner, and then the flight resets to its starting condition. Pressing `R` skips the wait. Pausing holds the countdown rather than letting it run out behind the paused frame.

## How the Terrain Works

The terrain is a `16000 × 16000` unit `PlaneGeometry` (200 × 200 segments) whose vertices are displaced vertically by a **fractal Brownian motion** function — seven octaves of smooth value noise layered together. Low-frequency octaves define broad valleys and mountain ranges; high-frequency octaves add fine surface detail.

A remapping curve flattens values below a threshold into wide plains and water, then exaggerates values above the threshold into steep peaks.

The noise, the remapping curve, the mountain falloff, and the height-to-colour ramp all live in `js/terrain-math.js` as plain functions with no Three.js dependency, so the world's shape can be unit tested in Node.

### Mountains

`mountains.js` runs a second pass after the base terrain is built. It calculates how many mountains are needed for ~10% area coverage:

```
count = (terrainArea × 0.10) / (π × avgRadius²)  ≈  14–15 mountains
```

Each mountain is a **smoothstep radial bump** added on top of the base terrain height. Vertex colours and the collision height cache are updated in the same pass, so the aircraft correctly collides with mountain peaks.

## Tech Stack

| Library | Version | Purpose |
|---------|---------|---------|
| [Three.js](https://threejs.org/) | 0.160.0 | 3D rendering |

No frameworks, no bundler, no dependencies beyond Three.js.

## License

MIT
