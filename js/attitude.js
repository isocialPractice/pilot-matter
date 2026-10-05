/**
 * Attitude indicator - the artificial horizon. The angles it reads and the
 * ladder it draws them against are pure functions with no DOM or Three.js
 * dependency, so the instrument's geometry can be unit tested in Node; the
 * class at the bottom is the SVG face they are drawn onto.
 */

// The ladder carries a labelled rung every PITCH_LADDER_STEP degrees with an
// unlabelled tick between them, out to PITCH_LADDER_LIMIT either side of the
// horizon - past which the ladder has stopped being an instrument and started
// being an aerobatic display.
export const PITCH_LADDER_STEP  = 10;
export const PITCH_LADDER_LIMIT = 60;

// How far the horizon slides across the face per degree of pitch, in the
// face's own units. The face is 84 units across, so a little over 30 degrees
// of ladder is in view at once.
export const PIXELS_PER_DEGREE = 1.4;

// Bank marks, mirrored either side of the top of the face.
export const BANK_MARKS = [10, 20, 30, 45, 60];

// The radius of the face the ball is clipped to, matching the clip circle in
// index.html.
export const FACE_RADIUS = 42;

export const DEGREES_PER_RADIAN = 180 / Math.PI;

export function toDegrees(radians) { return radians * DEGREES_PER_RADIAN; }
export function toRadians(degrees) { return degrees / DEGREES_PER_RADIAN; }

// --- How far the attitude may go -------------------------------------------

/**
 * The bound the nose and the wings are flown inside, in radians.
 *
 * Here rather than with the flight model because it is a statement about
 * attitude - the same quantity the ladder above is drawn against - rather than
 * about lift or airspeed. Nothing below reads an aircraft, so both the bound and
 * the carry past it are testable without one.
 */
export const ATTITUDE_PITCH_LIMIT = Math.PI / 2.2;
export const ATTITUDE_ROLL_LIMIT  = Math.PI;

/** Half a turn, which is as far from level as an attitude ever has to be read. */
const HALF_TURN = Math.PI;
const FULL_TURN = Math.PI * 2;

/**
 * An angle brought back inside half a turn either side of level, so an attitude
 * that has gone all the way round reads as where it arrived rather than as how
 * many turns it took to get there.
 *
 * Half a turn itself stays at the positive end, because the two spellings of it
 * are the same attitude and a reading needs one of them.
 */
export function wrapAngle(radians) {
    if (!Number.isFinite(radians)) return 0;

    const shifted = (radians + HALF_TURN) % FULL_TURN;
    return (shifted <= 0 ? shifted + FULL_TURN : shifted) - HALF_TURN;
}

/** True once the nose has gone past the vertical, which is an aircraft over. */
export function pastVertical(pitchRadians) {
    return Math.abs(wrapAngle(pitchRadians)) > HALF_TURN / 2;
}

/**
 * Which way a banked aircraft turns, as a sign on the heading its bank carries
 * round. Upright it is the bank's own direction; over the top the lift the wings
 * are turning on points the other way, and so does the turn.
 *
 * Inside the clamp this is always 1, so a pilot who has not opened the attitude
 * up flies exactly what they flew before any of this existed.
 */
export function turnSign(pitchRadians) {
    return pastVertical(pitchRadians) ? -1 : 1;
}

function clampAngle(radians, limit) {
    if (!Number.isFinite(radians)) return 0;
    return Math.min(Math.max(radians, -limit), limit);
}

/**
 * The attitude an aircraft is left at once the controls have moved it, bounded
 * the way the pilot asked for.
 *
 * Clamped, the nose and the wings stop at the limit, which is the thing that
 * makes ordinary flight readable: past the vertical "up" stops meaning up, and a
 * pilot who has not asked for that should not be handed it. Opened up, the angle
 * crosses the limit and comes round the other side instead of stopping dead, so
 * a loop and a barrel roll both carry on and the keys mean at 181 degrees what
 * they meant at 179.
 *
 * Coming round the other side is what keeps the input honest, and it is why this
 * wraps rather than reflecting the angle back off the pole. A reflection is the
 * same attitude written differently, and writing it differently is exactly what
 * turns the pitch keys over at the top of a loop; carrying the frame round with
 * the aircraft leaves both keys pointing where they pointed on the way in.
 *
 * Both angles go through this one function, which is the whole point of it: a
 * bound written per key is how two keys come to disagree about which way is up.
 */
export function boundAttitude(pitch, roll, full = false, limits = {}) {
    if (full) return { pitch: wrapAngle(pitch), roll: wrapAngle(roll) };

    return {
        pitch: clampAngle(pitch, limits.pitch ?? ATTITUDE_PITCH_LIMIT),
        roll:  clampAngle(roll,  limits.roll  ?? ATTITUDE_ROLL_LIMIT)
    };
}

/**
 * Where the nose, the right wing and the aircraft's own up are pointing, as the
 * vertical part of each direction, worked out from the two angles that decide
 * it.
 *
 * Written here rather than inside the aircraft so that the code which moves the
 * angles and the code which reads them cannot come to disagree about which way
 * either angle runs - which is the whole of how a control ends up flying the
 * opposite way to its own label. The aircraft turns on a `YXZ` Euler, where the
 * heading is applied outermost about the world's own up: it swings all three
 * directions round the horizon without raising or lowering any of them, so the
 * vertical part of an attitude is the pitch and the bank and nothing else.
 *
 * The signs are the model's own. It flies nose-first along `+Z`, which carries
 * its right wing on `-X`, so a positive pitch angle puts the nose down and a
 * positive bank drops the right wing. That is why the control which raises the
 * nose and the control which drops the left wing are both the ones that lower
 * their angle.
 */
export function attitudeFrom(pitch, roll) {
    return {
        forwardY: -Math.sin(pitch),
        rightY:   -Math.cos(pitch) * Math.sin(roll),
        upY:       Math.cos(pitch) * Math.cos(roll)
    };
}

/**
 * The pitch angle the instrument reads, in degrees, from the vertical part of
 * the direction the nose points. Positive is nose above the horizon.
 *
 * Reading the nose itself rather than the pitch input behind it means the
 * ladder always agrees with the view out of the window, whichever way the
 * flight model happens to sign its angles.
 */
export function pitchFromForward(forwardY) {
    return toDegrees(Math.asin(Math.min(1, Math.max(-1, forwardY))));
}

/**
 * The bank angle, in degrees, from the vertical part of the right wing and of
 * the aircraft's own up direction. Positive is right wing low, the way a
 * right turn is flown. Taking both directions rather than the wing alone
 * keeps the angle honest past the vertical, so inverted flight reads out near
 * 180 rather than folding back toward level.
 */
export function bankFromWing(rightY, upY) {
    return toDegrees(Math.atan2(-rightY, upY));
}

/**
 * The rungs of the pitch ladder, from the bottom of the ladder to the top,
 * each with the angle it marks and whether it is a labelled step or one of
 * the ticks between. The horizon is not a rung: it is a line of its own.
 */
export function pitchLadderRungs(limit = PITCH_LADDER_LIMIT, step = PITCH_LADDER_STEP) {
    const half  = step / 2;
    const count = Math.floor(limit / half);
    const rungs = [];

    for (let i = -count; i <= count; i++) {
        if (i === 0) continue;
        const degrees = i * half;
        const major   = i % 2 === 0;
        rungs.push({ degrees, major, label: major ? String(Math.abs(degrees)) : '' });
    }

    return rungs;
}

/**
 * Where a rung sits on the face, measured down from the middle, when the
 * aircraft is at the given pitch. A rung above the nose sits above the middle
 * of the face, and the rung matching the current pitch sits dead centre.
 */
export function rungOffset(rungDegrees, pitchDegrees, perDegree = PIXELS_PER_DEGREE) {
    return (pitchDegrees - rungDegrees) * perDegree;
}

/**
 * How far the whole ladder, horizon and all, is carried down the face at the
 * given pitch: a raised nose drops the horizon toward the bottom of the
 * instrument, the way it drops down the windscreen.
 */
export function horizonOffset(pitchDegrees, perDegree = PIXELS_PER_DEGREE) {
    return rungOffset(0, pitchDegrees, perDegree);
}

/** The bank marks around the face, left to right across the top. */
export function bankMarkAngles(marks = BANK_MARKS) {
    return [...marks].reverse().map(angle => -angle).concat(0, marks);
}

/**
 * Where a bank mark sits on the rim of the face, with zero at the top and the
 * angle counted the way the aircraft banks.
 */
export function bankMarkPoint(angleDegrees, radius = FACE_RADIUS) {
    const radians = toRadians(angleDegrees);
    return { x: radius * Math.sin(radians), y: -radius * Math.cos(radians) };
}

const SVG_NS = 'http://www.w3.org/2000/svg';

// Face geometry, in the same units as the SVG viewBox in index.html.
const MAJOR_RUNG_HALF_WIDTH = 17;
const MINOR_RUNG_HALF_WIDTH = 8;
const LABEL_GAP             = 3;
const MAJOR_MARK_LENGTH     = 8;
const MINOR_MARK_LENGTH     = 5;

export class AttitudeIndicator {
    constructor(root) {
        this.root    = root;
        this.ball    = root.querySelector('#attitude-ball');
        this.horizon = root.querySelector('#attitude-horizon');

        this.drawLadder(root.querySelector('#attitude-ladder'));
        this.drawBankMarks(root.querySelector('#attitude-bank-marks'));
    }

    // The ladder is drawn once, at its own angles, and then carried up and
    // down the face as a whole - a rung is in the same place on the ladder
    // whatever the aircraft is doing.
    drawLadder(group) {
        for (const rung of pitchLadderRungs()) {
            const y    = rungOffset(rung.degrees, 0);
            const half = rung.major ? MAJOR_RUNG_HALF_WIDTH : MINOR_RUNG_HALF_WIDTH;

            group.appendChild(svgLine(-half, y, half, y, 'attitude-rung'));
            if (!rung.major) continue;

            group.appendChild(svgLabel(-half - LABEL_GAP, y, rung.label, 'end'));
            group.appendChild(svgLabel(half + LABEL_GAP, y, rung.label, 'start'));
        }
    }

    // The marks ride the rim of the ball rather than the fixed bezel, so the
    // angle being flown is the one that has come round to the index at the top.
    drawBankMarks(group) {
        for (const angle of bankMarkAngles()) {
            const major  = angle % 30 === 0;
            const length = major ? MAJOR_MARK_LENGTH : MINOR_MARK_LENGTH;
            const outer  = bankMarkPoint(angle);
            const inner  = bankMarkPoint(angle, FACE_RADIUS - length);
            const mark   = svgLine(inner.x, inner.y, outer.x, outer.y, 'attitude-bank-mark');

            if (major) mark.setAttribute('class', 'attitude-bank-mark major');
            group.appendChild(mark);
        }
    }

    /**
     * Turns the face to the attitude being flown: the ball rolls against the
     * bank, so the horizon stays where the real one is, and the ladder slides
     * against the pitch.
     */
    update(pitchDegrees, bankDegrees) {
        this.ball.setAttribute('transform', `rotate(${(-bankDegrees).toFixed(2)})`);
        this.horizon.setAttribute('transform', `translate(0 ${horizonOffset(pitchDegrees).toFixed(2)})`);
    }
}

function svgLine(x1, y1, x2, y2, className) {
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', x1);
    line.setAttribute('y1', y1);
    line.setAttribute('x2', x2);
    line.setAttribute('y2', y2);
    line.setAttribute('class', className);
    return line;
}

function svgLabel(x, y, text, anchor) {
    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('x', x);
    label.setAttribute('y', y);
    label.setAttribute('text-anchor', anchor);
    label.setAttribute('dominant-baseline', 'middle');
    label.setAttribute('class', 'attitude-label');
    label.textContent = text;
    return label;
}
