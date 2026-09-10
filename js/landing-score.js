/**
 * What a landing was, rather than only that there was one.
 *
 * `js/crash.js` decides whether an arrival on a strip counts as a landing at
 * all, and that stays a yes or a no: an arrival is inside the limits or it is
 * not. What is here is the reading taken of the one that was - where down the
 * strip it touched, how far off the middle, how hard, and how square - and the
 * marks those four readings come to. A pilot who has landed four times has
 * flown four different approaches, and a counter that says "4" has told them
 * nothing about any of them.
 *
 * Pure module with no DOM or Three.js dependency, so a landing can be scored
 * from four numbers in Node without an aircraft anywhere near it.
 */

import { runwayOffsets } from './environment/elements.js';
import { wrapAngle, LANDING_SINK_SPEED, LANDING_HEADING_LIMIT } from './crash.js';

/**
 * Where down the strip a landing is aiming for, as a fraction of its length
 * from the threshold it was flown over. Far enough in that an undershoot has
 * somewhere to fall short of, and early enough that the whole of the rest of
 * the strip is left to stop on.
 */
export const TOUCHDOWN_ZONE = 0.2;

/**
 * How far off that aiming point takes the touchdown mark to nothing, as a
 * fraction of the strip's length. A third of the strip either way, so landing
 * on the numbers and landing halfway down are not the same landing.
 */
export const TOUCHDOWN_REACH = 0.3;

/** What each part of a landing is worth, and what the four come to together. */
export const LANDING_PARTS = Object.freeze(['touchdown', 'centreline', 'sink', 'heading']);

export const PERFECT_SCORE = 100;

/**
 * A reading turned into a mark: 1 for dead on, falling straight to 0 at the
 * reach it is allowed. A reach of nothing is a part that cannot be missed, so
 * it reads as flown perfectly rather than as a division by zero.
 */
export function mark(miss, reach) {
    if (!(reach > 0)) return 1;
    return Math.min(Math.max(1 - Math.abs(miss) / reach, 0), 1);
}

/**
 * Which way along the strip the landing was rolling, as the sign to read the
 * along-strip offset with. A runway is flown in either direction, so the
 * threshold a landing is measured from is whichever one the aircraft came over
 * rather than whichever end the generator laid first.
 */
export function landedForward(runway, heading) {
    const along = wrapAngle(heading - (runway?.heading ?? 0) * Math.PI / 180);
    return Math.abs(along) <= Math.PI / 2;
}

/**
 * How far down the strip a landing touched, measured from the threshold it was
 * flown over. Negative for a touchdown short of it, which is an undershoot and
 * reads as one.
 */
export function touchdownPoint(runway, touchdown = {}) {
    const { along } = runwayOffsets(runway, touchdown.x ?? 0, touchdown.z ?? 0);
    const forward = landedForward(runway, touchdown.heading ?? 0);
    return (forward ? along : -along) + runway.length / 2;
}

/**
 * The whole reading of a landing: the four measurements, the mark each comes
 * to, and the score the four make together.
 *
 * Null without a strip to measure against - a landing is a landing on
 * something, and there is nothing to say about one made on open ground.
 */
export function scoreLanding(runway, touchdown = {}) {
    if (!runway) return null;

    const down   = touchdownPoint(runway, touchdown);
    const across = Math.abs(runwayOffsets(runway, touchdown.x ?? 0, touchdown.z ?? 0).across);
    // Descent is signed the way the altimeter reads it, and every mark below is
    // a distance from perfect, so the sink is read as the rate it came down at.
    const sink    = Math.max(0, -(touchdown.verticalSpeed ?? 0));
    const heading = Math.abs(touchdown.headingOffset ?? 0);

    const marks = {
        touchdown:  mark(down - runway.length * TOUCHDOWN_ZONE, runway.length * TOUCHDOWN_REACH),
        centreline: mark(across, runway.width / 2),
        sink:       mark(sink, LANDING_SINK_SPEED),
        heading:    mark(heading, LANDING_HEADING_LIMIT)
    };

    const total = LANDING_PARTS.reduce((sum, part) => sum + marks[part], 0);

    return {
        down,
        across,
        sink,
        heading,
        marks,
        score: Math.round(total / LANDING_PARTS.length * PERFECT_SCORE)
    };
}

// --- The rollout ----------------------------------------------------------

/**
 * A landing is not over at the touchdown. The breakdown is held back until the
 * aircraft has stopped, because what a pilot wants to read it against is the
 * strip they are sitting on rather than the one going past the window - and
 * because a stage that moved on the moment a wheel touched would take the
 * rollout away from them.
 */

/** At or under this, in world units per second, the aircraft has stopped. */
export const ROLLOUT_STOP_SPEED = 1;

/**
 * How long a rollout is waited out before the breakdown is shown anyway, in
 * seconds. A pilot who touches down and leaves the throttle open never stops,
 * and a stage that waited on them forever would be a stage with no end.
 */
export const ROLLOUT_LIMIT = 10;

export function createRolloutState() {
    return { rolling: false, elapsed: 0 };
}

/**
 * Starts the wait. Returns true when this began one, so a landing reported
 * twice - a wheel bouncing back onto the strip - does not restart the clock on
 * a rollout already under way.
 */
export function beginRollout(state) {
    if (state.rolling) return false;
    state.rolling = true;
    state.elapsed = 0;
    return true;
}

export function clearRollout(state) {
    state.rolling = false;
    state.elapsed = 0;
}

/**
 * Runs the wait on by a frame. Returns true on the single frame it ends, which
 * is the caller's cue to show the breakdown, whether it ended because the
 * aircraft stopped or because it was never going to.
 */
export function updateRollout(state, dt, speed, limit = ROLLOUT_LIMIT) {
    if (!state.rolling) return false;

    state.elapsed += Math.max(0, dt);
    if (Math.abs(speed) > ROLLOUT_STOP_SPEED && state.elapsed < limit) return false;

    clearRollout(state);
    return true;
}

export function rollingOut(state) {
    return state?.rolling === true;
}
