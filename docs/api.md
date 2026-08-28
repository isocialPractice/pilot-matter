# Simulator API

Pilot Matter is two halves that can be used without each other.

The **Pilot API** is the aircraft: the flight model, the controls, and the
telemetry, flown against a scene, a terrain, and an aircraft model the host
supplies. The **Matter API** is the world: an assembled environment as one
detachable group, a height sampler for whatever is flying over it, and a
contract any aircraft can satisfy, including one driven by a control API that
has never heard of this one.

`js/api/index.js` is the one module a host page imports to get either.

- [Importing](#importing)
- [Stability](#stability)
- [Pilot API](#pilot-api)
- [Matter API](#matter-api)
- [Contracts](#contracts)
- [Configuration](#configuration)
- [Worlds and elements](#worlds-and-elements)
- [The day](#the-day)
- [The water](#the-water)
- [The edge of the world](#the-edge-of-the-world)

`examples/host.html` is both halves on one page and is the shortest way to see
what the rest of this document is describing: the Pilot API flying over ground
the page generated itself, beside the Matter API carrying an aircraft the page
built, over a world assembled out of four tiles. Serve the project - `npm run
serve` - and open `/examples/host.html`.

## Importing

There is no build step. The modules are ES modules, and Three.js is resolved
through an import map on the host page:

```html
<script type="importmap">
    {
        "imports": {
            "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js"
        }
    }
</script>
<script type="module" src="app.js"></script>
```

```javascript
import { createPilot, createEnvironment } from './js/api/index.js';
```

Under a package manager the same entry points are published by name:

```javascript
import { createPilot } from 'pilot-matter';
import { createEnvironment } from 'pilot-matter/matter';
import { validateAircraftContract } from 'pilot-matter/contract';
```

| Specifier | Is |
|-----------|-----|
| `pilot-matter` | Both halves, and everything below |
| `pilot-matter/pilot` | The Pilot API on its own |
| `pilot-matter/matter` | The Matter API on its own |
| `pilot-matter/contract` | The contracts, which load no renderer |
| `pilot-matter/config` | The configured start, and the fields it is set through |
| `pilot-matter/environment` | The assembled environments |
| `pilot-matter/elements` | The element registry and the field |
| `pilot-matter/day-night` | The day cycle: the hour, the light at it, and the sun's arc |
| `pilot-matter/water` | The wave, the sheen, and the surface animation |

Three.js is reached for by the two halves that build something with it, and by
the root entry point that re-exports them both. `pilot-matter/contract`,
`pilot-matter/config`, `pilot-matter/environment`, `pilot-matter/elements`,
`pilot-matter/day-night`, and `pilot-matter/water` load no renderer at all,
which is the point of the split: a host can check its own options, describe its
own world, light its own sky, move its own water, or check the shape of its
telemetry on a server, in a worker, or in a test, with nothing rendered.

## Stability

The API carries a version of its own, `API_VERSION`, which moves when the
contracts move rather than when the simulator does. A release that changes how
an aircraft flies does not change the API; a release that changes what an
aircraft has to be does.

```javascript
import { API_VERSION } from 'pilot-matter';

if (API_VERSION !== 1) console.warn('this host was written against API 1');
```

**What is guaranteed to hold within a major API version:**

- The names and call signatures of the exported functions
- The **shape** of what they return - the fields a telemetry object carries, the
  fields a resolved option set carries, the members of a pilot and of an
  environment
- The names of the option fields that go in, and the meaning of each
- That an option a host does not name is filled in from the configured default
  rather than left undefined
- That a validator reports its problems rather than throwing, and that a
  constructor throws rather than half-building

**What is not guaranteed, and is expected to move:**

- The **numbers**. Tuning is not a contract: the stall speed, the cruise speed,
  the sink rate, the terrain seeds, and the shape of the ground a preset draws
  are all free to change between releases. A telemetry object will always carry
  an `airspeed`; what that airspeed reads is the simulator's business.
- Anything not exported from `js/api/index.js`. The internals are reachable, as
  everything in a no-build-step project is, but importing `js/aircraft.js`
  directly is reading over the fence rather than through the window.
- The rendered look: materials, colours, lighting, and the geometry an element
  generates.

New optional fields may be added to an options object or to a returned object
within a version. A host reading a field it knows is safe; a host asserting on
the exact set of keys is not.

## Pilot API

```javascript
createPilot(options) -> pilot
```

### Options

| Option | Type | Default | Is |
|--------|------|---------|-----|
| `scene` | `Object3D` | a fresh `Scene` | What the aircraft is added to |
| `camera` | `Camera` | none | A camera to place behind the aircraft |
| `aircraft` | `Object3D` or loader result | the bundled model | The model to fly |
| `anchor` | `{x, y, z}` | `{0, 0, 0}` | The point in that model the flight model moves |
| `terrain` | `{sampleHeight, bounds}` | flat ground | The world being flown over |
| `keymap` | object | `DEFAULT_KEYMAP` | Bindings, merged over the bundled ones |
| `controls` | boolean | `true` | `false` takes the keyboard off entirely |
| `wrap` | boolean | `true` | `false` lets the aircraft fly past the bounds |
| `runways` | array | the terrain's | Strips a landing can be made on |
| `cameraMode` | `'CHASE'`, `'COCKPIT'`, `'ORBIT'` | `'CHASE'` | The view to open in |
| `onReset` | function | none | Called whenever the flight resets |
| `onLanding` | function | none | Called on an arrival that was a landing |
| `flight` | object | the configured start | Overrides for the start and the model |

`flight` takes the start state and the flight model's own numbers, all in world
units. Everything it does not name comes from the configured start, so a pilot
created with no options at all flies exactly the way the bundled simulator does.

| `flight` field | Is |
|----------------|-----|
| `speed`, `throttle`, `altitude`, `verticalSpeed`, `pitch`, `yaw` | The condition the flight opens in, and resets to |
| `x`, `z` | Where over the world it opens, which defaults to the middle of it |
| `grounded` | True for a start held on the ground, so the first arrival judged is the one flown back to it |
| `sensitivity` | How hard the controls bite, `0.1` to `4` |
| `minSpeed`, `cruiseSpeed`, `maxSpeed` | The stall speed, the speed lift cancels gravity at, and the speed a full throttle asks for |
| `gravity` | The pull before lift is subtracted |
| `clearance` | How far above the ground the aircraft sits when it meets it |
| `impactSpeed` | The sink rate that turns an arrival into a crash |
| `runwayImpactSpeed` | The same, over a strip, where prepared ground takes more |

An anchor is the one thing an external model has to declare. The bundled
aircraft is built nose-first along `+Z` with its control anchor at the origin;
a model built around some other point is shifted so that point sits where the
flight model puts the aircraft, rather than the host having to rebuild it.

### What comes back

| Member | Is |
|--------|-----|
| `update(dt)` | Advances one frame and returns the telemetry |
| `telemetry()` | The same reading without advancing |
| `pose()` | `{position, rotation, quaternion, attitude}`, for an external camera |
| `setTerrain(terrain)` | Flies a different world without rebuilding the aircraft |
| `setRunways(runways)` | Names the strips a landing can be made on |
| `setStart(flight)` | Changes what a reset resets to, without resetting |
| `reset()` | Back to the start state |
| `dispose()` | Takes the aircraft out of the scene, keyboard and all |
| `bounds` | The square being flown over, as the terrain declares it |
| `runways` | The strips currently being flown over |
| `aircraft`, `camera`, `scene`, `object3D`, `input`, `keymap` | The parts, for a host that wants them |

`input` is the control state the flight model reads each frame. A host that
created its pilot with `controls: false` writes it directly, from a gamepad, a
touch surface, or a replay:

```javascript
pilot.input.pitchUp = stick.y > 0.2;
pilot.input.throttleUp = trigger > 0.5;
```

### Telemetry

Every field is in world units, and the object carries these fields and no
others. It is a reading rather than a handle: mutating it changes nothing.

| Field | Is |
|-------|-----|
| `airspeed` | Units per second |
| `altitude` | Height above sea level |
| `verticalSpeed` | Units per second, positive on a climb |
| `heading` | Whole degrees, `0` to `359`, clockwise from north |
| `throttle` | The lever setting, `0` to `1` |
| `heightAboveTerrain` | Height above the ground directly below |
| `crashed` | True while the controls are locked by an impact |
| `landed` | True while the aircraft is down on a strip after an arrival that was a landing |
| `stalled` | True while airspeed is below the stall speed |

`TELEMETRY_FIELDS` is the same list, for a host checking its own.

### Worked example: the Pilot API over an external environment

A host page that has its own ground and wants the aircraft that flies over it.
Here the ground is a plain sine field, which is enough to show what the terrain
contract is: something that answers the height under a point, and says how far
its ground goes.

```javascript
import * as THREE from 'three';
import { createPilot, boundsFromSize } from 'pilot-matter';

const scene    = new THREE.Scene();
const camera   = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 12000);
const renderer = new THREE.WebGLRenderer({ antialias: true });

renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);
scene.add(new THREE.DirectionalLight(0xffffff, 1.2), new THREE.AmbientLight(0x8899aa, 0.6));

// The host's own world: any function of x and z will do, and the bounds say
// where it stops being one.
const myTerrain = {
    sampleHeight: (x, z) => 60 * Math.sin(x / 900) * Math.cos(z / 900),
    bounds: boundsFromSize(10000)
};

// The host's own aircraft, nose along +Z, with the point the flight model
// should move declared as the anchor.
const myAircraft = new THREE.Mesh(
    new THREE.ConeGeometry(2, 10, 8).rotateX(Math.PI / 2),
    new THREE.MeshPhongMaterial({ color: 0xdddddd })
);

const pilot = createPilot({
    scene,
    camera,
    terrain: myTerrain,
    aircraft: myAircraft,
    anchor: { x: 0, y: 0, z: 0 },
    keymap: { yawLeft: ['KeyZ'], yawRight: ['KeyX'] },   // remap two, keep the rest
    flight: { sensitivity: 1.5 },
    onReset: () => console.log('back at the start')
});

const clock = new THREE.Clock();

renderer.setAnimationLoop(() => {
    const { airspeed, altitude, verticalSpeed, heading, throttle, stalled } =
        pilot.update(clock.getDelta());

    myHud.textContent =
        `${Math.round(airspeed * 2)} kt  ${Math.round(altitude * 3.28)} ft  ` +
        `${heading.toString().padStart(3, '0')}  ${Math.round(throttle * 100)}%` +
        (stalled ? '  STALL' : '');

    renderer.render(scene, camera);
});
```

The aircraft is flown with the bundled keys, less the two that were remapped.
Nothing in the host page reaches into the flight model: the HUD is written from
the telemetry, and the world is read through the sampler.

## Matter API

```javascript
createEnvironment(options) -> environment
```

### Options

| Option | Type | Default | Is |
|--------|------|---------|-----|
| `environment` | string | `'highlands'` | The assembled environment to build |
| `size` | number | `16000` | The square the world covers |
| `segments` | number | `200` | How finely that square is sampled |
| `elements` | array | the preset's | Element placements, instead of the preset's |
| `runway` | boolean or object | `false` | A landable strip in the world, or a configuration for one |
| `tile` | `{x, z}` | `{0, 0}` | Which square of a larger assembly this world is |
| `seed` | number | the preset's | Builds the same description as different ground |
| `lights` | boolean | `true` | `false` to light the world yourself |
| `fog` | boolean | `true` | `false` to keep your own scene depth |

### What comes back

| Member | Is |
|--------|-----|
| `group` | The world as one `Group` any scene can add |
| `sampleHeight(x, z)` | The ground under a point - the terrain contract itself |
| `bounds` | The square the world covers |
| `runways` | The strips cut into it, empty for a world built without one |
| `field` | The height and colour field behind the mesh |
| `environment` | The preset being drawn |
| `tile`, `origin` | The square of a larger world this is, and where its middle sits |
| `setEnvironment(id)` | Regenerates the ground as a different world |
| `join(...neighbours)` | Settles this world's edges against the worlds laid beside it |
| `redraw()` | Draws the ground again from the field as it now stands |
| `register(object, placement)` | Adds a caller-supplied mesh as an element of the world |
| `attach(aircraft)` | Adopts an aircraft the environment did not build |
| `applyDepth(scene, depth)` | The sky and the fog, applied to any scene |
| `setDaylight(phase)` | Sets the hour of the day, and returns the light at it |
| `updateWater(dt, light)` | Moves the water on by a frame |
| `dispose()` | Releases the mesh, the geometry, and everything registered |

`register` is placement by the generator rather than by the host: given a
position the object is set down on the ground there, and given none it is
dropped somewhere inside the bounds by the environment's own seeded stream.
Anything registered is settled again when the world is regenerated, so an
object placed on a hillside that is no longer there is set down on what is.

```javascript
world.register(myWindsock, { x: 400, z: -900, offset: 2 });
```

`attach` checks the aircraft against the contract and throws with every problem
at once rather than one per reload. What it returns is the aircraft and a
`groundHeight()` for whatever is flying it.

`applyDepth` is the world's depth without the world: the sky it fades to and the
fog that fades it, applied to any scene. An environment created with
`fog: false` leaves the scene's own depth alone.

### The aircraft contract

What an aircraft has to be before the Matter API will fly it:

| Requirement | Why |
|-------------|-----|
| `position` with numeric `x`, `y`, `z` | The world has to know where to sample under it |
| `rotation` with a numeric `x`, **or** a `getQuaternion()` | The world has to know which way it points |
| `anchor` as a point, if given at all | The point in the model that is being moved |

An aircraft that is also an `Object3D` is added to the group; one that is not is
still flown, and stays wherever the host is drawing it.

### Worked example: the Matter API under an external aircraft

A host page with an aircraft of its own, driven by a flight model of its own,
that wants a world to fly it over.

```javascript
import * as THREE from 'three';
import { createEnvironment, isAircraftContractSatisfied } from 'pilot-matter';

const scene    = new THREE.Scene();
const camera   = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 12000);
const renderer = new THREE.WebGLRenderer({ antialias: true });

renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

const world = createEnvironment({ environment: 'lakeside' });

scene.add(world.group);
world.applyDepth(scene);                 // the sky and the fog, without the ground

// The host's own aircraft, flown by the host's own model. All the world asks
// of it is a position and an orientation it can read.
const myAircraft = new THREE.Group();
myAircraft.position.set(0, 900, 0);
myAircraft.add(new THREE.Mesh(
    new THREE.BoxGeometry(12, 1, 3),
    new THREE.MeshLambertMaterial({ color: 0x4477aa })
));

console.assert(isAircraftContractSatisfied(myAircraft));

const flown = world.attach(myAircraft);  // throws with every gap in the contract

// A landmark of the host's own, set down on the ground rather than over it.
world.register(new THREE.Mesh(
    new THREE.CylinderGeometry(1, 1, 30, 6),
    new THREE.MeshLambertMaterial({ color: 0xdd4422 })
), { x: 1200, z: -400, offset: 15 });

const clock = new THREE.Clock();

renderer.setAnimationLoop(() => {
    myFlightModel.update(clock.getDelta(), flown.groundHeight());

    camera.position.copy(myAircraft.position).add(new THREE.Vector3(0, 12, -36));
    camera.lookAt(myAircraft.position);

    renderer.render(scene, camera);
});

// A different world under the same aircraft, regenerated in place.
document.querySelector('#world-picker').addEventListener('change', (event) => {
    world.setEnvironment(event.target.value);
});
```

### One tile of a larger world

An environment covers a square, and `tile` says which square of a larger world
that is, counted in squares off the middle of it. A tile is generated in the
world's coordinates rather than in its own: its vertices stand where its place in
the grid puts them, its sampler answers for that square and nothing outside it,
and the noise its ground is shaped from runs on across the join instead of
starting again at it.

```javascript
import { createEnvironment } from 'pilot-matter';

const west = createEnvironment({ environment: 'highlands', size: 8000, tile: { x: -0.5, z: 0 } });
const east = createEnvironment({ environment: 'highlands', size: 8000, tile: { x:  0.5, z: 0 } });

scene.add(west.group, east.group);
west.join(east);                 // settles what their elements drew at the join
```

There is no coordinate to convert. A tile's mesh is drawn where its field says it
is, so a host flying across an assembly asks whichever tile the aircraft is over
and passes it the world position it already has:

```javascript
const ground = world.tileAt(position.x, position.z)?.sampleHeight(position.x, position.z) ?? 0;
```

`join` is what closes the seam. The ground a tile is shaped on already agrees
with its neighbour's, because it is noise read off the world rather than off the
tile; what does not is what the elements drew, since a peak that ended at one
tile's edge knows nothing about the ground its neighbour laid against it. Every
place two or more tiles put a vertex is settled on one height and one colour -
the average of what they all had there - and each tile is walked back to what it
was over the next few vertices in, so the join is seamless without the country
behind it being flattened to make it so.

Give `join` every neighbour at once rather than one at a time. A vertex four
tiles all reach has to be settled against all four of them to close.

```javascript
middle.join(north, south, east, west);
```

`createTiledEnvironment` does the whole of it: builds the grid, lights it once
rather than once per square, and settles every join in one pass before anything
is drawn.

```javascript
import { createTiledEnvironment } from 'pilot-matter';

const world = createTiledEnvironment({
    environment: 'lakeside',
    tiles: 2,                    // 2 by 2, or { x, z } for a rectangle
    size: 8000,
    runway: true
});

scene.add(world.group);
world.applyDepth(scene);

const flown = world.attach(myAircraft);   // ground reported from whichever square it is over
```

| Member | Is |
|--------|-----|
| `group` | The whole assembly as one `Group` |
| `tiles` | Each square, as the environment it is |
| `across` | How many squares the grid runs, as `{x, z}` |
| `bounds` | The square the whole assembly covers |
| `seams` | How many shared vertices the joins were settled at |
| `runways` | Every strip cut into the assembly, whichever square it was cut into |
| `tileAt(x, z)` | The square a place falls on, or `null` off the whole assembly |
| `sampleHeight(x, z)` | The ground under a point, from whichever square it is over |
| `attach(aircraft)` | Adopts an aircraft, reporting the ground under it across the assembly |
| `register(object, placement)` | Adds a mesh as an element of the square it falls on |
| `applyDepth(scene, depth)` | The sky and the fog, applied to any scene |
| `setDaylight(phase)` | The hour of the day, over the whole assembly |
| `updateWater(dt, light)` | Moves every square's water on together |
| `dispose()` | Releases every square |

An assembly answers the terrain contract the way a single environment does, so
the Pilot API flies over the whole grid rather than over one square of it:

```javascript
const pilot = createPilot({ scene, camera, terrain: world });
```

Each tile is a whole environment - its own elements, its own strips, its own
water - laid out from its own place in the grid, so neighbouring squares are the
same world without being the same ground. Because the ground is generated from a
description rather than loaded, a tile costs a few tens of milliseconds and no
download.

## Contracts

Everything under `js/api/contract.js` is pure and imports no renderer.

| Export | Is |
|--------|-----|
| `API_VERSION` | The version of the contracts a host is holding |
| `boundsFromSize(size, origin)` | The square a world of that size covers, about wherever its middle is |
| `tileOrigin(tile, size)` | Where the middle of a tile sits in the world it is one square of |
| `flatSampler(height)` | A height sampler for a host with no terrain of its own |
| `isInsideBounds(bounds, x, z)` | Whether a point is over the ground |
| `resolveTerrain(terrain)` | A terrain with its gaps filled in |
| `resolvePilotOptions(options)` | The Pilot API's options, resolved |
| `resolveEnvironmentOptions(options)` | The Matter API's options, resolved |
| `validateAircraftContract(aircraft)` | Every problem with an aircraft, as an array |
| `isAircraftContractSatisfied(aircraft)` | The same question as a yes or no |
| `createTelemetry(values)` | A telemetry object of the stable shape |
| `TELEMETRY_FIELDS` | The fields every telemetry object carries |
| `DEFAULT_KEYMAP`, `CONTROL_NAMES`, `RESET_KEYS` | The bundled bindings |

The resolvers are worth calling on their own: they are how a host finds out what
its options actually came to before anything is built.

```javascript
import { resolvePilotOptions, validateAircraftContract } from 'pilot-matter/contract';

const problems = validateAircraftContract(myAircraft);   // every gap at once, or []
if (problems.length) throw new TypeError(problems.join('; '));

const resolved = resolvePilotOptions({ flight: { sensitivity: 400 } });
resolved.flight.sensitivity;   // 4 - clamped onto the range, not refused
```

## Configuration

The condition a flight opens in is data rather than a set of literals, and a
host can read it, offer it, and hand back an edited one.

| Export | Is |
|--------|-----|
| `DEFAULT_CONFIG` | The configured start, frozen |
| `START_FIELDS` | Each field of the start, with what it may hold |
| `START_FIELD_IDS` | The field names, in the order they are offered |
| `START_MODES`, `START_FLYING`, `START_TAKEOFF` | The two conditions a flight can open in |
| `CHOICE_FIELD`, `TOGGLE_FIELD` | What a field that is chosen or switched calls itself |
| `startField(id)` | One field's declaration |
| `isStartValue(id, value)` | Whether a field can be left holding a value |
| `snapStartValue(id, value)` | The nearest value a field can hold to a worked-out one |
| `startDefaults()` | A fresh copy of the configured start |
| `resolveStart(values)` | A start with its gaps filled in, field by field |
| `startsOnRunway(start)`, `runwayForced(start)`, `runwayWanted(start)` | What the start says about the strip |
| `flightStart(start, world)` | The same start in the world units `flight` takes |
| `takeoffStart(start, runway)` | A flight held at a threshold, ready to roll |
| `createFlightState(start, world)` | The same start as a position and a rotation |

A start is written the way a pilot reads it:

| Field | Reads in | Opens on |
|-------|----------|----------|
| `startMode` | `'flying'` or `'takeoff'` | `'flying'` |
| `runway` | Whether the generated world carries a strip | `true` |
| `airspeedKnots` | Knots | `80` |
| `altitudeFeet` | Feet above sea level | `1390` |
| `verticalSpeedFpm` | Feet per minute, signed | `1260` |
| `headingDegrees` | Degrees on the card, clockwise from north | `0` |
| `throttlePercent` | Percent of lever travel | `20` |
| `cameraMode` | `'CHASE'`, `'COCKPIT'`, `'ORBIT'` | `'CHASE'` |

`startMode` decides which of the others mean anything. `'flying'` opens the
flight already up, in the condition the rest of the fields describe. `'takeoff'`
opens it stopped at a runway threshold with the engine idling, and takes nothing
from the airborne fields but the camera - an aircraft held on the ground has no
airspeed, no altitude, and no climb of its own to set. A takeoff also turns
`runway` on and holds it there, because a start that asked to roll out of a world
with no strip in it is not a start anything could honour.

`flightStart` is the one place those become world units. A start that opens on a
strip is resolved against the strip it opens on, so the world it is being flown
over is passed in beside it:

```javascript
import { startDefaults, flightStart, createPilot, START_TAKEOFF } from 'pilot-matter';

const start = { ...startDefaults(), airspeedKnots: 140, altitudeFeet: 3000 };
const pilot = createPilot({ scene, flight: flightStart(start) });

// Or held at the threshold of the strip the world carries:
const held = { ...startDefaults(), startMode: START_TAKEOFF };
pilot.setStart(flightStart(held, { runway: world.runways[0] }));
```

The pitch is not part of a start, it is worked out from one: the attitude that
holds the configured climb at the configured airspeed, so a flight opens in the
climb it was configured for rather than settling out of it over the first
second.

Each field declares its own range and step, or the list of settings it may take,
which is what lets a host build a control for it without knowing anything about
flight:

```javascript
import { START_FIELDS, CHOICE_FIELD, TOGGLE_FIELD } from 'pilot-matter';

for (const field of START_FIELDS) {
    if (field.kind === CHOICE_FIELD) makeRadioGroup(field.label, field.values);
    else if (field.kind === TOGGLE_FIELD) makeCheckbox(field.label, field.default);
    else if (field.values) makeDropdown(field.label, field.values);
    else makeSlider(field.label, field.min, field.max, field.step, field.unit);
}
```

`isStartValue` refuses a reading between two steps rather than snapping it,
because a value the configuration never offered is a value from somewhere else.
`snapStartValue` is for the other case - a reading worked out rather than chosen,
which wants the nearest setting the field actually has.

## Runways and landings

A runway is an element of the world like a river or a forest: generated by
algorithm rather than placed as an asset, cut into whichever ground the site
search found flattest, and levelled with an apron that eases back into the
country around it. A world is built without one unless one is asked for.

```javascript
import { createEnvironment, createPilot, flightStart, startDefaults, START_TAKEOFF } from 'pilot-matter';

const world = createEnvironment({ environment: 'highlands', runway: true });
const strip = world.runways[0];

const pilot = createPilot({
    scene, terrain: world, camera,
    flight: flightStart({ ...startDefaults(), startMode: START_TAKEOFF }, { runway: strip }),
    onLanding: (runway) => console.log('down on', runway.heading)
});
```

A strip is a plain description, and everything that reads one is published:

| Strip field | Is |
|-------------|-----|
| `x`, `z` | The middle of the pavement |
| `heading` | The bearing it runs on, in degrees clockwise from north |
| `alongX`, `alongZ` | The same bearing as a unit vector |
| `length`, `width` | The paved rectangle |
| `elevation` | The height it was levelled to |

| Export | Is |
|--------|-----|
| `runwayDirection(heading)` | A bearing as the vector a strip runs along |
| `runwayPoint(runway, along, across)` | A place on a strip, as a place in the world |
| `runwayOffsets(runway, x, z)` | The same reading the other way round |
| `isOnRunway(runway, x, z, margin)` | Whether a place is over the pavement |
| `runwayThresholds(runway)` | Both ends, each with the bearing a takeoff from it runs on |
| `nearestRunway(runways, x, z)` | The strip nearest a place, or null |

A strip changes what an arrival on the ground means rather than how hard one is
allowed to be. Off a runway the rule is the one it has always been: too fast a
descent breaks the aircraft, and anything gentler is flown out of. On one, an
arrival inside the landing limits and flown in the attitude a landing is flown in
is a landing; a firmer arrival still rolls out, because prepared ground takes
more than a hillside does; and only past the runway's own threshold is it a
crash.

| Export | Is |
|--------|-----|
| `FLYING`, `LANDED`, `CRASHED` | What an arrival amounted to |
| `GROUND_OUTCOMES` | The three of them, for a host checking its own |
| `touchdownOutcome(contact, limits)` | Which one an arrival was |
| `withinLandingAttitude(contact, limits)` | Whether it was being held the way a landing is flown |
| `headingOffsetTo(heading, runwayHeading)` | How far off the strip the nose is, to whichever end is nearer |
| `LANDING_LIMITS` | The thresholds all of the above default to |
| `GROUND_CLEARANCE`, `CRASH_IMPACT_SPEED`, `RUNWAY_IMPACT_SPEED` | The tuning behind them |

`contact` is `{verticalSpeed, onRunway, bank, pitch, headingOffset}`, in world
units and radians. The telemetry's `landed` is the same reading for a host that
would rather not work it out.

## Game modes

The bundled game is played in modes, and the rules behind them are pure: the
stages, the run state, the course a set of loops is laid out as, and the test for
whether a gate was flown through. A host can play them against its own renderer,
or read them as a worked example of a game built on the two APIs.

| Export | Is |
|--------|-----|
| `GAME_MODES`, `GAME_MODE_IDS` | The modes there are |
| `RUNWAY_LANDING`, `LOOP_COURSE` | The two of them by name |
| `LAND_OBJECTIVE`, `LOOP_OBJECTIVE` | What a mode is asking for |
| `getGameMode(id)`, `isGameModeId(id)` | Looking one up |
| `createRunState(modeId)`, `startRun(state, id)`, `endRun(state)` | A run, started and stopped |
| `runningMode(state)`, `currentStage(state)`, `advanceStage(state)`, `restartStage(state)` | Where it is up to |
| `recordLanding(state)`, `recordGate(state, index)`, `recordCrash(state)` | Telling it what happened |
| `stageProgress(state)`, `isStageComplete(state)`, `nextGate(state)` | How far through it is |
| `runObjective(state)`, `runStatus(state)` | What to write on the screen |
| `stageWorld(state)` | The world the stage is flown over |
| `stageStart(state, world)` | Where in it the flight opens |
| `buildCourse(stage, options)` | The loops a course stage is flown through |
| `gatePassed(ring, from, to)`, `gateOffset(ring, point)` | Whether a step went through one |

A gate is tested against the step the aircraft flew rather than against where it
ended up, because a hoop is thinner than the distance covered in a frame and a
point test would fly straight through one without noticing:

```javascript
import { createRunState, LOOP_COURSE, buildCourse, currentStage, nextGate, recordGate } from 'pilot-matter';

const run = createRunState(LOOP_COURSE);
const rings = buildCourse(currentStage(run), { seed: 1, sampleHeight: world.sampleHeight });

let last = pilot.pose().position;
function frame(dt) {
    pilot.update(dt);
    const now = pilot.pose().position;
    const gate = nextGate(run);
    if (gate >= 0 && gatePassed(rings[gate], last, now)) recordGate(run, gate);
    last = now;
}
```

## Worlds and elements

| Export | Is |
|--------|-----|
| `ENVIRONMENTS` | The five assembled environments |
| `MODE_ENVIRONMENTS` | The thin worlds the game modes are played over |
| `DEFAULT_ENVIRONMENT_ID` | The one a fresh install opens on |
| `getEnvironment(id)`, `environmentIds()`, `isEnvironmentId(id)` | Looking one up |
| `environmentElements(environment, runway)` | A description's placements, with a strip added if asked |
| `buildEnvironment(environment, options)` | The field a description becomes |
| `ELEMENTS`, `ELEMENT_ORDER` | The element registry, and the order it applies in |
| `getElement(id)`, `isElementId(id)` | Looking one up |
| `resolveConfig(element, overrides)` | An element's configuration, clamped to its ranges |
| `createField(options)` | An empty height and colour field |
| `sampleHeight(field, x, z)` | The ground under a point of a field |
| `fieldBounds(field)` | The square a field covers, in the world rather than in its own coordinates |
| `tileSeed(seed, x, z)` | The seed one square of an assembly is laid out from; the middle square is the seed itself, and no two places in a grid share one |
| `matchEdges(fields, options)` | Settles an assembly wherever its fields meet |
| `SEAM_BLEND` | How far a join is eased back into the ground, in vertices |
| `waterSurface(field)` | The water a world settled at, as the vertices under its level |

The five worlds a host can ask for by name:

| Id | Is |
|----|-----|
| `'highlands'` | fBm ground under scattered peaks, with snow above 300 |
| `'river-basin'` | A meandering river the width of the world, through low forested country |
| `'canyon-country'` | A branching canyon system cut into a high plateau |
| `'dune-sea'` | Wind-blown dunes and rock outcrops, cut by one desert river |
| `'lakeside'` | A town on the shore of a wide lake, under forested hills |

Two more are built for the game modes rather than to be chosen between, and are
deliberately thin - what a mode asks the pilot to read is the objective, not the
scenery around it. `isEnvironmentId` answers no for both, so a stored choice can
never leave a free flight parked in one; `getEnvironment` still finds them by
name.

| Id | Is |
|----|-----|
| `'open-country'` | Low rolling ground under a wide sky, with one strip cut into it |
| `'loop-valley'` | A shallow valley with clear air over it, for a course of loops |

An environment is a description rather than geometry: a name, a seed, the base
ground, and the elements placed over it. A host can pass its own list of
placements instead of a preset's, and every value in one is clamped into the
range the element declares, so a placement cannot configure an element outside
what it says it supports.

```javascript
import { createEnvironment } from 'pilot-matter';

const world = createEnvironment({
    size: 8000,
    elements: [
        { type: 'mountain', config: { count: 12, height: [200, 700], radius: [300, 900] } },
        { type: 'grass',    config: { band: [10, 200] } },
        { type: 'water',    config: { level: 6 } },
        { type: 'snow',     config: { line: 400, coverage: 0.8 } }
    ]
});
```

The field itself is a plain object of typed arrays, sampled row by row from the
low `z` edge to the high one, which is the order a renderer walks a plane grid
in. A host that wants the ground without a mesh can build one and read it:

```javascript
import { buildEnvironment, getEnvironment, sampleHeight } from 'pilot-matter';

const field = buildEnvironment(getEnvironment('canyon-country'), { size: 8000, segments: 128 });
const ground = sampleHeight(field, 120, -400);
```

| Field member | Is |
|--------------|-----|
| `size`, `segments`, `stride`, `count`, `step` | The grid the world is sampled on |
| `originX`, `originZ` | Where the middle of that grid sits in the world |
| `height` | A `Float32Array` of one height per vertex |
| `color` | A `Float32Array` of three components per vertex |
| `runways` | The strips cut into it, which a flight model has to be able to ask about by name |
| `water` | The level whatever water was laid settled at, or `null` for a dry world |

## The day

A world lit one way all flight is a world with one hour in it. The cycle turns
that hour into a day: the light warms and cools, the sky and the fog it fades to
go with it rather than after it, and the sun walks across the sky instead of
hanging in one corner of it. The whole of it is arithmetic - no renderer, no
scene - so a host can drive its own sky from it, or read the hour without
drawing one.

| Export | Is |
|--------|-----|
| `createDayNight(options)` | A day: how long it runs, and the hour it opens on |
| `advanceDayNight(state, dt)` | Moves the day on by a frame, and returns the hour |
| `daylightAt(phase)` | The light at an hour: the sky, the sun, the fill, and how much day it amounts to |
| `sunPositionAt(phase, distance)` | Where the sun is at that hour |
| `wrapPhase(phase)` | An hour outside the day, as the hour inside it that it amounts to |
| `clockAt(phase)` | The hour as a clock reading, for anything that shows it |
| `CYCLE_LENGTH`, `CYCLE_START` | How long a day takes, and the hour a flight opens on |
| `DAY_STOPS` | The day as the moments it is read between |
| `SUN_DISTANCE` | How far the sun is thrown from the middle of the world |

Phase runs `0` to `1` over a whole day: midnight at `0`, dawn around a quarter,
noon at a half, dusk around three quarters. Midday is the light the world was
drawn in before it had a day, so a flight at noon is lit exactly as it always
was.

```javascript
import { createDayNight, advanceDayNight } from 'pilot-matter';

const day = createDayNight({ length: 600, phase: 0.3 });   // ten minutes, opening mid-morning

renderer.setAnimationLoop(() => {
    const dt = clock.getDelta();
    advanceDayNight(day, dt);

    const light = world.setDaylight(day.phase);   // the sky, the fog, and the sun
    world.updateWater(dt, light.daylight);        // and what there is to glint with
});
```

Time a flight did not spend flying is time the day does not spend passing: hand
the cycle a `dt` of `0` and the sun stays where it was left, which is what keeps
a paused world paused.

`daylightAt` is the whole reading, for a host lighting its own scene:

| Field | Is |
|-------|-----|
| `phase` | The hour it was read at |
| `label` | What that hour is called - `NOON`, `DUSK`, `NIGHT` |
| `sky` | The colour the world fades to, as `[r, g, b]` in `0` to `1` |
| `sun` | `{color, intensity}` for the directional light |
| `ambient` | `{color, intensity}` for the fill |
| `daylight` | How much day there is at all, `0` to `1` |

## The water

Water is the one part of the ground that moves and the one part that shines. The
surface a world settled at is read off the finished field - the vertices lying at
or under the level the water was laid at - and moved from there, so ground the
water no longer has, a strip graded over a shallow or a town levelled onto a
shore, is not still being moved as though it were.

| Export | Is |
|--------|-----|
| `waterSurface(field)` | The surface a world settled at, or `null` for a dry world |
| `waveHeight(x, z, time, wave)` | How far the surface stands off its resting level at a point |
| `waveSpecular(x, z, time, wave)` | How much of the light that point is throwing back |
| `waterColor(base, specular, options)` | The colour water is showing, with the light laid over it |
| `animateWater(surface, time, options)` | Moves a whole surface on to a moment in time |
| `WAVE` | The swell every world's water is drawn with |
| `WATER_SHEEN`, `SHEEN_STRENGTH` | The colour the sun leaves on water, and how much of it a crest shows |

The wave is a function of where a point is in the world and what time it is,
which is what lets two tiles of an assembly work out the same surface at the
place they meet without agreeing on anything. `animateWater` writes into the
arrays a renderer is already drawing from, three numbers a vertex, and touches
nothing but the water:

```javascript
import { waterSurface, animateWater } from 'pilot-matter';

const surface = waterSurface(myField);
const position = myMesh.geometry.attributes.position;
const color = myMesh.geometry.attributes.color;

animateWater(surface, elapsed, { positions: position.array, colors: color.array, light: 0.8 });
position.needsUpdate = true;
color.needsUpdate = true;
```

| Surface member | Is |
|----------------|-----|
| `level` | The height the water was laid at |
| `count`, `vertices` | How many vertices it covers, and which they are |
| `x`, `z` | Where each of them is in the world |
| `rest` | The height each of them rests at |
| `color` | The colour each of them was painted |
| `open` | How far from the bank each of them is, `0` to `1` |

`open` is what holds the swell down to nothing at the shoreline, so the water
meets the bank it was poured against rather than lapping over it.

## The edge of the world

A terrain declares bounds and answers nothing outside them, so an aircraft flown
far enough would find itself over a flat nothing the fog had been promising was
more world. By default the Pilot API carries the aircraft round instead:
crossing an edge puts it back in over the opposite one, at the same distance
past it, at the same altitude, and on the same heading. Only the horizontal
position moves.

A host whose own world continues past the bounds it declared, or which would
rather handle the edge itself, creates its pilot with `wrap: false`. The rule is
published either way, so a host handling its own edge can match it:

| Export | Is |
|--------|-----|
| `wrapValue(value, low, high)` | A value carried back inside a span |
| `wrapPosition(bounds, x, z)` | `{x, z, wrapped}` - a position carried back inside a world |
| `isOutsideBounds(bounds, x, z)` | Whether a point is past one of the edges |

```javascript
import { wrapPosition } from 'pilot-matter';

const carried = wrapPosition(world.bounds, myAircraft.position.x, myAircraft.position.z);
if (carried.wrapped) myAircraft.position.set(carried.x, myAircraft.position.y, carried.z);
```

Sitting exactly on a boundary is still inside the world: a position that has
only reached the edge has not crossed it.

The bundled simulator answers the same question a different way. Rather than
carry the aircraft round one square, it lays the square down as one tile of an
endless grid and draws the tiles around the aircraft out past the far plane, so
the ground it is over is always ground that continues. A host can build the same
thing out of what is published here - `tileSeed` for the seed a place is laid
out from, and `createEnvironment({ tile })` for the square it is laid at - or use
`createTiledEnvironment` for a grid of a fixed size with its joins settled.
