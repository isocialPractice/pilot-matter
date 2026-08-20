import test from 'node:test';
import assert from 'node:assert/strict';
import {
    GROUND_CLEARANCE,
    CRASH_IMPACT_SPEED,
    CRASH_DURATION,
    createCrashState,
    isCrashImpact,
    beginCrash,
    clearCrash,
    updateCrash,
    controlsLocked,
    crashProgress
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
