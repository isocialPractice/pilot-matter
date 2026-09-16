import test from 'node:test';
import assert from 'node:assert/strict';
import {
    CHASE_POSITION_LAMBDA,
    CHASE_TARGET_LAMBDA,
    CHASE_SNAP_DISTANCE,
    ORBIT_RATE,
    ORBIT_RATES,
    dampFactor,
    damp,
    shouldSnap,
    orbitStep
} from '../js/camera-math.js';

test('the damping factor closes part of the gap, never all of it', () => {
    const factor = dampFactor(CHASE_POSITION_LAMBDA, 1 / 60);
    assert.ok(factor > 0 && factor < 1, `factor ${factor} should be a partial step`);
});

test('a longer frame closes more of the gap than a shorter one', () => {
    assert.ok(dampFactor(CHASE_POSITION_LAMBDA, 0.05) > dampFactor(CHASE_POSITION_LAMBDA, 1 / 60));
});

test('a frozen clock holds the camera still, so a paused frame does not drift', () => {
    assert.equal(dampFactor(CHASE_POSITION_LAMBDA, 0), 0);
    assert.equal(damp(10, 200, CHASE_POSITION_LAMBDA, 0), 10);
});

test('a rewound or missing frame time moves nothing', () => {
    assert.equal(dampFactor(CHASE_POSITION_LAMBDA, -0.5), 0);
    assert.equal(dampFactor(CHASE_POSITION_LAMBDA, NaN), 0);
    assert.equal(damp(10, 200, 0, 0.016), 10, 'a camera with no pull never moves');
});

test('the lag is framerate independent, so the feel does not change with the frame time', () => {
    // One long frame and the many short frames that fill the same second
    // should leave the camera in the same place
    const oneStep = damp(0, 100, CHASE_POSITION_LAMBDA, 1);

    let stepped = 0;
    for (let frame = 0; frame < 60; frame++) {
        stepped = damp(stepped, 100, CHASE_POSITION_LAMBDA, 1 / 60);
    }
    assert.ok(Math.abs(stepped - oneStep) < 1e-9,
        `60 short frames landed on ${stepped}, one long frame on ${oneStep}`);
});

test('damping converges on the target and settles there', () => {
    let position = 0;
    for (let frame = 0; frame < 600; frame++) {
        position = damp(position, 100, CHASE_POSITION_LAMBDA, 1 / 60);
    }
    assert.ok(Math.abs(position - 100) < 1e-6, `camera settled at ${position}`);
});

test('damping never overshoots the offset it is chasing', () => {
    let position = 0;
    for (let frame = 0; frame < 200; frame++) {
        position = damp(position, 100, CHASE_POSITION_LAMBDA, 0.05);
        assert.ok(position <= 100, `camera overshot to ${position}`);
    }
});

test('damping works the same closing a gap from either side', () => {
    const up   = damp(0, 100, CHASE_POSITION_LAMBDA, 0.05);
    const down = damp(100, 0, CHASE_POSITION_LAMBDA, 0.05);
    assert.ok(Math.abs((100 - down) - up) < 1e-9, 'the camera should lag symmetrically');
});

test('the camera trails further than the point it looks at', () => {
    assert.ok(CHASE_TARGET_LAMBDA > CHASE_POSITION_LAMBDA,
        'the aircraft should lead the frame through a turn');
});

test('a gap wider than a manoeuvre is cut across rather than flown', () => {
    assert.equal(shouldSnap(CHASE_SNAP_DISTANCE + 1), true);
    assert.equal(shouldSnap(CHASE_SNAP_DISTANCE), false);
    assert.equal(shouldSnap(0), false);
});

test('the snap distance is wider than the lag a normal frame builds up', () => {
    // Worst case at the capped frame time and full speed: the offset moves
    // 200 units/s * 0.05 s, well inside the snap distance
    assert.ok(CHASE_SNAP_DISTANCE > 200 * 0.05,
        'ordinary flight must not trip the snap and lose the lag');
});

// --- The orbit sweep -------------------------------------------------------

/**
 * The orbit view used to sweep at 0.4 radians a second - 23 degrees, a circle
 * in under 16 - which is faster than a pilot can read the ground it is showing
 * them. The rate is a setting now, and the default is half of what it was.
 */
test('the sweep is slow enough to read the world from', () => {
    assert.ok(ORBIT_RATE < 23, `a circle at ${ORBIT_RATE} degrees a second, against the 23 it was`);
    assert.ok(360 / ORBIT_RATE >= 25, 'which is at least twenty-five seconds the whole way round');
});

test('the rates on offer run either side of the default', () => {
    assert.ok(ORBIT_RATES.includes(ORBIT_RATE), 'the default is one of the settings offered');
    assert.ok(ORBIT_RATES[0] < ORBIT_RATE, 'with something slower to pick');
    assert.ok(ORBIT_RATES[ORBIT_RATES.length - 1] > ORBIT_RATE, 'and something faster');
    assert.deepEqual([...ORBIT_RATES].sort((a, b) => a - b), [...ORBIT_RATES],
        'listed in the order a dial turns');
});

test('a sweep is the bearing it turns through, in the time it is given', () => {
    assert.equal(orbitStep(180, 1), Math.PI, 'half a circle in a second');
    assert.equal(orbitStep(180, 2), Math.PI * 2, 'and the whole of one in two');
    assert.equal(orbitStep(0, 1), 0, 'a rate of nothing holds the view still');
});

test('a frozen clock holds the sweep where it was', () => {
    assert.equal(orbitStep(ORBIT_RATE, 0), 0);
    assert.equal(orbitStep(ORBIT_RATE, -1), 0, 'and time never runs backwards');
});

test('a rate that is not a number leaves the view still rather than undefined', () => {
    assert.equal(orbitStep(null, 1), 0);
    assert.equal(orbitStep(undefined, 1), 0);
    assert.equal(orbitStep(NaN, 1), 0);
});
