/**
 * The start point - where on an environment a flight begins, and which way it
 * is pointing. One per environment, placed with Insert Plane, kept with a build
 * and written into the environment file.
 *
 * The start point says where and the settings say how. A flying start opens
 * over the point, on its heading, at its height above the ground there, at the
 * settings' airspeed, climb and throttle. The height is measured from the
 * ground rather than from the sea, because a start altitude above the sea is
 * inside a mountain on half of a highland world. A takeoff opens on the runway
 * nearest the point, by the rule a takeoff already has.
 *
 * Held as `{ at: [x, z], heading, heightFeet }`: a point in world units, a
 * compass heading in whole degrees, and a height above the ground in feet,
 * which is how the settings hold a start altitude. The dock writes the height
 * out in whichever altitude unit the settings read in.
 *
 * Pure module with no DOM or Three.js dependency.
 */

import { DEFAULT_SIZE, scalar } from './environment/elements.js';
import { feetToAltitude, headingToYaw, METERS_PER_FOOT, altitudeUnit } from './units.js';

/** How far from the middle of the world a start point may stand, either way, in world units. */
export const START_REACH = DEFAULT_SIZE / 2;

/** The height above the ground a start point is placed at until one is set, in feet. */
export const START_HEIGHT_FEET = 1000;

/** The heights a start point may be set at above the ground, in feet. */
export const START_HEIGHT_LOW  = 100;
export const START_HEIGHT_HIGH = 10000;

/** The settings rows a start point overrides while a world with one is flown. */
export const HELD_START_FIELDS = Object.freeze(['headingDegrees', 'altitudeFeet']);

/** What those rows say while they are held. */
export const HELD_START_NOTE = 'set by this environment';

function clamp(value, low, high) {
    return Math.min(Math.max(value, low), high);
}

function wrapHeading(degrees) {
    const whole = Math.round(degrees);
    return ((whole % 360) + 360) % 360;
}

/**
 * A start point, or null for anything that is not one. Every part is held
 * inside what it may be - the point on the world, the heading on the compass,
 * the height inside its range - rather than refused, so a start point carried
 * in from a file a hand edited lands somewhere it can be flown from.
 */
export function cleanStartPoint(value) {
    if (value == null || typeof value !== 'object') return null;
    const at = value.at;
    if (!Array.isArray(at) || at.length !== 2 || !at.every(Number.isFinite)) return null;

    const heading = Number.isFinite(value.heading) ? wrapHeading(value.heading) : 0;
    const height  = Number.isFinite(value.heightFeet) ? value.heightFeet : START_HEIGHT_FEET;

    return {
        at: [clamp(at[0], -START_REACH, START_REACH), clamp(at[1], -START_REACH, START_REACH)],
        heading,
        heightFeet: clamp(height, START_HEIGHT_LOW, START_HEIGHT_HIGH)
    };
}

/** A start point placed at a point on the ground, keeping the heading and height of the one it moves, if there was one. */
export function placeStartPoint(at, was = null) {
    return cleanStartPoint({
        at,
        heading: was?.heading ?? 0,
        heightFeet: was?.heightFeet ?? START_HEIGHT_FEET
    });
}

/** The same start point pointed another way. */
export function turnStartPoint(point, heading) {
    if (point == null || !Number.isFinite(heading)) return point ?? null;
    return cleanStartPoint({ ...point, heading });
}

/** Two start points that are the same point, or both none. */
export function sameStartPoint(a, b) {
    if (a == null || b == null) return a == null && b == null;
    return a.at[0] === b.at[0] && a.at[1] === b.at[1] && a.heading === b.heading && a.heightFeet === b.heightFeet;
}

// --- The dock's rows ---------------------------------------------------------------

/** The name the height row is held under, which is its label once spaced: `HEIGHT FEET` or `HEIGHT METERS`. */
export function startHeightField(unit = 'feet') {
    return altitudeUnit(unit).id === 'meters' ? 'heightMeters' : 'heightFeet';
}

/**
 * The SELECT STARTING POINT rows, as ranges the properties panel draws: where
 * it stands, which way it points and how high it is, with the height in the
 * altitude unit the settings read in.
 */
export function startRanges(unit = 'feet') {
    const meters = startHeightField(unit) === 'heightMeters';
    const height = meters
        ? { ...scalar(Math.round(START_HEIGHT_LOW * METERS_PER_FOOT), Math.round(START_HEIGHT_HIGH * METERS_PER_FOOT),
            Math.round(START_HEIGHT_FEET * METERS_PER_FOOT)), step: 10 }
        : { ...scalar(START_HEIGHT_LOW, START_HEIGHT_HIGH, START_HEIGHT_FEET), step: 50 };

    return Object.freeze({
        atX: Object.freeze({ ...scalar(-START_REACH, START_REACH, 0), step: 10 }),
        atZ: Object.freeze({ ...scalar(-START_REACH, START_REACH, 0), step: 10 }),
        heading: Object.freeze({ ...scalar(0, 359, 0), step: 1 }),
        [startHeightField(unit)]: Object.freeze(height)
    });
}

/** A start point as the configuration its rows read, the height in the unit given. */
export function startRowValues(point, unit = 'feet') {
    if (point == null) return null;
    const field = startHeightField(unit);
    return {
        atX: Math.round(point.at[0]),
        atZ: Math.round(point.at[1]),
        heading: point.heading,
        [field]: field === 'heightMeters' ? Math.round(point.heightFeet * METERS_PER_FOOT) : Math.round(point.heightFeet)
    };
}

/**
 * The start point the rows now say, from the one they were drawn from: a row
 * the holder does not carry keeps the point's own value, so a height written
 * in metres and read back in metres does not drift by a rounding each time.
 */
export function startFromRows(point, config = {}, unit = 'feet') {
    if (point == null) return null;
    const field = startHeightField(unit);
    const read = (name, fallback) => (Number.isFinite(config?.[name]) ? config[name] : fallback);

    const shown = startRowValues(point, unit);
    const height = read(field, shown[field]);
    const heightFeet = height === shown[field]
        ? point.heightFeet
        : field === 'heightMeters' ? height / METERS_PER_FOOT : height;

    return cleanStartPoint({
        at: [read('atX', point.at[0]), read('atZ', point.at[1])],
        heading: read('heading', point.heading),
        heightFeet
    });
}

// --- In flight ---------------------------------------------------------------------

/**
 * A flight start opened at a start point: over the point, on its heading, at
 * its height above the ground there - the rest is the settings' own. A takeoff
 * is left as it is, because the strip it is held on is its own answer to where;
 * so is any start with no point to open at.
 *
 * `groundAt(x, z)` is the height of the ground in world units.
 */
export function startAtPoint(start, point, groundAt = () => 0) {
    if (start == null || point == null || start.grounded) return start;
    const [x, z] = point.at;
    const ground = Number(groundAt(x, z)) || 0;
    return {
        ...start,
        x, z,
        yaw: headingToYaw(point.heading),
        altitude: ground + feetToAltitude(point.heightFeet)
    };
}

// --- On the overlay ----------------------------------------------------------------

/** The start point's disc on the ground, as a radius in world units, and how far out its heading knob stands. */
export const START_DISC_RADIUS = 160;
export const START_KNOB_REACH  = 420;

/** The knob's point over the ground: out along the heading from the start point, by `START_KNOB_REACH`. */
export function startKnobPoint(point, reach = START_KNOB_REACH) {
    if (point == null) return null;
    const radians = point.heading * Math.PI / 180;
    // Heading 0 is +Z, and a heading turns towards -X, as `bearingToDirection` reads one.
    return { x: point.at[0] - Math.sin(radians) * reach, z: point.at[1] + Math.cos(radians) * reach };
}

/** The ring of the disc on the ground, as points in world x and z. */
export function startDiscLoop(point, radius = START_DISC_RADIUS, steps = 32) {
    if (point == null) return [];
    const loop = [];
    for (let i = 0; i < steps; i++) {
        const angle = i / steps * Math.PI * 2;
        loop.push([point.at[0] + Math.cos(angle) * radius, point.at[1] + Math.sin(angle) * radius]);
    }
    return loop;
}
