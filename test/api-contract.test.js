import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
    API_VERSION,
    DEFAULT_KEYMAP, CONTROL_NAMES, TELEMETRY_FIELDS,
    boundsFromSize, flatSampler, isInsideBounds,
    resolveTerrain, resolvePilotOptions, resolveEnvironmentOptions,
    validateAircraftContract, isAircraftContractSatisfied,
    createTelemetry
} from '../js/api/contract.js';
import {
    INITIAL_SPEED, INITIAL_THROTTLE, INITIAL_ALTITUDE, INITIAL_CAMERA_MODE
} from '../js/flight-state.js';
import { CONTROL_SENSITIVITY, MIN_SENSITIVITY, MAX_SENSITIVITY } from '../js/flight-model.js';
import { DEFAULT_ENVIRONMENT_ID } from '../js/environment/presets.js';
import { DEFAULT_SIZE, DEFAULT_SEGMENTS } from '../js/environment/elements.js';
import { createInputState } from '../js/input-map.js';

const source = (name) => readFileSync(
    fileURLToPath(new URL(`../js/api/${name}`, import.meta.url)),
    'utf8'
);

test('the API says which version of itself a host is holding', () => {
    assert.equal(Number.isInteger(API_VERSION), true);
    assert.ok(API_VERSION >= 1);
});

// --- The public entry point ----------------------------------------------

test('one module gives a host both halves of the simulator', () => {
    const index = source('index.js');
    assert.match(index, /export \{ createPilot \}/, 'the Pilot API should be re-exported');
    assert.match(index, /export \{ createEnvironment \}/, 'the Matter API should be re-exported');
});

// The contracts are the half of the API a host can hold without a renderer, so
// nothing in them may reach for one.
test('the contracts can be read without loading a renderer', () => {
    assert.doesNotMatch(source('contract.js'), /from 'three'/);
});

// --- Option defaults ------------------------------------------------------

test('a pilot created with no options flies the bundled simulator', () => {
    const options = resolvePilotOptions();
    assert.equal(options.flight.speed, INITIAL_SPEED);
    assert.equal(options.flight.throttle, INITIAL_THROTTLE);
    assert.equal(options.flight.altitude, INITIAL_ALTITUDE);
    assert.equal(options.cameraMode, INITIAL_CAMERA_MODE);
    assert.equal(options.controls, true);
    assert.deepEqual(options.anchor, { x: 0, y: 0, z: 0 });
});

test('a pilot keeps what it was given and fills in the rest', () => {
    const options = resolvePilotOptions({
        controls: false,
        cameraMode: 'ORBIT',
        anchor: { x: 0, y: 1.5, z: 2 },
        flight: { speed: 90, throttle: 0.75 }
    });

    assert.equal(options.controls, false);
    assert.equal(options.cameraMode, 'ORBIT');
    assert.deepEqual(options.anchor, { x: 0, y: 1.5, z: 2 });
    assert.equal(options.flight.speed, 90);
    assert.equal(options.flight.throttle, 0.75);
    assert.equal(options.flight.altitude, INITIAL_ALTITUDE, 'and everything it did not name');
});

test('a camera mode nothing answers to falls back to the configured one', () => {
    assert.equal(resolvePilotOptions({ cameraMode: 'PERISCOPE' }).cameraMode, INITIAL_CAMERA_MODE);
});

test('a throttle setting outside the lever travel is clamped onto it', () => {
    assert.equal(resolvePilotOptions({ flight: { throttle: 4 } }).flight.throttle, 1);
    assert.equal(resolvePilotOptions({ flight: { throttle: -4 } }).flight.throttle, 0);
});

test('a value that is not a number is not an option, it is a typo', () => {
    assert.equal(resolvePilotOptions({ flight: { speed: 'fast' } }).flight.speed, INITIAL_SPEED);
});

// A host embedding the pilot has its own idea of how hard the controls should
// bite, so the setting the settings panel moves is one the API takes too.
test('a host can set how hard the controls bite, within the range they hold', () => {
    assert.equal(resolvePilotOptions().flight.sensitivity, CONTROL_SENSITIVITY);
    assert.equal(resolvePilotOptions({ flight: { sensitivity: 1.5 } }).flight.sensitivity, 1.5);
    assert.equal(resolvePilotOptions({ flight: { sensitivity: 400 } }).flight.sensitivity, MAX_SENSITIVITY);
    assert.equal(resolvePilotOptions({ flight: { sensitivity: -1 } }).flight.sensitivity, MIN_SENSITIVITY);
    assert.equal(resolvePilotOptions({ flight: { sensitivity: 'twitchy' } }).flight.sensitivity, CONTROL_SENSITIVITY);
});

test('an environment created with no options is the one the game opens on', () => {
    const options = resolveEnvironmentOptions();
    assert.equal(options.environment, DEFAULT_ENVIRONMENT_ID);
    assert.equal(options.size, DEFAULT_SIZE);
    assert.equal(options.segments, DEFAULT_SEGMENTS);
    assert.equal(options.fog, true);
    assert.equal(options.lights, true);
    assert.equal(options.elements, null);
});

test('an environment sized with nonsense is sized the way the game is', () => {
    for (const size of [0, -400, 'wide', null]) {
        assert.equal(resolveEnvironmentOptions({ size }).size, DEFAULT_SIZE, `${size} is not a size`);
    }
    assert.equal(resolveEnvironmentOptions({ segments: 1 }).segments, 2, 'a grid needs at least one cell');
    assert.equal(resolveEnvironmentOptions({ segments: 40.4 }).segments, 40);
});

// --- The terrain contract -------------------------------------------------

test('a pilot given no terrain still has ground to fly over', () => {
    const terrain = resolveTerrain();
    assert.equal(terrain.sampleHeight(0, 0), 0);
    assert.deepEqual(terrain.bounds, boundsFromSize(DEFAULT_SIZE));
});

test('an external terrain is read through the sampler it supplies', () => {
    const terrain = resolveTerrain({ sampleHeight: (x, z) => x + z });
    assert.equal(terrain.sampleHeight(120, 80), 200);
});

test('outside the declared bounds reads as sea level, the way the world edge does', () => {
    const terrain = resolveTerrain({
        sampleHeight: () => 500,
        bounds: { minX: -100, maxX: 100, minZ: -100, maxZ: 100 }
    });

    assert.equal(terrain.sampleHeight(0, 0), 500);
    assert.equal(terrain.sampleHeight(400, 0), 0);
    assert.equal(terrain.sampleHeight(0, -400), 0);
});

test('a sampler that answers with nonsense is read as flat ground, not as a crash', () => {
    const terrain = resolveTerrain({ sampleHeight: () => 'up a bit' });
    assert.equal(terrain.sampleHeight(0, 0), 0);
});

test('bounds are the square the world covers, and know what is inside them', () => {
    const bounds = boundsFromSize(1000);
    assert.deepEqual(bounds, { minX: -500, maxX: 500, minZ: -500, maxZ: 500 });
    assert.equal(isInsideBounds(bounds, 0, 0), true);
    assert.equal(isInsideBounds(bounds, 500, -500), true, 'the edge is still inside');
    assert.equal(isInsideBounds(bounds, 501, 0), false);
});

test('flat ground is a sampler like any other', () => {
    assert.equal(flatSampler()(1, 2), 0);
    assert.equal(flatSampler(42)(1, 2), 42);
});

// --- The aircraft contract ------------------------------------------------

const flyable = () => ({ position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } });

test('an aircraft with a position and an orientation can fly the environment', () => {
    assert.deepEqual(validateAircraftContract(flyable()), []);
    assert.equal(isAircraftContractSatisfied(flyable()), true);
});

test('an orientation can be a rotation or something that hands one over', () => {
    const aircraft = { position: { x: 0, y: 0, z: 0 }, getQuaternion: () => ({}) };
    assert.deepEqual(validateAircraftContract(aircraft), []);
});

test('an aircraft missing what the world has to read reports every gap at once', () => {
    const problems = validateAircraftContract({});
    assert.equal(problems.length, 2, `expected a position and an orientation problem, got ${problems}`);
    assert.ok(problems.some(problem => /position/.test(problem)));
    assert.ok(problems.some(problem => /rotation|getQuaternion/.test(problem)));
});

test('no aircraft at all is the one problem worth reporting on its own', () => {
    for (const nothing of [null, undefined, 'a plane']) {
        assert.deepEqual(validateAircraftContract(nothing), ['an aircraft is required']);
        assert.equal(isAircraftContractSatisfied(nothing), false);
    }
});

test('a control anchor is optional, but it has to be a point when it is given', () => {
    assert.deepEqual(validateAircraftContract({ ...flyable(), anchor: { x: 0, y: 1, z: 0 } }), []);
    assert.equal(validateAircraftContract({ ...flyable(), anchor: 4 }).length, 1);
});

// --- Telemetry ------------------------------------------------------------

test('telemetry is a fixed shape, so an external HUD can be written against it', () => {
    assert.deepEqual(TELEMETRY_FIELDS, [
        'airspeed', 'altitude', 'verticalSpeed', 'heading',
        'throttle', 'heightAboveTerrain', 'crashed', 'stalled'
    ]);
    assert.deepEqual(Object.keys(createTelemetry({ airspeed: 40 })), TELEMETRY_FIELDS);
});

test('a reading that is missing reads as zero rather than as undefined', () => {
    const telemetry = createTelemetry();
    for (const field of ['airspeed', 'altitude', 'verticalSpeed', 'heading', 'throttle']) {
        assert.equal(telemetry[field], 0, `${field} should read zero`);
    }
    assert.equal(telemetry.crashed, false);
    assert.equal(telemetry.stalled, false);
});

test('telemetry reports what it was given, and nothing behind it', () => {
    const telemetry = createTelemetry({
        airspeed: 40, altitude: 423.78, verticalSpeed: 6.4,
        heading: 0, throttle: 0.2, heightAboveTerrain: 300,
        crashed: false, stalled: false, secret: 'the flight model'
    });

    assert.equal(telemetry.airspeed, 40);
    assert.equal(telemetry.throttle, 0.2);
    assert.equal('secret' in telemetry, false, 'the shape is the contract');
});

// --- Keybindings ----------------------------------------------------------

test('the keybindings are published as a map a host can remap', () => {
    assert.deepEqual(Object.keys(DEFAULT_KEYMAP), CONTROL_NAMES);
    for (const [control, codes] of Object.entries(DEFAULT_KEYMAP)) {
        assert.ok(Array.isArray(codes) && codes.length > 0, `${control} needs a key`);
    }
});

test('every control the keymap binds is one the input state carries', () => {
    const input = createInputState();
    for (const control of CONTROL_NAMES) {
        assert.equal(input[control], false, `${control} is bound but not flown`);
    }
});

test('a host can remap the bindings without losing the ones it left alone', () => {
    const keymap = resolvePilotOptions({ keymap: { yawLeft: ['KeyZ'] } }).keymap;
    assert.deepEqual(keymap.yawLeft, ['KeyZ']);
    assert.deepEqual(keymap.pitchUp, DEFAULT_KEYMAP.pitchUp);
});
