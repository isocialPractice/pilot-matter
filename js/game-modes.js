/**
 * Game modes - the flights that are played rather than flown.
 *
 * A mode is a world, an objective, and the stages the objective is set at, and
 * nothing else: the flight model, the terrain, and the instruments are the same
 * ones a free flight uses. What a stage changes is what the pilot is being
 * asked to do and how much help they are given doing it.
 *
 * Pure module with no DOM or Three.js dependency. The course a loop stage is
 * flown through is geometry rather than meshes, the gate test is a segment
 * against a disc, and the run state is a plain object, so every rule here can
 * be unit tested in Node and drawn by whatever renderer is in front of it.
 */

import { createRandom, runwayThresholds, DEFAULT_SIZE } from './environment/elements.js';
import { OPEN_COUNTRY_ID, LOOP_VALLEY_ID } from './environment/presets.js';
import {
    START_FLYING, startDefaults, snapStartValue, startField
} from './config.js';
import { FEET_PER_UNIT } from './units.js';

export const RUNWAY_LANDING = 'runway-landing';
export const LOOP_COURSE    = 'loop-course';

// What a stage asks for. A landing is one thing done once; a course is a count
// of gates flown in the order they were laid.
export const LAND_OBJECTIVE = 'landing';
export const LOOP_OBJECTIVE = 'loops';

/**
 * The world's +Z axis is north, the same north the compass card counts from, so
 * a bearing turns into a direction the same way everywhere in the simulator.
 */
const RADIANS = Math.PI / 180;

export function bearingDirection(degrees) {
    const radians = degrees * RADIANS;
    return { x: Math.sin(radians), z: Math.cos(radians) };
}

export function wrapDegrees(degrees) {
    return ((degrees % 360) + 360) % 360;
}

/** An angle folded back into the half turn either side of zero. */
export function wrapRadians(radians) {
    const turn = Math.PI * 2;
    const wrapped = ((radians % turn) + turn) % turn;
    return wrapped > Math.PI ? wrapped - turn : wrapped;
}

/** One bearing turned part of the way toward another, by the short way round. */
export function blendBearing(from, to, amount) {
    return from + wrapRadians(to - from) * clamp(amount, 0, 1);
}

// --- The modes ------------------------------------------------------------

/**
 * Landing on a strip, made harder along the two axes that make a landing hard:
 * finding the runway, and reading the ground around it well enough to get down
 * on it. The first stage puts the strip under the nose over flat country. The
 * last puts it behind the aircraft, small, in high ground.
 */
const runwayLanding = {
    id: RUNWAY_LANDING,
    label: 'RUNWAY LANDING',
    description: 'Find the strip and put the aircraft down on it',
    objective: LAND_OBJECTIVE,
    goal: 'LAND ON THE RUNWAY',
    environment: OPEN_COUNTRY_ID,
    seed: 41071,
    stages: [
        {
            label: 'FINAL',
            note: 'the strip ahead of you over flat country',
            base: { maxHeight: 180, scale: 1.9 },
            runway: { length: [3000, 3400], width: [300, 340] },
            approach: { distance: 2400, bearing: 8, heading: 0, altitudeFeet: 1000 }
        },
        {
            label: 'DOWNWIND',
            note: 'the strip off your wing, and the ground beginning to rise',
            base: { maxHeight: 300, scale: 2.4 },
            runway: { length: [2600, 3000], width: [260, 300] },
            approach: { distance: 5200, bearing: 75, heading: 55, altitudeFeet: 2000 }
        },
        {
            label: 'CROSS COUNTRY',
            note: 'the strip somewhere behind your shoulder, in broken country',
            base: { maxHeight: 460, scale: 3.4 },
            runway: { length: [2000, 2400], width: [220, 260] },
            approach: { distance: 6800, bearing: 140, heading: 145, altitudeFeet: 2600 }
        },
        {
            label: 'HIGH GROUND',
            note: 'a short strip behind you, in country you have to read to reach it',
            base: { maxHeight: 640, scale: 4.4 },
            runway: { length: [1600, 2000], width: [200, 240] },
            approach: { distance: 7400, bearing: 180, heading: 180, altitudeFeet: 3200 }
        }
    ]
};

/**
 * A course of loops flown in the order they were laid. The gates get smaller,
 * closer together, and further off the level as the stages go on, so what is
 * being asked for moves from flying at a target to flying a line through
 * several of them.
 */
const loopCourse = {
    id: LOOP_COURSE,
    label: 'FLYING THROUGH LOOPS',
    description: 'Fly the aircraft through every loop of the course in order',
    objective: LOOP_OBJECTIVE,
    goal: 'FLY THROUGH EVERY LOOP',
    environment: LOOP_VALLEY_ID,
    seed: 90733,
    stages: [
        {
            label: 'THREE GATES',
            note: 'wide loops in a line, with room to line each one up',
            rings: { count: 3, radius: 240, spacing: 2600, altitude: 900, spread: 0.10, turn: 0.20 }
        },
        {
            label: 'FIVE GATES',
            note: 'the course starts to bend, and the loops start to close',
            rings: { count: 5, radius: 200, spacing: 2300, altitude: 950, spread: 0.20, turn: 0.35 }
        },
        {
            label: 'SEVEN GATES',
            note: 'tighter loops, less run between them, and a course that turns',
            rings: { count: 7, radius: 165, spacing: 2000, altitude: 1000, spread: 0.30, turn: 0.50 }
        },
        {
            label: 'NINE GATES',
            note: 'a course flown as one line rather than nine approaches',
            rings: { count: 9, radius: 135, spacing: 1750, altitude: 1050, spread: 0.42, turn: 0.65 }
        }
    ]
};

export const GAME_MODES = [runwayLanding, loopCourse];

export const GAME_MODE_IDS = GAME_MODES.map(mode => mode.id);

const BY_ID = new Map(GAME_MODES.map(mode => [mode.id, mode]));

export function isGameModeId(id) {
    return BY_ID.has(id);
}

/** The mode answering to an id, or null for free flight and for anything else. */
export function getGameMode(id) {
    return BY_ID.get(id) ?? null;
}

// --- A run ----------------------------------------------------------------

/**
 * A run of a mode: which one, how far through its stages, and how far through
 * the stage under way. Free flight is a run of nothing, which is why the whole
 * of the rest of the game can read this state without asking first whether a
 * mode is being played at all.
 */
export function createRunState(modeId = null) {
    const state = { modeId: null, stageIndex: 0, gate: 0, landed: false, complete: false };
    if (isGameModeId(modeId)) startRun(state, modeId);
    return state;
}

export function startRun(state, modeId) {
    if (!isGameModeId(modeId)) return endRun(state);

    state.modeId = modeId;
    state.stageIndex = 0;
    state.complete = false;
    restartStage(state);
    return getGameMode(modeId);
}

/** Back to free flight, which is the run every session opens in. */
export function endRun(state) {
    state.modeId = null;
    state.stageIndex = 0;
    state.complete = false;
    restartStage(state);
    return null;
}

export function runningMode(state) {
    return getGameMode(state?.modeId);
}

export function isRunning(state) {
    return runningMode(state) != null;
}

export function stageCount(state) {
    return runningMode(state)?.stages.length ?? 0;
}

export function currentStage(state) {
    return runningMode(state)?.stages[state.stageIndex] ?? null;
}

/** The stage the pilot is on, counted the way a stage is spoken about. */
export function stageNumber(state) {
    return isRunning(state) ? state.stageIndex + 1 : 0;
}

/** Puts the stage back to its beginning, for a crash or a fresh attempt. */
export function restartStage(state) {
    state.gate = 0;
    state.landed = false;
    return state;
}

/**
 * How much of the stage is done. A landing is one thing done once; a course is
 * the gates flown out of the gates laid.
 */
export function stageProgress(state) {
    const mode = runningMode(state);
    if (!mode) return { done: 0, total: 0 };

    if (mode.objective === LOOP_OBJECTIVE) {
        return { done: state.gate, total: currentStage(state)?.rings.count ?? 0 };
    }

    return { done: state.landed ? 1 : 0, total: 1 };
}

export function isStageComplete(state) {
    const { done, total } = stageProgress(state);
    return total > 0 && done >= total;
}

/**
 * Moves on to the next stage, or finishes the run when there is no next one. A
 * finished run stays on its last stage rather than falling off the end, so the
 * world under the pilot is still the one they finished in.
 */
export function advanceStage(state) {
    if (!isRunning(state)) return false;

    if (state.stageIndex + 1 >= stageCount(state)) {
        state.complete = true;
        return false;
    }

    state.stageIndex += 1;
    restartStage(state);
    return true;
}

/**
 * Reports a landing to the run. Returns true when it completed the stage, which
 * is the caller's cue to lay out the next one.
 */
export function recordLanding(state) {
    const mode = runningMode(state);
    if (!mode || mode.objective !== LAND_OBJECTIVE || state.landed || state.complete) return false;

    state.landed = true;
    return true;
}

/**
 * Reports a loop flown through. Only the gate the course is up to counts: the
 * objective is the course in order, so flying back through one already behind
 * you, or skipping ahead to one further on, is not progress.
 *
 * Returns true when it completed the stage.
 */
export function recordGate(state, index) {
    const mode = runningMode(state);
    if (!mode || mode.objective !== LOOP_OBJECTIVE || state.complete) return false;
    if (index !== state.gate) return false;

    state.gate += 1;
    return isStageComplete(state);
}

/** The gate the course is waiting on, or -1 once the stage is flown out. */
export function nextGate(state) {
    const { done, total } = stageProgress(state);
    return runningMode(state)?.objective === LOOP_OBJECTIVE && done < total ? done : -1;
}

/** Reports a crash to the run, which puts the stage back to its beginning. */
export function recordCrash(state) {
    if (!isRunning(state) || state.complete) return false;
    restartStage(state);
    return true;
}

// --- What the pilot is told ------------------------------------------------

export function runObjective(state) {
    return runningMode(state)?.goal ?? '';
}

/**
 * Where the run is up to, in one line, for the corner of the screen: the stage
 * out of the stages, and for a course the gate out of the gates.
 */
export function runStatus(state) {
    if (!isRunning(state)) return '';
    if (state.complete) return 'COURSE COMPLETE';

    const stage = `STAGE ${stageNumber(state)} OF ${stageCount(state)}`;
    const { done, total } = stageProgress(state);
    return total > 1 ? `${stage}  ·  LOOP ${Math.min(done + 1, total)} OF ${total}` : stage;
}

// --- The panel the modes are chosen from -----------------------------------

export const GAME_MODES_TITLE = 'GAME MODES';

// Free flight is listed as a mode rather than left as the absence of one,
// because a pilot who has started a mode needs somewhere to go to stop playing
// it, and "none of the above" is not a thing anyone looks for in a list.
export const FREE_FLIGHT_ID    = 'free-flight';
export const FREE_FLIGHT_LABEL = 'FREE FLIGHT';
export const FREE_FLIGHT_NOTE  = 'no objective - the world and the settings you chose';

export const GAME_MODES_BACK_ID    = 'back';
export const GAME_MODES_BACK_LABEL = 'BACK';

export const GAME_MODES_CLOSE_KEYS = ['Escape', 'Backspace'];

export function isGameModesCloseKey(code) {
    return GAME_MODES_CLOSE_KEYS.includes(code);
}

/** The panel's rows: free flight, every mode there is, then the way out. */
export function gameModeEntries(modes = GAME_MODES) {
    return [
        { id: FREE_FLIGHT_ID, label: FREE_FLIGHT_LABEL, note: FREE_FLIGHT_NOTE, current: false },
        ...modes.map(mode => ({
            id: mode.id,
            label: mode.label,
            note: mode.description,
            current: false
        })),
        { id: GAME_MODES_BACK_ID, label: GAME_MODES_BACK_LABEL, note: '', current: false }
    ];
}

/** Marks the row for whatever is being played, so a reopened panel shows it. */
export function syncGameModeEntries(entries, state) {
    const playing = state?.modeId ?? FREE_FLIGHT_ID;
    for (const entry of entries) entry.current = entry.id === playing;
    return entries;
}

// --- The world a stage is flown over ---------------------------------------

/**
 * How to build the stage's world: which environment, what to change about the
 * ground it is drawn on, and whether it carries a strip.
 *
 * The seed moves with the stage, so the same mode played twice is the same
 * course in the same order and two stages of it are not the same world twice.
 */
export function stageWorld(state) {
    const mode  = runningMode(state);
    const stage = currentStage(state);
    if (!mode || !stage) return null;

    return {
        environment: mode.environment,
        seed: stageSeed(mode.seed, state.stageIndex),
        base: stage.base ?? null,
        runway: mode.objective === LAND_OBJECTIVE ? (stage.runway ?? true) : false
    };
}

/**
 * A stage's own seed. The stage number is mixed into the mode's rather than
 * added to it, because the generator's stream is a shift register: two seeds a
 * few apart open with values a few apart, and a course laid from one would run
 * off in much the same direction as a course laid from the next.
 */
export function stageSeed(seed, stageIndex) {
    return ((seed ^ Math.imul(stageIndex + 1, 0x9e3779b1)) >>> 0) || 1;
}

/**
 * The condition the stage opens in, as a start state and a place to open it at.
 *
 * Every stage opens in flight, whatever it is about, because a mode that began
 * with a takeoff would be a mode that began with the part nobody is being
 * scored on. Readings are snapped to the steps the start fields are declared
 * with, so a stage asks for a start the configuration can actually hold.
 */
export function stageStart(state, world = {}) {
    const mode  = runningMode(state);
    const stage = currentStage(state);
    if (!mode || !stage) return null;

    const opening = mode.objective === LAND_OBJECTIVE
        ? approachOpening(stage, world.runway)
        : courseOpening(stage, world.rings);

    // An opening stands where its bearing and its distance put it, however far
    // out that is. The ground is an endless grid of tiles rather than one
    // square with an outside, so a stage that opens past the edge of the tile
    // its objective was laid in opens over ground like any other; there is no
    // edge left to be carried back from. Carrying it back is what would break
    // the stage - the aircraft would open on the far side of the objective, at
    // a bearing and a distance nothing asked for.
    return {
        start: {
            ...startDefaults(),
            startMode: START_FLYING,
            runway: mode.objective === LAND_OBJECTIVE,
            airspeedKnots:    snapStartValue('airspeedKnots', opening.airspeedKnots),
            altitudeFeet:     snapStartValue('altitudeFeet', opening.altitudeFeet),
            verticalSpeedFpm: snapStartValue('verticalSpeedFpm', 0),
            headingDegrees:   snapStartValue('headingDegrees', wrapDegrees(opening.headingDegrees)),
            throttlePercent:  snapStartValue('throttlePercent', opening.throttlePercent)
        },
        position: { x: opening.x, z: opening.z }
    };
}

// The airspeed and lever setting a stage opens on: enough to be flying and
// little enough to be slowed down from, which is the condition every one of
// these objectives is flown out of.
const OPENING_KNOTS    = 105;
const OPENING_THROTTLE = 55;

/**
 * Where a landing stage opens: out on a bearing from the strip, at a height,
 * pointing however far off the line back to it the stage asks for. Stage one
 * puts it on the nose; the last puts it behind the shoulder.
 */
function approachOpening(stage, runway) {
    const { distance, bearing, heading, altitudeFeet } = stage.approach;

    if (!runway) {
        return { x: 0, z: 0, headingDegrees: 0, altitudeFeet, airspeedKnots: OPENING_KNOTS, throttlePercent: OPENING_THROTTLE };
    }

    // Landing runs down the strip's own bearing, so the approach lies out on
    // the reciprocal of it, turned by however far off the extended centreline
    // the stage puts the aircraft.
    const [threshold] = runwayThresholds(runway);
    const from = wrapDegrees(threshold.heading + 180 + bearing);
    const out  = bearingDirection(from);

    return {
        x: runway.x + out.x * distance,
        z: runway.z + out.z * distance,
        headingDegrees: wrapDegrees(from + 180 + heading),
        altitudeFeet,
        airspeedKnots: OPENING_KNOTS,
        throttlePercent: OPENING_THROTTLE
    };
}

/** Where a course opens: back down the line of the first loop, lined up on it. */
function courseOpening(stage, rings) {
    const first = rings?.[0];
    const altitudeField = startField('altitudeFeet');

    if (!first) {
        return { x: 0, z: 0, headingDegrees: 0, altitudeFeet: altitudeField.default,
                 airspeedKnots: OPENING_KNOTS, throttlePercent: OPENING_THROTTLE };
    }

    const run = stage.rings.spacing;

    return {
        x: first.x - first.dirX * run,
        z: first.z - first.dirZ * run,
        headingDegrees: Math.atan2(first.dirX, first.dirZ) / RADIANS,
        // The opening height is read off the first loop rather than configured,
        // so the aircraft arrives at the height the course was laid at.
        altitudeFeet: first.y * FEET_PER_UNIT,
        airspeedKnots: OPENING_KNOTS,
        throttlePercent: OPENING_THROTTLE
    };
}

// --- The course ------------------------------------------------------------

// How far a loop is held above the ground under it, as a multiple of its own
// radius: enough that the bottom of the gate is flyable rather than buried.
const RING_CLEARANCE = 1.8;

// How much of the world a course is laid inside, as a fraction of the half
// width, so a gate is never put out where the ground has run out.
const COURSE_REACH = 0.82;

/**
 * Lays out a stage's loops.
 *
 * The course is walked rather than scattered: each gate is a run on from the
 * last, on a bearing that drifts by the stage's own amount and is pulled back
 * toward the middle of the world as the course reaches the edge of it. That is
 * what makes a course a line to fly rather than a set of places to visit.
 *
 * Every gate faces the way the course runs through it, and sits at least its own
 * radius and a half over the ground beneath, so there is always a line through.
 */
export function buildCourse(stage, options = {}) {
    const plan = stage?.rings;
    if (!plan) return [];

    const random = options.random ?? createRandom(options.seed ?? 1);
    const sample = options.sampleHeight ?? (() => 0);
    const reach  = (options.size ?? DEFAULT_SIZE) / 2 * COURSE_REACH;

    // The course opens on the far side of the world from wherever it is headed,
    // so a short course has as much room to run as a long one.
    let heading = random() * Math.PI * 2;
    let x = -Math.sin(heading) * reach * 0.7;
    let z = -Math.cos(heading) * reach * 0.7;

    const rings = [];
    for (let index = 0; index < plan.count; index++) {
        const drift = (random() * 2 - 1) * plan.spread * plan.altitude;
        const ground = sample(x, z);

        rings.push({
            index,
            x,
            z,
            y: Math.max(ground + plan.radius * RING_CLEARANCE, plan.altitude + drift),
            radius: plan.radius,
            dirX: Math.sin(heading),
            dirZ: Math.cos(heading)
        });

        // Steer on: a wander of the stage's own width, pulled back toward the
        // middle by however far out toward the edge the course has run.
        const out  = Math.hypot(x, z) / reach;
        const home = Math.atan2(-x, -z);
        heading = blendBearing(heading + (random() * 2 - 1) * plan.turn, home, (out - 0.55) / 0.45);

        x += Math.sin(heading) * plan.spacing;
        z += Math.cos(heading) * plan.spacing;
    }

    return rings;
}

/** How far in front of or behind a gate a point lies, along the way it faces. */
export function gateOffset(ring, point) {
    return (point.x - ring.x) * ring.dirX + (point.z - ring.z) * ring.dirZ;
}

/**
 * True when a step of the flight went through a gate.
 *
 * The step is a segment rather than a point, because a gate is thinner than the
 * distance an aircraft covers in a frame and a point test would fly straight
 * through one without noticing. Where the segment crosses the gate's plane is
 * worked out first, and the gate is passed when that crossing lands inside the
 * hoop. Either direction counts: a loop is a loop from both sides.
 */
export function gatePassed(ring, from, to) {
    if (!ring) return false;

    const before = gateOffset(ring, from);
    const after  = gateOffset(ring, to);
    if ((before > 0) === (after > 0)) return false;

    const t  = before / (before - after);
    const dx = from.x + (to.x - from.x) * t - ring.x;
    const dy = from.y + (to.y - from.y) * t - ring.y;
    const dz = from.z + (to.z - from.z) * t - ring.z;

    return Math.sqrt(dx * dx + dy * dy + dz * dz) <= ring.radius;
}

function clamp(value, low, high) {
    return Math.min(Math.max(value, low), high);
}
