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
 * against the opening it was laid as, and the run state is a plain object, so
 * every rule here can be unit tested in Node and drawn by whatever renderer is
 * in front of it.
 */

import { createRandom, runwayThresholds, DEFAULT_SIZE } from './environment/elements.js';
import {
    OPEN_COUNTRY_ID, LOOP_VALLEY_ID, BACK_COUNTRY_ID,
    getEnvironment, environmentElements
} from './environment/presets.js';
import {
    START_FLYING, startDefaults, snapStartValue, startField
} from './config.js';
import {
    FEET_PER_UNIT, KNOTS_PER_UNIT,
    bearingToDirection as bearingDirection, directionToBearing
} from './units.js';
import { GLIDE_SPEED } from './flight-model.js';

export const RUNWAY_LANDING = 'runway-landing';
export const LOOP_COURSE    = 'loop-course';
export const DEAD_STICK     = 'dead-stick';
export const CARGO_RUN      = 'cargo-run';
export const SEARCH_RESCUE  = 'search-rescue';

// What a stage asks for. A landing is one thing done once; a course is a count
// of gates flown in the order they were laid; a cargo run is a count of strips
// landed at in the order they were laid; a search is a marker found and set
// down beside.
export const LAND_OBJECTIVE   = 'landing';
export const LOOP_OBJECTIVE   = 'loops';
export const CARGO_OBJECTIVE  = 'cargo';
export const SEARCH_OBJECTIVE = 'search';

/**
 * Whether there is an engine pulling. A mode may take it away at the start, as
 * a dead stick does, or a run may lose it partway down a leg by spending the
 * last of its budget - and the aircraft flies the same way in both cases,
 * which is why the two arrive at one answer here rather than at two flags.
 */
export const ENGINE_LIVE = 'live';
export const ENGINE_DEAD = 'dead';

/**
 * A bearing as the direction over the ground it names, and the reverse.
 *
 * Both are `js/units.js`, which owns the one compass frame the simulator has,
 * the same module `headingToYaw` is in. They are re-exported here under the
 * names the modes have always called them by rather than reimplemented: a
 * bearing written out a second time is a bearing written out in the mirror of
 * the frame the aircraft flies in, which is the whole of what went wrong when
 * these two lived here.
 */
export { bearingDirection, directionToBearing };

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
 *
 * The help goes as the ground gets harder. A lead-in out along the approach and
 * a bar across the threshold on the first stage, the bar alone on the second,
 * and by the last nothing at all: the strip is where the pilot works out it is.
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
            approach: { distance: 2400, bearing: 8, heading: 0, altitudeFeet: 1000 },
            guidance: { centreline: true, threshold: true }
        },
        {
            label: 'DOWNWIND',
            note: 'the strip off your wing, and the ground beginning to rise',
            base: { maxHeight: 300, scale: 2.4 },
            runway: { length: [2600, 3000], width: [260, 300] },
            approach: { distance: 5200, bearing: 75, heading: 55, altitudeFeet: 2000 },
            guidance: { centreline: false, threshold: true }
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
 * closer together, further off the level, and further off the horizontal as the
 * stages go on, so what is being asked for moves from flying at a target to
 * flying a line through several of them in the attitude each one was laid at.
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
            rings: { count: 3, radius: 240, spacing: 2600, altitude: 900, spread: 0.10, turn: 0.20,
                     aspect: 1, bank: 0 }
        },
        {
            label: 'FIVE GATES',
            note: 'the course starts to bend, and the loops lean off the level',
            rings: { count: 5, radius: 200, spacing: 2300, altitude: 950, spread: 0.20, turn: 0.35,
                     aspect: 0.80, bank: 0.40 }
        },
        {
            label: 'SEVEN GATES',
            note: 'tighter loops, less run between them, and a course that turns',
            rings: { count: 7, radius: 165, spacing: 2000, altitude: 1000, spread: 0.30, turn: 0.50,
                     aspect: 0.66, bank: 0.70 }
        },
        {
            label: 'NINE GATES',
            note: 'a course flown as one line rather than nine approaches',
            rings: { count: 9, radius: 135, spacing: 1750, altitude: 1050, spread: 0.42, turn: 0.65,
                     aspect: 0.55, bank: 1.00 }
        }
    ]
};

/**
 * A landing with nothing to go around on. The engine quits before the pilot
 * ever has it, the lever is dead for the whole flight, and the strip is far
 * enough off that reaching it is a glide to be planned rather than a descent to
 * be flown.
 *
 * The height comes down and the distance goes up as the stages go on, so what
 * is being asked for moves from a glide that is comfortably inside the aircraft
 * to one that is only inside it if the nose is held where the glide is best.
 * Level is roughly twelve to one and a little nose-up is better than that -
 * finding it is the mode.
 *
 * The help goes the way it goes in a powered landing, for the same reason, and
 * it goes sooner: a pilot with one approach in hand is being asked to read the
 * ground, not to be told where it is.
 */
const deadStick = {
    id: DEAD_STICK,
    label: 'DEAD STICK',
    description: 'The engine is out - glide to the strip and put it down',
    objective: LAND_OBJECTIVE,
    engine: ENGINE_DEAD,
    goal: 'GLIDE TO THE RUNWAY',
    environment: OPEN_COUNTRY_ID,
    seed: 27644437,
    stages: [
        {
            label: 'HIGH KEY',
            note: 'the strip ahead and well below, with height in hand',
            base: { maxHeight: 200, scale: 2.0 },
            runway: { length: [3000, 3400], width: [300, 340] },
            approach: { distance: 8000, bearing: 6, heading: 0, altitudeFeet: 4200 },
            guidance: { centreline: true, threshold: true }
        },
        {
            label: 'OFF THE LINE',
            note: 'the strip off to one side, so the turn is part of the glide',
            base: { maxHeight: 300, scale: 2.6 },
            runway: { length: [2600, 3000], width: [260, 300] },
            approach: { distance: 10000, bearing: 40, heading: 30, altitudeFeet: 4000 },
            guidance: { centreline: false, threshold: true }
        },
        {
            label: 'ABEAM',
            note: 'the strip off your wing and the height no longer generous',
            base: { maxHeight: 420, scale: 3.2 },
            runway: { length: [2200, 2600], width: [240, 280] },
            approach: { distance: 11500, bearing: 95, heading: 80, altitudeFeet: 3600 }
        },
        {
            label: 'BEHIND YOU',
            note: 'a short strip over your shoulder, at the end of the glide you have',
            base: { maxHeight: 560, scale: 4.0 },
            runway: { length: [1800, 2200], width: [220, 260] },
            approach: { distance: 12500, bearing: 150, heading: 150, altitudeFeet: 3200 }
        }
    ]
};

/**
 * Landings strung together into a route. Land at one strip, then at the next,
 * against a budget that only spends while the engine is open - so the way the
 * route is flown counts for as much as the arrivals at the end of it, and a
 * long glide with the lever closed is worth more than a fast run with it open.
 *
 * Running the budget out does not end the stage. It takes the engine, and the
 * rest of the route is flown as a dead stick, which is either the end of it or
 * the best landing the pilot ever makes.
 *
 * `strips` is how many strips the world carries and how many have to be landed
 * at, in the order they were laid; `separation` is how far apart they stand, so
 * a later stage is a longer route rather than a busier field.
 */
const cargoRun = {
    id: CARGO_RUN,
    label: 'CARGO RUN',
    description: 'Land at each strip in turn on the fuel the run is given',
    objective: CARGO_OBJECTIVE,
    goal: 'LAND AT EVERY STRIP',
    environment: OPEN_COUNTRY_ID,
    seed: 16777619,
    stages: [
        {
            label: 'SHORT HAUL',
            note: 'two strips, close together, and more fuel than the run needs',
            base: { maxHeight: 200, scale: 2.0 },
            strips: 2,
            separation: 6000,
            budget: 130,
            runway: { length: [2800, 3200], width: [280, 320] },
            approach: { distance: 3000, bearing: 8, heading: 0, altitudeFeet: 1400 },
            guidance: { centreline: true, threshold: true }
        },
        {
            label: 'LONG HAUL',
            note: 'the same two strips further apart, on a budget that notices',
            base: { maxHeight: 300, scale: 2.6 },
            strips: 2,
            separation: 9500,
            budget: 120,
            runway: { length: [2400, 2800], width: [260, 300] },
            approach: { distance: 3400, bearing: 20, heading: 15, altitudeFeet: 1600 },
            guidance: { centreline: false, threshold: true }
        },
        {
            label: 'THREE STOPS',
            note: 'three strips in broken country, and fuel for about two of them',
            base: { maxHeight: 460, scale: 3.4 },
            strips: 3,
            separation: 6500,
            budget: 160,
            runway: { length: [2000, 2400], width: [240, 280] },
            approach: { distance: 3800, bearing: 35, heading: 30, altitudeFeet: 1900 }
        }
    ]
};

/**
 * A marker put down somewhere in country with no strip in it, and a bearing and
 * a distance from the start to find it by. That briefing is the whole of what
 * the pilot is given: it is read off the start rather than off the aircraft, so
 * it does not follow them round as they fly, and nothing points at the marker
 * once they have left the line they were given.
 *
 * Then get down beside it, on whatever flat ground is there - the mode is over
 * the one world with nothing prepared to arrive on, because a search that ended
 * at a runway would be a search with the answer written on it.
 */
const searchRescue = {
    id: SEARCH_RESCUE,
    label: 'SEARCH AND RESCUE',
    description: 'Find the marker on the bearing given, and set down beside it',
    objective: SEARCH_OBJECTIVE,
    goal: 'SET DOWN BESIDE THE MARKER',
    environment: BACK_COUNTRY_ID,
    seed: 43112609,
    stages: [
        {
            label: 'CLOSE IN',
            note: 'a short leg out, and room either side of the marker to land',
            base: { maxHeight: 320, scale: 2.6 },
            search: { bearing: 45, distance: 3600, heading: 45, altitudeFeet: 2400, radius: 420 }
        },
        {
            label: 'OUT A WAY',
            note: 'further out, off the heading you open on, and a tighter circle',
            base: { maxHeight: 420, scale: 3.0 },
            search: { bearing: 128, distance: 5200, heading: 95, altitudeFeet: 2800, radius: 330 }
        },
        {
            label: 'LONG LEG',
            note: 'the far side of the country, and the marker small when you get there',
            base: { maxHeight: 540, scale: 3.6 },
            search: { bearing: 287, distance: 6800, heading: 320, altitudeFeet: 3200, radius: 260 }
        }
    ]
};

export const GAME_MODES = [runwayLanding, loopCourse, deadStick, cargoRun, searchRescue];

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
    const state = {
        modeId: null, stageIndex: 0, gate: 0, missed: 0,
        elapsed: 0, landed: false, complete: false,
        // The strips of a route already landed at, the budget left to spend on
        // the rest of it, and whether the marker has been reached. All three
        // are carried by every run rather than only by the runs that use them,
        // for the reason free flight is a run of nothing: everything reading a
        // run reads one shape.
        leg: 0, fuel: 0, found: false
    };
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

/**
 * Puts the stage back to its beginning, for a crash or a fresh attempt. The
 * clock goes back with it: a stage flown twice is timed as the attempt that
 * finished it rather than as everything the pilot did on the way there.
 */
export function restartStage(state) {
    state.gate = 0;
    state.missed = 0;
    state.elapsed = 0;
    state.landed = false;
    state.leg = 0;
    state.found = false;

    // The budget goes back with the stage, which is what makes a run out of
    // fuel something to fly again rather than something to sit in.
    state.fuel = stageBudget(state);
    return state;
}

/** The fuel a stage is given, in seconds of a wide open throttle. */
export function stageBudget(state) {
    const budget = currentStage(state)?.budget;
    return Number.isFinite(budget) && budget > 0 ? budget : 0;
}

/** How many strips a cargo stage lays down, which is how many it asks for. */
export function stageStrips(state) {
    const strips = currentStage(state)?.strips;
    return Number.isFinite(strips) && strips > 0 ? Math.round(strips) : 0;
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

    if (mode.objective === CARGO_OBJECTIVE) {
        return { done: state.leg, total: stageStrips(state) };
    }

    if (mode.objective === SEARCH_OBJECTIVE) {
        return { done: state.found ? 1 : 0, total: 1 };
    }

    return { done: state.landed ? 1 : 0, total: 1 };
}

/**
 * What the thing being counted off is called, for the one line the run is
 * reported in. A course counts loops and a route counts legs; everything else
 * counts one thing once and never reaches the plural.
 */
export function progressNoun(state) {
    return runningMode(state)?.objective === CARGO_OBJECTIVE ? 'LEG' : 'LOOP';
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
 * Reports a landing to the run, and the strip it was made on where the run
 * cares which one. Returns true when the landing counted for something, which
 * is the caller's cue to score it; whether it also finished the stage is
 * `isStageComplete`, because a route is several landings and only the last of
 * them ends anything.
 *
 * A route counts only the strip it is up to, exactly as a course counts only
 * the gate it is waiting on and for the same reason: the objective is the order
 * as much as the arrivals, so going back to one already behind you, or skipping
 * ahead to one further on, is somewhere to be rather than progress.
 */
export function recordLanding(state, runway = null) {
    const mode = runningMode(state);
    if (!mode || state.complete) return false;

    if (mode.objective === CARGO_OBJECTIVE) {
        // The strip is read first and refused on its own, because a route
        // already flown out is waiting on nothing and answers -1 as well: the
        // two read as one would count an arrival on open ground as a leg.
        const strip = stripIndex(runway);
        if (strip < 0 || nextStrip(state) !== strip) return false;
        state.leg += 1;
        return true;
    }

    if (mode.objective !== LAND_OBJECTIVE || state.landed) return false;

    state.landed = true;
    return true;
}

/** The strip a route is up to, or -1 once the route is flown out. */
export function nextStrip(state) {
    const { done, total } = stageProgress(state);
    return runningMode(state)?.objective === CARGO_OBJECTIVE && done < total ? done : -1;
}

/**
 * Which strip of a world a strip is, as the generator numbered them. A landing
 * reported with no strip under it - an arrival on open ground - answers to no
 * number, which is what keeps it from counting toward a route.
 */
export function stripIndex(runway) {
    const index = runway?.index;
    return Number.isInteger(index) ? index : -1;
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

/**
 * Reports a loop gone past rather than flown through. Only the gate the course
 * is waiting on can be missed, for the same reason only it can be flown: a
 * course is an order, and a gate further down it is not the pilot's business
 * yet.
 *
 * Nothing about the run moves. The gate stays the one the course is waiting
 * on, which is what lets it be flown again; what the miss buys is that the
 * pilot is told, rather than left circling a course that has quietly stopped
 * counting.
 *
 * Returns true when the miss was the outstanding gate's.
 */
export function recordMiss(state, index) {
    const mode = runningMode(state);
    if (!mode || mode.objective !== LOOP_OBJECTIVE || state.complete) return false;
    if (index !== state.gate) return false;

    state.missed += 1;
    return true;
}

/**
 * The step the aircraft just flew, put to the gate the course is waiting on.
 *
 * A step rather than a position, because a gate is thinner than the distance an
 * aircraft covers in a frame. Everything a step can do to a run is decided
 * here rather than half here and half in the caller, which is what lets a stage
 * be flown out with no flight model anywhere near it: hand this the two ends of
 * a line through a gate and the course moves on exactly as it does under a
 * pilot.
 *
 * Returns what became of the step: the gate it was put to, whether it went
 * through that gate or past it, and whether going through it was the last gate
 * the stage was waiting on.
 */
export function flyStep(state, course, from, to) {
    const gate = nextGate(state);
    const nothing = { gate, passed: false, missed: false, finished: false };
    if (gate < 0 || !from || !to) return nothing;

    const ring = course?.[gate];

    if (gatePassed(ring, from, to)) {
        return { gate, passed: true, missed: false, finished: recordGate(state, gate) };
    }

    if (gateMissed(ring, from, to)) {
        return { gate, passed: false, missed: recordMiss(state, gate), finished: false };
    }

    return nothing;
}

/** The gate the course is waiting on, or -1 once the stage is flown out. */
export function nextGate(state) {
    const { done, total } = stageProgress(state);
    return runningMode(state)?.objective === LOOP_OBJECTIVE && done < total ? done : -1;
}

/**
 * Runs the stage clock on by a frame. A stage is timed from the moment it is
 * laid out to the moment it is finished, so the beat a completed stage is held
 * on screen for is not part of the time it took, and neither is a finished run
 * left sitting on its last stage.
 *
 * Returns the time on the clock.
 */
export function tickRun(state, dt = 0) {
    if (!isRunning(state) || state.complete || isStageComplete(state)) return state.elapsed;

    state.elapsed += Math.max(0, dt);
    return state.elapsed;
}

// --- The engine, and what is left to run it on -----------------------------

/**
 * Whether the run has an engine pulling.
 *
 * Two ways to have none and one answer to both: a mode that took it away
 * before the pilot ever had it, and a route that has spent the last of its
 * budget. The aircraft flies identically in either case - the lever is dead and
 * the nose has the airspeed - so the reason belongs here rather than in the
 * flying.
 *
 * Free flight always has one. Nothing outside a mode has a budget to run out
 * of, and nothing outside a mode should be able to lose an engine by accident.
 */
export function runEngine(state) {
    const mode = runningMode(state);
    if (!mode) return ENGINE_LIVE;
    if (mode.engine === ENGINE_DEAD) return ENGINE_DEAD;
    if (mode.objective === CARGO_OBJECTIVE && stageBudget(state) > 0 && state.fuel <= 0) {
        return ENGINE_DEAD;
    }
    return ENGINE_LIVE;
}

export function engineLive(state) {
    return runEngine(state) === ENGINE_LIVE;
}

/**
 * Spends a frame of the budget, and returns what is left of it.
 *
 * Only an open throttle spends: the burn is the lever setting itself, so a wide
 * open throttle costs a second of budget per second and a closed one costs
 * nothing at all. That is the whole of what makes the route worth planning -
 * height traded for a glide is fuel not spent, and a run flown that way reaches
 * a strip the same budget flown flat out does not.
 *
 * A stage already flown out stops spending, so the beat it is held on screen
 * for is not charged to it.
 */
export function burnFuel(state, throttle = 0, dt = 0) {
    const mode = runningMode(state);
    if (!mode || mode.objective !== CARGO_OBJECTIVE) return state.fuel;
    if (state.complete || isStageComplete(state)) return state.fuel;

    const open = clamp(Number(throttle) || 0, 0, 1);
    state.fuel = Math.max(0, state.fuel - open * Math.max(0, Number(dt) || 0));
    return state.fuel;
}

/**
 * How much of the budget is left, from 1 at the start of a stage to 0 with the
 * engine gone. Null where there is no budget to read, which is every run but a
 * route, and is what leaves the instruments with nothing to write.
 */
export function fuelRemaining(state) {
    const budget = stageBudget(state);
    return budget > 0 ? clamp(state.fuel / budget, 0, 1) : null;
}

// --- The marker a search is flown to --------------------------------------

/**
 * Where the marker is, and how close beside it counts as beside it.
 *
 * Read off the stage rather than scattered by the generator, because the
 * bearing and the distance are the whole of the briefing: a marker put down
 * somewhere random would be a marker nobody could be told how to find. The
 * search opens at the middle of the world, so the bearing and the distance from
 * there are the bearing and the distance from the start.
 */
export function stageMarker(state) {
    const mode  = runningMode(state);
    const stage = currentStage(state);
    if (!mode || mode.objective !== SEARCH_OBJECTIVE || !stage?.search) return null;

    const { bearing, distance, radius = RESCUE_RADIUS } = stage.search;
    const out = bearingDirection(bearing);

    return { x: out.x * distance, z: out.z * distance, bearing, distance, radius };
}

/** How close beside a marker counts, for a stage that names no circle of its own. */
export const RESCUE_RADIUS = 340;

/**
 * How slow counts as down rather than still rolling, in world units per second.
 * A set-down is the aircraft stopped beside the marker, and a rollout through
 * the circle at flying speed is a pass over it.
 */
export const RESCUE_STOP_SPEED = 6;

/**
 * Reports where the aircraft has come to rest to a search. Returns true when
 * that was the rescue, which finishes the stage.
 *
 * Four things at once, and all four have to hold on the same frame: there is a
 * marker outstanding, the aircraft is on the ground, it has stopped, and it is
 * inside the circle. The aircraft being intact is the fifth - a wreck beside the
 * marker is not a rescue, and the crash puts the stage back to its beginning
 * before this is ever reached.
 */
export function recordRescue(state, marker, report = {}) {
    const mode = runningMode(state);
    if (!mode || mode.objective !== SEARCH_OBJECTIVE || state.complete || state.found) return false;
    if (!marker || report.airborne !== false || report.crashed === true) return false;
    if (Math.abs(Number(report.speed) || 0) > RESCUE_STOP_SPEED) return false;

    // Where it came to rest, which is the one reading with no sensible stand-in
    // for a report that does not carry it: a missing place measures NaN, and
    // NaN is not greater than the radius, so a report of nowhere would pass the
    // circle it was never inside.
    const x = Number(report.x), z = Number(report.z);
    if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
    if (Math.hypot(x - marker.x, z - marker.z) > marker.radius) return false;

    state.found = true;
    return true;
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
    return total > 1
        ? `${stage}  ·  ${progressNoun(state)} ${Math.min(done + 1, total)} OF ${total}`
        : stage;
}

/**
 * What a missed gate is reported as: which loop went by, and that the course
 * is still waiting on it. The second half is the part that matters - a pilot
 * told only that they missed has been told the course is over, which it is
 * not.
 *
 * It is written into the objective row of the card, which is the row it is
 * longest in: the goals it stands in for run to 22 characters and this ran to
 * 34, six past the two lines that row is declared at on a card at its 260
 * pixel minimum. `COME ROUND` says the same thing as `COME ROUND AGAIN` in a
 * line the row it is written in can hold.
 */
export function missNotice(state) {
    const gate = nextGate(state);
    return gate < 0 ? '' : `LOOP ${gate + 1} MISSED  ·  COME ROUND`;
}

// --- Where the gate is -----------------------------------------------------

/**
 * The compass bearing from a place in the world to a gate, on the same card
 * the heading readout is written on, so a bearing on the objective card and a
 * heading on the instruments are the same number when the nose is on the gate.
 */
export function gateBearing(ring, position) {
    return directionToBearing(ring.x - position.x, ring.z - position.z);
}

/** How far a gate is over the ground, which is the distance there is to fly. */
export function gateDistance(ring, position) {
    return Math.hypot(ring.x - position.x, ring.z - position.z);
}

/**
 * A bearing as degrees off the nose, negative to the left and positive to the
 * right, so a pilot reads which way to turn rather than working it out from
 * two compass numbers.
 */
export function relativeBearing(bearing, heading) {
    // Folded in degrees rather than through radians and back: two bearings a
    // whole number of degrees apart are a whole number of degrees apart, and a
    // round trip through radians would hand back that number with a tail on it.
    const off = wrapDegrees(bearing - heading);
    return off > 180 ? off - 360 : off;
}

/**
 * The arrows a relative bearing is drawn as, clockwise from the nose. The same
 * eight points the compass readout names, pointed at rather than named,
 * because what the pilot wants off a pointer is a direction rather than a word
 * to convert into one.
 */
export const GATE_ARROWS = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];

export function gateArrow(relative) {
    const slice = 360 / GATE_ARROWS.length;
    return GATE_ARROWS[Math.round(wrapDegrees(relative) / slice) % GATE_ARROWS.length];
}

/**
 * How far off the nose a gate can be and still be on the screen, in degrees
 * either side of it.
 *
 * Half the camera's vertical field of view, which is the narrow way across the
 * frame: a window is wider than it is tall, so a gate inside this is in frame
 * whatever shape the window has been dragged into. The pointer would rather
 * come up while the gate is still just visible than stay off while it is
 * already gone.
 */
export const GATE_IN_VIEW = 35;

export function gateInView(relative, halfAngle = GATE_IN_VIEW) {
    return Math.abs(relative) <= halfAngle;
}

/**
 * Where the gate the course is waiting on lies, for a pilot who cannot see it:
 * which loop it is, the bearing to it, how far that is off the nose, and how
 * far away it is.
 *
 * Null when there is no gate outstanding, and null while the gate is in front
 * of the aircraft - a gate on the screen is already pointing at itself, and a
 * readout that never goes away is a readout nobody reads.
 */
export function gatePointer(state, course, position, heading) {
    const index = nextGate(state);
    const ring  = index >= 0 ? course?.[index] : null;
    if (!ring) return null;

    const bearing  = gateBearing(ring, position);
    const relative = relativeBearing(bearing, heading);
    if (gateInView(relative)) return null;

    return {
        index,
        bearing,
        relative,
        arrow: gateArrow(relative),
        distance: gateDistance(ring, position)
    };
}

/**
 * Where the thing the run is waiting on lies, for a pilot who cannot see it -
 * whichever thing that is. One line for every mode, because the pilot reads one
 * row, and the differences between the modes are differences about what goes in
 * it rather than about how many rows there are.
 *
 * A gate is suppressed while it is in front of the aircraft, because a gate on
 * the screen is a bright hoop already pointing at itself. A strip is not: it is
 * a grey mark on grey country, several miles off, and a pilot looking straight
 * at one has no way of knowing it. So a route's pointer stays up.
 *
 * A search gets no pointer at all. What it gets is its briefing, which is the
 * bearing and the distance from the start and never moves - a needle swinging
 * round to the marker would be the mode answering its own question.
 */
export function runPointer(state, world = {}, position, heading) {
    const mode = runningMode(state);
    if (!mode || !position) return null;

    if (mode.objective === LOOP_OBJECTIVE) {
        const pointer = gatePointer(state, world.course, position, heading);
        return pointer ? { ...pointer, label: `LOOP ${pointer.index + 1}` } : null;
    }

    if (mode.objective === CARGO_OBJECTIVE) return stripPointer(state, world.runways, position, heading);
    if (mode.objective === SEARCH_OBJECTIVE) return searchBriefing(state);

    return null;
}

/**
 * The strip a route is up to: which one it is, where it lies, and how far off
 * the nose that is. Null once the route is flown out, and null for a strip the
 * world has not laid - a stage asking for three strips over ground that could
 * only take two points at the two it has rather than at nothing.
 */
export function stripPointer(state, runways, position, heading) {
    const index = nextStrip(state);
    const strip = index >= 0 ? runways?.[index] : null;
    if (!strip) return null;

    const bearing  = gateBearing(strip, position);
    const relative = relativeBearing(bearing, heading);

    return {
        index,
        // Named for the leg rather than for the strip, which is the same thing
        // said in the word the status row is already counting in - and said in
        // the room the row has. The row is measured at thirty characters and a
        // pointer at its widest fills them; `STRIP 3` would be one past.
        label: `LEG ${index + 1}`,
        bearing,
        relative,
        arrow: gateArrow(relative),
        distance: gateDistance(strip, position)
    };
}

/**
 * The one thing a search is given: a bearing and a distance, from the start
 * rather than from the aircraft.
 *
 * It carries no arrow, because there is nothing to point at - the pilot flies
 * the bearing they were given and finds what is at the end of it. Null once the
 * marker is found, which is the row going away the moment it has nothing left
 * to say.
 */
export function searchBriefing(state) {
    const marker = stageMarker(state);
    if (!marker || state.found) return null;

    return {
        index: 0,
        // One word, for the room: with no arrow in front of it the line still
        // has to fit the row, and `MARKER ON` would be a character past it.
        // What the bearing is for is plain from the row it is written in.
        label: 'MARKER',
        bearing: marker.bearing,
        relative: 0,
        arrow: '',
        distance: marker.distance
    };
}

/**
 * The marks the chart in the corner draws for a run: where the things it is
 * flying to lie, in the order they are flown. A course's gates and a route's
 * strips carry the number the run counts them by; a search's one marker is
 * counted by nothing, so it carries no number and a chart reads it by its place
 * in the list, which is what `coursePoints` falls back to.
 *
 * The card's pointer row is the same answer in words, and the two are built
 * side by side here so they cannot drift apart. That matters beyond tidiness:
 * a short screen takes the row off and gives the chart as the reason, so a mode
 * whose objective the chart never drew lost its bearing altogether.
 *
 * A course is its gates, a route is the strips it lands at, and a search is the
 * one marker it is looking for. Everything else draws nothing - a landing has
 * its strip under the nose and a free flight has no objective at all, so
 * neither has a bearing the chart is keeping from the pilot.
 */
export function chartCourse(state, world = {}) {
    const mode = runningMode(state);
    if (!mode) return [];

    if (mode.objective === LOOP_OBJECTIVE) return world.course ?? [];

    // Sliced to the strips the stage asks for rather than to the strips the
    // world carries, and never reordered: `nextStrip` counts legs flown, so the
    // mark it points at is found by position in this list.
    if (mode.objective === CARGO_OBJECTIVE) return (world.runways ?? []).slice(0, stageStrips(state));

    if (mode.objective === SEARCH_OBJECTIVE) {
        const marker = stageMarker(state);
        return marker ? [marker] : [];
    }

    return [];
}

/**
 * Which of those marks the run is waiting on, so the chart lights the same one
 * the card is naming. -1 is nothing outstanding, which draws every mark as
 * flown.
 *
 * A search is the one mode that counts nothing: it has a single marker, so the
 * mark it is waiting on is that marker until it is found and nothing after.
 */
export function chartNext(state) {
    const mode = runningMode(state);
    if (!mode) return -1;

    if (mode.objective === LOOP_OBJECTIVE)   return nextGate(state);
    if (mode.objective === CARGO_OBJECTIVE)  return nextStrip(state);
    if (mode.objective === SEARCH_OBJECTIVE) return state.found ? -1 : 0;

    return -1;
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

    const strips = mode.objective === CARGO_OBJECTIVE ? stageStrips(state) : 0;

    return {
        environment: mode.environment,
        seed: stageSeed(mode.seed, state.stageIndex),
        base: stage.base ?? null,
        runway: landsOnStrips(mode) && strips === 0 ? (stage.runway ?? true) : false,
        // A route needs more strips than the one a world lays on its own, so it
        // describes the world outright rather than asking for a strip and being
        // given one. Every other mode leaves this alone and takes the ground the
        // preset describes, which is how it has always been laid.
        elements: strips > 0 ? routeElements(mode, stage, strips) : null
    };
}

/** True for a mode whose objective is arriving on a prepared strip. */
function landsOnStrips(mode) {
    return mode.objective === LAND_OBJECTIVE || mode.objective === CARGO_OBJECTIVE;
}

/**
 * The world a route is flown over: everything the preset describes, and then a
 * strip per stop.
 *
 * Each is laid with the stage's own stand-off, so the second strip is put down
 * clear of the first rather than wherever the flattest ground happened to be -
 * which, over open country chosen for being flat, is quite often the same
 * place. The first carries the stand-off too and is unaffected by it: there is
 * nothing laid yet for it to stand off from.
 */
function routeElements(mode, stage, strips) {
    const environment = getEnvironment(mode.environment);

    // Configured from the preset where it says something about the strip it
    // wants, and from the stage over the top of that - the same two layers
    // `environmentElements` puts a single strip together from, so a route's
    // strips are the world's strips rather than a second kind of strip.
    const config = {
        ...environment.runway,
        ...stage.runway,
        separation: stage.separation ?? 0
    };

    return [
        ...environmentElements(environment),
        ...Array.from({ length: strips }, () => ({ type: 'runway', config }))
    ];
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

    const opening = stageOpening(mode, stage, world);

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
            runway: landsOnStrips(mode),
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

// What a stage with no engine opens on instead: the speed a level glide settles
// at, and a lever that is already where a dead one is going to stay. Opening at
// the powered speed would spend the first seconds of the glide converging on
// this anyway, which is height spent on nothing.
const GLIDE_KNOTS = GLIDE_SPEED * KNOTS_PER_UNIT;

/**
 * Where a stage opens, by what it is asking for: out on the approach to the
 * first strip, back down the line of the first gate, or at the middle of the
 * world a search is briefed from.
 *
 * A stage with no engine opens gliding rather than under power, whatever its
 * objective, because a dead lever is dead from the first frame.
 */
function stageOpening(mode, stage, world) {
    const opening = openingFor(mode, stage, world);
    if (mode.engine !== ENGINE_DEAD) return opening;

    return { ...opening, airspeedKnots: GLIDE_KNOTS, throttlePercent: 0 };
}

function openingFor(mode, stage, world) {
    if (mode.objective === SEARCH_OBJECTIVE) return searchOpening(stage);
    if (landsOnStrips(mode)) return approachOpening(stage, world.runway);
    return courseOpening(stage, world.rings);
}

/**
 * Where a search opens: the middle of the world, pointing wherever the stage
 * puts the nose. The middle is not a decorative choice - the briefing is a
 * bearing and a distance from the start, so the start has to be the place the
 * marker was measured from, and `stageMarker` measures from the origin.
 */
function searchOpening(stage) {
    const { heading = 0, altitudeFeet = startField('altitudeFeet').default } = stage.search ?? {};

    return {
        x: 0,
        z: 0,
        headingDegrees: heading,
        altitudeFeet,
        airspeedKnots: OPENING_KNOTS,
        throttlePercent: OPENING_THROTTLE
    };
}

/**
 * The end of the strip a landing stage is flown onto. A runway has two of them
 * and is landed on in either direction, so which one is "the" threshold is a
 * decision rather than a reading - and it is made once, here, because the
 * approach is opened off it and the guidance is drawn from it, and the two
 * pointing at opposite ends of the same strip would be worse than no guidance.
 */
export function approachThreshold(runway) {
    return runway ? runwayThresholds(runway)[0] : null;
}

// --- What the pilot is shown of the approach -------------------------------

/** How far the lead-in runs back from the threshold, in world units. */
export const CENTRELINE_REACH = 3200;

/** How many marks that reach is drawn with, evenly spaced along it. */
export const CENTRELINE_MARKS = 8;

/**
 * What is drawn on the ground to help the pilot find the strip and line up on
 * it: an extended centreline running back down the approach, and a bar across
 * the threshold. Which of the two a stage gets is declared on the stage rather
 * than worked out from its number, so what the pilot is given is read off the
 * mode in one place.
 *
 * Null where there is nothing to draw - a course stage, a stage past the help,
 * or a world with no strip in it - which is what leaves the ground clear.
 */
export function approachGuidance(state, runway) {
    const mode  = runningMode(state);
    const stage = currentStage(state);
    const shown = stage?.guidance;

    if (!runway || !mode || !landsOnStrips(mode) || !shown) return null;
    if (!shown.centreline && !shown.threshold) return null;

    const threshold = approachThreshold(runway);
    // Back down the approach, which is the reciprocal of the way a landing
    // rolls out: the marks lie between the aircraft and the strip.
    const out = bearingDirection(wrapDegrees(threshold.heading + 180));

    const marks = [];
    if (shown.centreline) {
        const step = CENTRELINE_REACH / CENTRELINE_MARKS;
        for (let at = 1; at <= CENTRELINE_MARKS; at++) {
            marks.push({ x: threshold.x + out.x * step * at, z: threshold.z + out.z * step * at });
        }
    }

    return {
        heading: threshold.heading,
        width: runway.width,
        elevation: runway.elevation ?? 0,
        threshold: shown.threshold ? { x: threshold.x, z: threshold.z } : null,
        marks
    };
}

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
    const threshold = approachThreshold(runway);
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
        // The way the course runs through the first gate, read back onto the
        // card: the opening lies a run short of that gate, so this is the
        // bearing that carries the nose along the line to it.
        headingDegrees: directionToBearing(first.dirX, first.dirZ),
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
 * Each is laid at a bank of its own, up to the stage's, so a course that has
 * left the first stage behind is flown wings-with-the-gate rather than upright
 * all the way down.
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
            aspect: gateAspect(plan),
            // Either way off the horizontal: a course that only ever banked one
            // way would be a course flown with one wing down the whole length
            // of it.
            bank: (random() * 2 - 1) * (plan.bank ?? 0),
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
 * How tall a gate is against how wide, which is what makes its bank something
 * to fly rather than something to look at: a circle turned about its own axis
 * is the same circle, so a gate that reads as laid over has to be narrower one
 * way across than the other.
 *
 * A gate that names no shape is the round one the course was always flown
 * through, which is what leaves the first stage exactly as it was.
 *
 * Read off a gate or off the plan a course is laid from, both of which carry
 * the shape under the same name, so the default lives here rather than once at
 * each end of the course being built.
 */
export function gateAspect(ring) {
    const aspect = ring?.aspect;
    return Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
}

/**
 * The two directions across a gate's opening: along its span, and up its own
 * vertical. Both are read off the way the course runs through the gate and the
 * bank it was laid at, so a gate lying over at half a right angle has a span
 * that climbs and a vertical that leans with it.
 *
 * These are the axes a crossing is measured on, and they are the axes the hoop
 * is drawn about in `js/rings.js`, so what the pilot is flying at and what the
 * course is testing are the same opening.
 */
export function gateAxes(ring) {
    const bank = ring?.bank ?? 0;
    const dirX = ring?.dirX ?? 0;
    const dirZ = ring?.dirZ ?? 1;

    const cos = Math.cos(bank);
    const sin = Math.sin(bank);

    // Level, the span lies to the right of the way the course runs and the
    // vertical is the world's. Banking turns the pair about the way the course
    // runs, which is the axis the aircraft's own roll turns about.
    return {
        span: { x:  dirZ * cos, y: sin, z: -dirX * cos },
        rise: { x: -dirZ * sin, y: cos, z:  dirX * sin }
    };
}

/**
 * Where a step of the flight crossed a gate's plane, or null for a step that
 * did not cross it at all.
 *
 * The step is a segment rather than a point, because a gate is thinner than the
 * distance an aircraft covers in a frame and a point test would fly straight
 * through one without noticing. Where the segment crosses the gate's plane is
 * worked out first, and everything either half of the course rules cares about
 * is read off that one crossing: how far off the middle of the hoop it landed,
 * whether that was inside it, and whether the step went the way the course
 * runs through it.
 *
 * Inside is asked of the opening rather than of a radius, because an opening
 * laid over is not the same shape whichever way you come at it: the crossing is
 * measured along the gate's own span and up its own vertical, and it is in when
 * those two together fall inside the ellipse the gate was laid as. A round gate
 * is the case where the two semi-axes are the same length, so the reading it
 * gives is the one it always gave.
 */
export function gateCrossing(ring, from, to) {
    if (!ring) return null;

    const before = gateOffset(ring, from);
    const after  = gateOffset(ring, to);
    if ((before > 0) === (after > 0)) return null;

    const t  = before / (before - after);
    const dx = from.x + (to.x - from.x) * t - ring.x;
    const dy = from.y + (to.y - from.y) * t - ring.y;
    const dz = from.z + (to.z - from.z) * t - ring.z;
    const offset = Math.sqrt(dx * dx + dy * dy + dz * dz);

    const { span, rise } = gateAxes(ring);
    const along  = (dx * span.x + dy * span.y + dz * span.z) / ring.radius;
    const across = (dx * rise.x + dy * rise.y + dz * rise.z) / (ring.radius * gateAspect(ring));

    return {
        offset,
        inside: along * along + across * across <= 1,
        forward: after > before
    };
}

/**
 * True when a step of the flight went through a gate. Either direction counts:
 * a loop is a loop from both sides.
 */
export function gatePassed(ring, from, to) {
    return gateCrossing(ring, from, to)?.inside === true;
}

/**
 * True when a step of the flight went past a gate instead of through it: it
 * crossed the gate's plane outside the hoop, going the way the course runs.
 *
 * Only that direction counts, unlike a pass. Flying a loop backwards is still
 * flying it, but being told you missed one is about having left it behind you,
 * and a pilot who has turned round to come at a gate again crosses its plane
 * on the way back - which is the turn, not a second miss.
 */
export function gateMissed(ring, from, to) {
    const crossing = gateCrossing(ring, from, to);
    return crossing != null && !crossing.inside && crossing.forward;
}

function clamp(value, low, high) {
    return Math.min(Math.max(value, low), high);
}
