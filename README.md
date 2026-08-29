# Pilot Matter ![favicon](favicon.png)

`Ctrl + click` to view [pilot-matter documentation](https://isocialpractice.github.io/pilot-matter/docs/index.html)

`Ctrl + click` to [play](https://isocialpractice.github.io/pilot-matter/index.html)

A browser-based 3D flight simulator built with [Three.js](https://threejs.org/). Fly over five procedurally generated worlds - highlands, a river basin, canyon country, a dune sea, and a lakeside town - each assembled out of elements that are drawn by algorithm rather than placed as assets, all rendered in real time with no build step required.

![screenshot placeholder](banner.png)

## Documentation

The manual lives on the [documentation site](https://isocialpractice.github.io/pilot-matter/docs/index.html).
This README is the front door: what it is, how to run it, and the keys. Every
section below links to the page carrying it in full.

| Page | Holds |
|------|-------|
| [Quickstart](https://isocialpractice.github.io/pilot-matter/docs/quickstart.html) | A clone to a climb in about a minute |
| [Getting started](https://isocialpractice.github.io/pilot-matter/docs/getting-started.html) | What a browser needs, and every way to serve it |
| [Features](https://isocialpractice.github.io/pilot-matter/docs/features.html) | Everything the simulator does |
| [Controls](https://isocialpractice.github.io/pilot-matter/docs/controls/index.html) | Every key, and the menus behind them |
| [The flight model](https://isocialpractice.github.io/pilot-matter/docs/flight-model.html) | Throttle, lift, stall, and what a runway does to an arrival |
| [The terrain](https://isocialpractice.github.io/pilot-matter/docs/terrain.html) | Noise, elements, the five worlds, and the world with no edge |
| [Simulator API](https://isocialpractice.github.io/pilot-matter/docs/api.html) | The Pilot API and the Matter API, side by side |
| [Project structure](https://isocialpractice.github.io/pilot-matter/docs/project-structure.html) | Every file and what it holds |
| [Testing](https://isocialpractice.github.io/pilot-matter/docs/testing.html) | What the suite covers |
| [Cheatsheet](https://isocialpractice.github.io/pilot-matter/docs/cheatsheet.html) | Keys, options, elements, and calls on one page |

[QUICKSTART.md](QUICKSTART.md) and [CHEATSHEET.md](CHEATSHEET.md) are the same
two pages as Markdown, for reading without a browser.

## [Features](https://isocialpractice.github.io/pilot-matter/docs/features.html)

- **Arcade flight model** - pitch, roll, and bank through coordinated turns, with a throttle lever the airspeed chases, airspeed-driven lift, and a wing that stalls when the speed decays
- **The world as data** - eleven environment elements, each declaring the ranges it can be configured through and the algorithm that draws it, assembled into five worlds and regenerated on the spot
- **A world with no edge** - the square an environment describes is one tile of an endless grid of them, drawn out further than the camera can see, so there is always more ground ahead
- **A day to fly through** - the sun walks across the sky and the light, the fog, and the water's sheen warm and cool with it
- **Two game modes** - Runway Landing and Flying through Loops, four stages each, and each getting harder at exactly the thing it is about
- **Instruments** - a HUD, a north-up minimap, an artificial horizon reading the aircraft's own nose and wings, and a photo mode that clears all of it for the one frame it captures
- **A simulator API** - fly the aircraft over a host's own world, or a host's own aircraft over this one
- **Zero build step** - runs directly in the browser via ES modules and an import map

The [full list](https://isocialpractice.github.io/pilot-matter/docs/features.html)
has all of it.

## [Getting Started](https://isocialpractice.github.io/pilot-matter/docs/getting-started.html)

### Prerequisites

A modern browser with ES module support (Chrome, Firefox, Edge, Safari). No
Node.js, no bundler, no install needed - Three.js is loaded from a CDN. Node 18
or newer is needed only for the bundled server and the tests.

### Running locally

Because ES modules require a server context, open the project with any static
file server. The bundled one needs no install and no dependencies:

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

## [Controls](https://isocialpractice.github.io/pilot-matter/docs/controls/index.html)

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
| `O` | Open the settings panel, and close it again |
| `M` | Mute or unmute the engine and wind |
| `H` | Collapse the control list to a hint line, and open it again |
| `Tab` | Show or hide the instruments |
| `R` | Reset aircraft to starting position |
| `F2` | Take a picture: clears the screen for one frame and downloads the view as a PNG |

In any menu, `W`/`S` or `↑`/`↓` move between entries and `Enter` or `Space`
chooses one. The mouse works the menus too: the pointer moves the cursor and a
click chooses. In the settings panel, `A`/`D` or `←`/`→` step the option under
the cursor through its settings. `Esc` backs out.

**Tip:** Flight begins in the air and already climbing, at 80 knots and 1390 ft
with the throttle set at 20%. That airspeed is the stall speed itself, so the
wing is carrying with nothing in hand: opening the throttle is the first thing
to do. The rules behind all of it are written out in
[How the flight model works](https://isocialpractice.github.io/pilot-matter/docs/flight-model.html).

The [loading screen, the menus, the settings panel, the game modes, the sound,
the photo mode, and the instruments](https://isocialpractice.github.io/pilot-matter/docs/controls/index.html)
each have a page of their own.

## [How It Works](https://isocialpractice.github.io/pilot-matter/docs/flight-model.html)

The physics is arcade, not aerodynamic. Four rules carry it: the throttle is a
lever the airspeed converges on rather than a shove, lift is read off the
square of airspeed and capped at the weight, the wing stalls below 40 units/s,
and the ground is not a floor - a gentle arrival is survived and a dive is not.
A runway changes what an arrival means, giving it somewhere to be a landing
rather than a crash.
[Read it in full](https://isocialpractice.github.io/pilot-matter/docs/flight-model.html).

The ground is a `16000 x 16000` unit plane displaced by seven octaves of
fractal Brownian motion, and everything over it is an environment element: a
registry entry carrying the ranges it can be configured through and the
algorithm that draws it. The square is one tile of an endless grid, each tile
seeded from its own place, drawn out as far as the camera can see.
[Read it in full](https://isocialpractice.github.io/pilot-matter/docs/terrain.html).

## [Simulator API](https://isocialpractice.github.io/pilot-matter/docs/api.html)

The simulator is two halves that can be used without each other, and
`js/api/index.js` is the one module a host page imports to get either.

```javascript
import { createPilot, createEnvironment } from './js/api/index.js';

// The aircraft, flown against a scene, a terrain, and a model the host supplies
const pilot = createPilot({ scene, aircraft: myModel, terrain: myTerrain });
const { airspeed, altitude, heading } = pilot.update(dt);

// The world, as one detachable group anything can fly over
const world = createEnvironment({ environment: 'lakeside', runway: true });
scene.add(world.group);
```

The whole surface is written out in [docs/api.md](docs/api.md): every option
and everything that comes back for both halves, the contracts, the configured
start, the runways and the landing rules, the game modes, the worlds and the
elements, the day and the water, what the stability guarantee does and does not
cover, and a worked host page for each half.

`examples/host.html` is that host page, running. It works both halves side by
side, which is the shortest way to see that each genuinely works without the
other:

```bash
npm run serve   # then open http://localhost:8080/examples/host.html
```

## [Testing](https://isocialpractice.github.io/pilot-matter/docs/testing.html)

Unit tests cover the pure logic and run on Node 18+ with no dependencies to
install:

```bash
npm test        # or: node --test
```

[What the suite covers](https://isocialpractice.github.io/pilot-matter/docs/testing.html)
is the whole of it, the documents included: the API reference, this README, and
the pages of the site are all read back and checked against the code.

## [Tech Stack](https://isocialpractice.github.io/pilot-matter/docs/about.html)

| Library | Version | Purpose |
|---------|---------|---------|
| [Three.js](https://threejs.org/) | 0.160.0 | 3D rendering |

No frameworks, no bundler, no dependencies beyond Three.js. The documentation
site is the same: hand-written HTML, one stylesheet, one script, and no
generator, with its palette read off the project's own mark in
[DESIGN_LANGUAGE.md](DESIGN_LANGUAGE.md).

## License

MIT
