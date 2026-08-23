/**
 * Units - the conversions between world units and the numbers the instruments
 * read, in both directions. Pure module with no DOM or Three.js dependency, so
 * a start state written in knots and feet can be turned into world units and
 * unit tested in Node.
 *
 * The readings go out rounded, the way an instrument shows them, and come back
 * unrounded, because a configured start state is a request for an exact
 * condition rather than a reading off a dial.
 *
 * An instrument can be switched to read on a second scale - miles per hour
 * instead of knots, metres instead of feet - which is a conversion of the same
 * reading rather than a second world, so the flight model never learns which
 * scale is on the dial.
 */

// Approximate, tuned for arcade feel rather than for a real airframe.
export const KNOTS_PER_UNIT = 2;
export const FEET_PER_UNIT  = 3.28;
export const SECONDS_PER_MINUTE = 60;

// The exact factors between the units an instrument can be switched to read in,
// so the alternative scale is a conversion of the same reading rather than a
// second set of tuning numbers that could drift away from the first.
export const MPH_PER_KNOT    = 1.15078;
export const METERS_PER_FOOT = 0.3048;

export const MPH_PER_UNIT    = KNOTS_PER_UNIT * MPH_PER_KNOT;
export const METERS_PER_UNIT = FEET_PER_UNIT * METERS_PER_FOOT;

export const DEGREES_PER_RADIAN = 180 / Math.PI;

/**
 * The scales an airspeed can be read on. `perUnit` is what one world unit per
 * second reads as, and `label` is what the instrument writes beside the number.
 */
export const SPEED_UNITS = {
    knots: { id: 'knots', label: 'knots', perUnit: KNOTS_PER_UNIT },
    mph:   { id: 'mph',   label: 'mph',   perUnit: MPH_PER_UNIT }
};

/**
 * The scales a height can be read on. A climb rate is the same scale over a
 * minute, so each one carries the label its vertical speed indicator uses too.
 */
export const ALTITUDE_UNITS = {
    feet:   { id: 'feet',   label: 'ft', rateLabel: 'ft/min', perUnit: FEET_PER_UNIT },
    meters: { id: 'meters', label: 'm',  rateLabel: 'm/min',  perUnit: METERS_PER_UNIT }
};

export const DEFAULT_SPEED_UNIT    = 'knots';
export const DEFAULT_ALTITUDE_UNIT = 'feet';

function clamp(value, low, high) {
    return Math.min(Math.max(value, low), high);
}

/**
 * The scale named, or the one a flight starts on. An unknown name reads as the
 * default rather than throwing, so a stored setting from a version that had a
 * scale this one does not still leaves a working instrument.
 */
export function speedUnit(id = DEFAULT_SPEED_UNIT) {
    return SPEED_UNITS[id] ?? SPEED_UNITS[DEFAULT_SPEED_UNIT];
}

export function altitudeUnit(id = DEFAULT_ALTITUDE_UNIT) {
    return ALTITUDE_UNITS[id] ?? ALTITUDE_UNITS[DEFAULT_ALTITUDE_UNIT];
}

export function speedTo(speed, id = DEFAULT_SPEED_UNIT) {
    return Math.round(speed * speedUnit(id).perUnit);
}

export function altitudeTo(altitude, id = DEFAULT_ALTITUDE_UNIT) {
    return Math.round(altitude * altitudeUnit(id).perUnit);
}

export function speedToKnots(speed) { return speedTo(speed, 'knots'); }
export function knotsToSpeed(knots) { return knots / KNOTS_PER_UNIT; }

export function altitudeToFeet(altitude) { return altitudeTo(altitude, 'feet'); }
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
