# Cheatsheet

`Ctrl + click` to read this on the site: [Cheatsheet](https://isocialpractice.github.io/pilot-matter/docs/cheatsheet.html)

Everything on one page, for a reader who has already read the rest. No
teaching, no explanation: the keys, the options, the elements, and the calls.

## Keys

| Key | Action |
|-----|--------|
| `W` `↑` | Pitch up |
| `S` `↓` | Pitch down |
| `A` `←` | Roll left |
| `D` `→` | Roll right |
| `Q` / `E` | Yaw left / right |
| `Shift` / `Ctrl` | Throttle up / down |
| `C` | Cycle camera: chase, cockpit, orbit |
| `P` | Pause, and the pause menu |
| `O` | Settings panel, and close it |
| `L` | Element editor, and close it |
| `M` | Mute the engine and wind |
| `H` | Collapse the control list |
| `Tab` | Show or hide the instruments |
| `R` | Reset to the start condition |
| `F2` | Photo: download the view as a PNG |
| `Esc` `Backspace` | Back out of a panel |
| `Enter` `Space` | Choose the menu entry under the cursor |

## Flight numbers

| Quantity | Value |
|----------|-------|
| HUD scale | 2 knots per world unit/s |
| Stall speed | 40 units/s (80 knots) |
| Cruise speed | 120 units/s |
| Full throttle | 200 units/s |
| Throttle sweep | 2 seconds, 0 to 100% |
| Terrain crash | Faster than 30 units/s down |
| Runway crash | Faster than 48 units/s down |
| Runway landing | Under 18 units/s, wings 11 deg, nose 15 deg, heading 25 deg |
| Ground clearance | 5 units |
| Crash countdown | 2.5 seconds, then reset |
| Low altitude warning | Within 200 ft of the ground below |
| Terrain tile | 16000 x 16000 units, 200 x 200 segments |
| Ground drawn to | 12000 units past the aircraft |
| fBm octaves | 7 |

## The start state

| Field | Range | Step | Default |
|-------|-------|------|---------|
| `START AIRSPEED` | 0 to 200 knots | 5 | 80 knots |
| `START ALTITUDE` | 0 to 8000 ft | 10 | 1390 ft |
| `START CLIMB` | -2000 to +3000 ft/min | 20 | +1260 ft/min |
| `START HEADING` | 000 to 355 deg | 5 | 000 |
| `START THROTTLE` | 0 to 100% | 5 | 20% |
| `START CAMERA` | chase, cockpit, orbit | - | `CHASE` |

Radio group: `START OFF FLYING` (default) or `RUNWAY TAKEOFF`. Checkbox:
`RUNWAY`, forced on and disabled under `RUNWAY TAKEOFF`. Pitch is derived,
never set.

## Options

| Option | Steps through |
|--------|---------------|
| `CONTROL SENSITIVITY` | 50% to 200% |
| `FOG DENSITY` | `CLEAR` to `THICK` |
| `AIRSPEED IN` | `KNOTS`, `MPH` |
| `ALTITUDE IN` | `FEET`, `METERS` |

Everything above is stored in `localStorage` and reopens with the next session.

## Worlds

| Environment | Id | Is |
|-------------|-----|-----|
| `HIGHLANDS` | `highlands` | Peaks over fBm ground, snow above 300. The default |
| `RIVER BASIN` | `river-basin` | A river the width of the world, low forested country |
| `CANYON COUNTRY` | `canyon-country` | Branching canyons in a high plateau, no standing water |
| `DUNE SEA` | `dune-sea` | Dunes, outcrops, one desert river, palm groves |
| `LAKESIDE` | `lakeside` | A town on a lake, forested hills, snow peaks |

Two more are built for the modes and kept out of the panel: `OPEN COUNTRY` and
`LOOP VALLEY`.

## Elements

| Element | Configured through |
|---------|--------------------|
| Mountain | Count, height, radius, girth |
| Canyon | Depth, width, steepness, branches, wander |
| Desert | Dune height, crest spacing, coverage, sand gradient |
| Grass | Green gradient, height band |
| Sand | Brown gradient, height band |
| Water body | Water line, blue gradient by depth, basin pull |
| River | Blue gradient, windiness, width, depth |
| Forest | Tree height, density, grove size, grove count, canopy, band |
| Town | Block size, block count, building height, extent, gradients |
| Snow | Snow line, coverage, slope limit, white gradient |
| Runway | Length, width, heading, height band, apron, gradients |

Pipeline order: landforms, ground cover, water, cuts and built things, snow,
runway last.

## Element editor

`L` opens the world being flown as the elements it was assembled from. Enter
opens an element onto its ranges; `A`/`D` step the range under the cursor.

| Row | Reads |
|-----|-------|
| Span | Two rows, `MIN` and `MAX`, neither able to cross the other |
| Scalar | One row, one number |
| Gradient | Two rows, `LIGHT` and `DARK`, as a percentage of the preset's colour |

One press moves a fiftieth of what the range allows, rounded to 1, 2, or 5
times a power of ten. `RESTORE THE PRESET` puts every range back. Edits belong
to the world they were made on and are not stored between sessions. Not
available while a game mode is being played: a mode brings its own ground.

## Game modes

| Mode | Stages | Objective |
|------|--------|-----------|
| `RUNWAY LANDING` | 4 | Land on the strip. Harder: further out, off the line, shorter strip, higher country |
| `FLYING THROUGH LOOPS` | 4 | Fly the gates in order. Harder: more gates, tighter, closer, bending more |

Gate colours: green is the one the course is waiting on, amber is still to
come, dim is behind you. A crash restarts the stage.

The whole course is drawn on the minimap the moment the stage is laid out, in
the same three colours. A gate past the edge of the square the chart covers is
held hollow at that edge.

| Reading | Where | Says |
|---------|-------|------|
| `TIME` / `BEST` | Objective card | The stage clock, and your best for this stage of this mode |
| `↑ LOOP 3 · 045° · 4200 ft` | Objective card | The gate the course is waiting on, while it is more than 35 degrees off the nose |
| `LOOP 3 MISSED · COME ROUND AGAIN` | Objective card | You crossed the gate's plane outside the hoop, going the way the course runs |

Best times are kept per stage per mode in `localStorage`. The clock runs from
the moment a stage is laid out to the moment its objective is met, and a stage
restarted is timed from nothing.

## API

```javascript
import { createPilot, createEnvironment, createTiledEnvironment } from './js/api/index.js';

createPilot({ scene, camera, aircraft, anchor, terrain, keymap, flight })
    .update(dt)          // returns { airspeed, altitude, verticalSpeed, heading, throttle }

createEnvironment({ environment, runway })
    .group               // one detachable Object3D
    .applyDepth(scene)   // the sky and the fog, without the ground
    .attach(aircraft)    // throws with every gap in the contract
    .register(mesh, { x, z })
    .runways[0]
    .setEnvironment(id)
    .setDaylight(phase)  // 0 to 1
    .updateWater(dt, phase)

createTiledEnvironment({ environment, tiles, size })
    .sampleHeight(x, z)  // answered by whichever square the point is over
```

```javascript
import { validateAircraftContract, TELEMETRY_FIELDS, API_VERSION } from './js/api/contract.js';

validateAircraftContract(aircraft)   // every gap at once, or []
```

The whole surface is in [docs/api.md](docs/api.md).

## Commands

| Command | Does |
|---------|------|
| `npm run serve` | Static server on `http://localhost:8080` |
| `npm run serve -- 3000` | Another port, and `PORT` works too |
| `npm test` | The whole suite, no dependencies |
| `node --test` | The same thing without npm |
| `npm run docs:api` | Builds the site's API reference page from `docs/api.md` |

## Photo names

`pilot-matter-YYYYMMDD-HHMMSS.png`, for example
`pilot-matter-20260824-050709.png`.
