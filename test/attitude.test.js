import test from 'node:test';
import assert from 'node:assert/strict';
import {
    AttitudeIndicator,
    PITCH_LADDER_STEP,
    PITCH_LADDER_LIMIT,
    PIXELS_PER_DEGREE,
    BANK_MARKS,
    FACE_RADIUS,
    toDegrees,
    toRadians,
    attitudeFrom,
    pitchFromForward,
    bankFromWing,
    pitchLadderRungs,
    rungOffset,
    horizonOffset,
    bankMarkAngles,
    bankMarkPoint,
    ATTITUDE_PITCH_LIMIT,
    ATTITUDE_ROLL_LIMIT,
    wrapAngle,
    pastVertical,
    turnSign,
    boundAttitude
} from '../js/attitude.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { headingDegrees } from '../js/hud.js';
import {
    CRUISE_SPEED, LEVEL_OFF_SECONDS, pitchForClimb, pitchLevellingOff
} from '../js/flight-model.js';

const close = (actual, expected, within = 1e-9) =>
    assert.ok(Math.abs(actual - expected) < within, `${actual} is not ${expected}`);

// The Euler angles the aircraft carries, turned into the directions the
// instrument reads. Three.js applies them in YXZ order about a right-handed
// frame, and repeating that here checks the indicator's signs against the
// flight model's without loading Three.js into the test.
const rotateX = ([x, y, z], a) => [x, y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)];
const rotateY = ([x, y, z], a) => [x * Math.cos(a) + z * Math.sin(a), y, -x * Math.sin(a) + z * Math.cos(a)];
const rotateZ = ([x, y, z], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a), z];

function attitudeFromEuler({ x = 0, y = 0, z = 0 }) {
    const apply = (v) => rotateY(rotateX(rotateZ(v, z), x), y);
    return {
        forwardY: apply([0, 0, 1])[1],
        rightY:   apply([-1, 0, 0])[1],
        upY:      apply([0, 1, 0])[1]
    };
}

const bankOf = ({ rightY, upY }) => bankFromWing(rightY, upY);
const pitchOf = ({ forwardY }) => pitchFromForward(forwardY);

// --- Angles ---

test('degrees and radians convert back into each other', () => {
    close(toDegrees(Math.PI), 180);
    close(toRadians(180), Math.PI);
    close(toDegrees(toRadians(37)), 37, 1e-12);
});

test('level flight reads a level nose', () => {
    close(pitchFromForward(0), 0);
});

test('the ladder reads the nose above the horizon on a climb and below it on a dive', () => {
    close(pitchFromForward(0.5), 30, 1e-12);
    close(pitchFromForward(-0.5), -30, 1e-12);
    close(pitchFromForward(1), 90);
    close(pitchFromForward(-1), -90);
});

test('a nose beyond the vertical is still read as the vertical, not as nothing', () => {
    // Rounding can carry the direction a hair past a unit vector, and asin of
    // anything past 1 is not a number
    close(pitchFromForward(1.0000001), 90);
    close(pitchFromForward(-1.0000001), -90);
});

test('level wings read a level bank', () => {
    close(bankFromWing(0, 1), 0);
});

test('the bank reads right wing low as a right bank and left wing low as a left one', () => {
    close(bankOf(attitudeFromEuler({ z: toRadians(30) })), 30, 1e-9);
    close(bankOf(attitudeFromEuler({ z: toRadians(-30) })), -30, 1e-9);
});

test('the bank still reads past the vertical rather than folding back toward level', () => {
    close(Math.abs(bankFromWing(0, -1)), 180);
    close(bankOf(attitudeFromEuler({ z: toRadians(90) })), 90, 1e-9);
    close(bankOf(attitudeFromEuler({ z: toRadians(135) })), 135, 1e-9);
});

// --- What the instrument is reading ---

test('a bank reads the way the turn it flies runs', () => {
    // js/aircraft.js turns the aircraft with `rotation.y -= sin(rotation.z)`,
    // so the roll angle that walks the compass card to the right is the one
    // the indicator should draw as a right bank
    const roll = 0.5;
    const heading = headingDegrees(-Math.sin(roll) * 1.2 * 0.1);

    assert.ok(bankOf(attitudeFromEuler({ z: roll })) > 0, 'a positive roll angle is a right bank');
    assert.ok(heading > 0 && heading < 180, 'and a positive roll angle turns toward the right of the card');
});

test('the ladder reads the nose rather than the stick behind it', () => {
    // A positive pitch angle carries the nose below the horizon in the frame
    // Three.js rotates in, and the aircraft flies where its nose points, so
    // the ladder shows the descent that angle actually flies
    assert.ok(pitchOf(attitudeFromEuler({ x: 0.3 })) < 0);
    assert.ok(pitchOf(attitudeFromEuler({ x: -0.3 })) > 0);
});

test('a turn on its own is not a climb, and a heading is not a bank', () => {
    for (const yaw of [0.4, 2, -1.3]) {
        const attitude = attitudeFromEuler({ y: yaw });
        close(pitchOf(attitude), 0, 1e-9);
        close(bankOf(attitude), 0, 1e-9);
    }
});

test('a banked climb reads as both, not as one or the other', () => {
    const attitude = attitudeFromEuler({ x: -toRadians(20), z: toRadians(45), y: 1.1 });
    assert.ok(pitchOf(attitude) > 5, 'the climb should still be on the ladder');
    assert.ok(bankOf(attitude) > 5, 'and the bank should still be on the rim');
});

/**
 * `attitudeFrom` against the frame it stands in for.
 *
 * The aircraft used to read its attitude by turning three unit vectors with its
 * own quaternion, and now asks `js/attitude.js` for the same three numbers out
 * of two angles instead - which is what lets a test say which way a control
 * flies it without loading Three.js. The closed form is only worth that if it
 * is the frame it replaced, so it is checked against the rotation above rather
 * than trusted to be the same arithmetic written shorter.
 *
 * The yaw is where a closed form would come apart, because it is the one angle
 * the short version drops: it is applied outermost about the world's own up, so
 * it swings all three directions round the horizon without raising or lowering
 * any of them. A yaw that reached the vertical part of an attitude would show
 * up here as a disagreement at every heading but zero.
 */
test('the attitude read off the angles is the attitude the frame turns to', () => {
    for (const pitch of [-1.4, -1, -0.3, 0, 0.3, 1, 1.4]) {
        for (const roll of [-3, -1.6, -0.7, 0, 0.7, 1.6, 3]) {
            for (const yaw of [-2.2, -1.1, 0, 1.1, 2.2, 4]) {
                const closed = attitudeFrom(pitch, roll);
                const turned = attitudeFromEuler({ x: pitch, y: yaw, z: roll });

                for (const reading of ['forwardY', 'rightY', 'upY']) {
                    assert.ok(Math.abs(closed[reading] - turned[reading]) < 1e-12,
                        `${reading} reads ${closed[reading]} off the angles and ${turned[reading]}`
                        + ` off the frame at pitch ${pitch}, roll ${roll}, yaw ${yaw}`);
                }
            }
        }
    }
});

// --- The pitch ladder ---

test('the ladder is stepped and labelled either side of the horizon', () => {
    const rungs = pitchLadderRungs();
    const majors = rungs.filter(rung => rung.major);

    assert.ok(rungs.length > 0);
    for (const rung of majors) {
        assert.equal(Math.abs(rung.degrees) % PITCH_LADDER_STEP, 0, `${rung.degrees} is not a whole step`);
        assert.equal(rung.label, String(Math.abs(rung.degrees)), 'a rung is labelled by how steep it is');
    }
    for (const rung of rungs.filter(rung => !rung.major)) {
        assert.equal(rung.label, '', 'the ticks between the steps are not labelled');
    }
});

test('the horizon is a line of its own rather than a rung of the ladder', () => {
    assert.equal(pitchLadderRungs().some(rung => rung.degrees === 0), false);
});

test('the ladder reaches the same way up as it does down', () => {
    const rungs = pitchLadderRungs();
    const degrees = rungs.map(rung => rung.degrees);

    for (const rung of rungs) {
        assert.ok(degrees.includes(-rung.degrees), `${rung.degrees} has no opposite`);
    }
    assert.equal(Math.max(...degrees), PITCH_LADDER_LIMIT);
    assert.equal(Math.min(...degrees), -PITCH_LADDER_LIMIT);
});

test('the ladder is built from the bottom up, evenly spaced', () => {
    const degrees = pitchLadderRungs().map(rung => rung.degrees);
    const half = PITCH_LADDER_STEP / 2;

    for (let i = 1; i < degrees.length; i++) {
        // The horizon is the one gap of a whole step, being the line the
        // ladder is built either side of rather than a rung of it
        const overTheHorizon = degrees[i - 1] < 0 && degrees[i] > 0;
        assert.ok(degrees[i] > degrees[i - 1], 'the rungs should climb the ladder in order');
        assert.equal(degrees[i] - degrees[i - 1], overTheHorizon ? PITCH_LADDER_STEP : half,
            'with an even gap between them');
    }
});

test('a shorter ladder can be asked for without changing the rules it is built by', () => {
    const rungs = pitchLadderRungs(20, 10);
    assert.deepEqual(rungs.map(rung => rung.degrees), [-20, -15, -10, -5, 5, 10, 15, 20]);
    assert.deepEqual(rungs.filter(rung => rung.major).map(rung => rung.degrees), [-20, -10, 10, 20]);
});

// --- Where the ladder sits on the face ---

test('the rung matching the pitch being flown sits in the middle of the face', () => {
    for (const pitch of [0, 12, -35]) {
        close(rungOffset(pitch, pitch), 0);
    }
});

test('a rung above the nose sits above the middle of the face', () => {
    assert.ok(rungOffset(10, 0) < 0, 'the 10 degree rung is above a level nose');
    assert.ok(rungOffset(-10, 0) > 0, 'and the descending one is below it');
});

test('a raised nose carries the horizon down the face, the way it drops down a windscreen', () => {
    assert.ok(horizonOffset(20) > 0);
    assert.ok(horizonOffset(-20) < 0);
    close(horizonOffset(0), 0);
});

test('the face moves by a fixed distance per degree, so the ladder is evenly spaced on it', () => {
    close(horizonOffset(10), 10 * PIXELS_PER_DEGREE);
    close(horizonOffset(10, 2), 20);
    close(rungOffset(0, 30) - rungOffset(0, 20), 10 * PIXELS_PER_DEGREE, 1e-9);
});

test('the ladder in view is a readable slice of it, not the whole sky at once', () => {
    const inView = PITCH_LADDER_STEP * PIXELS_PER_DEGREE;
    assert.ok(inView > 5, 'rungs closer than this would run into each other');
    assert.ok(inView < FACE_RADIUS, 'and further apart than this leaves the face empty');
});

// --- The bank marks ---

test('the bank marks run left to right across the top of the face', () => {
    const angles = bankMarkAngles();
    assert.equal(angles[0], -Math.max(...BANK_MARKS));
    assert.equal(angles[angles.length - 1], Math.max(...BANK_MARKS));
    assert.ok(angles.includes(0), 'the top of the face is wings level');

    for (let i = 1; i < angles.length; i++) {
        assert.ok(angles[i] > angles[i - 1], 'the marks should run round the rim in order');
    }
});

test('every mark is matched on the other side of level', () => {
    const angles = bankMarkAngles();
    for (const angle of angles) {
        assert.ok(angles.includes(-angle), `${angle} has no opposite`);
    }
});

test('level sits at the top of the face and the marks run round with the bank', () => {
    const level = bankMarkPoint(0);
    close(level.x, 0);
    close(level.y, -FACE_RADIUS);

    const right = bankMarkPoint(90);
    close(right.x, FACE_RADIUS, 1e-9);
    close(right.y, 0, 1e-9);

    const left = bankMarkPoint(-90);
    close(left.x, -FACE_RADIUS, 1e-9);
});

test('a mark sits on the rim of the face it is asked for', () => {
    for (const angle of bankMarkAngles()) {
        const point = bankMarkPoint(angle, 30);
        close(Math.hypot(point.x, point.y), 30, 1e-9);
    }
});

// --- The face the geometry is drawn onto ---

// Enough of a document for the instrument to draw itself into, with no
// browser to draw it in: elements that remember what was set on them.
function fakeElement(tag) {
    return {
        tag,
        children: [],
        attributes: {},
        textContent: '',
        setAttribute(name, value) { this.attributes[name] = String(value); },
        getAttribute(name) { return this.attributes[name] ?? null; },
        appendChild(child) { this.children.push(child); return child; }
    };
}

function fakeFace() {
    const groups = {
        '#attitude-ball':       fakeElement('g'),
        '#attitude-horizon':    fakeElement('g'),
        '#attitude-ladder':     fakeElement('g'),
        '#attitude-bank-marks': fakeElement('g')
    };
    globalThis.document = { createElementNS: (namespace, tag) => fakeElement(tag) };
    return { groups, root: { querySelector: (selector) => groups[selector] ?? null } };
}

test('the face is drawn with a rung for every step of the ladder, labelled either side', () => {
    const { groups, root } = fakeFace();
    new AttitudeIndicator(root);

    const rungs = pitchLadderRungs();
    const drawn = groups['#attitude-ladder'].children;
    const majors = rungs.filter(rung => rung.major).length;

    assert.equal(drawn.filter(child => child.tag === 'line').length, rungs.length);
    assert.equal(drawn.filter(child => child.tag === 'text').length, majors * 2,
        'a labelled rung is read from either side of the face');
});

test('every rung is drawn level, at the height its angle puts it', () => {
    const { groups, root } = fakeFace();
    new AttitudeIndicator(root);

    const lines = groups['#attitude-ladder'].children.filter(child => child.tag === 'line');
    pitchLadderRungs().forEach((rung, index) => {
        const line = lines[index];
        assert.equal(line.getAttribute('y1'), line.getAttribute('y2'), `rung ${rung.degrees} is not level`);
        assert.equal(Number(line.getAttribute('y1')), rungOffset(rung.degrees, 0));
    });
});

test('the bank marks are drawn round the rim, the widest ones on the whole angles', () => {
    const { groups, root } = fakeFace();
    new AttitudeIndicator(root);

    const marks = groups['#attitude-bank-marks'].children;
    assert.equal(marks.length, bankMarkAngles().length);

    for (const mark of marks) {
        const outer = Math.hypot(Number(mark.getAttribute('x2')), Number(mark.getAttribute('y2')));
        close(outer, FACE_RADIUS, 1e-9);
    }
    assert.equal(marks.filter(mark => mark.getAttribute('class').includes('major')).length, 5,
        'level, both 30 degree marks, and both 60 degree marks are the wide ones');
});

test('the face turns to the attitude being flown', () => {
    const { groups, root } = fakeFace();
    const indicator = new AttitudeIndicator(root);

    indicator.update(0, 0);
    assert.match(groups['#attitude-ball'].getAttribute('transform'), /^rotate\(-?0\.00\)$/);
    assert.match(groups['#attitude-horizon'].getAttribute('transform'), /^translate\(0 -?0\.00\)$/);

    indicator.update(10, 30);
    assert.equal(groups['#attitude-ball'].getAttribute('transform'), 'rotate(-30.00)',
        'the ball rolls against the bank, so the horizon stays where the real one is');
    assert.equal(groups['#attitude-horizon'].getAttribute('transform'),
        `translate(0 ${horizonOffset(10).toFixed(2)})`);
});


// --- Levelling off, read off the dial -------------------------------------

/**
 * The reading the level off is judged by. The vertical speed is trimmed to
 * zero on the press, so the only thing left that can disagree with it is the
 * attitude: an instrument showing a climb above a horizon that is already
 * level, or the other way about, is the two halves of the same manoeuvre
 * contradicting each other at the moment a pilot is trusting one of them.
 *
 * The indicator reads the model's own pitch, so easing that pitch is the whole
 * of what carries the horizon down with the nose. This walks the same ease the
 * aircraft runs and reads the face at each step.
 */
test('the horizon comes down with the nose and both arrive at level', () => {
    const { groups, root } = fakeFace();
    const indicator = new AttitudeIndicator(root);
    const bank = toRadians(15);

    const readAt = (pitch) => {
        const { forwardY, rightY, upY } = attitudeFromEuler({ x: pitch, z: bank });
        const degrees = pitchFromForward(forwardY);
        indicator.update(degrees, bankFromWing(rightY, upY));
        return {
            degrees,
            ball:    groups['#attitude-ball'].getAttribute('transform'),
            horizon: groups['#attitude-horizon'].getAttribute('transform')
        };
    };

    const climb = pitchForClimb(20, CRUISE_SPEED);
    const start = readAt(pitchLevellingOff(climb, 0));
    assert.ok(start.degrees > 1, 'the aircraft is nose-up when the key goes down');
    assert.equal(start.horizon, `translate(0 ${horizonOffset(start.degrees).toFixed(2)})`,
        'and the instrument is showing the climb');

    let previous = start.degrees;
    for (const step of [0.25, 0.5, 0.75]) {
        const during = readAt(pitchLevellingOff(climb, LEVEL_OFF_SECONDS * step));
        assert.ok(during.degrees < previous, `the nose should still be coming down at ${step}`);
        assert.equal(during.horizon, `translate(0 ${horizonOffset(during.degrees).toFixed(2)})`,
            'and the horizon should be wherever that pitch puts it, not a frame behind');
        assert.equal(during.ball, start.ball, 'while the bank is left exactly as it was');
        previous = during.degrees;
    }

    const rest = readAt(pitchLevellingOff(climb, LEVEL_OFF_SECONDS));
    assert.equal(rest.degrees, 0, 'the nose is level once the ease has run');
    assert.ok(Math.abs(rest.degrees) < 1, 'well inside the degree the item asks for');
    assert.equal(rest.horizon, 'translate(0 0.00)', 'and the horizon is centred on the face');
    assert.equal(rest.ball, start.ball, 'the level off never touched the roll');
});

// --- How far the attitude may go -------------------------------------------

// js/aircraft.js imports Three.js, so what it does with the bound is read off
// its source rather than by flying one.
const aircraftSource = readFileSync(
    fileURLToPath(new URL('../js/aircraft.js', import.meta.url)),
    'utf8'
);

const HALF_TURN = Math.PI;

test('an angle is wrapped to where it arrived rather than to how far it went', () => {
    close(wrapAngle(0), 0);
    close(wrapAngle(1), 1);
    close(wrapAngle(-1), -1);
    close(wrapAngle(HALF_TURN), HALF_TURN, 1e-12);
    // The two spellings of half a turn are one attitude, so a reading needs one.
    close(wrapAngle(-HALF_TURN), HALF_TURN, 1e-12);
    close(wrapAngle(HALF_TURN * 2), 0, 1e-12);
    close(wrapAngle(HALF_TURN * 1.5), -HALF_TURN / 2, 1e-12);
    close(wrapAngle(-HALF_TURN * 1.5), HALF_TURN / 2, 1e-12);
});

test('every wrapped angle lands inside half a turn of level', () => {
    for (let turns = -3; turns <= 3; turns += 0.125) {
        const wrapped = wrapAngle(turns * HALF_TURN * 2);
        assert.ok(wrapped > -HALF_TURN - 1e-9 && wrapped <= HALF_TURN + 1e-9,
            `${turns} turns wrapped to ${wrapped}, which is outside half a turn`);
    }
});

test('an angle that is not a number reads as level rather than as nothing', () => {
    assert.equal(wrapAngle(NaN), 0);
    assert.equal(wrapAngle(Infinity), 0);
    assert.equal(wrapAngle(undefined), 0);
});

test('the nose is past the vertical once it is more than a quarter turn from level', () => {
    assert.equal(pastVertical(0), false);
    assert.equal(pastVertical(toRadians(89)), false);
    assert.equal(pastVertical(toRadians(90)), false, 'straight up is the vertical, not past it');
    assert.equal(pastVertical(toRadians(91)), true);
    assert.equal(pastVertical(toRadians(-91)), true);
    assert.equal(pastVertical(toRadians(180)), true);
    assert.equal(pastVertical(toRadians(271)), false, 'three quarters round is a quarter turn short');
});

// The sign is what carries the frame round with the aircraft: over the top the
// lift the wings turn on points the other way, and so does the turn.
test('a bank turns its own way upright and the other way over the top', () => {
    assert.equal(turnSign(0), 1);
    assert.equal(turnSign(toRadians(45)), 1);
    assert.equal(turnSign(toRadians(120)), -1);
    assert.equal(turnSign(toRadians(-120)), -1);
    assert.equal(turnSign(toRadians(180)), -1);
});

// The clamp bounds the pitch well inside the vertical, so a pilot who has not
// opened the attitude up can never reach the frame that is carried round.
test('nothing inside the clamp is ever past the vertical', () => {
    assert.ok(ATTITUDE_PITCH_LIMIT < HALF_TURN / 2,
        'the clamp should stop the nose short of straight up');
    assert.equal(pastVertical(ATTITUDE_PITCH_LIMIT), false);
    assert.equal(turnSign(ATTITUDE_PITCH_LIMIT), 1);
    assert.equal(turnSign(-ATTITUDE_PITCH_LIMIT), 1);
});

test('the clamp stops the nose and the wings at the limit', () => {
    const over = boundAttitude(HALF_TURN, HALF_TURN * 1.5);
    close(over.pitch, ATTITUDE_PITCH_LIMIT);
    close(over.roll, ATTITUDE_ROLL_LIMIT);

    const under = boundAttitude(-HALF_TURN, -HALF_TURN * 1.5);
    close(under.pitch, -ATTITUDE_PITCH_LIMIT);
    close(under.roll, -ATTITUDE_ROLL_LIMIT);
});

test('an attitude inside the clamp is handed back exactly as it came', () => {
    for (const pitch of [0, 0.3, -0.3, ATTITUDE_PITCH_LIMIT, -ATTITUDE_PITCH_LIMIT]) {
        for (const roll of [0, 1, -1, ATTITUDE_ROLL_LIMIT, -ATTITUDE_ROLL_LIMIT]) {
            const bounded = boundAttitude(pitch, roll);
            close(bounded.pitch, pitch);
            close(bounded.roll, roll);
        }
    }
});

/**
 * The item this exists for: the attitude goes all the way round without the
 * controls breaking at the limit. Coming round the other side is what keeps the
 * input honest - the angle past the limit is the angle it would have been, so a
 * key that was carrying the nose up carries on carrying it up.
 */
test('opened up, the attitude crosses the limit and comes round the other side', () => {
    const past = boundAttitude(toRadians(181), toRadians(181), true);
    close(past.pitch, toRadians(-179), 1e-9);
    close(past.roll, toRadians(-179), 1e-9);

    // And it keeps going, rather than stopping one turn out.
    const round = boundAttitude(toRadians(540), toRadians(-540), true);
    close(round.pitch, HALF_TURN, 1e-9);
    close(round.roll, HALF_TURN, 1e-9);
});

/**
 * A loop, flown one step at a time the way the aircraft flies it: the pitch key
 * moves the nose by a fixed amount every frame, and the bound is asked what the
 * attitude is afterwards. Opened up, the nose comes all the way round to where
 * it started, and every step of the way is a step in the same direction.
 */
test('a loop flown a step at a time comes round to where it started', () => {
    const step = toRadians(5);
    const seen = [];
    let pitch = 0;

    for (let i = 0; i < 72; i++) {
        pitch = boundAttitude(pitch - step, 0, true).pitch;
        seen.push(pitch);
    }

    // Seventy-two steps of five degrees is one full turn.
    close(pitch, 0, 1e-9);
    assert.equal(new Set(seen.map(angle => angle.toFixed(6))).size, 72,
        'no two frames of a loop should read as the same attitude');

    // Every step moved the nose the same way, counting the one crossing where the
    // reading comes round the other side.
    const crossings = seen.filter((angle, i) => i > 0 && angle > seen[i - 1]).length;
    assert.equal(crossings, 1, 'the nose should only appear to go back once, at the crossing');
});

test('the same loop stops dead at the limit while the clamp is in force', () => {
    const step = toRadians(5);
    let pitch = 0;

    for (let i = 0; i < 72; i++) pitch = boundAttitude(pitch - step, 0).pitch;

    // The clamp is what makes ordinary flight readable, so it still holds.
    close(pitch, -ATTITUDE_PITCH_LIMIT);
});

test('a bound attitude that is not a number reads as level', () => {
    const broken = boundAttitude(NaN, undefined);
    assert.equal(broken.pitch, 0);
    assert.equal(broken.roll, 0);

    const wrapped = boundAttitude(NaN, undefined, true);
    assert.equal(wrapped.pitch, 0);
    assert.equal(wrapped.roll, 0);
});

test('a caller can bound the attitude to limits of its own', () => {
    const bounded = boundAttitude(1, 2, false, { pitch: 0.5, roll: 1 });
    close(bounded.pitch, 0.5);
    close(bounded.roll, 1);
});

/**
 * One call for both angles is the point of the function: a bound written per key
 * is how two keys come to disagree about which way is up at 180 degrees. Read
 * off the source, which is the only place that can be seen.
 */
test('the aircraft bounds both angles in one call rather than one clamp per key', () => {
    assert.ok(/boundAttitude\(this\.rotation\.x, this\.rotation\.z, this\.fullRotation\)/
        .test(aircraftSource),
        'the aircraft should hand both angles to boundAttitude at once');
    assert.ok(!/MathUtils\.clamp\(this\.rotation\./.test(aircraftSource),
        'and should hold no clamp of its own on either of them');
    assert.ok(/turnSign\(this\.rotation\.x\)/.test(aircraftSource),
        'and should turn the coordinated turn the way the wings are actually turning');
});
