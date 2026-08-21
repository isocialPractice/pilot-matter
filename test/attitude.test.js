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
    pitchFromForward,
    bankFromWing,
    pitchLadderRungs,
    rungOffset,
    horizonOffset,
    bankMarkAngles,
    bankMarkPoint
} from '../js/attitude.js';
import { headingDegrees } from '../js/hud.js';

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
