/**
 * Initial flight state - the condition gameplay starts from, and the condition
 * Reset Flight and the R key put the aircraft back into. Pure module with no
 * DOM or Three.js dependencies so the starting values can be unit tested in
 * Node.
 *
 * The start is configured the way a pilot reads it, in knots, feet, feet per
 * minute, and degrees on the card, and converted into the world units the
 * flight model works in. The conversions are the ones the instruments use, so
 * the HUD reads back exactly the numbers configured here on the first frame.
 */

import {
    knotsToSpeed, feetToAltitude, feetPerMinuteToVerticalSpeed,
    percentToThrottle, headingToYaw
} from './units.js';
import { pitchForClimb } from './flight-model.js';

// --- The configured start, in the units it is read in ---

export const INITIAL_AIRSPEED_KNOTS     = 80;
export const INITIAL_ALTITUDE_FEET      = 1390;
export const INITIAL_VERTICAL_SPEED_FPM = 1260;
export const INITIAL_HEADING_DEGREES    = 0;
export const INITIAL_THROTTLE_PERCENT   = 20;
export const INITIAL_CAMERA_MODE        = 'CHASE';

// --- The same start, in the world units the flight model works in ---

export const INITIAL_SPEED          = knotsToSpeed(INITIAL_AIRSPEED_KNOTS);
export const INITIAL_ALTITUDE       = feetToAltitude(INITIAL_ALTITUDE_FEET);
export const INITIAL_VERTICAL_SPEED = feetPerMinuteToVerticalSpeed(INITIAL_VERTICAL_SPEED_FPM);
export const INITIAL_THROTTLE       = percentToThrottle(INITIAL_THROTTLE_PERCENT);
export const INITIAL_YAW            = headingToYaw(INITIAL_HEADING_DEGREES);

// The attitude that holds the configured climb at the configured airspeed. The
// throttle setting asks for exactly the airspeed configured above, so nothing
// is converging on the first frame and the aircraft flies the climb it starts
// in rather than settling out of it.
export const INITIAL_PITCH = pitchForClimb(INITIAL_VERTICAL_SPEED, INITIAL_SPEED);

/**
 * Builds a fresh starting state. Returns new objects on every call so the
 * caller can mutate position and rotation without touching the defaults.
 */
export function createFlightState() {
    return {
        speed: INITIAL_SPEED,
        throttle: INITIAL_THROTTLE,
        verticalSpeed: INITIAL_VERTICAL_SPEED,
        cameraMode: INITIAL_CAMERA_MODE,
        position: { x: 0, y: INITIAL_ALTITUDE, z: 0 },
        rotation: { x: INITIAL_PITCH, y: INITIAL_YAW, z: 0 }
    };
}
