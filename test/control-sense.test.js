import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { attitudeFrom, boundAttitude, turnSign } from '../js/attitude.js';
import { controlRates } from '../js/flight-model.js';
import {
    createInputState,
    applyKeyToInput,
    resolveAxes,
    AXIS_DIRECTIONAL,
    AXIS_INVERTED
} from '../js/input-map.js';

/**
 * Which way a control actually flies the aircraft.
 *
 * Everything else in test/ pins which input field a control writes:
 * test/input-map.test.js for a key, test/tilt-controls.test.js for a tilt, and
 * test/flight-state.test.js treats `rotation.z` only as a value carried or
 * zeroed. None of that can tell a field wired to the wrong end of the flight
 * model from one wired to the right end, and twice now it has not: the pitch
 * keys flew W into a dive, and the roll keys left the ROLL AXIS row offering
 * its two settings the wrong way round.
 *
 * So these read the attitude instead of the angle behind it. `forwardY` and
 * `rightY` are where the nose and the right wing are actually pointing, which
 * is the thing a pilot sees out of the window, and an assertion about them
 * stays true whichever way the flight model chooses to sign its Euler.
 */

// js/aircraft.js imports Three.js and wants a scene, so it cannot be flown
// here. The frame's rotation steps are mirrored below out of the same shared
// functions it calls, in the same order, and its source is read to hold that
// mirror honest: a sign changed in the frame and not here fails
// `the mirrored frame is the frame the aircraft actually flies` rather than
// quietly passing against a copy nobody flies.
const aircraftSource = readFileSync(
    fileURLToPath(new URL('../js/aircraft.js', import.meta.url)),
    'utf8'
);

const DT = 1 / 60;

/**
 * The rotation half of `Aircraft.update`, run for a while with one set of
 * controls held, and the attitude it leaves the aircraft in.
 *
 * `heading` is `-rotation.y` because that is how `getFlightData` reads one out,
 * so a rising heading here is a rising bearing on the compass.
 */
function flyHeld(input, { seconds = 1, fullRotation = false } = {}) {
    const rates    = controlRates();
    const rotation = { x: 0, y: 0, z: 0 };

    for (let t = 0; t < seconds; t += DT) {
        if (input.pitchUp)   rotation.x -= rates.pitch * DT;
        if (input.pitchDown) rotation.x += rates.pitch * DT;

        if (input.rollLeft)  rotation.z -= rates.roll * DT;
        if (input.rollRight) rotation.z += rates.roll * DT;

        const bounded = boundAttitude(rotation.x, rotation.z, fullRotation);
        rotation.x = bounded.pitch;
        rotation.z = bounded.roll;

        if (!input.rollLeft && !input.rollRight) rotation.z *= (1 - DT * 1.5);

        if (input.yawLeft)  rotation.y += rates.yaw * DT;
        if (input.yawRight) rotation.y -= rates.yaw * DT;

        rotation.y -= Math.sin(rotation.z) * 1.2 * DT * turnSign(rotation.x);
    }

    return {
        ...attitudeFrom(rotation.x, rotation.z),
        heading: -rotation.y,
        rotation
    };
}

/** The aircraft flown on a real key press, through whichever way the axes are set. */
function flyKey(code, axes) {
    const input = createInputState();
    applyKeyToInput(input, code, true, undefined, axes);
    return flyHeld(input);
}

// --- Which way the stick flies the aircraft --------------------------------

test('the nose follows the pitch controls, read off where the nose points', () => {
    const up   = flyHeld({ pitchUp: true });
    const down = flyHeld({ pitchDown: true });

    assert.ok(up.forwardY > 0,
        `holding pitch up left the nose at forwardY ${up.forwardY.toFixed(3)}, which is not above the horizon`);
    assert.ok(down.forwardY < 0,
        `holding pitch down left the nose at forwardY ${down.forwardY.toFixed(3)}, which is not below it`);
    assert.ok(up.forwardY > down.forwardY, 'and a climb is a higher nose than a descent');
});

test('the wings follow the roll controls, read off where the right wing points', () => {
    const left  = flyHeld({ rollLeft: true });
    const right = flyHeld({ rollRight: true });

    // The right wing going up is the left wing going down, which is what a
    // roll to the left is. Reading the wing rather than the bank angle behind
    // it is what makes this say the thing a pilot would notice.
    assert.ok(left.rightY > 0,
        `rolling left left the right wing at rightY ${left.rightY.toFixed(3)}, so the left wing did not drop`);
    assert.ok(right.rightY < 0,
        `rolling right left the right wing at rightY ${right.rightY.toFixed(3)}, so the right wing did not drop`);
    assert.ok(left.rightY > right.rightY, 'and the two controls bank opposite ways');
});

test('the coordinated turn follows the wing that dropped', () => {
    const left  = flyHeld({ rollLeft: true });
    const right = flyHeld({ rollRight: true });

    assert.ok(left.heading < 0,
        `a left bank carried the heading to ${left.heading.toFixed(3)}, which is not a left turn`);
    assert.ok(right.heading > 0,
        `a right bank carried the heading to ${right.heading.toFixed(3)}, which is not a right turn`);
});

test('neither axis moves the other one', () => {
    const pitched = flyHeld({ pitchUp: true });
    const rolled  = flyHeld({ rollLeft: true });

    assert.ok(Math.abs(pitched.rightY) < 1e-9, 'a pitch input leaves the wings level');
    assert.ok(Math.abs(rolled.forwardY) < 1e-9, 'and a roll input leaves the nose where it was');
});

test('an aircraft nobody is flying sits level', () => {
    const level = flyHeld({}, { seconds: 2 });

    assert.ok(Math.abs(level.forwardY) < 1e-9, 'the nose stays on the horizon');
    assert.ok(Math.abs(level.rightY) < 1e-9, 'the wings stay level');
    assert.ok(level.upY > 0.999, 'and up stays up');
    assert.ok(Math.abs(level.heading) < 1e-9, 'with the heading where it started');
});

// --- Which way the keys fly it, on either setting of the axis --------------

/**
 * The fault this file was written for. `ROLL AXIS` defaults to `DIRECTIONAL`,
 * and js/input-map.js says over `AXIS_DIRECTIONAL` that directional means the
 * key points where the aircraft goes - so A on the default has to drop the
 * left wing and turn left. It dropped the right wing and turned right, because
 * `rollLeft` was attached to the end of the flight model that banks right.
 *
 * CHEATSHEET.md, README.md and docs/cheatsheet.html all list A as Roll left
 * with no setting named, so they describe the default, and these are what hold
 * them true.
 */
test('A rolls left and D rolls right on the default axis', () => {
    const axes = resolveAxes({ roll: AXIS_DIRECTIONAL });
    const a = flyKey('KeyA', axes);
    const d = flyKey('KeyD', axes);

    assert.ok(a.rightY > 0 && a.heading < 0,
        `A left the right wing at rightY ${a.rightY.toFixed(3)} and the heading at ${a.heading.toFixed(3)}`);
    assert.ok(d.rightY < 0 && d.heading > 0,
        `D left the right wing at rightY ${d.rightY.toFixed(3)} and the heading at ${d.heading.toFixed(3)}`);
});

test('W raises the nose and S lowers it on the default axis', () => {
    const axes = resolveAxes({ pitch: AXIS_DIRECTIONAL });

    assert.ok(flyKey('KeyW', axes).forwardY > 0, 'W climbs');
    assert.ok(flyKey('KeyS', axes).forwardY < 0, 'and S descends');
});

test('an inverted axis flies the mirror of the directional one', () => {
    const roll = flyKey('KeyA', resolveAxes({ roll: AXIS_INVERTED }));
    assert.ok(roll.rightY < 0 && roll.heading > 0,
        'A on an inverted roll axis drops the right wing and turns right');

    const pitch = flyKey('KeyW', resolveAxes({ pitch: AXIS_INVERTED }));
    assert.ok(pitch.forwardY < 0, 'and W on an inverted pitch axis lowers the nose');
});

test('the arrow keys fly whatever their letters fly', () => {
    for (const axis of [AXIS_DIRECTIONAL, AXIS_INVERTED]) {
        const axes = resolveAxes({ pitch: axis, roll: axis });
        assert.equal(flyKey('ArrowLeft', axes).rightY, flyKey('KeyA', axes).rightY,
            `the left arrow and A should bank the same way on ${axis}`);
        assert.equal(flyKey('ArrowUp', axes).forwardY, flyKey('KeyW', axes).forwardY,
            `the up arrow and W should pitch the same way on ${axis}`);
    }
});

// --- That the mirror above is the frame the aircraft flies -----------------

test('the mirrored frame is the frame the aircraft actually flies', () => {
    for (const line of [
        'if (this.input.pitchUp)   this.rotation.x -= this.rates.pitch * dt;',
        'if (this.input.pitchDown) this.rotation.x += this.rates.pitch * dt;',
        'if (this.input.rollLeft)  this.rotation.z -= this.rates.roll * dt;',
        'if (this.input.rollRight) this.rotation.z += this.rates.roll * dt;',
        'this.rotation.y -= Math.sin(this.rotation.z) * 1.2 * dt * turnSign(this.rotation.x);'
    ]) {
        assert.ok(aircraftSource.includes(line),
            `js/aircraft.js should still fly "${line}" - the mirror above assumes it does`);
    }
});

test('the aircraft reads its attitude out of the same function these do', () => {
    assert.ok(aircraftSource.includes('return attitudeFrom(this.rotation.x, this.rotation.z);'),
        'js/aircraft.js should answer getAttitude() out of js/attitude.js');
    assert.ok(aircraftSource.includes('heading: -this.rotation.y'),
        'and report a heading as the negative of its own Y rotation');
});

// --- The arithmetic the readings rest on -----------------------------------

test('a level attitude is a nose on the horizon and wings across it', () => {
    const level = attitudeFrom(0, 0);

    // Read to a tolerance rather than against zero itself: a negated sine of
    // nothing is -0, which is the same direction written with a sign on it.
    assert.ok(Math.abs(level.forwardY) < 1e-12, 'the nose is on the horizon');
    assert.ok(Math.abs(level.rightY) < 1e-12, 'and the wings are across it');
    assert.equal(level.upY, 1, 'with up pointing straight up');
});

test('the attitude reads the angles the way the model is built', () => {
    // Nose-first along +Z with the right wing on -X: a positive pitch angle
    // puts the nose down and a positive bank drops the right wing.
    assert.ok(attitudeFrom(Math.PI / 6, 0).forwardY < 0, 'a positive pitch angle is a nose down');
    assert.ok(attitudeFrom(-Math.PI / 6, 0).forwardY > 0, 'and a negative one a nose up');
    assert.ok(attitudeFrom(0, Math.PI / 6).rightY < 0, 'a positive bank drops the right wing');
    assert.ok(attitudeFrom(0, -Math.PI / 6).rightY > 0, 'and a negative one the left');
});

test('an attitude is a direction, so its three readings make up one', () => {
    for (const pitch of [-1, -0.4, 0, 0.4, 1]) {
        for (const roll of [-2, -0.7, 0, 0.7, 2]) {
            const { forwardY, rightY, upY } = attitudeFrom(pitch, roll);
            assert.ok(Math.abs(forwardY ** 2 + rightY ** 2 + upY ** 2 - 1) < 1e-12,
                `the attitude at ${pitch}, ${roll} is not a unit direction`);
        }
    }
});

test('inverted is the wings the other way up, not the nose', () => {
    const upright  = attitudeFrom(0, 0);
    const inverted = attitudeFrom(0, Math.PI);

    assert.ok(upright.upY > 0.999, 'upright, up points up');
    assert.ok(inverted.upY < -0.999, 'rolled all the way over, it points down');
    assert.ok(Math.abs(inverted.forwardY) < 1e-12, 'with the nose still on the horizon');
});
