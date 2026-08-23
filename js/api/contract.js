/**
 * The simulator API's contracts - the option defaults both halves fill in, the
 * checks they run on what a host supplies, and the shape of the telemetry they
 * hand back.
 *
 * Pure module with no DOM or Three.js dependency, which is the point: a host
 * can validate its own aircraft or its own environment against these before it
 * ever loads a renderer, and the whole surface can be unit tested in Node.
 */

import { DEFAULT_SIZE, DEFAULT_SEGMENTS } from '../environment/elements.js';
import { DEFAULT_ENVIRONMENT_ID } from '../environment/presets.js';
import { CAMERA_MODES } from '../camera-math.js';
import {
    INITIAL_SPEED, INITIAL_THROTTLE, INITIAL_ALTITUDE,
    INITIAL_VERTICAL_SPEED, INITIAL_PITCH, INITIAL_YAW, INITIAL_CAMERA_MODE
} from '../flight-state.js';
import {
    MIN_SPEED, CRUISE_SPEED, MAX_SPEED, GRAVITY,
    CONTROL_SENSITIVITY, MIN_SENSITIVITY, MAX_SENSITIVITY
} from '../flight-model.js';
import { GROUND_CLEARANCE, CRASH_IMPACT_SPEED } from '../crash.js';
import { DEFAULT_KEYMAP } from '../input-map.js';

/**
 * The version of the API surface itself, which moves when the contracts below
 * change rather than when the simulator does.
 */
export const API_VERSION = 1;

// The bindings the bundled control scheme uses, published so a host can remap
// them or replace them with an input source of its own.
export { DEFAULT_KEYMAP, CONTROL_NAMES, RESET_KEYS } from '../input-map.js';

/** The square the bundled world covers, and the ground outside it. */
export function boundsFromSize(size = DEFAULT_SIZE) {
    const half = Math.abs(size) / 2;
    return { minX: -half, maxX: half, minZ: -half, maxZ: half };
}

/** A height sampler for a host with no terrain of its own: flat ground. */
export function flatSampler(height = 0) {
    return () => height;
}

export function isInsideBounds(bounds, x, z) {
    return x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ;
}

/**
 * An external environment as the Pilot API uses it: something that answers the
 * height under a point, and says how far its ground goes.
 *
 * A host that supplies neither gets flat ground over the bundled world's
 * square, so a pilot dropped into an empty scene still has something to fly
 * over and something to crash into.
 */
export function resolveTerrain(terrain = {}) {
    const sample = typeof terrain.sampleHeight === 'function' ? terrain.sampleHeight : flatSampler(0);
    const bounds = { ...boundsFromSize(DEFAULT_SIZE), ...(terrain.bounds ?? {}) };

    return {
        bounds,
        sampleHeight(x, z) {
            if (!isInsideBounds(bounds, x, z)) return 0;
            const height = Number(sample(x, z));
            return Number.isFinite(height) ? height : 0;
        }
    };
}

/**
 * What an external aircraft has to satisfy before the Matter API will fly it:
 * something with a position and an orientation the environment can read, and a
 * declared control anchor, which is the point in the model the flight model
 * moves and turns.
 *
 * Returns the problems found rather than throwing, so a host can report all of
 * them at once instead of one per reload.
 */
export function validateAircraftContract(aircraft) {
    const problems = [];

    if (!aircraft || typeof aircraft !== 'object') {
        return ['an aircraft is required'];
    }

    if (!aircraft.position || typeof aircraft.position.x !== 'number') {
        problems.push('aircraft.position must be a point with x, y, and z');
    }

    const hasRotation = aircraft.rotation && typeof aircraft.rotation.x === 'number';
    const hasQuaternion = typeof aircraft.getQuaternion === 'function';
    if (!hasRotation && !hasQuaternion) {
        problems.push('aircraft needs a rotation, or a getQuaternion() to read one from');
    }

    if (aircraft.anchor !== undefined && typeof aircraft.anchor !== 'object') {
        problems.push('aircraft.anchor must be a point when it is given');
    }

    return problems;
}

export function isAircraftContractSatisfied(aircraft) {
    return validateAircraftContract(aircraft).length === 0;
}

/**
 * Fills in the Pilot API's options. Everything a host does not name comes from
 * the configured start state and the flight model, so a pilot created with no
 * options at all flies exactly the way the bundled simulator does.
 */
export function resolvePilotOptions(options = {}) {
    const flight = { ...options.flight };

    return {
        scene: options.scene ?? null,
        aircraft: options.aircraft ?? null,
        anchor: options.anchor ?? { x: 0, y: 0, z: 0 },
        terrain: resolveTerrain(options.terrain),
        keymap: { ...DEFAULT_KEYMAP, ...(options.keymap ?? {}) },
        controls: options.controls !== false,
        cameraMode: CAMERA_MODES.includes(options.cameraMode) ? options.cameraMode : INITIAL_CAMERA_MODE,
        flight: {
            speed:         numberOr(flight.speed, INITIAL_SPEED),
            throttle:      clamp(numberOr(flight.throttle, INITIAL_THROTTLE), 0, 1),
            altitude:      numberOr(flight.altitude, INITIAL_ALTITUDE),
            verticalSpeed: numberOr(flight.verticalSpeed, INITIAL_VERTICAL_SPEED),
            pitch:         numberOr(flight.pitch, INITIAL_PITCH),
            yaw:           numberOr(flight.yaw, INITIAL_YAW),
            sensitivity:   clamp(numberOr(flight.sensitivity, CONTROL_SENSITIVITY), MIN_SENSITIVITY, MAX_SENSITIVITY),
            minSpeed:      numberOr(flight.minSpeed, MIN_SPEED),
            cruiseSpeed:   numberOr(flight.cruiseSpeed, CRUISE_SPEED),
            maxSpeed:      numberOr(flight.maxSpeed, MAX_SPEED),
            gravity:       numberOr(flight.gravity, GRAVITY),
            clearance:     numberOr(flight.clearance, GROUND_CLEARANCE),
            impactSpeed:   numberOr(flight.impactSpeed, CRASH_IMPACT_SPEED)
        }
    };
}

/**
 * Fills in the Matter API's options. An environment built with no options is
 * the one the bundled simulator opens on.
 */
export function resolveEnvironmentOptions(options = {}) {
    return {
        environment: options.environment ?? DEFAULT_ENVIRONMENT_ID,
        size: positiveOr(options.size, DEFAULT_SIZE),
        segments: Math.max(2, Math.round(positiveOr(options.segments, DEFAULT_SEGMENTS))),
        fog: options.fog !== false,
        lights: options.lights !== false,
        elements: Array.isArray(options.elements) ? options.elements : null
    };
}

/**
 * The reading an external HUD renders from: every instrument the bundled one
 * shows, in world units, with nothing reaching into the flight model behind it.
 * The shape is the stable part of the contract; the numbers in it are not.
 */
export function createTelemetry(values = {}) {
    return {
        airspeed:      numberOr(values.airspeed, 0),
        altitude:      numberOr(values.altitude, 0),
        verticalSpeed: numberOr(values.verticalSpeed, 0),
        heading:       numberOr(values.heading, 0),
        throttle:      clamp(numberOr(values.throttle, 0), 0, 1),
        heightAboveTerrain: numberOr(values.heightAboveTerrain, 0),
        crashed:       values.crashed === true,
        stalled:       values.stalled === true
    };
}

/** The fields every telemetry object carries, for a host checking its own. */
export const TELEMETRY_FIELDS = Object.freeze(Object.keys(createTelemetry()));

function numberOr(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function positiveOr(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : fallback;
}

function clamp(value, low, high) {
    return Math.min(Math.max(value, low), high);
}
