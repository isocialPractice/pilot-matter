/**
 * Units - the conversions between world units and the numbers the instruments
 * read, in both directions. Pure module with no DOM or Three.js dependency, so
 * a start state written in knots and feet can be turned into world units and
 * unit tested in Node.
 *
 * The readings go out rounded, the way an instrument shows them, and come back
 * unrounded, because a configured start state is a request for an exact
 * condition rather than a reading off a dial.
 */

// Approximate, tuned for arcade feel rather than for a real airframe.
export const KNOTS_PER_UNIT = 2;
export const FEET_PER_UNIT  = 3.28;
export const SECONDS_PER_MINUTE = 60;

export const DEGREES_PER_RADIAN = 180 / Math.PI;

function clamp(value, low, high) {
    return Math.min(Math.max(value, low), high);
}

export function speedToKnots(speed) { return Math.round(speed * KNOTS_PER_UNIT); }
export function knotsToSpeed(knots) { return knots / KNOTS_PER_UNIT; }

export function altitudeToFeet(altitude) { return Math.round(altitude * FEET_PER_UNIT); }
export function feetToAltitude(feet)     { return feet / FEET_PER_UNIT; }

export function throttleToPercent(throttle) { return Math.round(throttle * 100); }
export function percentToThrottle(percent)  { return clamp(percent / 100, 0, 1); }

/**
 * A climb rate in feet per minute as a vertical speed in world units per
 * second. The inverse of what the vertical speed indicator reads, without the
 * indicator's rounding.
 */
export function feetPerMinuteToVerticalSpeed(feetPerMinute) {
    return feetPerMinute / (FEET_PER_UNIT * SECONDS_PER_MINUTE);
}

/**
 * The compass bearing the aircraft is pointing along, in whole degrees from
 * 0 to 359. The world's +Z axis is north, so a flight starts on 000, and the
 * card counts clockwise the way a right turn carries the nose - which is the
 * falling direction of the yaw angle, hence the sign.
 */
export function headingDegrees(yaw) {
    const degrees = Math.round(-yaw * DEGREES_PER_RADIAN);
    return ((degrees % 360) + 360) % 360;
}

/**
 * The yaw angle that puts the nose on a compass bearing. North comes back as a
 * plain zero rather than the negated one the sign would otherwise leave, so a
 * start state written for 000 holds a rotation of 0.
 */
export function headingToYaw(degrees) {
    const yaw = -degrees / DEGREES_PER_RADIAN;
    return Object.is(yaw, -0) ? 0 : yaw;
}
