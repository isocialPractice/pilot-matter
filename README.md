# Pilot Matter ![favicon](favicon.png)

`Ctrl + click` to [play](https://isocialpractice.github.io/pilot-matter/index.html)

A browser-based 3D flight simulator built with [Three.js](https://threejs.org/). Fly over a procedurally generated landscape with mountains, plains, beaches, and snow-capped peaks — all rendered in real time with no build step required.

![screenshot placeholder](banner.png)

## Features

- **Arcade flight model** — pitch, roll, and bank through coordinated turns, with a throttle lever the airspeed chases
- **Airspeed-driven lift** — hold cruise speed and level flight holds altitude; let the speed decay and the wing stalls and drops
- **Procedural terrain** — multi-octave fractal Brownian motion (fBm) noise generates a unique landscape every time
- **Random mountains** — a dedicated algorithm scatters mountains across ~10% of the terrain surface using smooth radial bumps
- **Height-based vertex colouring** — water, sand, grass, rock, and snow rendered purely through vertex colours, no textures needed
- **Atmospheric fog** — exponential fog fades the world to sky blue in the distance, hiding terrain edges and giving the illusion of an infinite world
- **Three camera modes** — chase, cockpit, and orbit views, cycled with the `C` key
- **HUD** — live readout of airspeed (knots), altitude (ft), throttle (%), and camera mode
- **Pause** - freeze the simulation with `P`; the world stays on screen behind a paused indicator and no flight time passes while it is held
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
| `P` | Pause / resume |
| `R` | Reset aircraft to starting position |

**Tip:** Flight begins at 0 knots with the throttle closed, which is a stall — open the throttle straight away. `Shift` and `Ctrl` move a lever rather than the speed itself, so the HUD throttle reads the setting you asked for while airspeed catches up to it over the next second or two. Once the needle reaches cruise speed the wing carries the aircraft and level flight holds altitude; climb with the nose, and watch the airspeed while you do, because pulling up too hard bleeds the speed the lift depends on.

### Pausing

`P` latches the simulation clock at zero: the flight model, gravity, and the orbit camera all stop, a `PAUSED` indicator appears, and the last frame stays on screen. Pressing `P` again resumes from exactly where the flight left off, with the time spent paused discarded rather than applied in one jump.

## Project Structure

```
pilot-matter/
├── index.html          # Entry point — HUD markup, import map, styles
├── js/
│   ├── main.js         # Scene setup, render loop
│   ├── aircraft.js     # 3D model, and the frame loop the flight model drives
│   ├── flight-model.js # Pure throttle, speed convergence, lift and stall math
│   ├── flight-state.js # Pure starting conditions (0 knots, 300 units up)
│   ├── input-map.js    # Pure keyboard-to-input-state mapping
│   ├── pause.js        # Pure pause toggle and frozen simulation clock
│   ├── terrain-math.js # Pure noise, fBm, height curve, and mountain bump math
│   ├── terrain.js      # Procedural fBm terrain with vertex colours
│   ├── mountains.js    # Random mountain placement algorithm (~10% coverage)
│   ├── camera.js       # Chase, cockpit, and orbit cameras
│   ├── sky.js          # Lighting and atmospheric fog
│   └── hud.js          # On-screen instrument display
├── tools/
│   └── serve.mjs       # Zero-dependency static server behind `npm run serve`
└── test/               # Zero-dependency node:test unit tests
```

## Testing

Unit tests cover the pure logic (unit conversions, input mapping, starting
flight state, throttle and lift math, pause toggling, terrain noise and
mountain formulas, page metadata, and the static server's path and content
type rules) and run on Node 18+ with no dependencies to install:

```bash
npm test        # or: node --test
```

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
