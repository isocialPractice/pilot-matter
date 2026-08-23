import test from 'node:test';
import assert from 'node:assert/strict';
import {
    MIN_SPEED,
    CRUISE_SPEED,
    MAX_SPEED,
    GRAVITY,
    STALL_SINK_MULTIPLIER,
    THROTTLE_RATE,
    SPEED_ACCEL,
    SPEED_DECEL,
    PITCH_RATE,
    ROLL_RATE,
    YAW_RATE,
    CONTROL_SENSITIVITY,
    MIN_SENSITIVITY,
    MAX_SENSITIVITY,
    updateThrottle,
    targetSpeed,
    convergeSpeed,
    liftFactor,
    isStalled,
    sinkRate,
    controlRates
} from '../js/flight-model.js';
import { createFlightState, INITIAL_THROTTLE } from '../js/flight-state.js';
import { throttleToPercent } from '../js/hud.js';

// --- Throttle as a setting ---

test('holding throttle up walks the lever toward full and stops there', () => {
    let throttle = 0;
    for (let i = 0; i < 10; i++) {
        throttle = updateThrottle(throttle, { throttleUp: true }, 0.5);
    }
    assert.equal(throttle, 1, 'the lever should stop at 100%');
});

test('holding throttle down walks the lever back to closed and stops there', () => {
    let throttle = 1;
    for (let i = 0; i < 10; i++) {
        throttle = updateThrottle(throttle, { throttleDown: true }, 0.5);
    }
    assert.equal(throttle, 0, 'the lever should stop at 0%');
});

test('a full throttle sweep takes the documented two seconds', () => {
    assert.equal(THROTTLE_RATE, 0.5);
    assert.equal(updateThrottle(0, { throttleUp: true }, 2), 1);
    assert.equal(updateThrottle(0, { throttleUp: true }, 1), 0.5);
});

test('pressing both throttle keys cancels out', () => {
    const throttle = updateThrottle(0.4, { throttleUp: true, throttleDown: true }, 0.5);
    assert.ok(Math.abs(throttle - 0.4) < 1e-9, `throttle drifted to ${throttle}`);
});

test('no throttle input leaves the setting where the pilot left it', () => {
    assert.equal(updateThrottle(0.62, {}, 0.5), 0.62);
});

test('the throttle setting is what the HUD reports, not the current speed', () => {
    // A half-open throttle reads 50% the instant it is set, while airspeed
    // is still climbing toward the target it asks for.
    const throttle = 0.5;
    assert.equal(throttleToPercent(throttle), 50);
    assert.equal(targetSpeed(throttle), MAX_SPEED / 2);
    assert.ok(convergeSpeed(0, targetSpeed(throttle), 0.1) < targetSpeed(throttle),
        'speed should still be catching up to the setting');
});

test('flight starts on a part-open throttle, already asking for its airspeed', () => {
    const state = createFlightState();
    assert.equal(state.throttle, INITIAL_THROTTLE);
    assert.equal(throttleToPercent(state.throttle), 20);
    assert.equal(targetSpeed(state.throttle), state.speed,
        'a lever asking for a different speed would drift off the configured start');
});

// --- Speed converging toward the setting ---

test('the throttle setting picks the target speed it asks for', () => {
    assert.equal(targetSpeed(0), 0);
    assert.equal(targetSpeed(1), MAX_SPEED);
    assert.equal(targetSpeed(0.25), MAX_SPEED * 0.25);
});

test('targetSpeed clamps a lever pushed past its stops', () => {
    assert.equal(targetSpeed(1.4), MAX_SPEED);
    assert.equal(targetSpeed(-0.3), 0);
});

test('speed climbs toward the target rather than jumping to it', () => {
    const target = MAX_SPEED;
    const afterOneFrame = convergeSpeed(0, target, 0.1);
    assert.equal(afterOneFrame, SPEED_ACCEL * 0.1);
    assert.ok(afterOneFrame < target, 'one frame should not reach full speed');
});

test('speed bleeds off toward a lower target, more gently than it builds', () => {
    assert.ok(SPEED_DECEL < SPEED_ACCEL, 'drag should be gentler than the engine');
    assert.equal(convergeSpeed(200, 0, 0.1), 200 - SPEED_DECEL * 0.1);
});

test('speed settles exactly on the target instead of oscillating past it', () => {
    // Within a single step of the target, converge snaps to it
    assert.equal(convergeSpeed(119.9, 120, 1), 120);
    assert.equal(convergeSpeed(120.1, 120, 1), 120);
    assert.equal(convergeSpeed(120, 120, 1), 120);
});

test('a held throttle setting converges on its target and stays there', () => {
    let speed = 0;
    const target = targetSpeed(0.6);
    for (let i = 0; i < 200; i++) speed = convergeSpeed(speed, target, 0.05);
    assert.equal(speed, target);
    assert.equal(convergeSpeed(speed, target, 0.05), target, 'speed should hold once settled');
});

// --- Lift, stall, and level flight ---

test('lift builds with airspeed and caps at the weight of the aircraft', () => {
    assert.equal(liftFactor(0), 0);
    assert.equal(liftFactor(CRUISE_SPEED), 1);
    assert.equal(liftFactor(MAX_SPEED), 1, 'extra speed must not lift on its own');
    assert.ok(liftFactor(CRUISE_SPEED / 2) > 0 && liftFactor(CRUISE_SPEED / 2) < 1);
});

test('the wing is stalled below the minimum speed and flying at or above it', () => {
    assert.equal(isStalled(0), true);
    assert.equal(isStalled(MIN_SPEED - 0.1), true);
    assert.equal(isStalled(MIN_SPEED), false);
    assert.equal(isStalled(CRUISE_SPEED), false);
});

test('level flight at cruise speed holds altitude', () => {
    assert.equal(sinkRate(CRUISE_SPEED), 0);
    assert.equal(sinkRate(MAX_SPEED), 0, 'faster than cruise should still hold, not climb');
});

test('a stalled aircraft sinks faster than an unstalled one', () => {
    const stalled = sinkRate(MIN_SPEED / 2);
    const flying  = sinkRate(MIN_SPEED);
    assert.ok(stalled > flying, `stall sink ${stalled} should beat ${flying}`);
    assert.ok(stalled > GRAVITY, 'a stall should sink harder than plain gravity');
});

test('a dead stop sinks at the full stall multiple of gravity', () => {
    assert.equal(sinkRate(0), GRAVITY * STALL_SINK_MULTIPLIER);
});

test('the stall penalty eases in rather than snapping on at the stall speed', () => {
    const justFlying  = sinkRate(MIN_SPEED);
    const justStalled = sinkRate(MIN_SPEED - 0.001);
    assert.ok(Math.abs(justStalled - justFlying) < 0.01,
        `sink jumped from ${justFlying} to ${justStalled} across the stall speed`);
});

test('sink falls away as speed builds, all the way to level flight', () => {
    let previous = sinkRate(0);
    for (let speed = 5; speed <= CRUISE_SPEED; speed += 5) {
        const current = sinkRate(speed);
        assert.ok(current < previous, `sink did not ease at ${speed} units/s`);
        previous = current;
    }
    assert.equal(previous, 0);
});

test('sink is never negative, so the model never lifts the aircraft by itself', () => {
    for (let speed = 0; speed <= MAX_SPEED * 2; speed += 7) {
        assert.ok(sinkRate(speed) >= 0, `sinkRate(${speed}) went negative`);
    }
});

test('a flight opening the throttle from its start climbs clear of the stall', () => {
    // The configured start sits right on the stall speed, where the wing is
    // carrying but has nothing in hand. Opening the lever is what buys the
    // margin back.
    const state = createFlightState();
    let { speed, throttle } = state;
    assert.equal(isStalled(speed), false, 'the start is not a stall, but it is the edge of one');
    assert.equal(speed, MIN_SPEED, 'and the edge is exactly where it sits');

    const dt = 1 / 60;
    for (let frame = 0; frame < 120; frame++) {
        throttle = updateThrottle(throttle, { throttleUp: true }, dt);
        speed = convergeSpeed(speed, targetSpeed(throttle), dt);
    }
    // Two seconds of 60 fps frames is a full sweep, give or take the float
    // rounding of 120 additions
    assert.equal(throttleToPercent(throttle), 100);
    assert.ok(!isStalled(speed), `still stalled at ${speed} units/s after two seconds`);
    assert.ok(sinkRate(speed) < sinkRate(state.speed), 'sink should have eased off');
});

// --- How hard the controls bite ---

test('the controls are tuned at a sensitivity of one, which is where a flight starts', () => {
    assert.deepEqual(controlRates(CONTROL_SENSITIVITY), {
        pitch: PITCH_RATE,
        roll: ROLL_RATE,
        yaw: YAW_RATE
    });
    assert.deepEqual(controlRates(), controlRates(CONTROL_SENSITIVITY));
});

test('a sensitivity setting scales every control by the same amount', () => {
    const doubled = controlRates(2);
    assert.equal(doubled.pitch, PITCH_RATE * 2);
    assert.equal(doubled.roll, ROLL_RATE * 2);
    assert.equal(doubled.yaw, YAW_RATE * 2);

    // The aircraft the setting changes is still the same aircraft: roll is
    // still the quickest control and yaw still the slowest.
    assert.ok(doubled.roll > doubled.pitch);
    assert.ok(doubled.pitch > doubled.yaw);
});

test('a sensitivity outside the range is held to the range rather than flown at', () => {
    assert.deepEqual(controlRates(0), controlRates(MIN_SENSITIVITY));
    assert.deepEqual(controlRates(-4), controlRates(MIN_SENSITIVITY));
    assert.deepEqual(controlRates(400), controlRates(MAX_SENSITIVITY));
});

test('a sensitivity that is not a number leaves the controls where they were tuned', () => {
    for (const value of [undefined, null, 'twice as much', NaN]) {
        assert.deepEqual(controlRates(value), controlRates(CONTROL_SENSITIVITY));
    }
});
