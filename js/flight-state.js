/**
 * Initial flight state - the condition gameplay starts from, and the condition
 * Reset Flight and the R key put the aircraft back into. Pure module with no
 * DOM or Three.js dependencies so the starting values can be unit tested in
 * Node.
 *
 * What the start is belongs to `js/config.js`, where it is data a pilot can
 * read and the settings panel can change. What this module does is turn it
 * into the world units the flight model works in, through the conversions the
 * instruments read back through, so the HUD shows exactly the numbers that
 * were configured on the first frame.
 *
 * The `INITIAL_` constants below are the configured defaults resolved once, for
 * everything that wants the start the simulator ships with rather than the one
 * a particular flight was given.
 */

import {
    knotsToSpeed, feetToAltitude, feetPerMinuteToVerticalSpeed,
    percentToThrottle, headingToYaw
} from './units.js';
import { pitchForClimb } from './flight-model.js';
import { DEFAULT_CONFIG, resolveStart } from './config.js';

/**
 * A configured start in the world units the flight model works in.
 *
 * The pitch is worked out rather than configured: it is the attitude that
 * holds the configured climb at the configured airspeed, so the aircraft flies
 * the climb it starts in rather than settling out of it over the first second.
 * A start whose throttle asks for a different airspeed than it was given is
 * still honoured as written - the lever is a setting the airspeed converges on,
 * and converging on it from somewhere else is a legitimate thing to ask for.
 */
export function flightStart(start = DEFAULT_CONFIG.start) {
    const resolved      = resolveStart(start);
    const speed         = knotsToSpeed(resolved.airspeedKnots);
    const verticalSpeed = feetPerMinuteToVerticalSpeed(resolved.verticalSpeedFpm);

    return {
        speed,
        verticalSpeed,
        altitude:   feetToAltitude(resolved.altitudeFeet),
        throttle:   percentToThrottle(resolved.throttlePercent),
        yaw:        headingToYaw(resolved.headingDegrees),
        pitch:      pitchForClimb(verticalSpeed, speed),
        cameraMode: resolved.cameraMode
    };
}

// --- The configured start, in the units it is read in ---

export const INITIAL_AIRSPEED_KNOTS     = DEFAULT_CONFIG.start.airspeedKnots;
export const INITIAL_ALTITUDE_FEET      = DEFAULT_CONFIG.start.altitudeFeet;
export const INITIAL_VERTICAL_SPEED_FPM = DEFAULT_CONFIG.start.verticalSpeedFpm;
export const INITIAL_HEADING_DEGREES    = DEFAULT_CONFIG.start.headingDegrees;
export const INITIAL_THROTTLE_PERCENT   = DEFAULT_CONFIG.start.throttlePercent;
export const INITIAL_CAMERA_MODE        = DEFAULT_CONFIG.start.cameraMode;

// --- The same start, in the world units the flight model works in ---

const DEFAULT_START = flightStart();

export const INITIAL_SPEED          = DEFAULT_START.speed;
export const INITIAL_ALTITUDE       = DEFAULT_START.altitude;
export const INITIAL_VERTICAL_SPEED = DEFAULT_START.verticalSpeed;
export const INITIAL_THROTTLE       = DEFAULT_START.throttle;
export const INITIAL_YAW            = DEFAULT_START.yaw;

// The attitude that holds the configured climb at the configured airspeed. The
// throttle setting asks for exactly the airspeed configured above, so nothing
// is converging on the first frame and the aircraft flies the climb it starts
// in rather than settling out of it.
export const INITIAL_PITCH = DEFAULT_START.pitch;

/**
 * Builds a fresh starting state, from the configured start or from one a caller
 * supplies. Returns new objects on every call so the caller can mutate position
 * and rotation without touching the defaults.
 */
export function createFlightState(start = DEFAULT_CONFIG.start) {
    const flight = flightStart(start);

    return {
        speed: flight.speed,
        throttle: flight.throttle,
        verticalSpeed: flight.verticalSpeed,
        cameraMode: flight.cameraMode,
        position: { x: 0, y: flight.altitude, z: 0 },
        rotation: { x: flight.pitch, y: flight.yaw, z: 0 }
    };
}
