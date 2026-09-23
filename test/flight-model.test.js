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
    glidePitch,
    glideDescentAt,
    descentRate,
    GLIDE_ACCEL,
    GLIDE_DECEL,
    liftFactor,
    isStalled,
    sinkRate,
    controlRates,
    pitchForClimb,
    LEVEL_OFF_SECONDS,
    levelOffProgress,
    pitchLevellingOff,
    heldAltitude
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
    assert.ok(/glideDescentAt\(this\.rotation\.x, this\.speed/.test(aircraftSource),
        'and take that engine\'s vertical from the pair the aircraft is in');
});

// --- The glide the aircraft is actually in ---

// `glideSpeed` read the other way round, which is what says whether the nose a
// pilot is holding is one their airspeed can pay for.
test('the settled attitude of an airspeed is the attitude that asks for it', () => {
    for (let pitch = -0.4; pitch <= 0.6; pitch += 0.01) {
        assert.ok(Math.abs(glidePitch(glideSpeed(pitch)) - pitch) < 1e-9,
            `a glide settled at ${pitch.toFixed(2)} rad is the attitude its speed belongs to`);
    }

    assert.equal(glidePitch(GLIDE_SPEED), 0, 'the level glide speed is the level nose');
    assert.ok(glidePitch(GLIDE_SPEED + 10) > 0, 'faster than it is a nose down');
    assert.ok(glidePitch(GLIDE_SPEED - 10) < 0, 'and slower is a nose up');
});

/**
 * The sweep above, held over the pairs the aircraft is actually in rather than
 * over the one pair it settles to.
 *
 * `glideDescent` describes the settled pair: the descent at an attitude once
 * the airspeed is the one that attitude asks for. The aircraft is rarely on it.
 * The nose moves at the control rate and the speed follows at GLIDE_ACCEL and
 * GLIDE_DECEL, which are slower, so a pull leaves the aircraft carrying the
 * speed of the attitude it left at the angle of the one it arrived at, and that
 * pair is not on the curve the settled sweep walks.
 *
 * Which is how a dead stick came to climb 151 ft out of a settled glide and
 * 2150 ft out of a dive while the settled sweep passed. So this sweeps the
 * whole plane: every attitude the nose can be clamped to, against every
 * airspeed from a standstill to the top of the range.
 */
test('no attitude and airspeed the aircraft can be in comes out climbing', () => {
    const limit = Math.PI / 2.2;

    for (let pitch = -limit; pitch <= limit; pitch += 0.01) {
        for (let speed = 0; speed <= MAX_SPEED; speed += 1) {
            assert.ok(glideDescentAt(pitch, speed) >= 0,
                `a glide at ${pitch.toFixed(3)} rad and ${speed} units climbs at `
              + `${(-glideDescentAt(pitch, speed)).toFixed(3)} units per second`);
        }
    }
});

// And below cruise speed it is a descent rather than a hold. At and above it
// the wing cancels gravity outright, which is the lift model rather than the
// glide giving way, and is a speed no dead stick keeps for long.
test('under cruise speed a glide is always losing height, at every attitude', () => {
    const limit = Math.PI / 2.2;

    for (let pitch = -limit; pitch <= limit; pitch += 0.01) {
        for (let speed = 0; speed < CRUISE_SPEED; speed += 1) {
            assert.ok(glideDescentAt(pitch, speed) > 0,
                `a glide at ${pitch.toFixed(3)} rad and ${speed} units holds height`);
        }
    }
});

// The floor is on the nose rather than on the descent, so the glide the mode is
// flown on is the one `glideDescent` describes, attitude for attitude. A bound
// that moved the settled curve would be a different aeroplane rather than the
// same one stopped from climbing.
test('a settled glide is the same descent it always was', () => {
    const limit = Math.PI / 2.2;

    for (let pitch = -limit; pitch <= limit; pitch += 0.002) {
        assert.ok(Math.abs(glideDescentAt(pitch, glideSpeed(pitch)) - glideDescent(pitch)) < 1e-9,
            `a settled glide at ${pitch.toFixed(3)} rad should descend at `
          + `${glideDescent(pitch).toFixed(3)} and comes out at `
          + `${glideDescentAt(pitch, glideSpeed(pitch)).toFixed(3)}`);
    }
});

// And it only ever bites on a nose held up. A pull cannot be answered with a
// sink faster than the level nose at that speed is already losing, which is
// what keeps an engine dying at cruise from dropping the aircraft out of the
// sky on the frame the tank empties.
test('the floor slows a climb rather than adding a drop', () => {
    const limit = Math.PI / 2.2;

    for (let pitch = -limit; pitch <= limit; pitch += 0.01) {
        for (let speed = 0; speed <= MAX_SPEED; speed += 5) {
            const held = glideDescentAt(pitch, speed);

            assert.ok(held >= descentRate(pitch, speed) - 1e-9,
                'a glide never comes down slower than the pair it is in');
            assert.ok(held <= descentRate(Math.max(pitch, 0), speed) + 1e-9,
                `a glide at ${pitch.toFixed(3)} rad and ${speed} units drops faster `
              + 'than a level nose at the same speed');
        }
    }
});

/**
 * The manoeuvre that found it, flown the way the aircraft flies it.
 *
 * The aircraft is not constructible here - it wants a scene - so this steps the
 * same calls its frame makes in the same order: the speed converging on what
 * the nose is asking for, the nose moving at the control rate, and the vertical
 * coming off the pair those two are in. Nose up is the negative direction,
 * which is the sign `pitchForClimb` negates and the sign js/aircraft.js moves
 * the rotation in for W.
 *
 * Height is counted from where the run opens, so anything above zero is height
 * the aircraft was given rather than height it was flown down from.
 */
function glideFor(seconds, { pitch, speed, pitchInput = 0, dt = 1 / 60 }) {
    const limit = Math.PI / 2.2;
    let height  = 0;
    let highest = 0;

    for (let t = 0; t < seconds; t += dt) {
        speed   = convergeSpeed(speed, glideSpeed(pitch), dt, GLIDE_ACCEL, GLIDE_DECEL);
        pitch   = Math.min(Math.max(pitch + pitchInput * PITCH_RATE * dt, -limit), limit);
        height -= glideDescentAt(pitch, speed) * dt;
        highest = Math.max(highest, height);
    }

    return { height, highest, speed, pitch };
}

// Reported from the browser: settled at 4153 ft and 130 kt, the nose held up
// and nothing else touched, and the aircraft gains 151 ft with the vertical
// speed reading positive for nine frames at up to +6520 ft/min.
test('a dead stick does not gain height when the nose is held up', () => {
    const settled = glidePitch(65);
    const flown   = glideFor(5, { pitch: settled, speed: 65, pitchInput: -1 });

    assert.ok(flown.highest <= 0,
        `holding the nose up gained ${flown.highest.toFixed(1)} units of height`);
    assert.ok(flown.height < 0, 'and the aircraft is lower than it started');
});

// And the larger one: nose down for two seconds, then nose up. That entry
// climbed 2150 ft and finished 297 ft above where the dive began.
test('and does not zoom back above where a dive began', () => {
    const dive = glideFor(2, { pitch: 0, speed: GLIDE_SPEED, pitchInput: 1 });
    const zoom = glideFor(4, { pitch: dive.pitch, speed: dive.speed, pitchInput: -1 });

    assert.ok(dive.highest <= 0, 'the dive itself never gains height');
    assert.ok(zoom.highest <= 0,
        `the zoom out of it gained ${zoom.highest.toFixed(1)} units`);
    assert.ok(dive.height + zoom.height < dive.height,
        'and the whole manoeuvre finishes below the bottom of the dive');
});

// --- The level off, which is the other way to stop coming down ---

/**
 * `glideDescentAt` rules out a glide that climbs, and says nothing about a
 * glide that is simply pinned. The level off pins one: it writes the altitude
 * the frame opened at over whatever the vertical worked out, so a dead stick
 * trimmed level held its height forever, read `0 ft/min` because the vertical
 * speed is measured from the same two altitudes, and left the stage with
 * nothing to end it - roll and yaw are not a call for a different vertical
 * state, so the strip could be steered to at a fixed height.
 *
 * `heldAltitude` is that decision as a function the frame calls, so it can be
 * swept the way the plane above is swept rather than read out of the source.
 */
test('no pair a dead stick can be in can be trimmed to hold its height', () => {
    const limit  = Math.PI / 2.2;
    const dt     = 1 / 60;
    const startY = 1000;

    for (let pitch = -limit; pitch <= limit; pitch += 0.01) {
        for (let speed = 0; speed <= MAX_SPEED; speed += 5) {
            const flown = startY - glideDescentAt(pitch, speed) * dt;
            const held  = heldAltitude(startY, flown, {
                holding: true, airborne: true, engine: false
            });

            assert.equal(held, flown,
                `a dead stick at ${pitch.toFixed(3)} rad and ${speed} units held `
              + 'the altitude it was trimmed at');
            assert.ok(held <= startY,
                `a trimmed dead stick at ${pitch.toFixed(3)} rad and ${speed} units `
              + `ended the frame ${(held - startY).toFixed(4)} units higher`);
        }
    }
});

// Under power it is the trim wheel it was written to be, which is the half of
// this that a landing is flown with.
test('with an engine the hold is the altitude the aircraft was levelled at', () => {
    assert.equal(heldAltitude(1000, 994, { holding: true, airborne: true, engine: true }),
        1000, 'a held altitude is the one the frame opened at');
    assert.equal(heldAltitude(1000, 994, { holding: false, airborne: true, engine: true }),
        994, 'and nothing is held when nothing was trimmed');
});

// On the ground the altitude is the ground's, engine or no engine. A hold there
// pins the aircraft to a strip it is trying to leave.
test('the hold does not reach the ground', () => {
    for (const engine of [true, false]) {
        assert.equal(heldAltitude(1000, 994, { holding: true, airborne: false, engine }),
            994, 'a hold on the ground is not a hold');
    }
});

// Anything missing is not a hold. A host driving the Pilot API writes this
// state itself, and a state it has not written is not permission to stop
// descending.
test('a hold has to be asked for in full', () => {
    assert.equal(heldAltitude(1000, 994), 994, 'no state at all holds nothing');
    assert.equal(heldAltitude(1000, 994, { holding: 1, airborne: 1, engine: 1 }),
        994, 'and nothing short of true is the answer to any of the three');
});

/**
 * The manoeuvre the item was reported from, flown through the same calls the
 * frame makes: settled in a glide, `Space`, and nothing else touched.
 *
 * `glideFor` above flies the vertical alone. This flies the altitude, because
 * the hold is written over the altitude rather than into the rate.
 */
test('space on a dead stick leaves the glide coming down', () => {
    const dt     = 1 / 60;
    const settled = glidePitch(65);
    let pitch = settled, speed = 65, altitude = 4153, highest = 4153;

    for (let t = 0; t < 5; t += dt) {
        const startY = altitude;

        speed    = convergeSpeed(speed, glideSpeed(pitch), dt, GLIDE_ACCEL, GLIDE_DECEL);
        pitch    = pitchLevellingOff(settled, t);
        altitude = startY - glideDescentAt(pitch, speed) * dt;

        // The press is held for the whole run: the pilot trimmed and let go.
        altitude = heldAltitude(startY, altitude, {
            holding: true, airborne: true, engine: false
        });
        highest = Math.max(highest, altitude);
    }

    assert.equal(highest, 4153, `the trimmed glide climbed to ${highest.toFixed(1)}`);
    assert.ok(altitude < 4153, 'and five seconds of it is five seconds of descent');
});
