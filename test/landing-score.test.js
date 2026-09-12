import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    TOUCHDOWN_ZONE,
    TOUCHDOWN_REACH,
    LANDING_PARTS,
    PERFECT_SCORE,
    ROLLOUT_STOP_SPEED,
    ROLLOUT_LIMIT,
    mark,
    landedForward,
    touchdownPoint,
    scoreLanding,
    createRolloutState,
    beginRollout,
    clearRollout,
    updateRollout,
    rollingOut
} from '../js/landing-score.js';
import { LANDING_SINK_SPEED, LANDING_HEADING_LIMIT, headingOffsetTo } from '../js/crash.js';
import { runwayDirection, runwayPoint, runwayThresholds } from '../js/environment/elements.js';
import { headingDegrees } from '../js/units.js';

/**
 * A strip laid on a bearing, written the way the generator writes them, so
 * everything below is measured against a real description rather than against
 * one this file made convenient for itself.
 */
function strip(heading = 0, length = 3000, width = 300) {
    return { x: 0, z: 0, heading, length, width, elevation: 100, ...runwayDirection(heading) };
}

const RADIANS = Math.PI / 180;

/**
 * An arrival on a strip: how far down it, how far off the middle, how hard, and
 * how square. The place is worked back out of the two offsets rather than given
 * as a coordinate, because a strip on 040 has no axis anything is written along.
 */
function arrival(runway, { down = 0, across = 0, sink = 0, heading = runway.heading, off = 0 } = {}) {
    const at = runwayPoint(runway, down - runway.length / 2, across);
    return {
        x: at.x,
        z: at.z,
        heading: heading * RADIANS,
        verticalSpeed: -sink,
        headingOffset: off
    };
}

// --- A reading turned into a mark ------------------------------------------

test('a mark is one at dead on and nothing at the reach it is allowed', () => {
    assert.equal(mark(0, 100), 1);
    assert.equal(mark(50, 100), 0.5);
    assert.equal(mark(100, 100), 0);
    assert.equal(mark(400, 100), 0, 'and stays there rather than going negative');
});

test('a miss is a distance, so which side of perfect it fell is not the point', () => {
    assert.equal(mark(-40, 100), mark(40, 100));
});

test('a part that cannot be missed is one that was flown', () => {
    assert.equal(mark(20, 0), 1, 'a reach of nothing');
    assert.equal(mark(20, -5), 1, 'and a reach that is not one');
});

// --- Which way down the strip ----------------------------------------------

test('a strip is landed on in either direction, and measured from the end flown over', () => {
    const runway = strip(90);

    assert.equal(landedForward(runway, 90 * RADIANS), true, 'rolling out on the strip bearing');
    assert.equal(landedForward(runway, 270 * RADIANS), false, 'and on the reciprocal');
    assert.equal(landedForward(runway, 130 * RADIANS), true, 'a drift is still the same direction');
    assert.equal(landedForward(runway, 200 * RADIANS), false);
});

test('a touchdown is measured from the threshold it was flown over, either way round', () => {
    const runway = strip(40);
    const [near, far] = runwayThresholds(runway);

    // Six hundred units past whichever end the aircraft came over reads as six
    // hundred either way, which is the whole point of asking the question.
    const forward = { ...arrival(runway, { down: 600 }), heading: near.heading * RADIANS };
    const back    = { ...arrival(runway, { down: runway.length - 600 }), heading: far.heading * RADIANS };

    assert.ok(Math.abs(touchdownPoint(runway, forward) - 600) < 1e-6);
    assert.ok(Math.abs(touchdownPoint(runway, back) - 600) < 1e-6);
});

test('touching down short of the threshold is an undershoot and reads as one', () => {
    const runway = strip(0);
    assert.ok(touchdownPoint(runway, arrival(runway, { down: -200 })) < 0);
});

// --- The score --------------------------------------------------------------

test('a landing on the numbers, straight, level and feathered, is the whole hundred', () => {
    const runway = strip(0);
    const landing = scoreLanding(runway, arrival(runway, { down: runway.length * TOUCHDOWN_ZONE }));

    assert.equal(landing.score, PERFECT_SCORE);
    for (const part of LANDING_PARTS) {
        assert.equal(landing.marks[part], 1, `${part} should be flown rather than merely met`);
    }
});

test('each part of a landing is marked on its own reading', () => {
    const runway = strip(0);
    const aim = runway.length * TOUCHDOWN_ZONE;

    const off = scoreLanding(runway, arrival(runway, { down: aim, across: runway.width / 4 }));
    assert.equal(off.marks.centreline, 0.5, 'half the half width is half the mark');
    assert.equal(off.marks.touchdown, 1, 'and nothing else is touched by it');

    const hard = scoreLanding(runway, arrival(runway, { down: aim, sink: LANDING_SINK_SPEED / 2 }));
    assert.equal(hard.marks.sink, 0.5);
    assert.equal(hard.marks.centreline, 1);

    const crooked = scoreLanding(runway, arrival(runway, { down: aim, off: LANDING_HEADING_LIMIT / 2 }));
    assert.equal(crooked.marks.heading, 0.5);

    const long = scoreLanding(runway, arrival(runway, { down: aim + runway.length * TOUCHDOWN_REACH / 2 }));
    assert.equal(long.marks.touchdown, 0.5);
});

/**
 * The second half of the mirrored-bearing defect, and the half that is quiet:
 * every test above takes the heading it lands on from the strip's `heading`
 * field, so a field holding the mirror of the bearing the strip is actually
 * carved on is marked as square by all of them.
 *
 * This one never reads that field. It flies the strip's own geometry - the
 * direction `runwayOffsets` measures along and `gradeRunway` paved - and asks
 * for the full mark. A landing that physically ran down the middle of the
 * strip was reported as four degrees off while the two disagreed.
 */
test('a landing flown along the strip itself is scored as square', () => {
    for (const heading of [0, 37, 128, 214, 301]) {
        const runway = strip(heading);

        // The card heading an aircraft has to be on to run down this strip,
        // worked out from the aircraft rather than from any compass helper: a
        // model built nose-first along +Z and turned about +Y by its yaw
        // travels (sin yaw, cos yaw), so the yaw that runs along the strip is
        // the one below, and `headingDegrees` says what the card reads at it.
        const along = headingDegrees(Math.atan2(runway.alongX, runway.alongZ));

        const landing = scoreLanding(runway, {
            ...arrival(runway, { down: runway.length * TOUCHDOWN_ZONE, heading: along }),
            // Worked out the way the aircraft works it out, off the strip's
            // heading field, which is where the two frames meet.
            headingOffset: headingOffsetTo(along * RADIANS, runway.heading * RADIANS)
        });

        assert.ok(Math.abs(landing.heading) < 1e-9,
            `a landing down the middle of a strip on ${heading} read `
          + `${(landing.heading / RADIANS).toFixed(2)} degrees off it`);
        assert.equal(landing.marks.heading, 1, 'and should take the whole mark for it');
        assert.equal(landing.score, PERFECT_SCORE,
            'a landing flown perfectly along the strip is a perfect landing');
    }
});

test('the readings come back beside the marks, in the units they were taken in', () => {
    const runway = strip(0);
    const landing = scoreLanding(runway, arrival(runway, { down: 900, across: 40, sink: 6, off: 0.1 }));

    assert.ok(Math.abs(landing.down - 900) < 1e-6);
    assert.ok(Math.abs(landing.across - 40) < 1e-6, 'off the middle either way is a distance');
    assert.ok(Math.abs(landing.sink - 6) < 1e-9, 'and a descent is read as the rate it came down at');
    assert.ok(Math.abs(landing.heading - 0.1) < 1e-9);
});

test('the score is the four marks together rather than any one of them', () => {
    const runway = strip(0);
    const aim = runway.length * TOUCHDOWN_ZONE;
    const landing = scoreLanding(runway, arrival(runway, { down: aim, across: runway.width / 2 }));

    // Three parts flown and one missed outright: three quarters of the hundred.
    assert.equal(landing.marks.centreline, 0);
    assert.equal(landing.score, Math.round(PERFECT_SCORE * 3 / 4));
});

test('a landing off a strip is a landing there is nothing to say about', () => {
    assert.equal(scoreLanding(null, { x: 0, z: 0 }), null);
});

test('an arrival that names nothing is scored rather than thrown at', () => {
    const landing = scoreLanding(strip(0), {});
    assert.ok(Number.isFinite(landing.score), 'the middle of the strip, dead level, feather soft');
    assert.equal(landing.across, 0);
    assert.equal(landing.sink, 0);
});

// --- The rollout ------------------------------------------------------------

test('a rollout is waited out, and ends when the aircraft has stopped', () => {
    const state = createRolloutState();

    assert.equal(rollingOut(state), false, 'nothing is rolling out before a landing');
    assert.equal(updateRollout(state, 1, 0), false, 'and a wait that never began cannot end');

    assert.equal(beginRollout(state), true);
    assert.equal(rollingOut(state), true);

    assert.equal(updateRollout(state, 0.5, 40), false, 'still running down the strip');
    assert.equal(updateRollout(state, 0.5, ROLLOUT_STOP_SPEED), true, 'and stopped on it');
    assert.equal(rollingOut(state), false, 'which is the end of the wait');
});

test('a wheel bouncing back onto the strip does not restart the wait', () => {
    const state = createRolloutState();

    beginRollout(state);
    updateRollout(state, 2, 60);
    assert.equal(beginRollout(state), false);
    assert.equal(state.elapsed, 2, 'the clock is the one the landing started');
});

test('a pilot who never stops is not waited on forever', () => {
    const state = createRolloutState();

    beginRollout(state);
    assert.equal(updateRollout(state, ROLLOUT_LIMIT - 1, 90), false);
    assert.equal(updateRollout(state, 1, 90), true, 'the wait runs out on its own');
});

test('a rollout can be called off, for a stage that has been started again', () => {
    const state = createRolloutState();

    beginRollout(state);
    updateRollout(state, 1, 50);
    clearRollout(state);

    assert.equal(rollingOut(state), false);
    assert.equal(state.elapsed, 0);
    assert.equal(updateRollout(state, 1, 0), false, 'and it does not go off later');
});

// --- The flight reaches for it ---------------------------------------------
//
// Everything above proves a landing is scored and read off correctly, and every
// one of those tests exercises `scoreLanding` and `formatLandingReport` in
// isolation. What none of them can prove is that a landing flown in a browser
// ever reaches them: `js/aircraft.js` reports the strip and the arrival to a
// callback `js/main.js` registers, and for a while that callback was a
// zero-argument arrow. It dropped both, `scoreLanding` was handed `undefined`
// twice, the breakdown was never written, and all 893 tests passed. Both files
// import `three`, so nothing here can load them - the seam is read from the
// source the way `test/world-tiles.test.js` reads the camera out of
// `js/main.js`.

const aircraftSource = readFileSync(new URL('../js/aircraft.js', import.meta.url), 'utf8');
const mainSource     = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');

/** The arguments of a call, read off the line it is written on. */
function callArguments(source, pattern) {
    const call = source.match(pattern);
    if (!call) return null;
    return call[1].split(',').map(argument => argument.trim()).filter(Boolean);
}

test('the flight model reports the strip a landing was made on, and the arrival', () => {
    const reported = callArguments(aircraftSource, /this\.options\.onLanding\?\.\((.*)\)/);
    assert.ok(reported, 'js/aircraft.js should still be reporting landings');
    assert.equal(reported.length, 2,
        `onLanding is called with (${reported.join(', ')}), which is not a strip and an arrival`);
});

test('the handler registered for a landing takes what the flight model reports', () => {
    const taken = callArguments(mainSource, /onLanding:\s*\(([^)]*)\)\s*=>/);
    assert.ok(taken, 'js/main.js should still register an onLanding handler');
    assert.equal(taken.length, 2,
        `the handler takes (${taken.join(', ')}), so the landing is dropped on the way in`);

    // Named is not yet passed on: an arrow that takes both and then calls
    // `this.onLanding()` drops them just as quietly, and just as silently.
    const passed = callArguments(mainSource, /onLanding:\s*\([^)]*\)\s*=>\s*this\.onLanding\(([^)]*)\)/);
    assert.ok(passed, 'the handler should hand the landing on to this.onLanding');
    assert.deepEqual(passed, taken, 'and hand on the two it was given rather than calling with nothing');
});

test('the landing is scored from the two the handler was given', () => {
    const handler = mainSource.match(/^ {4}onLanding\((.*?)\)\s*\{([\s\S]*?)^ {4}\}/m);
    assert.ok(handler, 'js/main.js should still define onLanding');

    const [strip, contact] = handler[1].split(',').map(name => name.trim());
    assert.ok(strip && contact, `onLanding(${handler[1]}) should take a strip and an arrival`);
    assert.ok(handler[2].includes(`scoreLanding(${strip}, ${contact})`),
        'the breakdown is written from the landing that was reported, not from nothing');
});
