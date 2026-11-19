/**
 * Planes - the aircraft a world can be flown in, each drawn by code as the
 * trainer always has been and each flying a little differently.
 *
 * A plane is a recipe rather than a model file: boxes, cylinders and cones in
 * the plane's own frame - nose along +Z, right wing along -X, up along +Y, in
 * world units, a metre each - with a colour apiece, and the figures the flight
 * model already takes from a host: the speed the wing stalls below, the speed
 * lift holds level at, the speed a full throttle settles at, and how quickly
 * the controls answer. `js/aircraft.js` builds meshes from a recipe; nothing
 * here touches a renderer, so every recipe can be checked in Node.
 *
 * The designs are generic and original: a trainer, a high-winged bush plane, a
 * twin, a jet and a biplane, named for what they are rather than after any
 * aircraft that flies.
 *
 * Pure module with no DOM or Three.js dependency.
 */

import { MIN_SENSITIVITY, MAX_SENSITIVITY, pitchForClimb } from './flight-model.js';

/** The plane a world is flown in until one is chosen for it: the one the simulator has always flown. */
export const DEFAULT_PLANE_ID = 'trainer';

/** The kinds of part a recipe is drawn from. */
export const PART_SHAPES = Object.freeze(['box', 'cylinder', 'cone']);

const HALF_TURN = Math.PI / 2;

/**
 * The turns a cylinder or a cone is laid along: both are drawn up the +Y axis,
 * so a body, a pod or a nose cone lying nose-first is turned a quarter about X,
 * and an axle across the plane a quarter about Z.
 */
const ALONG = Object.freeze([HALF_TURN, 0, 0]);
const FORWARD = Object.freeze([HALF_TURN, 0, 0]);
const ACROSS = Object.freeze([0, 0, HALF_TURN]);

// The trainer's nose cone is laid the other way round, tip back into the body,
// which is how the simulator has always drawn it.
const BLUNT = Object.freeze([-HALF_TURN, 0, 0]);

function box(size, at, color, turn = [0, 0, 0]) {
    return Object.freeze({ shape: 'box', size: Object.freeze(size), at: Object.freeze(at), turn: Object.freeze(turn), color });
}

function cylinder(top, bottom, length, at, color, turn = ALONG, segments = 8) {
    return Object.freeze({ shape: 'cylinder', top, bottom, length, segments, at: Object.freeze(at), turn: Object.freeze(turn), color });
}

function cone(radius, length, at, color, turn = FORWARD, segments = 8) {
    return Object.freeze({ shape: 'cone', radius, length, segments, at: Object.freeze(at), turn: Object.freeze(turn), color });
}

/**
 * The five, in the order Insert Plane's cards draw them. `span` and `length`
 * are the plane's extent across and along, in metres, which the chase camera
 * stands back by. `flight` is what the aircraft is handed: the three speeds the
 * flight model reads, the two arrival speeds a touchdown is judged against,
 * `startSpeed`, the speed a flight in it opens at, and `handling`, a share of
 * the pilot's own control sensitivity - so a biplane answers quicker than a
 * twin whatever the pilot has set.
 *
 * `startSpeed` is a floor on the pilot's own START AIRSPEED rather than a
 * replacement for it: the setting is one figure for every plane and the planes
 * do not share a stall speed, so a figure that opens the trainer a shade above
 * its stall opens the jet well under its own. Each is a figure the plane can
 * hold with the throttle `planeStart` sets, and far enough above its stall to
 * leave the wing some margin - the trainer's is its stall speed exactly,
 * because that is what the simulator has always opened at and what the
 * configured 80 knots comes to.
 */
export const PLANES = Object.freeze([
    Object.freeze({
        id: 'trainer',
        label: 'TRAINER',
        note: 'the plane the simulator has always flown',
        span: 14, length: 10,
        parts: Object.freeze([
            cylinder(0.8, 0.5, 8, [0, 0, 0], 0x4477aa),
            box([14, 0.15, 2], [0, 0, 0], 0x3366aa),
            box([5, 0.1, 1], [0, 0, -3.5], 0x3366aa),
            box([0.1, 2, 1.5], [0, 1, -3.5], 0x3366aa),
            cone(0.5, 1.5, [0, 0, 4.5], 0xdddddd, BLUNT)
        ]),
        flight: Object.freeze({ minSpeed: 40, cruiseSpeed: 120, maxSpeed: 200, impactSpeed: 30, runwayImpactSpeed: 48, startSpeed: 40, handling: 1 }),
    }),
    Object.freeze({
        id: 'bush',
        label: 'BUSH PLANE',
        note: 'a high wing and big tyres - slow to stall, slow at the top',
        span: 15, length: 9,
        parts: Object.freeze([
            cylinder(0.9, 0.6, 7.5, [0, 0, 0], 0xe0b040),
            box([15, 0.18, 2.2], [0, 1.05, 0.4], 0xb03a2e),
            box([0.08, 1.1, 0.08], [-2.6, 0.45, 0.4], 0x2e3439, [0, 0, -0.5]),
            box([0.08, 1.1, 0.08], [2.6, 0.45, 0.4], 0x2e3439, [0, 0, 0.5]),
            box([5.4, 0.1, 1.1], [0, 0.3, -3.4], 0xb03a2e),
            box([0.1, 2.2, 1.6], [0, 1.3, -3.4], 0xb03a2e),
            cylinder(0.45, 0.45, 0.35, [-1.1, -1.1, 1.2], 0x2e3439, ACROSS, 12),
            cylinder(0.45, 0.45, 0.35, [1.1, -1.1, 1.2], 0x2e3439, ACROSS, 12),
            cone(0.6, 1.1, [0, 0, 4.2], 0x3b444a)
        ]),
        flight: Object.freeze({ minSpeed: 32, cruiseSpeed: 100, maxSpeed: 160, impactSpeed: 34, runwayImpactSpeed: 54, startSpeed: 40, handling: 1.1 }),
    }),
    Object.freeze({
        id: 'twin',
        label: 'TWIN',
        note: 'two engines under a low wing - quicker in the cruise, heavier on the controls',
        span: 16, length: 11,
        parts: Object.freeze([
            cylinder(0.85, 0.55, 9, [0, 0, 0], 0xe8e8e8),
            box([16, 0.16, 2.2], [0, -0.3, 0], 0x5a6f86),
            cylinder(0.45, 0.4, 2.6, [-3, -0.2, 0.8], 0x5a6f86),
            cylinder(0.45, 0.4, 2.6, [3, -0.2, 0.8], 0x5a6f86),
            box([6, 0.1, 1.2], [0, 0.2, -4.2], 0x5a6f86),
            box([0.1, 2.4, 1.8], [0, 1.2, -4.2], 0x5a6f86),
            cone(0.55, 1.6, [0, 0, 5.2], 0xdddddd)
        ]),
        flight: Object.freeze({ minSpeed: 48, cruiseSpeed: 140, maxSpeed: 240, impactSpeed: 30, runwayImpactSpeed: 48, startSpeed: 60, handling: 0.85 }),
    }),
    Object.freeze({
        id: 'jet',
        label: 'JET',
        note: 'swept wings and no propeller - fast, and quick to stall when slow',
        span: 12, length: 14,
        parts: Object.freeze([
            cylinder(0.75, 0.45, 11, [0, 0, 0], 0x8a949c),
            box([6, 0.12, 2.6], [-3, -0.1, -0.8], 0x5f6970, [0, -0.45, 0]),
            box([6, 0.12, 2.6], [3, -0.1, -0.8], 0x5f6970, [0, 0.45, 0]),
            box([0.5, 0.6, 2.2], [-0.9, -0.1, 1.2], 0x3b444a),
            box([0.5, 0.6, 2.2], [0.9, -0.1, 1.2], 0x3b444a),
            box([2.4, 0.08, 1.2], [-1.3, 0.1, -5], 0x5f6970, [0, -0.5, 0]),
            box([2.4, 0.08, 1.2], [1.3, 0.1, -5], 0x5f6970, [0, 0.5, 0]),
            box([0.1, 2.4, 2], [0, 1.3, -4.8], 0x5f6970, [-0.35, 0, 0]),
            cone(0.75, 3, [0, 0, 7], 0x2e3439)
        ]),
        flight: Object.freeze({ minSpeed: 60, cruiseSpeed: 180, maxSpeed: 300, impactSpeed: 26, runwayImpactSpeed: 42, startSpeed: 80, handling: 0.9 }),
    }),
    Object.freeze({
        id: 'biplane',
        label: 'BIPLANE',
        note: 'two wings on struts - slow, and quick to roll',
        span: 12, length: 8,
        parts: Object.freeze([
            cylinder(0.8, 0.5, 6.5, [0, 0, 0], 0xe8dcc0),
            box([12, 0.15, 1.8], [0, 1.0, 0.3], 0xb52f2f),
            box([11, 0.15, 1.8], [0, -0.5, 0], 0xb52f2f),
            box([0.08, 1.5, 0.08], [-3.5, 0.25, 0.15], 0x2e3439),
            box([0.08, 1.5, 0.08], [3.5, 0.25, 0.15], 0x2e3439),
            box([4.4, 0.1, 1], [0, 0.1, -3], 0xb52f2f),
            box([0.1, 1.8, 1.3], [0, 0.9, -3], 0xb52f2f),
            cylinder(0.95, 0.95, 0.6, [0, 0, 3.4], 0x3b444a),
            cylinder(0.4, 0.4, 0.3, [-1, -1.1, 1], 0x2e3439, ACROSS, 12),
            cylinder(0.4, 0.4, 0.3, [1, -1.1, 1], 0x2e3439, ACROSS, 12)
        ]),
        flight: Object.freeze({ minSpeed: 30, cruiseSpeed: 90, maxSpeed: 150, impactSpeed: 32, runwayImpactSpeed: 50, startSpeed: 40, handling: 1.3 }),
    })
]);

const BY_ID = new Map(PLANES.map(plane => [plane.id, plane]));

/** True for a plane a world can be flown in. */
export function isPlaneId(id) {
    return BY_ID.has(id);
}

/** A plane by its id, or the trainer for an id no plane answers to. */
export function planeById(id = DEFAULT_PLANE_ID) {
    return BY_ID.get(id) ?? BY_ID.get(DEFAULT_PLANE_ID);
}

/** The plane ids, in the order the cards draw them. */
export function planeIds() {
    return PLANES.map(plane => plane.id);
}

/** The trainer's chase camera, which every other plane's is scaled from by its size. */
export const CHASE_DISTANCE = 30;
export const CHASE_HEIGHT   = 10;

/**
 * Where the chase camera stands behind a plane: as far back, for its size, as
 * it stands behind the trainer, so a long jet is not filmed from inside its own
 * tail and a small biplane is not a speck.
 */
export function chaseFor(plane = planeById()) {
    const trainer = planeById(DEFAULT_PLANE_ID);
    const scale = Math.max(plane.span, plane.length) / Math.max(trainer.span, trainer.length);
    return { distance: CHASE_DISTANCE * scale, height: CHASE_HEIGHT * scale };
}

/**
 * The sensitivity a plane flies with: the pilot's, times the plane's handling,
 * held inside the bounds the flight model allows one.
 */
export function planeSensitivity(sensitivity, plane = planeById()) {
    const base = Number.isFinite(sensitivity) ? sensitivity : 1;
    return Math.min(Math.max(base * (plane?.flight?.handling ?? 1), MIN_SENSITIVITY), MAX_SENSITIVITY);
}

/**
 * The condition a flight opens in, raised to what the plane flying it can
 * actually hold - the start the pilot asked for where the plane can hold it,
 * and the plane's own where it cannot.
 *
 * Three things, and the third is the one easiest to miss:
 *
 * - **The speed** is the greater of the one asked for and the plane's own
 *   `startSpeed`. The pilot's START AIRSPEED is one figure for every plane, so
 *   the 80 knots a fresh install opens at is a shade above the trainer's stall
 *   speed and well under the jet's - which is the jet opening stalled.
 * - **The throttle** is raised to what holds the plane's own floor, because the
 *   lever picks a target and the speed converges on it. Left alone, a plane
 *   opened faster than its lever asks for slows back to the lever's figure
 *   within a second or two: at the configured 20 per cent that is 32 for the
 *   bush plane and 30 for the biplane, which is each one's stall speed exactly.
 *   The floor and never the speed, so a pilot who asks for a speed above the
 *   floor keeps the lever they set and the start settles back toward it, which
 *   is what a lever is. Raised to hold `speed` instead - which at every
 *   configured default is the floor, so nothing shows there - 200 knots at 20
 *   per cent opened the trainer's lever at 50 per cent and the biplane's at 67.
 * - **The trim** is worked out again from this plane's own figures. The pitch
 *   that holds a climb has to out-climb the sink the wing is already losing at
 *   that speed, and that sink is read off the plane's cruise speed - so a trim
 *   worked out from the flight model's default figures asks the jet for a climb
 *   it does not get. At the same speed the two want attitudes seven degrees
 *   apart, and the start's own START CLIMB row is what reads wrong for it.
 *
 * `figures` is what the aircraft is flying on - its three speeds and its
 * `startSpeed` - rather than a plane, so a host flying figures of its own gets
 * them honoured rather than a plane's. Without a `startSpeed` the floor is the
 * stall speed itself, which is the least a wing can open at and still be
 * flying.
 *
 * A start held on a runway is handed back exactly as it came: it is stopped on
 * the ground with the engine idling, and every figure above is about being in
 * the air. So is a start with nothing in it.
 */
export function planeStart(start, figures = {}) {
    if (start == null || typeof start !== 'object' || start.grounded === true) return start;

    // Left out rather than defaulted to zero: the flight model fills a figure
    // nobody named with the one the controls were tuned at, and a zero stall
    // speed would read as a wing that cannot stall.
    const named = name => (Number.isFinite(figures[name]) ? figures[name] : undefined);
    const maxSpeed = named('maxSpeed') ?? 0;

    // The floor a start is raised to. Without a `startSpeed` it is the stall
    // speed itself, and without that either there is nothing to raise to: a
    // caller flying figures of its own keeps the start it asked for.
    const floor = named('startSpeed') ?? named('minSpeed') ?? 0;

    const speed = Math.max(Number(start.speed) || 0, floor, 0);

    // Read off the floor rather than off `speed`, which is the greater of the
    // floor and what the pilot asked for. Where the pilot's figure is the
    // greater one the floor played no part, so there is nothing to hold and
    // the lever they set stands: 200 knots at 20 per cent is a start that
    // settles back toward 20 per cent, which is what the lever means.
    const holds = maxSpeed > 0 ? Math.min(Math.max(floor, 0) / maxSpeed, 1) : 0;

    return {
        ...start,
        speed,
        throttle: Math.max(Number(start.throttle) || 0, holds),
        pitch: pitchForClimb(Number(start.verticalSpeed) || 0, speed, {
            minSpeed: named('minSpeed'),
            cruiseSpeed: named('cruiseSpeed')
        })
    };
}
