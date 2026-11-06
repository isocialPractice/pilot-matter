import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
    PLANES, PART_SHAPES, DEFAULT_PLANE_ID, CHASE_DISTANCE, CHASE_HEIGHT,
    planeById, isPlaneId, planeIds, chaseFor, planeSensitivity
} from '../js/planes.js';
import {
    MIN_SPEED, CRUISE_SPEED, MAX_SPEED, MIN_SENSITIVITY, MAX_SENSITIVITY,
    convergeSpeed, targetSpeed, descentRate
} from '../js/flight-model.js';
import { CRASH_IMPACT_SPEED, RUNWAY_IMPACT_SPEED } from '../js/crash.js';
import { runwayTemplate } from '../js/templates.js';
import { TAKEOFF_MARGIN, flightStart } from '../js/flight-state.js';
import {
    START_REACH, START_HEIGHT_FEET, START_HEIGHT_LOW, START_HEIGHT_HIGH, HELD_START_FIELDS, HELD_START_NOTE,
    cleanStartPoint, placeStartPoint, turnStartPoint, sameStartPoint, startHeightField, startRanges,
    startRowValues, startFromRows, startAtPoint, startKnobPoint, startDiscLoop, START_DISC_RADIUS, START_KNOB_REACH
} from '../js/start-point.js';
import { feetToAltitude, headingToYaw, bearingToDirection, directionToBearing, METERS_PER_FOOT } from '../js/units.js';
import { START_FIELD_IDS } from '../js/config.js';
import {
    createBuildState, openBuildMode, beginCanvas, chooseBuildTool, buildModeTool, requestLeave, answerConfirm,
    requestLoad, loadCanvas, replacesBuild, sessionWorld, CONFIRM_YES, CONFIRM_NO, REPLACE_WORLD,
    buildStartPoint, buildPlane, setBuildStartPoint, turnBuildStartPoint, writeBuildStartPoint,
    clearBuildStartPoint, chooseBuildPlane
} from '../js/build-mode.js';
import {
    dockContent, DOCK_PLANE, DOCK_START, PLANE_SECTION, START_SECTION, DOCK_CLEAR_START, START_HINT
} from '../js/build-panel.js';
import { PLANE_TOOL, placesStartPoint, choosesPlane, isChoosableTool, buildTool } from '../js/build-tools.js';
import { modeType } from '../js/mode-types.js';
import {
    createEditorState, canvasWorld, keepBuiltWorld, builtWorld, setEditorWorld, releaseBuiltWorld,
    keptFlight, flownStartPoint, flownPlane
} from '../js/element-editor.js';
import {
    environmentDocument, environmentText, readEnvironmentDocument, DOCUMENT_FIELDS, START_FIELDS
} from '../js/environment-file.js';
import { loadedWorldFrom } from '../js/loaded-world.js';
import {
    createSettingsState, settingsEntry, adjustSetting, chooseSetting, isTypedSettingRow, beginTypedSetting,
    holdStartFields, startFieldHeld
} from '../js/settings.js';
import { strokeStartPoint, START_COLOUR, START_KNOB_RADIUS, START_KNOB_HIT } from '../js/build-overlay.js';

const source = name => readFileSync(fileURLToPath(new URL(`../js/${name}`, import.meta.url)), 'utf8');
const mainSource = source('main.js');
const aircraftSource = source('aircraft.js');
const cameraSource = source('camera.js');
const schema = JSON.parse(readFileSync(new URL('../schemas/environment.schema.json', import.meta.url), 'utf8'));

/**
 * The body of a method, from the brace that opens it: the one after its
 * parameters, so a default of `{}` among them is not taken for the body.
 */
function methodBody(text, name) {
    const match = new RegExp(`^\\s+(?:async\\s+)?${name}\\((?:[^()]|\\([^()]*\\))*\\)\\s*\\{`, 'm').exec(text);
    if (!match) return null;
    const from = match.index + match[0].length - 1;
    let depth = 0;
    for (let at = from; at < text.length; at += 1) {
        if (text[at] === '{') depth += 1;
        if (text[at] === '}') {
            depth -= 1;
            if (depth === 0) return text.slice(from, at + 1);
        }
    }
    return null;
}

// --- The planes -----------------------------------------------------------------------

test('five planes, the trainer first and the default, each found by its id and nothing else by any', () => {
    assert.deepEqual(planeIds(), ['trainer', 'bush', 'twin', 'jet', 'biplane']);
    assert.deepEqual(PLANES.map(plane => plane.label), ['TRAINER', 'BUSH PLANE', 'TWIN', 'JET', 'BIPLANE']);
    assert.equal(DEFAULT_PLANE_ID, 'trainer');
    for (const plane of PLANES) {
        assert.equal(planeById(plane.id), plane);
        assert.equal(isPlaneId(plane.id), true);
        assert.ok(Object.isFrozen(plane) && Object.isFrozen(plane.parts) && Object.isFrozen(plane.flight), `${plane.id} cannot be rewritten`);
        assert.ok(plane.note.length > 0, `${plane.id} says what it is`);
    }
    assert.equal(planeById('airliner'), planeById('trainer'), 'an id no plane answers to is the trainer');
    assert.equal(planeById(null), planeById('trainer'));
    assert.equal(planeById(), planeById('trainer'));
    assert.equal(isPlaneId('airliner'), false);
    assert.equal(isPlaneId(null), false);
});

test('the trainer is the model the simulator has always flown, part for part', () => {
    const quarter = Math.PI / 2;
    assert.deepEqual(planeById('trainer').parts.map(part => ({ ...part })), [
        { shape: 'cylinder', top: 0.8, bottom: 0.5, length: 8, segments: 8, at: [0, 0, 0], turn: [quarter, 0, 0], color: 0x4477aa },
        { shape: 'box', size: [14, 0.15, 2], at: [0, 0, 0], turn: [0, 0, 0], color: 0x3366aa },
        { shape: 'box', size: [5, 0.1, 1], at: [0, 0, -3.5], turn: [0, 0, 0], color: 0x3366aa },
        { shape: 'box', size: [0.1, 2, 1.5], at: [0, 1, -3.5], turn: [0, 0, 0], color: 0x3366aa },
        { shape: 'cone', radius: 0.5, length: 1.5, segments: 8, at: [0, 0, 4.5], turn: [-quarter, 0, 0], color: 0xdddddd }
    ]);
});

test('every part is a shape the aircraft can build, with a size, a place, a turn and a colour', () => {
    for (const plane of PLANES) {
        for (const [index, part] of plane.parts.entries()) {
            const where = `${plane.id} part ${index}`;
            assert.ok(PART_SHAPES.includes(part.shape), `${where} is a ${part.shape}`);
            assert.equal(part.at.length, 3, `${where} stands somewhere`);
            assert.equal(part.turn.length, 3, `${where} is turned some way`);
            assert.ok([...part.at, ...part.turn].every(Number.isFinite));
            assert.ok(Number.isInteger(part.color) && part.color >= 0 && part.color <= 0xffffff, `${where} has a colour`);
            const sizes = part.shape === 'box' ? part.size
                : part.shape === 'cylinder' ? [part.top, part.bottom, part.length] : [part.radius, part.length];
            assert.ok(sizes.every(size => Number.isFinite(size) && size > 0), `${where} has a size`);
        }
    }
});

/** How far a recipe reaches across and along, read off its parts as they lie before any turn but the ones that lay them along an axis. */
function extent(plane) {
    let left = Infinity, right = -Infinity, back = Infinity, front = -Infinity;
    for (const part of plane.parts) {
        let x, z;
        if (part.shape === 'box') {
            x = part.size[0] / 2;
            z = part.size[2] / 2;
        } else {
            const radius = part.shape === 'cone' ? part.radius : Math.max(part.top, part.bottom);
            const across = part.turn[2] !== 0;
            x = across ? part.length / 2 : radius;
            z = across ? radius : part.length / 2;
        }
        left = Math.min(left, part.at[0] - x);
        right = Math.max(right, part.at[0] + x);
        back = Math.min(back, part.at[2] - z);
        front = Math.max(front, part.at[2] + z);
    }
    return { span: right - left, length: front - back };
}

test('a plane\'s span and length are its recipe\'s own, to a metre', () => {
    for (const plane of PLANES) {
        const reach = extent(plane);
        assert.ok(Math.abs(reach.span - plane.span) <= 1, `${plane.id} spans ${reach.span}, not ${plane.span}`);
        assert.ok(Math.abs(reach.length - plane.length) <= 1, `${plane.id} is ${reach.length} long, not ${plane.length}`);
    }
});

test('the trainer flies on the figures the flight model and the crash rules were tuned at', () => {
    assert.deepEqual({ ...planeById('trainer').flight }, {
        minSpeed: MIN_SPEED, cruiseSpeed: CRUISE_SPEED, maxSpeed: MAX_SPEED,
        impactSpeed: CRASH_IMPACT_SPEED, runwayImpactSpeed: RUNWAY_IMPACT_SPEED, handling: 1
    });
});

test('every plane\'s figures hang together, inside what the flight model allows', () => {
    for (const { id, flight } of PLANES) {
        assert.ok(flight.minSpeed > 0 && flight.minSpeed < flight.cruiseSpeed && flight.cruiseSpeed < flight.maxSpeed,
            `${id} stalls below its cruise, which is below its top speed`);
        assert.ok(flight.impactSpeed > 0 && flight.impactSpeed < flight.runwayImpactSpeed,
            `${id} takes a firmer arrival on a strip than off one`);
        assert.ok(flight.handling >= 0.5 && flight.handling <= 1.5,
            `${id} handles within half again of the trainer, either way`);
    }
});

test('each plane flies the way its card says, measured against the trainer', () => {
    const trainer = planeById('trainer').flight;
    const fly = id => planeById(id).flight;
    assert.ok(fly('bush').minSpeed < trainer.minSpeed && fly('bush').maxSpeed < trainer.maxSpeed, 'the bush plane: a slower stall, a gentle top speed');
    assert.ok(fly('twin').cruiseSpeed > trainer.cruiseSpeed && fly('twin').handling < 1, 'the twin: a faster cruise, heavier on the controls');
    assert.ok(fly('jet').minSpeed > trainer.minSpeed && fly('jet').cruiseSpeed > fly('twin').cruiseSpeed
        && fly('jet').maxSpeed === Math.max(...PLANES.map(plane => plane.flight.maxSpeed)), 'the jet: a high stall, the highest cruise and top speed');
    assert.ok(fly('biplane').minSpeed === Math.min(...PLANES.map(plane => plane.flight.minSpeed))
        && fly('biplane').handling === Math.max(...PLANES.map(plane => plane.flight.handling)), 'the biplane: slow, and the quickest to roll');
});

/**
 * A standing start at full throttle with the nose held ten degrees up, run
 * through the pure flight model a frame at a time until the wing climbs: how
 * far down the strip that is, and how fast.
 */
function takeoffRoll(plane, dt = 1 / 60) {
    const air = { minSpeed: plane.flight.minSpeed, cruiseSpeed: plane.flight.cruiseSpeed, maxSpeed: plane.flight.maxSpeed };
    const pitch = -10 * Math.PI / 180;
    let speed = 0, distance = 0;
    for (let frame = 0; frame < 120 / dt; frame += 1) {
        speed = convergeSpeed(speed, targetSpeed(1, plane.flight.maxSpeed), dt);
        distance += speed * dt;
        if (descentRate(pitch, speed, air) < 0) return { distance, speed };
    }
    return null;
}

test('every plane leaves the ground inside BASIC RUNWAY from a standing start at full throttle, and none of them stalled', () => {
    const strip = runwayTemplate('basic-runway').length;
    const room = strip - 2 * TAKEOFF_MARGIN;
    for (const plane of PLANES) {
        const roll = takeoffRoll(plane);
        assert.ok(roll, `${plane.id} leaves the ground at all`);
        assert.ok(roll.distance < room, `${plane.id} needs ${roll.distance.toFixed(0)} of the ${room} a takeoff has`);
        assert.ok(roll.speed >= plane.flight.minSpeed, `${plane.id} climbs away above its stall, at ${roll.speed.toFixed(1)}`);
    }
});

test('the throttle a flight opens at asks no plane for less than its stall', () => {
    const opening = flightStart().throttle;
    for (const { id, flight } of PLANES) {
        assert.ok(targetSpeed(opening, flight.maxSpeed) >= flight.minSpeed,
            `${id} settles at ${targetSpeed(opening, flight.maxSpeed)} on the opening throttle, its stall is ${flight.minSpeed}`);
    }
});

test('the chase camera stands as far back for a plane\'s size as it does behind the trainer', () => {
    assert.deepEqual(chaseFor(planeById('trainer')), { distance: CHASE_DISTANCE, height: CHASE_HEIGHT });
    assert.deepEqual(chaseFor(), { distance: 30, height: 10 }, 'and the trainer is the one asked of with none named');
    for (const plane of PLANES) {
        const { distance, height } = chaseFor(plane);
        const size = Math.max(plane.span, plane.length);
        assert.ok(Math.abs(distance / size - 30 / 14) < 1e-9, `${plane.id} is filmed in proportion`);
        assert.ok(Math.abs(height * 3 - distance) < 1e-9);
    }
    assert.ok(chaseFor(planeById('twin')).distance > CHASE_DISTANCE, 'the twin, the widest, from further back');
    assert.ok(chaseFor(planeById('biplane')).distance < CHASE_DISTANCE, 'and the biplane, the smallest, from nearer');
});

test('a plane\'s handling is a share of the pilot\'s own sensitivity, held inside its bounds', () => {
    assert.equal(planeSensitivity(1, planeById('trainer')), 1);
    assert.equal(planeSensitivity(2, planeById('biplane')), 2.6);
    assert.equal(planeSensitivity(1, planeById('twin')), 0.85);
    assert.equal(planeSensitivity(4, planeById('biplane')), MAX_SENSITIVITY, 'never past the top');
    assert.equal(planeSensitivity(0.1, planeById('twin')), MIN_SENSITIVITY, 'nor under the bottom');
    assert.equal(planeSensitivity(Number.NaN, planeById('trainer')), 1, 'and a setting that is not one is the tuned one');
});

test('the aircraft builds a plane from its recipe, flies its figures, and keeps a host\'s own model', () => {
    const bundled = methodBody(aircraftSource, 'export function bundledModel') ?? aircraftSource.slice(aircraftSource.indexOf('export function bundledModel'));
    assert.match(bundled, /return planeModel\(planeById\(DEFAULT_PLANE_ID\)\);/, 'the bundled model is the trainer\'s recipe');
    assert.match(aircraftSource, /function partGeometry\(part\) \{\s*if \(part\.shape === 'cylinder'\) return new THREE\.CylinderGeometry\(part\.top, part\.bottom, part\.length, part\.segments\);\s*if \(part\.shape === 'cone'\) return new THREE\.ConeGeometry\(part\.radius, part\.length, part\.segments\);\s*return new THREE\.BoxGeometry\(\.\.\.part\.size\);/);
    assert.match(aircraftSource, /mesh\.position\.set\(\.\.\.part\.at\);\s*mesh\.rotation\.set\(\.\.\.part\.turn\);/);

    const setPlane = methodBody(aircraftSource, 'setPlane');
    for (const figure of ['minSpeed', 'cruiseSpeed', 'maxSpeed', 'impactSpeed', 'runwayImpactSpeed']) {
        assert.match(setPlane, new RegExp(`this\\.${figure}\\s*= figures\\.${figure}\\s*\\?\\?`), `setPlane flies the plane's ${figure}`);
    }
    assert.match(setPlane, /this\.setSensitivity\(this\.sensitivity\);/, 'and its handling, over the pilot\'s own sensitivity');
    assert.match(setPlane, /if \(this\.group && !this\.external\) \{/, 'its model only where the host flies none of its own');
    assert.match(setPlane, /this\.group\.add\(\.\.\.planeModel\(chosen\)\);/);
    assert.match(methodBody(aircraftSource, 'setSensitivity'), /this\.rates = controlRates\(planeSensitivity\(sensitivity, this\.plane\)\);/);
    assert.match(methodBody(aircraftSource, 'createModel'), /this\.external = external != null;/);
    assert.ok(aircraftSource.indexOf('this.plane = planeById(DEFAULT_PLANE_ID);') < aircraftSource.indexOf('this.setSensitivity(flight.sensitivity'),
        'the trainer is in hand before the first sensitivity is worked out from it');

    const chase = methodBody(cameraSource, 'setChase');
    assert.match(chase, /if \(Number\.isFinite\(distance\) && distance > 0\) this\.distance = distance;/);
    assert.match(chase, /if \(Number\.isFinite\(height\) && height >= 0\) this\.height = height;/);
});

// --- The start point --------------------------------------------------------------------

test('a start point is a point, a heading and a height, each held to what it may be', () => {
    assert.equal(cleanStartPoint(null), null);
    assert.equal(cleanStartPoint('here'), null);
    assert.equal(cleanStartPoint({}), null, 'a start nobody said where is no start');
    assert.equal(cleanStartPoint({ at: [1, Number.NaN] }), null);
    assert.equal(cleanStartPoint({ at: [1, 2, 3] }), null);

    assert.deepEqual(cleanStartPoint({ at: [100, -200] }), { at: [100, -200], heading: 0, heightFeet: START_HEIGHT_FEET });
    assert.deepEqual(cleanStartPoint({ at: [99999, -99999], heading: 370.4, heightFeet: 50 }),
        { at: [START_REACH, -START_REACH], heading: 10, heightFeet: START_HEIGHT_LOW });
    assert.equal(cleanStartPoint({ at: [0, 0], heading: -5 }).heading, 355, 'a heading is read round the compass');
    assert.equal(cleanStartPoint({ at: [0, 0], heading: 359.6 }).heading, 0, 'in whole degrees');
    assert.equal(cleanStartPoint({ at: [0, 0], heightFeet: 1e9 }).heightFeet, START_HEIGHT_HIGH);
    assert.equal(START_REACH, 8000, 'anywhere on the world');
});

test('a start point placed again keeps the heading and height of the one it moves', () => {
    const first = placeStartPoint([10, 20]);
    assert.deepEqual(first, { at: [10, 20], heading: 0, heightFeet: START_HEIGHT_FEET });
    const turned = turnStartPoint(first, 90);
    assert.deepEqual(turned, { at: [10, 20], heading: 90, heightFeet: START_HEIGHT_FEET });
    const moved = placeStartPoint([300, 400], { ...turned, heightFeet: 2500 });
    assert.deepEqual(moved, { at: [300, 400], heading: 90, heightFeet: 2500 });
    assert.equal(turnStartPoint(null, 90), null);
    assert.equal(turnStartPoint(first, Number.NaN), first);
    assert.equal(sameStartPoint(moved, { at: [300, 400], heading: 90, heightFeet: 2500 }), true);
    assert.equal(sameStartPoint(moved, turned), false);
    assert.equal(sameStartPoint(null, null), true);
    assert.equal(sameStartPoint(moved, null), false);
});

test('SELECT STARTING POINT writes it out as AT X, AT Z, HEADING and HEIGHT in the settings\' altitude unit', () => {
    assert.deepEqual(Object.keys(startRanges('feet')), ['atX', 'atZ', 'heading', 'heightFeet']);
    assert.deepEqual(Object.keys(startRanges('meters')), ['atX', 'atZ', 'heading', 'heightMeters']);
    assert.equal(startHeightField('nonsense'), 'heightFeet', 'a unit nothing answers to reads as feet');
    const feet = startRanges('feet');
    assert.deepEqual([feet.atX.low, feet.atX.high, feet.heading.low, feet.heading.high], [-START_REACH, START_REACH, 0, 359]);
    assert.deepEqual([feet.heightFeet.low, feet.heightFeet.high, feet.heightFeet.default], [START_HEIGHT_LOW, START_HEIGHT_HIGH, START_HEIGHT_FEET]);
    const meters = startRanges('meters');
    assert.deepEqual([meters.heightMeters.low, meters.heightMeters.high, meters.heightMeters.default], [30, 3048, 305]);

    const point = { at: [1200.4, -800.6], heading: 45, heightFeet: 1000 };
    assert.deepEqual(startRowValues(point, 'feet'), { atX: 1200, atZ: -801, heading: 45, heightFeet: 1000 });
    assert.deepEqual(startRowValues(point, 'meters'), { atX: 1200, atZ: -801, heading: 45, heightMeters: 305 });
    assert.equal(startRowValues(null), null);
});

test('rows read back move only what was changed, so a height in metres does not drift a rounding at a time', () => {
    const point = { at: [1200, -800], heading: 45, heightFeet: 1000 };
    assert.deepEqual(startFromRows(point, { atX: 1200, atZ: -800, heading: 45, heightMeters: 305 }, 'meters'), point,
        'the rows as they were drawn are the point as it was');
    assert.equal(startFromRows(point, { heightMeters: 610 }, 'meters').heightFeet, 610 / METERS_PER_FOOT);
    assert.equal(startFromRows(point, { heightFeet: 2000 }, 'feet').heightFeet, 2000);
    assert.deepEqual(startFromRows(point, { heading: 400, atX: 50000 }, 'feet'), { at: [START_REACH, -800], heading: 40, heightFeet: 1000 });
    assert.equal(startFromRows(null, {}), null);
});

test('a flying start opens over the point, on its heading, at its height above the ground there - the rest is the settings\'', () => {
    const start = flightStart();
    const point = { at: [1500, -2500], heading: 270, heightFeet: 1000 };
    const opened = startAtPoint(start, point, (x, z) => (x === 1500 && z === -2500 ? 120 : 0));
    assert.equal(opened.x, 1500);
    assert.equal(opened.z, -2500);
    assert.equal(opened.yaw, headingToYaw(270));
    assert.equal(opened.altitude, 120 + feetToAltitude(1000), 'measured from the ground, not from the sea');
    for (const kept of ['speed', 'verticalSpeed', 'throttle', 'pitch', 'cameraMode', 'grounded']) {
        assert.equal(opened[kept], start[kept], `${kept} is the settings'`);
    }
    assert.equal(startAtPoint(start, null), start, 'with no point, the start is the settings\' own');
    const takeoff = { ...start, grounded: true };
    assert.equal(startAtPoint(takeoff, point), takeoff, 'and a takeoff is the strip\'s');
    assert.equal(startAtPoint(start, point, () => Number.NaN).altitude, feetToAltitude(1000), 'ground nobody can read is the sea');
});

test('the knob stands out along the heading, the way a bearing points over the ground', () => {
    for (const heading of [0, 45, 90, 180, 270, 315]) {
        const knob = startKnobPoint({ at: [100, 200], heading, heightFeet: 1000 }, 50);
        const way = bearingToDirection(heading);
        assert.ok(Math.abs(knob.x - (100 + way.x * 50)) < 1e-9 && Math.abs(knob.z - (200 + way.z * 50)) < 1e-9, `at ${heading}`);
        assert.ok(Math.abs(directionToBearing(knob.x - 100, knob.z - 200) - heading) < 1e-9, 'and the bearing back to it is the heading');
    }
    const far = startKnobPoint({ at: [0, 0], heading: 0, heightFeet: 1000 });
    assert.equal(far.z, START_KNOB_REACH);
    assert.equal(startKnobPoint(null), null);

    const disc = startDiscLoop({ at: [10, 20], heading: 0, heightFeet: 1000 }, 30, 16);
    assert.equal(disc.length, 16);
    assert.ok(disc.every(([x, z]) => Math.abs(Math.hypot(x - 10, z - 20) - 30) < 1e-9), 'a ring round the point');
    assert.equal(startDiscLoop({ at: [0, 0], heading: 0, heightFeet: 1000 }).every(([x, z]) => Math.abs(Math.hypot(x, z) - START_DISC_RADIUS) < 1e-9), true);
    assert.deepEqual(startDiscLoop(null), []);
});

test('the rows a start point holds are the settings\' own start rows', () => {
    assert.deepEqual(HELD_START_FIELDS, ['headingDegrees', 'altitudeFeet']);
    for (const id of HELD_START_FIELDS) assert.ok(START_FIELD_IDS.includes(id), `${id} is a start row`);
    assert.equal(HELD_START_NOTE, 'set by this environment');
});

// --- Insert Plane in the builder -----------------------------------------------------------

/** A builder open on a canvas, with Insert Plane live. */
function planeCanvas(base = 'highlands') {
    const state = createBuildState();
    openBuildMode(state);
    beginCanvas(state, base, [], canvasWorld(createEditorState(base), base));
    assert.equal(chooseBuildTool(state, PLANE_TOOL), true, 'Insert Plane can be chosen');
    return state;
}

test('Insert Plane does both of its mode types, and is a tool a canvas is worked with', () => {
    assert.equal(PLANE_TOOL, 'plane');
    assert.equal(isChoosableTool(PLANE_TOOL), true);
    assert.equal(placesStartPoint(PLANE_TOOL), true);
    assert.equal(choosesPlane(PLANE_TOOL), true);
    assert.equal(placesStartPoint('runway'), false);
    assert.equal(choosesPlane('runway'), false);
    assert.deepEqual(buildTool(PLANE_TOOL).modes.map(modeType), ['Insert asset<flight:plane>', 'Insert config<flight:start-point>']);
});

test('a click puts the one start point down, a second moves it, and its knob and rows turn and write it', () => {
    const state = planeCanvas();
    assert.equal(buildStartPoint(state), null);
    assert.equal(setBuildStartPoint(state, [100, 200]), true);
    assert.deepEqual(buildStartPoint(state), { at: [100, 200], heading: 0, heightFeet: START_HEIGHT_FEET });

    assert.equal(turnBuildStartPoint(state, 135), true);
    assert.equal(turnBuildStartPoint(state, 135), false, 'a turn to where it already points is no turn');
    assert.equal(setBuildStartPoint(state, [500, 600]), true);
    assert.deepEqual(buildStartPoint(state), { at: [500, 600], heading: 135, heightFeet: START_HEIGHT_FEET }, 'moved, still pointing the same way');

    assert.equal(writeBuildStartPoint(state, { at: [1, 2], heading: 10, heightFeet: 3000 }), true);
    assert.deepEqual(buildStartPoint(state), { at: [1, 2], heading: 10, heightFeet: 3000 });
    assert.equal(writeBuildStartPoint(state, { at: 'nowhere' }), false);
    assert.equal(setBuildStartPoint(state, null), false);

    assert.equal(clearBuildStartPoint(state), true);
    assert.equal(buildStartPoint(state), null, 'CLEAR takes it away');
    assert.equal(clearBuildStartPoint(state), false, 'and there is then nothing to take');
    assert.equal(turnBuildStartPoint(state, 90), false, 'nor anything to turn');
    assert.equal(writeBuildStartPoint(state, { at: [1, 2] }), false, 'nor to write');
});

test('a plane is chosen from the five, the trainer until one is', () => {
    const state = planeCanvas();
    assert.equal(buildPlane(state), null);
    assert.equal(chooseBuildPlane(state, 'airliner'), false);
    assert.equal(chooseBuildPlane(state, 'jet'), true);
    assert.equal(chooseBuildPlane(state, 'jet'), false, 'the plane already chosen is no change');
    assert.equal(buildPlane(state), 'jet');
});

test('the world\'s flight is not changed off a canvas, or under a question', () => {
    const off = createBuildState();
    assert.equal(setBuildStartPoint(off, [0, 0]), false);
    assert.equal(chooseBuildPlane(off, 'jet'), false);
    assert.equal(buildStartPoint(off), null);
    assert.equal(buildPlane(off), null);

    const asking = planeCanvas();
    setBuildStartPoint(asking, [0, 0]);
    requestLeave(asking);
    assert.equal(setBuildStartPoint(asking, [9, 9]), false);
    assert.equal(turnBuildStartPoint(asking, 90), false);
    assert.equal(clearBuildStartPoint(asking), false);
    assert.equal(chooseBuildPlane(asking, 'jet'), false);
    assert.deepEqual(buildStartPoint(asking).at, [0, 0]);
});

test('the start point and the plane go with the world: saved, kept on the way out, and a load asks before taking them', () => {
    const state = planeCanvas();
    assert.equal('start' in sessionWorld(state) || 'plane' in sessionWorld(state), false, 'a world with neither carries neither');
    assert.equal(replacesBuild(state), false);

    setBuildStartPoint(state, [100, 200]);
    assert.equal(replacesBuild(state), true, 'a start point placed is something a load would take away');
    assert.deepEqual(requestLoad(state), { confirm: REPLACE_WORLD });
    answerConfirm(state, CONFIRM_NO);

    chooseBuildPlane(state, 'bush');
    const world = sessionWorld(state);
    assert.deepEqual(world.start, { at: [100, 200], heading: 0, heightFeet: START_HEIGHT_FEET });
    assert.equal(world.plane, 'bush');
    world.start.at[0] = 9;
    assert.equal(buildStartPoint(state).at[0], 100, 'a copy, sharing nothing with the canvas');

    requestLeave(state);
    const answered = answerConfirm(state, CONFIRM_YES);
    assert.equal(answered.keep, true);
    assert.deepEqual(answered.start, { at: [100, 200], heading: 0, heightFeet: START_HEIGHT_FEET });
    assert.equal(answered.plane, 'bush');

    const chosen = planeCanvas();
    chooseBuildPlane(chosen, 'twin');
    assert.equal(replacesBuild(chosen), true, 'and so is a plane chosen');
});

test('a canvas opens with the flight it was kept or saved with, and only one that is a flight', () => {
    const state = createBuildState();
    openBuildMode(state, undefined, {
        environment: 'lakeside', placements: [], world: [],
        start: { at: [10, 20], heading: 90, heightFeet: 800 }, plane: 'biplane'
    });
    assert.deepEqual(buildStartPoint(state), { at: [10, 20], heading: 90, heightFeet: 800 });
    assert.equal(buildPlane(state), 'biplane');
    assert.equal(replacesBuild(state), false, 'what it opened with is not a change');

    const loading = planeCanvas();
    assert.equal(loadCanvas(loading, { environment: 'dune-sea', placements: [], world: [], start: { at: [5, 6] }, plane: 'jet' }), true);
    assert.deepEqual(buildStartPoint(loading).at, [5, 6]);
    assert.equal(buildPlane(loading), 'jet');
    assert.equal(loadCanvas(loading, { environment: 'dune-sea', placements: [], world: [] }), true);
    assert.equal(buildStartPoint(loading), null, 'a world loaded without one has none');
    assert.equal(buildPlane(loading), null);

    const odd = createBuildState();
    openBuildMode(odd);
    beginCanvas(odd, 'highlands', [], [], { start: { at: 'there' }, plane: 'airliner' });
    assert.equal(buildStartPoint(odd), null);
    assert.equal(buildPlane(odd), null);
});

test('INSERT PLANE\'s panel is SELECT PLANE\'s cards and SELECT STARTING POINT\'s rows, each its own mode type', () => {
    const state = planeCanvas();
    const shown = dockContent(state, {});
    assert.equal(shown.kind, DOCK_PLANE);
    assert.equal(shown.heading, 'INSERT PLANE');
    assert.deepEqual(shown.sections.map(section => [section.id, section.heading]),
        [[PLANE_SECTION, 'SELECT PLANE'], [START_SECTION, 'SELECT STARTING POINT']]);
    assert.deepEqual(shown.sections.map(section => modeType(section.mode)), ['Insert asset<flight:plane>', 'Insert config<flight:start-point>']);

    const cards = shown.sections[0].shapes[0].tools;
    assert.deepEqual(cards.map(card => card.id), planeIds());
    assert.deepEqual(cards.map(card => card.label), PLANES.map(plane => plane.label));
    assert.ok(cards.every(card => card.art === null), 'named tiles, as Insert Runway\'s were');
    assert.deepEqual(cards.filter(card => card.live).map(card => card.id), ['trainer'], 'the trainer pressed until another is chosen');

    const start = shown.sections[1];
    assert.equal(start.kind, DOCK_START);
    assert.deepEqual(start.rows, [], 'nothing to write out before a click');
    assert.deepEqual(start.status, { text: START_HINT });
    assert.deepEqual(shown.actions, [{ ...DOCK_CLEAR_START, disabled: true }], 'CLEAR there to see, with nothing to take');
});

test('with a start point, its rows are written out in the unit asked for, and CLEAR can be pressed', () => {
    const state = planeCanvas();
    setBuildStartPoint(state, [1200, -800]);
    turnBuildStartPoint(state, 90);
    chooseBuildPlane(state, 'jet');

    const feet = dockContent(state, { altitude: 'feet' });
    const start = feet.sections[1];
    assert.deepEqual(start.rows.map(row => [row.row.label, row.value]),
        [['AT X', 1200], ['AT Z', -800], ['HEADING', 90], ['HEIGHT FEET', START_HEIGHT_FEET]]);
    assert.ok(start.rows.every(row => row.section === START_SECTION), 'each row says which section it writes');
    assert.equal(start.status.text, '', 'no hint once there is a point');
    assert.deepEqual(feet.actions, [{ ...DOCK_CLEAR_START, disabled: false }]);
    assert.deepEqual(feet.sections[0].shapes[0].tools.filter(card => card.live).map(card => card.id), ['jet']);

    const meters = dockContent(state, { altitude: 'meters' }).sections[1];
    assert.deepEqual(meters.rows.map(row => [row.row.label, row.value]).at(-1), ['HEIGHT METERS', 305]);
    assert.equal(dockContent(state).sections[1].rows.at(-1).row.label, 'HEIGHT FEET', 'feet when nothing is asked');
});

// --- Kept with a build ----------------------------------------------------------------------

test('the editor keeps the world\'s flight with its build, and a start point alone is a build', () => {
    const editor = createEditorState('highlands');
    assert.equal(builtWorld(editor), null);
    keepBuiltWorld(editor, 'highlands', false, [], 'highlands', null, { start: { at: [10, 20], heading: 30, heightFeet: 900 } });
    assert.deepEqual(builtWorld(editor), {
        environment: 'highlands', placements: [], world: canvasWorld(editor, 'highlands'),
        start: { at: [10, 20], heading: 30, heightFeet: 900 }
    }, 'the builder goes back to a world with a start point on it');
    assert.deepEqual(flownStartPoint(editor, 'highlands'), { at: [10, 20], heading: 30, heightFeet: 900 });
    assert.equal(flownPlane(editor, 'highlands'), null);
    assert.deepEqual(keptFlight(editor, 'highlands'), { start: { at: [10, 20], heading: 30, heightFeet: 900 } });
    assert.deepEqual(keptFlight(editor, 'lakeside'), {}, 'and nothing on another world');

    keepBuiltWorld(editor, 'highlands', false, [], 'highlands', null, { plane: 'twin' });
    assert.equal(flownStartPoint(editor, 'highlands'), null, 'what is kept replaces what was');
    assert.equal(flownPlane(editor, 'highlands'), 'twin');
    assert.equal(builtWorld(editor).plane, 'twin');
    assert.equal(flownPlane(editor, 'lakeside'), null, 'a world the editor is not on flies the trainer');

    keepBuiltWorld(editor, 'highlands', false, [], 'highlands', null, { start: { at: 'nowhere' }, plane: 'airliner' });
    assert.equal(builtWorld(editor), null, 'and a flight that is not one is nothing kept');
});

test('another world, or the build let go of, takes the flight with it', () => {
    const editor = createEditorState('highlands');
    keepBuiltWorld(editor, 'highlands', false, [], 'highlands', null, { start: { at: [1, 2] }, plane: 'bush' });
    setEditorWorld(editor, 'highlands', true);
    assert.equal(flownPlane(editor, 'highlands'), 'bush', 'the strip turned on is the same world');
    setEditorWorld(editor, 'lakeside');
    assert.equal(flownStartPoint(editor, 'lakeside'), null);
    assert.equal(flownPlane(editor, 'lakeside'), null);

    keepBuiltWorld(editor, 'lakeside', false, [], 'lakeside', null, { start: { at: [1, 2] }, plane: 'bush' });
    releaseBuiltWorld(editor);
    assert.equal(editor.start, null);
    assert.equal(editor.plane, null);
});

// --- The environment file -------------------------------------------------------------------

test('a world saves its start point and plane, and reads them back', () => {
    const editor = createEditorState('highlands');
    const world = {
        environment: 'highlands', placements: [], world: canvasWorld(editor, 'highlands'),
        start: { at: [1200, -800], heading: 90, heightFeet: 1000 }, plane: 'bush'
    };
    const document = environmentDocument(world, { name: 'Sample Valley', savedAt: '2026-11-05T12:00:00.000Z' });
    assert.deepEqual(document.start, { at: [1200, -800], heading: 90, heightFeet: 1000 });
    assert.equal(document.plane, 'bush');
    world.start.at[0] = 0;
    assert.equal(document.start.at[0], 1200, 'a copy');

    const read = readEnvironmentDocument(environmentText(document));
    assert.equal(read.ok, true);
    assert.deepEqual(read.world.start, { at: [1200, -800], heading: 90, heightFeet: 1000 });
    assert.equal(read.world.plane, 'bush');
    assert.deepEqual(loadedWorldFrom(environmentText(document)).world.start, read.world.start, 'and the world the browser keeps has them');

    const plain = environmentDocument({ environment: 'highlands', placements: [], world: [] });
    assert.equal('start' in plain || 'plane' in plain, false, 'a world with neither writes neither');
    const plainRead = readEnvironmentDocument(environmentText(plain));
    assert.equal('start' in plainRead.world || 'plane' in plainRead.world, false, 'nor reads them back');
});

test('a file\'s start point is held to the world, and one that is not a start point is refused with why', () => {
    const file = extra => JSON.stringify({ format: 'pilot-matter.environment', version: 1, base: 'highlands', ...extra });
    assert.deepEqual(readEnvironmentDocument(file({ start: { at: [99999, 0], heading: 725, heightFeet: 5 } })).world.start,
        { at: [START_REACH, 0], heading: 5, heightFeet: START_HEIGHT_LOW });
    const problems = extra => readEnvironmentDocument(file(extra)).problems;
    assert.deepEqual(problems({ start: 'here' }), ['start: not a start point']);
    assert.deepEqual(problems({ start: { heading: 0 } }), ['start: at is not a point']);
    assert.deepEqual(problems({ start: { at: [0, 0], heading: 'north' } }), ['start: heading is not a number']);
    assert.deepEqual(problems({ start: { at: [0, 0], altitude: 3 } }), ['start: altitude is not a field a start point has']);
    assert.deepEqual(problems({ plane: 'airliner' }), ['plane: no plane is called "airliner"']);
    assert.equal(readEnvironmentDocument(file({ plane: 'airliner' })).ok, false);
});

test('the schema names the start point and the planes the module reads', () => {
    assert.ok(DOCUMENT_FIELDS.includes('start') && DOCUMENT_FIELDS.includes('plane'));
    assert.deepEqual(Object.keys(schema.properties.start.properties), START_FIELDS);
    assert.deepEqual(schema.properties.start.required, ['at']);
    assert.equal(schema.properties.start.additionalProperties, false);
    assert.deepEqual(schema.properties.plane.enum, planeIds());
    assert.equal(schema.required.includes('start') || schema.required.includes('plane'), false, 'and neither is required');
});

// --- The settings rows it sets ---------------------------------------------------------------

test('while a world with a start point is flown, START HEADING and START ALTITUDE are held, and say why', () => {
    const settings = createSettingsState(null);
    const note = settingsEntry(settings, 'headingDegrees').note;
    assert.equal(startFieldHeld(settings, 'headingDegrees'), false);
    assert.equal(holdStartFields(settings, false), false, 'nothing held, nothing let go');

    assert.equal(holdStartFields(settings, true), true);
    assert.equal(holdStartFields(settings, true), false, 'held already');
    for (const id of HELD_START_FIELDS) {
        const entry = settingsEntry(settings, id);
        assert.equal(entry.locked, true, `${id} is drawn locked`);
        assert.equal(entry.note, HELD_START_NOTE);
        assert.equal(adjustSetting(settings, id, 1), null, `${id} is not stepped`);
        assert.equal(chooseSetting(settings, id, 1), null, 'nor chosen on');
        assert.equal(isTypedSettingRow(settings, id), false, 'nor typed into');
        assert.equal(beginTypedSetting(settings, id, 'Digit5'), null);
    }
    assert.equal(settingsEntry(settings, 'airspeedKnots').locked, false, 'the rest of the start is the settings\'');
    assert.notEqual(adjustSetting(settings, 'airspeedKnots', 1), null);

    assert.equal(holdStartFields(settings, false), true);
    assert.equal(settingsEntry(settings, 'headingDegrees').locked, false);
    assert.equal(settingsEntry(settings, 'headingDegrees').note, note, 'and its own note back');
    assert.notEqual(adjustSetting(settings, 'headingDegrees', 1), null);
});

test('a figure being typed into a row that is then held is dropped', () => {
    const settings = createSettingsState(null);
    assert.equal(beginTypedSetting(settings, 'altitudeFeet', 'Digit2'), 'altitudeFeet');
    holdStartFields(settings, true);
    assert.equal(settings.typing, null);
});

// --- On the overlay ---------------------------------------------------------------------------

/** A canvas context that writes down what was drawn. */
function recordingContext() {
    const calls = [];
    const record = name => (...args) => calls.push([name, ...args]);
    const ctx = { calls };
    for (const name of ['setLineDash', 'beginPath', 'moveTo', 'lineTo', 'closePath', 'fill', 'stroke', 'arc']) ctx[name] = record(name);
    return new Proxy(ctx, {
        set(target, key, value) {
            calls.push([`=${String(key)}`, value]);
            target[key] = value;
            return true;
        }
    });
}

test('the start point is a green disc with an arrow, and its knob only when asked for', () => {
    const layout = {
        centre: { x: 100, y: 100 },
        disc: [{ x: 90, y: 100 }, { x: 100, y: 90 }, { x: 110, y: 100 }, { x: 100, y: 110 }],
        knob: { x: 100, y: 40 }
    };
    /** The fill the knob was drawn in: the last one set before the fill after its arc. */
    const knobFill = calls => {
        const arc = calls.findIndex(call => call[0] === 'arc');
        const fill = calls.findIndex((call, at) => at > arc && call[0] === 'fill');
        return calls.slice(0, fill).filter(call => call[0] === '=fillStyle').at(-1)?.[1];
    };

    const drawn = recordingContext();
    strokeStartPoint(drawn, layout, { knob: true });
    const arcs = drawn.calls.filter(call => call[0] === 'arc');
    assert.equal(arcs.length, 1, 'the knob');
    assert.deepEqual(arcs[0].slice(1, 4), [100, 40, START_KNOB_RADIUS]);
    assert.ok(drawn.calls.some(call => call[0] === '=strokeStyle' && call[1] === START_COLOUR), 'in the start point\'s green');
    assert.equal(knobFill(drawn.calls), '#ffffff', 'a white knob');
    assert.equal(START_COLOUR, '#00db95');
    assert.ok(START_KNOB_HIT > START_KNOB_RADIUS, 'pressed a little wide of itself');

    const held = recordingContext();
    strokeStartPoint(held, layout, { knob: true, lit: true });
    assert.equal(knobFill(held.calls), START_COLOUR, 'green while it is held');

    const bare = recordingContext();
    strokeStartPoint(bare, layout, { knob: false });
    assert.equal(bare.calls.filter(call => call[0] === 'arc').length, 0, 'no knob while Insert Plane is not live');
    assert.ok(bare.calls.some(call => call[0] === 'fill'), 'the disc and the arrow still drawn');

    const none = recordingContext();
    strokeStartPoint(none, null);
    assert.deepEqual(none.calls, []);
});

// --- The page ---------------------------------------------------------------------------------

test('a free flight opens at the world\'s start point, on the strip nearest it for a takeoff, and a mode at its own', () => {
    const start = methodBody(mainSource, 'buildStart');
    assert.match(start, /const point = this\.worldStartPoint\(\);\s*if \(point == null\) return flightStart\(startSettings\(this\.settings\), \{ runway \}\);/);
    assert.match(start, /const strip = nearestRunway\(this\.terrain\.getRunways\(\), point\.at\[0\], point\.at\[1\]\) \?\? runway;/);
    assert.match(start, /return startAtPoint\(\s*flightStart\(startSettings\(this\.settings\), \{ runway: strip \}\), point,\s*\(x, z\) => this\.terrain\.getTerrainHeightAt\(x, z\)\s*\);/);
    assert.ok(start.indexOf('if (isRunning(this.run))') < start.indexOf('this.worldStartPoint()'), 'a run opens where its stage says first');

    assert.match(methodBody(mainSource, 'worldStartPoint'), /if \(isRunning\(this\.run\)\) return null;\s*return flownStartPoint\(this\.editor, currentEnvironment\(this\.settings\)\);/);
    assert.match(methodBody(mainSource, 'worldPlane'), /if \(isRunning\(this\.run\)\) return null;\s*return flownPlane\(this\.editor, currentEnvironment\(this\.settings\)\);/);
});

test('the world put in force puts the pilot in its plane and holds the start rows its start point sets', () => {
    const refresh = methodBody(mainSource, 'refreshWorld');
    assert.match(refresh, /const rebuilt = this\.buildWorld\(\);\s*this\.flyPlane\(\);/);
    assert.match(refresh, /holdStartFields\(this\.settings, this\.worldStartPoint\(\) != null\);\s*const flight\s*= this\.buildStart\(\);/,
        'held before the start is read from them');

    const fly = methodBody(mainSource, 'flyPlane');
    assert.match(fly, /const plane = planeById\(this\.worldPlane\(\)\);\s*if \(this\.aircraft\.plane\?\.id === plane\.id\) return false;/,
        'a setting applied for another reason swaps no model');
    assert.match(fly, /this\.aircraft\.setPlane\(plane\);\s*this\.camera2\.setChase\(chaseFor\(plane\)\);/);

    const key = methodBody(mainSource, 'flightWorldKey');
    assert.match(key, /start: flownStartPoint\(this\.editor, currentEnvironment\(this\.settings\)\),\s*plane: flownPlane\(this\.editor, currentEnvironment\(this\.settings\)\)/,
        'so a build kept with only its flight changed is a new world to fly');
});

test('the canvas places the start point at a click with Insert Plane, and turns it by its knob before anything else', () => {
    const press = methodBody(mainSource, 'onCanvasPress');
    assert.match(press, /if \(!buildModeDrawing\(this\.builder\) \|\| this\.canvasDrag \|\| this\.gumballDrag \|\| this\.startTurning\) return;/);
    assert.match(press, /if \(e\.button === 0 && this\.startKnobHit\(e\.clientX, e\.clientY\)\) \{\s*e\.preventDefault\(\);\s*this\.renderer\.domElement\.setPointerCapture\(e\.pointerId\);\s*this\.startTurning = \{ pointer: e\.pointerId \};/);
    assert.ok(press.indexOf('this.startKnobHit(') < press.indexOf('cameraGesture(e, tool)'), 'the knob before an orbit, a pick or a drop');
    assert.match(press, /else if \(e\.button === 0 && placesStartPoint\(tool\)\) this\.startPointAt\(e\);/);

    assert.match(methodBody(mainSource, 'startPointAt'),
        /const point = this\.pickCanvasPoint\(e\.clientX, e\.clientY\);\s*if \(!point \|\| !setBuildStartPoint\(this\.builder, \[point\.x, point\.z\]\)\) return;/);
    assert.match(methodBody(mainSource, 'startKnobHit'), /Math\.hypot\(clientX - knob\.x, clientY - knob\.y\) <= START_KNOB_HIT/);
    const turn = methodBody(mainSource, 'turnStartAt');
    assert.match(turn, /turnBuildStartPoint\(this\.builder, directionToBearing\(dx, dz\)\)/, 'the heading the bearing from the point to the pointer');

    assert.match(methodBody(mainSource, 'onCanvasDrag'), /if \(this\.startTurning && e\.pointerId === this\.startTurning\.pointer\) \{\s*this\.turnStartAt\(e\.clientX, e\.clientY\);\s*return;/);
    assert.match(methodBody(mainSource, 'onCanvasRelease'), /if \(this\.startTurning && e\.pointerId === this\.startTurning\.pointer\) \{\s*this\.startTurning = null;/);
    assert.match(methodBody(mainSource, 'canvasCursor'), /insertsTemplate\(tool\) \|\| placesStartPoint\(tool\) \|\| insertsCity\(tool\) \|\|/);
});

test('the overlay draws the start point whatever tool is live, and its knob only with Insert Plane', () => {
    const overlay = methodBody(mainSource, 'drawBuildOverlay');
    assert.match(overlay, /this\.startKnob = null;\s*const start = buildStartPoint\(this\.builder\);\s*const layout = start \? this\.startLayout\(start, width, height\) : null;/);
    assert.match(overlay, /const knob = placesStartPoint\(live\) && !confirmOpen\(this\.builder\) && layout\.knob != null;\s*strokeStartPoint\(ctx, layout, \{ knob, lit: this\.startTurning != null \}\);\s*if \(knob\) this\.startKnob = layout\.knob;/);
    const layout = methodBody(mainSource, 'startLayout');
    assert.match(layout, /startDiscLoop\(start, radius\)/);
    assert.match(layout, /const tip = startKnobPoint\(start, radius \* 2\.6\);/);
});

test('the dock\'s cards choose the plane, its rows write the start point in the unit they were drawn in, and CLEAR takes it', () => {
    assert.match(methodBody(mainSource, 'onDockShape'), /if \(this\.dockShown\?\.kind === DOCK_PLANE\) \{\s*if \(chooseBuildPlane\(this\.builder, id\)\) this\.syncOverlays\(\);\s*return;/);
    assert.match(methodBody(mainSource, 'applyDockValue'),
        /if \(kind === DOCK_START\) \{\s*const unit = currentOption\(this\.settings, ALTITUDE_UNIT_OPTION\);\s*writeBuildStartPoint\(this\.builder, startFromRows\(buildStartPoint\(this\.builder\), holder\.config, unit\)\);\s*this\.syncOverlays\(\);/);
    assert.match(methodBody(mainSource, 'onDockAction'), /if \(id === DOCK_CLEAR_START\.id\) \{\s*if \(clearBuildStartPoint\(this\.builder\)\) this\.syncOverlays\(\);\s*return;/);
    assert.match(methodBody(mainSource, 'syncDock'), /altitude: currentOption\(this\.settings, ALTITUDE_UNIT_OPTION\)/);
});

test('the world\'s flight is kept with the build it was made with, and handed back to the canvas it reopens', () => {
    assert.match(methodBody(mainSource, 'startCanvas'), /canvasWorld\(this\.editor, environmentId\), keptFlight\(this\.editor, environmentId\)\)/);
    assert.match(methodBody(mainSource, 'saveBuiltWorld'), /currentEnvironment\(this\.settings\), world, flight\);/);
    assert.match(methodBody(mainSource, 'keepLoadedWorld'), /currentEnvironment\(this\.settings\), world\.world, world\);/);
});
