import test from 'node:test';
import assert from 'node:assert/strict';
import {
    TILT_DEADZONE,
    TILT_CONTROLS,
    tiltAxes,
    createTiltState,
    tiltFlying,
    applyTiltReading,
    tiltOffset,
    levelTilt,
    tiltToInput,
    tiltNeedsPermission,
    requestTilt,
    screenAngle,
    TiltSensor
} from '../js/tilt-controls.js';
import {
    createInputState, AXIS_DIRECTIONAL, AXIS_INVERTED, DEFAULT_AXES
} from '../js/input-map.js';

/** A state that is wanted and already reporting, held at the angle given. */
function held(beta = 0, gamma = 0, angle = 0) {
    const state = createTiltState(true);
    applyTiltReading(state, beta, gamma, angle);
    return state;
}

const OVER = TILT_DEADZONE + 5;

// --- Reading the device -----------------------------------------------------

test('held upright, the device reports the pilot pitch as pitch', () => {
    const { pitch, roll } = tiltAxes(20, -10, 0);
    assert.ok(Math.abs(pitch - 20) < 1e-9);
    assert.ok(Math.abs(roll + 10) < 1e-9);
});

test('turned on its side, the device reports the pilot pitch as roll', () => {
    // A quarter turn of the screen is a quarter turn of the frame the readings
    // are taken in, which is the ordinary case: a flight simulator on a phone is
    // held sideways every time.
    const { pitch, roll } = tiltAxes(20, 0, 90);
    assert.ok(Math.abs(pitch) < 1e-9, 'the front-back reading has stopped being pitch');
    assert.ok(Math.abs(roll - 20) < 1e-9, 'and become roll');
});

test('a turn is a turn: the reading keeps its size whichever way the screen is', () => {
    for (const angle of [0, 90, 180, 270]) {
        const { pitch, roll } = tiltAxes(12, -5, angle);
        assert.ok(Math.abs(Math.hypot(pitch, roll) - Math.hypot(12, -5)) < 1e-9);
    }
});

// --- Wanted, and actually reporting -----------------------------------------

test('tilt is not flying until a sensor has said something', () => {
    const wanted = createTiltState(true);
    assert.equal(tiltFlying(wanted), false, 'a browser can refuse the sensor outright');

    applyTiltReading(wanted, 0, 0);
    assert.equal(tiltFlying(wanted), true);
});

test('a machine that never wanted tilt does not start flying by it', () => {
    const state = createTiltState(false);

    assert.equal(applyTiltReading(state, 30, 30), null, 'the reading is not taken');
    assert.equal(state.reading, null);
    assert.equal(tiltFlying(state), false);
});

// A browser with no gyroscope still fires one event, with every angle null.
// Read as zero that is a device held perfectly level, and the pads for pitch and
// roll come off the glass for a sensor that never arrived - on the one kind of
// machine that has no keys to fall back on.
test('a sensor reporting nothing is not a device held level', () => {
    const state = createTiltState(true);

    assert.equal(applyTiltReading(state, null, null), null, 'no numbers in it is no reading');
    assert.equal(state.reading, null);
    assert.equal(tiltFlying(state), false, 'so the pads stay on the glass');

    applyTiltReading(state, undefined, undefined);
    assert.equal(tiltFlying(state), false, 'an event with no angles on it at all reads the same');

    applyTiltReading(state, NaN, NaN);
    assert.equal(tiltFlying(state), false, 'and so does one that answered with nothing numeric');

    applyTiltReading(state, 0, 0);
    assert.equal(tiltFlying(state), true, 'a device genuinely held level is a reading, and zero');
});

test('the four attitude controls are left to whoever is holding them', () => {
    const state = createTiltState(true);
    const input = createInputState();
    input.pitchUp = true;

    applyTiltReading(state, null, null);
    tiltToInput(input, state);
    assert.equal(input.pitchUp, true, 'a sensor with nothing to say lets go of nothing');
});

test('one axis reported and the other silent is still a device saying something', () => {
    const state = createTiltState(true);

    assert.deepEqual(applyTiltReading(state, null, 20), { pitch: 0, roll: 20 },
        'a sensor that only knows roll can still fly the wings');
    assert.equal(tiltFlying(state), true);
});

test('the first reading is what level means, so a phone is held however it suits', () => {
    const state = held(40, -15);

    assert.deepEqual(state.zero, { pitch: 40, roll: -15 });
    assert.deepEqual(tiltOffset(state), { pitch: 0, roll: 0 },
        'the angle it was picked up at is straight and level');

    applyTiltReading(state, 50, -15);
    assert.deepEqual(tiltOffset(state), { pitch: 10, roll: 0 }, 'and ten degrees on is ten degrees');
});

test('levelling takes wherever the device is being held now as level', () => {
    const state = held(0, 0);
    applyTiltReading(state, 25, 8);

    levelTilt(state);
    assert.deepEqual(tiltOffset(state), { pitch: 0, roll: 0 });

    assert.deepEqual(levelTilt(createTiltState(true)), { pitch: 0, roll: 0 },
        'and a state with no reading levels to nothing rather than to undefined');
});

// --- What tilt writes -------------------------------------------------------

test('a device held still flies straight', () => {
    const input = tiltToInput(createInputState(), held(30, 30));
    assert.ok(TILT_CONTROLS.every(control => input[control] === false));
});

test('inside the deadzone is a hand rather than a control input', () => {
    const state = held(0, 0);
    applyTiltReading(state, TILT_DEADZONE - 1, TILT_DEADZONE - 1);

    const input = tiltToInput(createInputState(), state);
    assert.ok(TILT_CONTROLS.every(control => input[control] === false));
});

test('the device is the aircraft: it pitches and rolls the way it is turned', () => {
    const back = held(0, 0);
    applyTiltReading(back, OVER, 0);
    assert.equal(tiltToInput(createInputState(), back).pitchUp, true);

    const forward = held(0, 0);
    applyTiltReading(forward, -OVER, 0);
    assert.equal(tiltToInput(createInputState(), forward).pitchDown, true);

    const left = held(0, 0);
    applyTiltReading(left, 0, -OVER);
    assert.equal(tiltToInput(createInputState(), left).rollLeft, true);

    const right = held(0, 0);
    applyTiltReading(right, 0, OVER);
    assert.equal(tiltToInput(createInputState(), right).rollRight, true);
});

test('a control let go of on the device is let go of in the air', () => {
    const state = held(0, 0);
    const input = createInputState();

    applyTiltReading(state, OVER, 0);
    tiltToInput(input, state);
    assert.equal(input.pitchUp, true);

    applyTiltReading(state, 0, 0);
    tiltToInput(input, state);
    assert.equal(input.pitchUp, false, 'the device coming back to level is the stick centring');
});

// A tilt that has never reported shares the input state with the keys and the
// pads. Writing four released controls into it would be a sensor nobody has
// heard from taking the aircraft off whoever is flying it.
test('a tilt that is not flying writes nothing at all', () => {
    const input = createInputState();
    input.pitchUp = true;
    input.rollLeft = true;

    tiltToInput(input, createTiltState(true));
    assert.equal(input.pitchUp, true, 'a sensor that was asked for and never answered');

    tiltToInput(input, createTiltState(false));
    assert.equal(input.rollLeft, true, 'and one that was never wanted');
});

// --- Reaching the sensor ----------------------------------------------------

test('a browser that wants asking is asked, and one that does not is not', async () => {
    assert.equal(tiltNeedsPermission({}), false);
    assert.equal(await requestTilt({}), true, 'nothing to ask means nothing in the way');

    const asks = { DeviceOrientationEvent: { requestPermission: async () => 'granted' } };
    assert.equal(tiltNeedsPermission(asks), true);
    assert.equal(await requestTilt(asks), true);
});

test('anything other than a plain yes is a no', async () => {
    const refuses = { DeviceOrientationEvent: { requestPermission: async () => 'denied' } };
    assert.equal(await requestTilt(refuses), false);

    const throws = {
        DeviceOrientationEvent: { requestPermission: async () => { throw new Error('no gesture'); } }
    };
    assert.equal(await requestTilt(throws), false,
        'a browser that wants the ask made from a gesture throws when it was not');
});

test('the screen angle is read where the browser gives one and is nothing where it does not', () => {
    assert.equal(screenAngle({ screen: { orientation: { angle: 90 } } }), 90);
    assert.equal(screenAngle({}), 0);
    assert.equal(screenAngle({ screen: { orientation: {} } }), 0);
});

/** A window, as the three things the sensor asks of one. */
function fakeWindow(permission = null) {
    const listeners = new Map();
    return {
        DeviceOrientationEvent: permission ? { requestPermission: permission } : undefined,
        screen: { orientation: { angle: 0 } },
        addEventListener: (name, fn) => listeners.set(name, fn),
        removeEventListener: (name) => listeners.delete(name),
        send: (event) => listeners.get('deviceorientation')?.(event),
        get listening() { return listeners.has('deviceorientation'); }
    };
}

test('the sensor listens, reports, and stops', async () => {
    const state = createTiltState(true);
    const env = fakeWindow();
    const sensor = new TiltSensor(state, env);

    assert.equal(await sensor.start(), true);
    assert.equal(env.listening, true);

    env.send({ beta: 12, gamma: -4 });
    assert.deepEqual(state.reading, { pitch: 12, roll: -4 });

    assert.equal(sensor.stop(), true);
    assert.equal(env.listening, false);
    assert.equal(tiltFlying(state), false, 'a sensor stopped is a sensor no longer flying');
});

test('the sensor hands the angles over exactly as the event reported them', async () => {
    const state = createTiltState(true);
    const env = fakeWindow();
    await new TiltSensor(state, env).start();

    env.send({ alpha: null, beta: null, gamma: null });
    assert.equal(state.reading, null, 'the emulated phone with nothing driving its sensors');

    env.send({ alpha: 0, beta: 12, gamma: -4 });
    assert.deepEqual(state.reading, { pitch: 12, roll: -4 }, 'and a real orientation, arriving after');
});

test('a machine that does not want tilt never reaches for the sensor', async () => {
    const env = fakeWindow();
    assert.equal(await new TiltSensor(createTiltState(false), env).start(), false);
    assert.equal(env.listening, false);
});

test('a refused sensor is listened to no further, and the flight goes on', async () => {
    const env = fakeWindow(async () => 'denied');
    const sensor = new TiltSensor(createTiltState(true), env);

    assert.equal(await sensor.start(), false);
    assert.equal(env.listening, false);
    assert.equal(sensor.stop(), false, 'and there is nothing to stop');
});

test('a sensor already listening is not listened to twice', async () => {
    const env = fakeWindow();
    const sensor = new TiltSensor(createTiltState(true), env);

    await sensor.start();
    assert.equal(await sensor.start(), true, 'the answer is the same');
    assert.equal(sensor.stop(), true);
    assert.equal(sensor.stop(), false);
});

// --- Reading the device through the axes ------------------------------------

/** A device levelled where it was picked up and then turned off that neutral. */
function turned(beta = 0, gamma = 0) {
    const state = held(0, 0);
    applyTiltReading(state, beta, gamma);
    return state;
}

/**
 * Nose up is the top of the device coming toward the pilot and a wing down is
 * the same wing down on the device, which is the device being the aircraft.
 * That is still the default, and still the reason it is: a pilot who has not
 * asked for anything is flying the device itself rather than a stick.
 */
test('the device is the aircraft until a pair says otherwise', () => {
    for (const [beta, gamma, control] of [
        [OVER, 0, 'pitchUp'], [-OVER, 0, 'pitchDown'], [0, -OVER, 'rollLeft'], [0, OVER, 'rollRight']
    ]) {
        assert.equal(tiltToInput(createInputState(), turned(beta, gamma))[control], true,
            `${control} should be what the device asks for with no pair handed over`);
        assert.equal(
            tiltToInput(createInputState(), turned(beta, gamma), TILT_DEADZONE, DEFAULT_AXES)[control],
            true,
            'and the directional pair should be the same answer rather than a second one');
    }
});

/**
 * One setting rather than two more: the inversion is `axisControl`'s to apply
 * and the pair handed here is the same pair the keys are read through, so the
 * device cannot end up inverted on one axis for the keys and not for itself.
 */
test('an inverted pair turns the device over the way it turns the keys', () => {
    const axes = { pitch: AXIS_INVERTED, roll: AXIS_DIRECTIONAL };

    assert.equal(tiltToInput(createInputState(), turned(OVER, 0), TILT_DEADZONE, axes).pitchDown, true,
        'the top of the device coming toward the pilot lowers the nose on an inverted pitch');
    assert.equal(tiltToInput(createInputState(), turned(-OVER, 0), TILT_DEADZONE, axes).pitchUp, true);

    assert.equal(tiltToInput(createInputState(), turned(0, OVER), TILT_DEADZONE, axes).rollRight, true,
        'while the axis nobody turned over writes exactly what it always wrote');
});

test('both pairs turned over turns all four controls over', () => {
    const axes = { pitch: AXIS_INVERTED, roll: AXIS_INVERTED };
    const input = tiltToInput(createInputState(), turned(OVER, OVER), TILT_DEADZONE, axes);

    assert.equal(input.pitchDown, true);
    assert.equal(input.rollLeft, true);
    assert.equal(input.pitchUp, false);
    assert.equal(input.rollRight, false);
});

/**
 * An axis turned over exchanges the two ends of a pair that are both in
 * `TILT_CONTROLS`, so the four cleared on the way in cover the same four
 * whichever way the pair reads - and a device brought back inside the deadzone
 * lets go of what it was holding either way.
 */
test('a device brought back level lets go whichever way the pair reads', () => {
    const axes = { pitch: AXIS_INVERTED, roll: AXIS_INVERTED };
    const state = turned(OVER, OVER);
    const input = createInputState();

    tiltToInput(input, state, TILT_DEADZONE, axes);
    assert.equal(input.pitchDown, true);

    applyTiltReading(state, 0, 0);
    tiltToInput(input, state, TILT_DEADZONE, axes);
    for (const control of TILT_CONTROLS) {
        assert.equal(input[control], false, `${control} should be let go of`);
    }
});
