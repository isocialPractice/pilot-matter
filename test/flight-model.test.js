import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
    MIN_SPEED,
    CRUISE_SPEED,
    MAX_SPEED,
    GRAVITY,
    STALL_SINK_MULTIPLIER,
    THROTTLE_RATE,
    SPEED_ACCEL,
    SPEED_DECEL,
    GLIDE_SPEED,
    GLIDE_PITCH_SPEED,
    PITCH_RATE,
    ROLL_RATE,
    YAW_RATE,
    CONTROL_SENSITIVITY,
    MIN_SENSITIVITY,
    MAX_SENSITIVITY,
    updateThrottle,
    targetSpeed,
    convergeSpeed,
    glideSpeed,
    glideDescent,
    liftFactor,
    isStalled,
    sinkRate,
    controlRates,
    pitchForClimb,
    LEVEL_OFF_SECONDS,
    levelOffProgress,
    pitchLevellingOff
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

// --- Which way the stick is wired -----------------------------------------

// js/aircraft.js imports Three.js, so the binding it writes is read off its
// source, the way the HUD's contract with it is.
const aircraftSource = readFileSync(
    fileURLToPath(new URL('../js/aircraft.js', import.meta.url)),
    'utf8'
);

/**
 * `pitchForClimb` is where the simulator writes down which way the X part of
 * the aircraft's rotation runs: it negates the angle, because the model flies
 * nose-first along +Z and a positive rotation about +X carries that nose down.
 *
 * The keys, the tilt and the pads all reach the aircraft through `pitchUp` and
 * `pitchDown`, and for a while those raised the angle for `pitchUp` - so W,
 * the pad labelled PITCH + and a device tilted back every one of them flew the
 * nose the opposite way to what is written on the glass and in the controls.
 */
test('a climb is a lower pitch angle, and the control that climbs lowers it', () => {
    assert.ok(pitchForClimb(10, CRUISE_SPEED) < 0,
        'a climb asks for a negative rotation about +X');
    assert.ok(pitchForClimb(-10, CRUISE_SPEED) > pitchForClimb(10, CRUISE_SPEED),
        'and a descent for a higher one than a climb');

    const binding = (control) => aircraftSource.match(
        new RegExp(String.raw`input\.${control}\)\s*this\.rotation\.x\s*([+-])=`)
    )?.[1];

    assert.equal(binding('pitchUp'), '-',
        'so the control that raises the nose is the one that lowers the angle');
    assert.equal(binding('pitchDown'), '+',
        'and the one that drops the nose is the one that raises it');
});


// --- The nose settling to level -------------------------------------------

/**
 * A level off is watched as much as it is read. The vertical speed going to
 * zero is only half of it; the other half is the aeroplane settling, and an
 * attitude that snapped to level on the frame the key went down would read as
 * a rendering fault rather than as an aircraft levelling off.
 */
test('a level off runs from the press to level over the stated interval', () => {
    assert.ok(LEVEL_OFF_SECONDS > 0, 'the ease has to take some time to be an ease');

    assert.equal(levelOffProgress(0), 0, 'nothing has moved on the frame the key goes down');
    assert.equal(levelOffProgress(LEVEL_OFF_SECONDS), 1, 'and it is over when the interval is');
    assert.equal(levelOffProgress(LEVEL_OFF_SECONDS * 4), 1,
        'a frame that arrives late finds it finished rather than overshot');
    assert.equal(levelOffProgress(-1), 0, 'and a clock that ran backwards does not undo it');
});

test('the nose leaves its attitude gently and arrives at level gently', () => {
    const half = LEVEL_OFF_SECONDS / 2;
    const step = LEVEL_OFF_SECONDS / 20;

    assert.equal(levelOffProgress(half), 0.5, 'half way through the interval is half way to level');
    assert.ok(levelOffProgress(step) < step / LEVEL_OFF_SECONDS,
        'the first frames move the nose less than a straight line would');
    assert.ok(1 - levelOffProgress(LEVEL_OFF_SECONDS - step) < step / LEVEL_OFF_SECONDS,
        'and the last frames settle onto level rather than stopping dead at it');

    let previous = -1;
    for (let elapsed = 0; elapsed <= LEVEL_OFF_SECONDS; elapsed += step) {
        const now = levelOffProgress(elapsed);
        assert.ok(now >= previous, `the ease went backwards at ${elapsed}s`);
        previous = now;
    }
});

test('the ease is exact at both ends, so nothing is left a fraction nose-up', () => {
    const climb = pitchForClimb(20, CRUISE_SPEED);
    assert.ok(climb < 0, 'the aircraft starts in a climb');

    assert.equal(pitchLevellingOff(climb, 0), climb,
        'the nose starts where the pilot left it');
    assert.equal(pitchLevellingOff(climb, LEVEL_OFF_SECONDS), 0,
        'and finishes at a flat zero rather than near one');
    assert.equal(pitchLevellingOff(climb, LEVEL_OFF_SECONDS * 2), 0,
        'and stays there once it is there');

    // Within a degree of level well before the interval is out, which is the
    // reading the item asks for once the ease has finished and then some.
    const degree = Math.PI / 180;
    assert.ok(Math.abs(pitchLevellingOff(climb, LEVEL_OFF_SECONDS)) < degree);

    const dive = pitchForClimb(-20, CRUISE_SPEED);
    assert.ok(dive > 0, 'and a descent is levelled off the same way from the other side');
    assert.equal(pitchLevellingOff(dive, LEVEL_OFF_SECONDS), 0);
});

test('an interval of nothing is a level off that has already happened', () => {
    assert.equal(levelOffProgress(0, 0), 1, 'rather than a division by zero');
    assert.equal(pitchLevellingOff(0.4, 0, 0), 0);
    assert.equal(levelOffProgress(0, -1), 1, 'and an interval that runs backwards is not one');
});

// The ease belongs to the model, and the attitude indicator reads the model's
// own pitch. One value eased once is what keeps the horizon and the dial from
// disagreeing by a frame, which is what happens when each eases its own copy.
test('the aircraft eases the model pitch rather than keeping a second copy', () => {
    assert.ok(aircraftSource.includes('pitchLevellingOff(this.levelling.from, this.levelling.elapsed)'),
        'js/aircraft.js should ease its own rotation through the shared helper');
    assert.ok(/levelOff\(\)\s*\{[^}]*this\.levelling = \{ from: this\.rotation\.x, elapsed: 0 \}/
        .test(aircraftSource),
        'starting from the attitude the pilot actually left it in');
    assert.ok(/endLevelOff\(\)\s*\{[\s\S]*?this\.holdingAltitude = false;[\s\S]*?this\.levelling = null;/
        .test(aircraftSource),
        'and let go of the altitude and the nose together when it is handed back');
    assert.ok(aircraftSource.includes('if (wantsVerticalChange(this.input)) this.endLevelOff();'),
        'which is what a call for a different vertical state does');
});

// Nothing here asks for the wings to be levelled, and a wing-level is a
// decision of its own. Rolling the aircraft on a keypress nobody pressed for
// it is the kind of surprise this item exists to remove.
test('levelling off moves the nose and nothing else', () => {
    const between = (open, close) => {
        const from = aircraftSource.indexOf(open);
        const to   = aircraftSource.indexOf(close, from + 1);
        return from < 0 || to < 0 ? '' : aircraftSource.slice(from, to);
    };

    const levelling = between('if (this.levelling) {', '// Roll');
    assert.ok(levelling, 'the ease should run as a block of its own in the frame loop');
    assert.ok(levelling.includes('this.rotation.x ='), 'writing the pitch');
    assert.ok(!/rotation\.[yz]/.test(levelling),
        'and leaving the roll and the heading exactly where the pilot left them');

    const levelOff = between('    levelOff() {', 'Hands the aircraft back');
    assert.ok(levelOff, 'and the press itself should be a method of its own');
    assert.ok(!/rotation\.[yz]/.test(levelOff), 'which does not touch them either');
});

// Where the handback sits in the frame loop is the whole of whether taking the
// pitch back is answered now or a frame from now. Read after the ease instead
// of before it, the ease would write the nose one more time on the frame the
// pilot pulled, and the pull they felt would be the one they made a frame ago.
// Both lines are in `update`, so only their order says which happens.
test('the pilot taking the pitch back is answered on that frame, not the next one', () => {
    const handback = aircraftSource.indexOf('if (wantsVerticalChange(this.input)) this.endLevelOff();');
    const ease     = aircraftSource.indexOf('if (this.levelling) {');

    assert.ok(handback >= 0, 'the frame loop should read the call for a different vertical state');
    assert.ok(ease >= 0, 'and run the ease as a block of its own');
    assert.ok(handback < ease,
        'and read the handback first, so a frame that hands the aircraft back does not '
      + 'also ease the nose it has just given away');
});

// --- The glide ------------------------------------------------------------

// The lever picks the speed under power. With no engine the nose does, because
// there is nothing else left to pick it: a dive buys airspeed with height and a
// nose-up spends it back.
test('a glide takes its airspeed from the nose', () => {
    assert.equal(glideSpeed(0), GLIDE_SPEED, 'level is the speed a glide settles at');
    assert.ok(glideSpeed(0.1) > GLIDE_SPEED, 'nose down buys speed');
    assert.ok(glideSpeed(-0.1) < GLIDE_SPEED, 'and nose up spends it');

    // The same sign the model carries its attitude in, which is the sign
    // `pitchForClimb` negates: a positive rotation about +X is nose down.
    assert.ok(Math.abs(glideSpeed(0.1) - (GLIDE_SPEED + 0.1 * GLIDE_PITCH_SPEED)) < 1e-9);
});

test('a glide is floored at a standstill and capped where the engine is', () => {
    assert.equal(glideSpeed(-Math.PI / 2), 0, 'a nose straight up leaves no speed, not a negative one');
    assert.equal(glideSpeed(Math.PI / 2), MAX_SPEED, 'and a dive is fast rather than unbounded');
    assert.equal(glideSpeed(Math.PI / 2, { maxSpeed: 90 }), 90, 'to whatever cap it is given');
});

/**
 * The one thing a dead stick has to be, swept rather than sampled.
 *
 * A glide that came out level or climbing at some attitude would be an aircraft
 * holding height on no engine and holding it forever, which is the dead stick
 * quietly stopping being one. It is not a thing anyone would find by flying -
 * it needs the whole attitude range looked at, which is what this does.
 *
 * The range is the one the aircraft clamps its pitch to, because that is every
 * attitude a pilot can actually put the nose at.
 */
test('a glide descends at every attitude the aircraft can be held in', () => {
    const limit = Math.PI / 2.2;

    for (let pitch = -limit; pitch <= limit; pitch += 0.002) {
        assert.ok(glideDescent(pitch) > 0,
            `a glide at ${pitch.toFixed(3)} rad descends at `
          + `${glideDescent(pitch).toFixed(3)} units per second`);
    }
});

// And the descent is a glide rather than a fall: level flight goes a long way
// for the height it spends, which is what makes reaching a strip a thing to
// plan rather than a thing to hope for.
test('a level glide trades its height for a long way over the ground', () => {
    const ratio = glideSpeed(0) / glideDescent(0);

    assert.ok(ratio > 8, `a level glide reaches ${ratio.toFixed(1)} times the height it spends`);
    assert.ok(ratio < 20, 'and not so far that the height stops mattering');
});

// A dive is steeper than level, which is the trade the whole mode is flown on:
// speed is bought with the ground you had left to cover.
test('the steeper the nose, the less the glide reaches', () => {
    const reach = pitch => glideSpeed(pitch) * Math.cos(pitch) / glideDescent(pitch);

    assert.ok(reach(0.3) < reach(0.15), 'a steep dive covers less ground than a shallow one');
    assert.ok(reach(0.15) < reach(0), 'and a shallow dive less than level flight');
});

// The aircraft flies the glide the module describes rather than a second copy
// of it, which is what keeps the sweep above about the thing being flown.
test('the aircraft flies the glide from the model rather than from a lever', () => {
    assert.ok(/glideSpeed\(this\.rotation\.x/.test(aircraftSource),
        'js/aircraft.js should take a dead engine\'s speed from the attitude');
    assert.ok(/this\.throttle = 0;/.test(aircraftSource),
        'and hold the lever closed while there is nothing on the end of it');
});
