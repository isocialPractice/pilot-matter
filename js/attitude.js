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
