/**
 * The landmarks a photo survey is flown over, and the window each one has to
 * be caught from.
 *
 * Every other objective is met by being somewhere: through the gate, down on
 * the strip, stopped beside the marker. A survey is met by being somewhere
 * *and saying so* - the shutter is the report, and the mode's whole question is
 * whether the aircraft was where the brief asked when it was pressed. So there
 * are three readings rather than one: how high, how far off, and which way
 * round. A landmark photographed from directly overhead at four thousand feet
 * is a photograph of a roof, and the brief asked for an elevation.
 *
 * The landmarks are shot in the order they are listed, as a course's gates are
 * flown in the order they are laid. A list that could be worked in any order
 * would want a chart that lit all of it at once and a card that named none of
 * it, and the instruments the rest of the game is read on say one thing at a
 * time on purpose.
 *
 * Pure module with no DOM or Three.js dependency: a window is three ranges and
 * a bearing, and whether a shot was inside it is arithmetic.
 */

import { bearingToDirection, directionToBearing, FEET_PER_UNIT } from './units.js';

/** How far off the briefed heading a shot can be taken and still count. */
export const HEADING_REACH = 40;

/**
 * The landmarks a stage lists, placed in the world.
 *
 * Each is declared as a bearing and a distance from the middle, the way a
 * search's marker is, and for the same reason: a survey is briefed before it
 * is flown, and a place nobody can be told how to reach is not on a list. The
 * window travels with the landmark, because what makes one landmark different
 * from the next is as much how it has to be caught as where it is.
 *
 * Empty for a stage that lists none, which is every stage of every other mode.
 */
export function buildSurvey(stage) {
    const listed = stage?.survey?.landmarks;
    if (!Array.isArray(listed)) return [];

    const defaults = stage.survey.window ?? {};

    return listed.map((landmark, index) => {
        const out = bearingToDirection(landmark.bearing);
        const window = { ...defaults, ...(landmark.window ?? {}) };

        return {
            index,
            name: landmark.name,
            x: out.x * landmark.distance,
            z: out.z * landmark.distance,
            bearing: landmark.bearing,
            distance: landmark.distance,
            // The height the landmark itself stands to, so the mark drawn for
            // it is drawn on top of it rather than in the ground beside it.
            height: landmark.height ?? 0,
            window: {
                heightFeet: window.heightFeet,
                range: window.range,
                heading: landmark.heading,
                headingReach: window.headingReach ?? HEADING_REACH
            }
        };
    });
}

/**
 * The shot the brief is asking for, read against where the aircraft actually
 * is: how high it is, how far off the landmark, which way it is pointing, and
 * whether each of those three is inside the window.
 *
 * Null without a landmark to measure against. A reading that cannot be taken -
 * a report with no place or no height in it - is a reading outside every part
 * of the window rather than one inside it by default, because the one thing a
 * survey must not do is count a photograph of nothing.
 */
export function shotFor(landmark, report = {}) {
    if (!landmark) return null;

    const window = landmark.window;
    const x = Number(report.x);
    const z = Number(report.z);
    const altitudeFeet = Number(report.altitudeFeet);
    const headingDegrees = Number(report.headingDegrees);

    const placed = Number.isFinite(x) && Number.isFinite(z);
    const range = placed ? Math.hypot(x - landmark.x, z - landmark.z) : NaN;
    const bearing = placed ? directionToBearing(landmark.x - x, landmark.z - z) : NaN;

    const heightOk  = within(altitudeFeet, window.heightFeet);
    const rangeOk   = within(range, window.range);
    const headingOk = Number.isFinite(headingDegrees)
        && Math.abs(headingMiss(headingDegrees, window.heading)) <= window.headingReach;

    return {
        index: landmark.index,
        name: landmark.name,
        altitudeFeet,
        range,
        bearing,
        heightOk,
        rangeOk,
        headingOk,
        inside: heightOk && rangeOk && headingOk
    };
}

/** A reading inside a low-to-high pair. A pair that is not one is never met. */
function within(value, band) {
    if (!Number.isFinite(value) || !Array.isArray(band)) return false;
    const [low, high] = band;
    return value >= low && value <= high;
}

/**
 * How far off the briefed heading the aircraft is pointing, in degrees either
 * side of it. Folded in degrees, the way every other bearing in the simulator
 * is folded.
 */
export function headingMiss(heading, briefed) {
    const off = (((heading - (briefed ?? 0)) % 360) + 360) % 360;
    return off > 180 ? off - 360 : off;
}

/**
 * What is wrong with a shot, in the words the pilot is told it in. The first
 * thing that is wrong rather than all of them: a line that lists three faults
 * is a line nobody reads in the second it is up, and a pilot who fixes the
 * first comes round and is told the second.
 *
 * Empty for a shot that was inside the window, which has nothing to say.
 */
export function shotFault(shot, landmark) {
    if (!shot || shot.inside) return '';

    if (!shot.rangeOk) {
        const [near, far] = landmark?.window?.range ?? [];
        if (Number.isFinite(shot.range) && Number.isFinite(far) && shot.range > far) return 'TOO FAR OUT';
        if (Number.isFinite(shot.range) && Number.isFinite(near) && shot.range < near) return 'TOO CLOSE IN';
        return 'OUT OF RANGE';
    }

    if (!shot.heightOk) {
        const [low, high] = landmark?.window?.heightFeet ?? [];
        if (Number.isFinite(shot.altitudeFeet) && Number.isFinite(high) && shot.altitudeFeet > high) return 'TOO HIGH';
        if (Number.isFinite(shot.altitudeFeet) && Number.isFinite(low) && shot.altitudeFeet < low) return 'TOO LOW';
        return 'OUT OF HEIGHT';
    }

    return 'WRONG SIDE';
}

/**
 * The brief for a landmark, as the one line the objective row has room for:
 * what it is, what height to be at, and which way to be pointing.
 *
 * Two of the three readings are here and the third is not, and that is the
 * row's doing rather than an omission. The card's objective row is measured at
 * thirty-two characters, and a name, two bands and a bearing do not fit in
 * them. What goes is the range - because the range is the one of the three
 * that is a place, and a place can be drawn. `rangeBand` hands it to the
 * renderer, which lays it round the landmark as the circle a rescue is drawn
 * with, so the pilot reads it off the ground instead of off the card.
 *
 * The height is briefed as the middle of its band rather than as the band, for
 * the same room: a pilot flies at a number and is told which way they were out
 * when they miss, which is what `shotFault` is for.
 */
export function landmarkBrief(landmark) {
    if (!landmark) return '';

    const [low, high] = landmark.window.heightFeet ?? [];
    const middle = Math.round(((low ?? 0) + (high ?? 0)) / 2);

    return `${landmark.name}  ·  ${middle} FT  ·  ${pad(landmark.window.heading)}°`;
}

/** A bearing written the way the compass readout writes one, three digits. */
function pad(bearing) {
    return String(Math.round(((bearing % 360) + 360) % 360)).padStart(3, '0');
}

/**
 * The circle a landmark has to be shot from inside, in the world units a
 * renderer draws in: the near edge and the far edge of its range band. Null
 * for a window with no range to it, which is a landmark nothing can be told
 * about.
 */
export function rangeBand(landmark) {
    const band = landmark?.window?.range;
    if (!Array.isArray(band)) return null;
    return { near: band[0], far: band[1] };
}

/**
 * How high a landmark's window sits, in the world units a renderer draws in.
 * Null for a window with no height band.
 */
export function windowHeight(landmark) {
    const band = landmark?.window?.heightFeet;
    if (!Array.isArray(band)) return null;
    return { low: band[0] / FEET_PER_UNIT, high: band[1] / FEET_PER_UNIT };
}
