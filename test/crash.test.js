import test from 'node:test';
import assert from 'node:assert/strict';
import {
    GROUND_CLEARANCE,
    CRASH_IMPACT_SPEED,
    RUNWAY_IMPACT_SPEED,
    CRASH_DURATION,
    LANDING_SINK_SPEED,
    LANDING_BANK_LIMIT,
    LANDING_PITCH_LIMIT,
    LANDING_HEADING_LIMIT,
    LANDING_LIMITS,
    FLYING,
    LANDED,
    CRASHED,
    GROUND_OUTCOMES,
    createCrashState,
    isCrashImpact,
    beginCrash,
    clearCrash,
    updateCrash,
    controlsLocked,
    crashProgress,
    wrapAngle,
    headingOffsetTo,
    withinLandingAttitude,
    touchdownOutcome,
    recordTouchdown,
    releaseGround,
    groundOutcome,
    hasLanded
} from '../js/crash.js';
import { GRAVITY, STALL_SINK_MULTIPLIER, MAX_SPEED, sinkRate } from '../js/flight-model.js';

// --- What counts as a crash ---

test('a flight starts uncrashed with its controls live', () => {
    const state = createCrashState();
    assert.equal(state.crashed, false);
    assert.equal(state.timer, 0);
    assert.equal(controlsLocked(state), false);
});

test('dropping onto terrain faster than the threshold is a crash', () => {
    assert.equal(isCrashImpact(-CRASH_IMPACT_SPEED), true);
    assert.equal(isCrashImpact(-CRASH_IMPACT_SPEED - 50), true);
    assert.equal(isCrashImpact(-CRASH_IMPACT_SPEED + 0.1), false);
});

test('settling onto terrain gently is a landing and not a crash', () => {
    assert.equal(isCrashImpact(0), false);
    assert.equal(isCrashImpact(-1), false);
});

test('a climb into terrain is never an impact, whatever its rate', () => {
    assert.equal(isCrashImpact(5), false);
    assert.equal(isCrashImpact(CRASH_IMPACT_SPEED * 10), false);
});

test('the worst unpowered sink survives, so an engine-out settle is a landing', () => {
    // The hardest the flight model can drop the aircraft without the nose
    // pointing down is a dead-stop stall
    const worstSink = sinkRate(0);
    assert.equal(worstSink, GRAVITY * STALL_SINK_MULTIPLIER);
    assert.ok(!isCrashImpact(-worstSink),
        `a ${worstSink} units/s stall sink should not be fatal on its own`);
});

test('a dive into terrain at speed is fatal', () => {
    // Nose down through 45 degrees at half throttle: the vertical component
    // of the flight path alone clears the threshold
    const diveRate = -Math.sin(Math.PI / 4) * (MAX_SPEED / 2);
    assert.ok(isCrashImpact(diveRate), `a ${diveRate} units/s dive should be fatal`);
});

test('the threshold reads the same whichever sign it is written with', () => {
    assert.equal(isCrashImpact(-31, 30), true);
    assert.equal(isCrashImpact(-31, -30), true);
    assert.equal(isCrashImpact(-29, 30), false);
});

test('the aircraft keeps clearance over the ground rather than sitting in it', () => {
    assert.ok(GROUND_CLEARANCE > 0);
});

// --- The crash state and its countdown ---

test('beginning a crash locks the controls and starts the countdown', () => {
    const state = createCrashState();
    assert.equal(beginCrash(state), true);
    assert.equal(state.crashed, true);
    assert.equal(state.timer, CRASH_DURATION);
    assert.equal(controlsLocked(state), true);
});

test('a wreck sliding along the ground cannot restart its own countdown', () => {
    const state = createCrashState();
    beginCrash(state);
    updateCrash(state, 1);
    assert.equal(beginCrash(state), false, 'the second impact should be ignored');
    assert.equal(state.timer, CRASH_DURATION - 1, 'the countdown should keep running');
});

test('the countdown runs out once and asks for exactly one reset', () => {
    const state = createCrashState();
    beginCrash(state);

    let resets = 0;
    const dt = 1 / 60;
    for (let frame = 0; frame < 60 * 5; frame++) {
        if (updateCrash(state, dt)) resets++;
    }
    assert.equal(resets, 1, 'the crash should reset the flight once, not every frame');
    assert.equal(state.crashed, false, 'the controls should be live again after the reset');
});

test('the countdown lasts the documented duration before resetting', () => {
    const state = createCrashState();
    beginCrash(state);
    assert.equal(updateCrash(state, CRASH_DURATION / 2), false, 'reset came early');
    assert.equal(updateCrash(state, CRASH_DURATION / 2), true);
});

test('a frame longer than the countdown still resets exactly once', () => {
    const state = createCrashState();
    beginCrash(state);
    assert.equal(updateCrash(state, CRASH_DURATION * 10), true);
    assert.equal(updateCrash(state, CRASH_DURATION * 10), false);
});

test('an uncrashed flight never asks for a reset', () => {
    const state = createCrashState();
    assert.equal(updateCrash(state, 1), false);
    assert.equal(state.timer, 0);
});

test('a frozen clock holds the countdown, so a pause does not fly the reset by', () => {
    const state = createCrashState();
    beginCrash(state);
    for (let frame = 0; frame < 100; frame++) {
        assert.equal(updateCrash(state, 0), false);
    }
    assert.equal(state.timer, CRASH_DURATION, 'no crash time should pass while paused');
});

test('resetting by hand clears the crash without waiting out the countdown', () => {
    const state = createCrashState();
    beginCrash(state);
    clearCrash(state);
    assert.equal(state.crashed, false);
    assert.equal(state.timer, 0);
    assert.equal(controlsLocked(state), false);
    assert.equal(updateCrash(state, 1), false, 'a cleared crash should not fire a late reset');
});

test('crash progress runs from the full countdown down to nothing', () => {
    const state = createCrashState();
    assert.equal(crashProgress(state), 0, 'an uncrashed flight has nothing to run down');

    beginCrash(state);
    assert.equal(crashProgress(state), 1);
    updateCrash(state, CRASH_DURATION / 2);
    assert.ok(Math.abs(crashProgress(state) - 0.5) < 1e-9);
    updateCrash(state, CRASH_DURATION);
    assert.equal(crashProgress(state), 0);
});

// --- Landing on a runway ---------------------------------------------------

// A landing has to be flyable: gentler than a crash by enough of a margin that
// there is a way to arrive that is neither, and firmer than the worst an
// unpowered aircraft can settle at, or nobody could ever make one.
test('the thresholds leave room between a landing, a rollout, and a wreck', () => {
    assert.ok(LANDING_SINK_SPEED < CRASH_IMPACT_SPEED,
        'a landing should be gentler than the arrival that breaks the aircraft');
    assert.ok(CRASH_IMPACT_SPEED < RUNWAY_IMPACT_SPEED,
        'prepared ground should take an arrival a hillside would not');
    assert.ok(LANDING_SINK_SPEED < sinkRate(0),
        'and a dead-stop stall onto a strip should not count as a landing');
});

test('an angle is folded back into the half turn either side of zero', () => {
    assert.equal(wrapAngle(0), 0);
    assert.ok(Math.abs(wrapAngle(Math.PI * 2.25) - Math.PI * 0.25) < 1e-9);
    assert.ok(Math.abs(wrapAngle(-Math.PI * 2.25) + Math.PI * 0.25) < 1e-9);
    assert.ok(Math.abs(wrapAngle(Math.PI * 1.5) + Math.PI * 0.5) < 1e-9,
        'three quarters round one way is a quarter round the other');
});

test('a strip is arrived square on from either end of it', () => {
    const north = 0;
    assert.equal(headingOffsetTo(north, north), 0);
    assert.ok(Math.abs(headingOffsetTo(Math.PI, north)) < 1e-9,
        'landing on the reciprocal is landing square, not backwards');

    const quarter = Math.PI / 2;
    assert.ok(Math.abs(headingOffsetTo(quarter, north) - quarter) < 1e-9,
        'and across the strip is as far off as it gets');
    assert.ok(headingOffsetTo(0.2, 0) > 0, 'an offset is a size rather than a direction');
    assert.ok(headingOffsetTo(-0.2, 0) > 0);
});

test('a landing is flown wings level, nose square, and pointing down the strip', () => {
    const square = { bank: 0, pitch: 0, headingOffset: 0 };
    assert.equal(withinLandingAttitude(square), true);
    assert.equal(withinLandingAttitude({}), true, 'and nothing said is nothing wrong');

    assert.equal(withinLandingAttitude({ ...square, bank: LANDING_BANK_LIMIT * 1.1 }), false,
        'a wing down is a wing into the ground');
    assert.equal(withinLandingAttitude({ ...square, pitch: -LANDING_PITCH_LIMIT * 1.1 }), false,
        'and a nose down is a nose into it');
    assert.equal(withinLandingAttitude({ ...square, headingOffset: LANDING_HEADING_LIMIT * 1.1 }), false,
        'and a heading across the strip does not stay on it');
});

test('the outcome of an arrival is one of the three there are', () => {
    assert.deepEqual(GROUND_OUTCOMES, [FLYING, LANDED, CRASHED]);
    assert.equal(createCrashState().outcome, FLYING, 'a flight opens flying');
});

test('off a runway the rule is the one it has always been', () => {
    assert.equal(touchdownOutcome({ verticalSpeed: -1 }), FLYING, 'a settle is flown out of');
    assert.equal(touchdownOutcome({ verticalSpeed: -CRASH_IMPACT_SPEED }), CRASHED);
    assert.equal(touchdownOutcome({ verticalSpeed: -2, bank: 0, pitch: 0 }), FLYING,
        'and no attitude on open ground makes an arrival a landing');
});

test('a soft square arrival on a strip is a landing', () => {
    assert.equal(touchdownOutcome({ onRunway: true, verticalSpeed: -4 }), LANDED);
    assert.equal(touchdownOutcome({
        onRunway: true,
        verticalSpeed: -(LANDING_SINK_SPEED - 1),
        bank: LANDING_BANK_LIMIT * 0.5,
        pitch: LANDING_PITCH_LIMIT * 0.5,
        headingOffset: LANDING_HEADING_LIMIT * 0.5
    }), LANDED, 'right up to the limits it is flown inside');
});

test('an arrival that misses the limits rolls out rather than counting', () => {
    const firm = { onRunway: true, verticalSpeed: -(LANDING_SINK_SPEED + 2) };
    assert.equal(touchdownOutcome(firm), FLYING, 'too hard to be a landing, not hard enough to be a crash');

    assert.equal(touchdownOutcome({
        onRunway: true, verticalSpeed: -4, bank: LANDING_BANK_LIMIT * 2
    }), FLYING, 'and a wing down is not a landing either');
});

test('a strip turns an arrival that would have broken the aircraft into one it survives', () => {
    const hard = { verticalSpeed: -(CRASH_IMPACT_SPEED + 5) };
    assert.equal(touchdownOutcome(hard), CRASHED, 'on a hillside');
    assert.equal(touchdownOutcome({ ...hard, onRunway: true }), FLYING, 'on a strip');

    assert.equal(touchdownOutcome({ onRunway: true, verticalSpeed: -RUNWAY_IMPACT_SPEED }), CRASHED,
        'though a strip is not a promise, and past its own threshold it is still a wreck');
});

test('the limits can be moved without the rules being rewritten', () => {
    assert.equal(touchdownOutcome({ onRunway: true, verticalSpeed: -30 }, { sinkSpeed: 40 }), LANDED);
    assert.equal(touchdownOutcome({ verticalSpeed: -12 }, { impactSpeed: 10 }), CRASHED);
    assert.equal(LANDING_LIMITS.sinkSpeed, LANDING_SINK_SPEED, 'and the defaults are the constants');
});

// --- The outcome the rest of the game reads --------------------------------

test('a landing is held while the aircraft is on the strip, and counted once', () => {
    const state = createCrashState();

    assert.equal(recordTouchdown(state, LANDED), true, 'the first frame of it is news');
    assert.equal(groundOutcome(state), LANDED);
    assert.equal(hasLanded(state), true);
    assert.equal(state.landings, 1);

    assert.equal(recordTouchdown(state, LANDED), false, 'a rollout is not a second landing');
    assert.equal(state.landings, 1);
});

test('leaving the ground puts the outcome back to a flight in progress', () => {
    const state = createCrashState();
    recordTouchdown(state, LANDED);

    assert.equal(releaseGround(state), true);
    assert.equal(groundOutcome(state), FLYING);
    assert.equal(releaseGround(state), false, 'and a flight already flying has not just left the ground');
    assert.equal(state.landings, 1, 'the landing still happened');
});

test('a crash is an outcome as well as a countdown', () => {
    const state = createCrashState();

    assert.equal(recordTouchdown(state, CRASHED), true);
    assert.equal(groundOutcome(state), CRASHED);
    assert.equal(state.timer, CRASH_DURATION);

    assert.equal(recordTouchdown(state, CRASHED), false, 'a wreck cannot crash again');
    assert.equal(recordTouchdown(state, LANDED), false, 'nor land');
    assert.equal(releaseGround(state), false, 'nor fly out of it');
    assert.equal(groundOutcome(state), CRASHED);
});

test('clearing a crash clears the outcome with it', () => {
    const state = createCrashState();
    recordTouchdown(state, CRASHED);
    clearCrash(state);

    assert.equal(groundOutcome(state), FLYING);
    assert.equal(hasLanded(state), false);
});

test('a state from nowhere reads as a flight in progress rather than throwing', () => {
    assert.equal(groundOutcome(null), FLYING);
    assert.equal(groundOutcome(undefined), FLYING);
    assert.equal(hasLanded(null), false);
});
