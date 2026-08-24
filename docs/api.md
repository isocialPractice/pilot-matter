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
- [The edge of the world](#the-edge-of-the-world)

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

Three.js is reached for by the two halves that build something with it, and by
the root entry point that re-exports them both. `pilot-matter/contract`,
`pilot-matter/config`, `pilot-matter/environment`, and `pilot-matter/elements`
load no renderer at all,
which is the point of the split: a host can check its own options, describe its
own world, or check the shape of its telemetry on a server, in a worker, or in a
test, with nothing rendered.

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
| `cameraMode` | `'CHASE'`, `'COCKPIT'`, `'ORBIT'` | `'CHASE'` | The view to open in |
| `onReset` | function | none | Called whenever the flight resets |
| `flight` | object | the configured start | Overrides for the start and the model |

`flight` takes the start state and the flight model's own numbers, all in world
units. Everything it does not name comes from the configured start, so a pilot
created with no options at all flies exactly the way the bundled simulator does.

| `flight` field | Is |
|----------------|-----|
| `speed`, `throttle`, `altitude`, `verticalSpeed`, `pitch`, `yaw` | The condition the flight opens in, and resets to |
| `sensitivity` | How hard the controls bite, `0.1` to `4` |
| `minSpeed`, `cruiseSpeed`, `maxSpeed` | The stall speed, the speed lift cancels gravity at, and the speed a full throttle asks for |
| `gravity` | The pull before lift is subtracted |
| `clearance` | How far above the ground the aircraft sits when it meets it |
| `impactSpeed` | The sink rate that turns an arrival into a crash |

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
| `setStart(flight)` | Changes what a reset resets to, without resetting |
| `reset()` | Back to the start state |
| `dispose()` | Takes the aircraft out of the scene, keyboard and all |
| `bounds` | The square being flown over, as the terrain declares it |
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
| `lights` | boolean | `true` | `false` to light the world yourself |
| `fog` | boolean | `true` | `false` to keep your own scene depth |

### What comes back

| Member | Is |
|--------|-----|
| `group` | The world as one `Group` any scene can add |
| `sampleHeight(x, z)` | The ground under a point - the terrain contract itself |
| `bounds` | The square the world covers |
| `field` | The height and colour field behind the mesh |
| `environment` | The preset being drawn |
| `setEnvironment(id)` | Regenerates the ground as a different world |
| `register(object, placement)` | Adds a caller-supplied mesh as an element of the world |
| `attach(aircraft)` | Adopts an aircraft the environment did not build |
| `applyDepth(scene, depth)` | The sky and the fog, applied to any scene |
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

An environment covers a square, and a host assembling several of them moves each
group to its own place in the larger world. Because the ground is generated from
a description rather than loaded, a tile costs a few tens of milliseconds and no
download, and a tile built from the same preset and seed is the same ground
every time:

```javascript
const tiles = [];

for (const [tx, tz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const tile = createEnvironment({ environment: 'highlands', lights: false, fog: false });
    tile.group.position.set(tx * tile.bounds.maxX * 2, 0, tz * tile.bounds.maxZ * 2);
    scene.add(tile.group);
    tiles.push(tile);
}
```

Each tile is sampled in its own coordinates, so a host flying across an assembly
works out which tile it is over and takes the ground from that one:

```javascript
const local = { x: position.x - tile.group.position.x, z: position.z - tile.group.position.z };
const ground = tile.sampleHeight(local.x, local.z);
```

Two tiles laid side by side meet at a seam rather than at matched heights: the
ground each one draws is a description of a whole world rather than of a piece
of one, and where its east edge lands has nothing to do with where its
neighbour's west edge does. In the bundled simulator that never shows, because
the fog reaches its full depth well before the edge does; in an assembly flown
low it will. A host that needs the join to hold either flies with enough fog to
cover it, or draws its tiles from a description of its own that carries the
shared edge in both.

## Contracts

Everything under `js/api/contract.js` is pure and imports no renderer.

| Export | Is |
|--------|-----|
| `API_VERSION` | The version of the contracts a host is holding |
| `boundsFromSize(size)` | The square a world of that size covers |
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
| `startField(id)` | One field's declaration |
| `isStartValue(id, value)` | Whether a field can be left holding a value |
| `startDefaults()` | A fresh copy of the configured start |
| `resolveStart(values)` | A start with its gaps filled in, field by field |
| `flightStart(start)` | The same start in the world units `flight` takes |
| `createFlightState(start)` | The same start as a position and a rotation |

A start is written the way a pilot reads it:

| Field | Reads in | Opens on |
|-------|----------|----------|
| `airspeedKnots` | Knots | `80` |
| `altitudeFeet` | Feet above sea level | `1390` |
| `verticalSpeedFpm` | Feet per minute, signed | `1260` |
| `headingDegrees` | Degrees on the card, clockwise from north | `0` |
| `throttlePercent` | Percent of lever travel | `20` |
| `cameraMode` | `'CHASE'`, `'COCKPIT'`, `'ORBIT'` | `'CHASE'` |

`flightStart` is the one place those become world units:

```javascript
import { startDefaults, flightStart, createPilot } from 'pilot-matter';

const start = { ...startDefaults(), airspeedKnots: 140, altitudeFeet: 3000 };
const pilot = createPilot({ scene, flight: flightStart(start) });
```

The pitch is not part of a start, it is worked out from one: the attitude that
holds the configured climb at the configured airspeed, so a flight opens in the
climb it was configured for rather than settling out of it over the first
second.

Each field declares its own range and step, which is what lets a host build a
control for it without knowing anything about flight:

```javascript
import { START_FIELDS, isStartValue } from 'pilot-matter';

for (const field of START_FIELDS) {
    if (field.values) makeDropdown(field.label, field.values);
    else makeSlider(field.label, field.min, field.max, field.step, field.unit);
}
```

## Worlds and elements

| Export | Is |
|--------|-----|
| `ENVIRONMENTS` | The five assembled environments |
| `DEFAULT_ENVIRONMENT_ID` | The one a fresh install opens on |
| `getEnvironment(id)`, `environmentIds()`, `isEnvironmentId(id)` | Looking one up |
| `buildEnvironment(environment, options)` | The field a description becomes |
| `ELEMENTS`, `ELEMENT_ORDER` | The element registry, and the order it applies in |
| `getElement(id)`, `isElementId(id)` | Looking one up |
| `resolveConfig(element, overrides)` | An element's configuration, clamped to its ranges |
| `createField(options)` | An empty height and colour field |
| `sampleHeight(field, x, z)` | The ground under a point of a field |

The five worlds a host can ask for by name:

| Id | Is |
|----|-----|
| `'highlands'` | fBm ground under scattered peaks, with snow above 300 |
| `'river-basin'` | A meandering river the width of the world, through low forested country |
| `'canyon-country'` | A branching canyon system cut into a high plateau |
| `'dune-sea'` | Wind-blown dunes and rock outcrops, cut by one desert river |
| `'lakeside'` | A town on the shore of a wide lake, under forested hills |

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
| `height` | A `Float32Array` of one height per vertex |
| `color` | A `Float32Array` of three components per vertex |

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
