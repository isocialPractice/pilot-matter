/**
 * The circuit a traffic pattern is flown to, and how well each leg of it was
 * held.
 *
 * Every other landing mode asks one question at the end - what the arrival came
 * to - and nothing at all about the flying that got there. A circuit is the
 * opposite: it is a shape to be flown, and the landing is the last fifth of it.
 * So the leg is the unit here. Each one declares a heading to track and a
 * height to be at by the end of it, the aircraft is read against both every
 * frame it is on that leg, and what the leg came to is a mark out of a hundred
 * the same way a landing is.
 *
 * The circuit is laid off the strip rather than configured place by place: a
 * pattern is a shape relative to a runway, so the same plan laid at any strip
 * in any world gives the circuit that strip would be flown.
 *
 * Pure module with no DOM or Three.js dependency. The legs are geometry, the
 * reading is four numbers a frame, and the score is arithmetic over them, so a
 * circuit can be laid out and flown through in Node with no aircraft anywhere
 * near it.
 */

import { bearingToDirection, directionToBearing, FEET_PER_UNIT } from './units.js';
import { runwayThresholds } from './environment/elements.js';
import { mark, PERFECT_SCORE } from './landing-score.js';

/**
 * The five legs of the circuit, in the order they are flown.
 *
 * The turn from the strip out onto the downwind line belongs to the climb out
 * rather than standing as a crosswind leg of its own. That is what leaves the
 * downwind exactly parallel to the strip, and the downwind is the leg that is
 * genuinely about holding a heading - a leg laid diagonally would be asking the
 * pilot to hold a number nothing on the ground explains.
 */
export const PATTERN_LEGS = Object.freeze([
    'TAKEOFF', 'CLIMB OUT', 'DOWNWIND', 'BASE', 'FINAL'
]);

export const TAKEOFF_LEG = 0;
export const FINAL_LEG   = PATTERN_LEGS.length - 1;

/**
 * The height each leg is to be at by the end of it, as a fraction of the
 * circuit height above the field.
 *
 * The target between one end of a leg and the other is read off the ramp
 * between the two, so a leg whose ends are the same height is a height to hold
 * and a leg whose ends differ is a climb or a descent to fly at a steady rate.
 * That is what lets one reading serve all five: the takeoff is a ground roll,
 * the downwind is a hold, and the final is an approach, and none of them needs
 * a rule of its own.
 */
export const LEG_HEIGHTS = Object.freeze([0, 1, 1, 0.45, 0]);

/** How far off a leg's heading takes its mark to nothing, in degrees. */
export const HEADING_REACH = 25;

/** How far off a leg's height takes its mark to nothing, in feet. */
export const ALTITUDE_REACH = 320;

/**
 * The circuit a stage is flown round, as the five legs it is made of.
 *
 * A leg is the segment between two turns: where it starts, where it ends, the
 * heading that carries the aircraft along it, and the height it is to be at
 * either end. The end is also the mark the chart draws and the plane the run
 * crosses to move on to the next leg, which is why it is the point the leg is
 * named by.
 *
 * Empty without a strip to lay it off - a circuit is a circuit round something,
 * and there is nothing to fly over open ground.
 */
export function buildPattern(stage, runway) {
    const plan = stage?.pattern;
    if (!plan || !runway) return [];

    const [approach, departure] = runwayThresholds(runway);

    const forward = bearingToDirection(runway.heading);
    // The side of the strip the circuit lies on. A left-hand circuit is the
    // standard one and the default here, which puts the downwind off the
    // pilot's left shoulder on the climb out.
    const hand    = plan.hand ?? LEFT_HAND;
    const across  = bearingToDirection(runway.heading + 90 * hand);

    const out    = plan.upwind;
    const offset = plan.offset;
    const back   = plan.final;

    const step = (from, along, aside) => ({
        x: from.x + forward.x * along + across.x * aside,
        z: from.z + forward.z * along + across.z * aside
    });

    // The corners of the circuit, in the order they are turned at: the
    // departure threshold, the point out on the downwind line, the point
    // abeam the far end of final, the point final begins at, and the
    // threshold itself.
    const corners = [
        step(approach, 0, 0),
        step(departure, 0, 0),
        step(departure, out, offset),
        step(approach, -back, offset),
        step(approach, -back, 0),
        step(approach, 0, 0)
    ];

    const field = (runway.elevation ?? 0) * FEET_PER_UNIT;
    const climb = plan.altitudeFeet;

    return PATTERN_LEGS.map((label, index) => {
        const from = corners[index];
        const to   = corners[index + 1];

        return {
            index,
            label,
            // The start of the leg carries the height the one before it ended
            // at, so the ramp through the circuit is continuous: a leg never
            // asks the pilot to be somewhere the leg before it did not leave
            // them.
            fromX: from.x,
            fromZ: from.z,
            fromFeet: field + climb * (LEG_HEIGHTS[index - 1] ?? 0),
            x: to.x,
            z: to.z,
            altitudeFeet: field + climb * LEG_HEIGHTS[index],
            heading: directionToBearing(to.x - from.x, to.z - from.z),
            ...legDirection(from, to)
        };
    });
}

/** The standard circuit, flown with the field off the pilot's left. */
export const LEFT_HAND  = -1;
export const RIGHT_HAND = 1;

/**
 * The way a leg runs, as a unit vector over the ground. A leg of no length -
 * a plan that put two corners in the same place - runs the way the strip does
 * rather than nowhere, so the plane at the end of it is still a plane to cross.
 */
function legDirection(from, to) {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const run = Math.hypot(dx, dz);
    return run > 0 ? { dirX: dx / run, dirZ: dz / run, run } : { dirX: 0, dirZ: 1, run: 0 };
}

/**
 * How far in front of or behind the end of a leg a place lies, along the way
 * the leg runs. Negative while the leg is still being flown, positive once its
 * end is behind the aircraft.
 */
export function legOffset(leg, point) {
    return (point.x - leg.x) * leg.dirX + (point.z - leg.z) * leg.dirZ;
}

/**
 * True when a step of the flight crossed the end of a leg, going the way the
 * leg runs.
 *
 * A step rather than a place, for the reason a gate is tested as one: the end
 * of a leg is a line, and an aircraft covers more ground in a frame than a line
 * is wide. Only the forward crossing counts - a pilot who has overshot the turn
 * and come back is on the same leg they were on, not a leg further round.
 */
export function legCrossed(leg, from, to) {
    if (!leg || !from || !to) return false;
    return legOffset(leg, from) <= 0 && legOffset(leg, to) > 0;
}

/**
 * How far along a leg a place is, from 0 at its start to 1 at its end. It is
 * what the height target is read at, so it is held inside the leg: an aircraft
 * wide of the turn is still being asked for the height the end of that leg
 * wants rather than for one further round the circuit.
 */
export function legProgress(leg, point) {
    if (!leg || !point || !(leg.run > 0)) return 1;
    const along = (point.x - leg.fromX) * leg.dirX + (point.z - leg.fromZ) * leg.dirZ;
    return Math.min(Math.max(along / leg.run, 0), 1);
}

/** The height a leg wants at a place along it, in feet. */
export function legAltitude(leg, point) {
    if (!leg) return 0;
    return leg.fromFeet + (leg.altitudeFeet - leg.fromFeet) * legProgress(leg, point);
}

/**
 * How far off the leg's heading the aircraft is pointing, in degrees either
 * side of it. Folded in degrees rather than through radians, the way every
 * other bearing in the simulator is folded, so two headings a whole number of
 * degrees apart stay a whole number of degrees apart.
 */
export function headingMiss(leg, heading) {
    const off = (((heading - (leg?.heading ?? 0)) % 360) + 360) % 360;
    return off > 180 ? off - 360 : off;
}

// --- What the circuit was flown like --------------------------------------

/**
 * The running reading of a circuit: for each leg, how long has been spent on
 * it and what the two errors have come to over that time.
 *
 * Held beside the run rather than inside it, the way a rollout is: the run
 * state is what every mode reads and it has one shape for all of them, while
 * this is one mode's own working. It is reset with the stage and read at the
 * end of each leg.
 */
export function createPatternState(legs = PATTERN_LEGS.length) {
    return { legs: Array.from({ length: legs }, emptyLeg), flown: [] };
}

function emptyLeg() {
    return { seconds: 0, altitude: 0, heading: 0 };
}

/** Puts the reading back to an unflown circuit, for a crash or a fresh stage. */
export function resetPattern(state, legs = PATTERN_LEGS.length) {
    if (!state) return state;
    state.legs = Array.from({ length: legs }, emptyLeg);
    state.flown = [];
    return state;
}

/**
 * Reads the aircraft against the leg it is on, for one frame.
 *
 * Both errors are accumulated against time rather than against frames, so what
 * a leg comes to does not depend on how fast the machine drawing it was. A
 * frame with no time in it reads nothing, which is what leaves a paused circuit
 * unjudged.
 */
export function samplePattern(state, leg, report = {}, dt = 0) {
    const tally = state?.legs?.[leg?.index];
    const seconds = Math.max(0, Number(dt) || 0);
    if (!tally || !leg || seconds === 0) return tally ?? null;

    const altitude = Number(report.altitudeFeet);
    const heading  = Number(report.headingDegrees);
    if (!Number.isFinite(altitude) || !Number.isFinite(heading)) return tally;

    tally.seconds  += seconds;
    tally.altitude += Math.abs(altitude - legAltitude(leg, report)) * seconds;
    tally.heading  += Math.abs(headingMiss(leg, heading)) * seconds;

    return tally;
}

/**
 * What a leg was held like: the mean error on each of the two readings over the
 * time it was flown, the mark each comes to, and the score the pair make
 * together.
 *
 * A leg with no time on it has not been flown, and reads as perfect rather than
 * as a division by zero - which is right for the one case it happens in, a leg
 * crossed in a single frame, where there is nothing to have held badly.
 */
export function scoreLeg(state, leg, reaches = {}) {
    const tally = state?.legs?.[leg?.index];
    if (!tally || !leg) return null;

    const seconds  = tally.seconds;
    const altitude = seconds > 0 ? tally.altitude / seconds : 0;
    const heading  = seconds > 0 ? tally.heading / seconds : 0;

    const marks = {
        altitude: mark(altitude, reaches.altitude ?? ALTITUDE_REACH),
        heading:  mark(heading,  reaches.heading  ?? HEADING_REACH)
    };

    return {
        index: leg.index,
        label: leg.label,
        seconds,
        altitude,
        heading,
        marks,
        score: Math.round((marks.altitude + marks.heading) / 2 * PERFECT_SCORE)
    };
}

/**
 * Closes a leg off: scores it, keeps the reading, and hands it back for the
 * line the pilot is shown. Scoring it again - a leg crossed twice by a step
 * that wandered - leaves the first reading standing, because the first is the
 * one flown to the turn.
 */
export function completeLeg(state, leg, reaches = {}) {
    if (!state || !leg) return null;
    if (state.flown[leg.index]) return state.flown[leg.index];

    const flown = scoreLeg(state, leg, reaches);
    state.flown[leg.index] = flown;
    return flown;
}

/**
 * What the circuit came to: the mean of the legs that have been flown. Null
 * until one has been, so a stage that has only just opened writes nothing
 * rather than writing a hundred nobody earned.
 */
export function patternScore(state) {
    const flown = (state?.flown ?? []).filter(Boolean);
    if (flown.length === 0) return null;

    const total = flown.reduce((sum, leg) => sum + leg.score, 0);
    return Math.round(total / flown.length);
}

/** The legs flown so far, in the order they were flown. */
export function flownLegs(state) {
    return (state?.flown ?? []).filter(Boolean);
}
