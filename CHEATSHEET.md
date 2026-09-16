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
| `Space` | Level off: vertical speed to zero, nose left where it is |
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

## Without a keyboard

Drawn on a machine that takes touches and has no pointer that can hover: a
phone or a tablet, never a laptop with a touchscreen. Menus were always worked
by pointer, so only the flight controls are added.

| Pad | Works | Cluster |
|-----|-------|---------|
| `PITCH +` / `PITCH -` | Nose up / down | Left |
| `ROLL L` / `ROLL R` | Wing down either way | Left |
| `THR +` / `THR -` | The throttle lever | Right |
| `YAW L` / `YAW R` | Nose left / right | Right |

Tilt is what those machines open in, and it takes the four attitude pads off
the glass. Whatever angle the device is held at when a flight starts is level
for it, and a reset levels it again. Seven degrees either side of level is
nothing. Refused, or on a device with no gyroscope, the pads stay and the
flight is flown from them: a sensor that reports no angles at all is no reading
rather than a device held level. The pads take the bottom corners, so the
attitude indicator moves to the top left of the screen, the readouts drop below
it and the chart it now shares that top with, and the control list comes off.

A pad is 44 pixels square, which is both the smallest a control under a thumb
should be and what lets two clusters and the padding either side of them fit
the 320 pixel screen a phone is narrowest at.

The pads take a fixed band off the bottom whatever the screen, so a short one
has less left between them and the instruments above. Below 541 pixels of
height - which is every phone held sideways - the readouts are drawn compact
and drop `THROTTLE` and `CAMERA`, the two you are not flying on - and on a
screen 640 pixels or narrower that starts at 657 instead, because a narrow one
has the objective card under the readouts as well as the pads under both.
Shorter again and they move into the band between the two clusters of pads,
with the `AUDIO MUTED` line going up beside the attitude indicator rather than
staying under it. The objective card, which is what carries the breakdown of a
landing, is lifted clear of the pads on any screen narrow enough for them to
cross it; on a screen short and wide enough for the readouts to be in that
middle band it is hung from the top of the same lane instead, because the band
is where the readouts now are. The two are placed against each other rather
than each against the pads, so neither is drawn over the other at any size a
phone comes in.

Bounded to the room the readouts leave, the card holds what it says in flight
and not a landing read off it, which is five lines more. So the readouts stand
down for as long as a breakdown is up and the card takes the column - on the
screens the two are in one column on. An aircraft stopped on a strip reads zero
knots, zero feet a minute and the strip's own elevation, which is everything
the breakdown says and nothing it does not, so of the two wanting that column
it is the stack that gives way. From 680 pixels of width, on a screen tall
enough to keep the readouts in their own corner, the card's left edge is past
their right edge and the two never meet, so there the stack stays up and the
card is bounded to the screen rather than to anything above it. A screen short
enough to have put the readouts in the middle lane is the exception at any
width, because the card is hung in that same lane and the two are back in one
column.

On the shortest screen a browser leaves, 320 by 460, there are 108 pixels
between the chart and the pads for both of them, so the stack keeps the
airspeed and the altitude and the card keeps its stage and its objective. What
the card has no room for comes off rather than being cut through: the bound is
written in the card's own rows, so every line on it is either read whole or not
drawn at all.

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
| Landing aim | A fifth of the strip's length past the threshold |
| Landing reach | A third of its length either side of that is worth nothing |
| Landing rollout | Ends at 1 unit/s, or after 10 seconds |
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
| `ORBIT SWEEP` | `6°/S` to `36°/S`, default `12°/S` |
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
| `RUNWAY LANDING` | 4 | Land on the strip. Harder: further out, off the line, shorter strip, higher country, less help |
| `FLYING THROUGH LOOPS` | 4 | Fly the gates in order. Harder: more gates, tighter, closer, bending more, laid further over |

Gate colours: green is the one the course is waiting on, amber is still to
come, dim is behind you. A crash restarts the stage.

Gates are laid over from the second stage on, and closed up one way across as
they are - a round hoop is the same hoop at every angle, so a gate that has to
be flown at the angle it was laid at is wider along its span than it is tall.

| Stage | Gate height against its width | Laid over up to |
|-------|-------------------------------|-----------------|
| `THREE GATES` | Round | Upright |
| `FIVE GATES` | 0.80 | 0.40 rad |
| `SEVEN GATES` | 0.66 | 0.70 rad |
| `NINE GATES` | 0.55 | 1.00 rad |

Approach guidance is withdrawn the same way: an extended centreline of eight
marks running 3200 units back down the approach and a bar across the threshold
on stage one, the bar alone on stage two, and nothing from stage three on. Both
are laid off the threshold the stage opens you out from.

The whole course is drawn on the minimap the moment the stage is laid out, in
the same three colours. A gate past the edge of the square the chart covers is
held hollow at that edge.

| Reading | Where | Says |
|---------|-------|------|
| `TIME` / `BEST` | Objective card | The stage clock, and your best for this stage of this mode |
| `↑ LOOP 3 · 045° · 4200 ft` | Objective card | The gate the course is waiting on, while it is more than 35 degrees off the nose |
| `LOOP 3 MISSED · COME ROUND` | Objective card | You crossed the gate's plane outside the hoop, going the way the course runs |
| `LANDING · 85` | Objective card | What a landing came to, shown once the aircraft has stopped |
| `DOWN THE STRIP` `OFF THE CENTRELINE` `SINK RATE` `OFF THE STRIP` | Objective card | The four readings behind that score, each marked against its own limit |

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
