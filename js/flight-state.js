/**
 * Initial flight state - the condition gameplay starts from, and the
 * condition the R key resets back to. Pure module with no DOM or Three.js
 * dependencies so the starting values can be unit tested in Node.
 */

// Speed is in world units per second. Gameplay starts from a standstill, so
// the HUD reads AIRSPEED 0 knots until the throttle is applied.
export const INITIAL_SPEED = 0;

// Altitude and position are in world units.
export const INITIAL_ALTITUDE = 300;

/**
 * Builds a fresh starting state. Returns new objects on every call so the
 * caller can mutate position and rotation without touching the defaults.
 */
export function createFlightState() {
    return {
        speed: INITIAL_SPEED,
        position: { x: 0, y: INITIAL_ALTITUDE, z: 0 },
        rotation: { x: 0, y: 0, z: 0 }
    };
}
