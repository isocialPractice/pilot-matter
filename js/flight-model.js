/**
 * Flight model - the arcade physics rules, as pure functions with no DOM or
 * Three.js dependencies so they can be unit tested in Node.
 *
 * Throttle is a setting, not a speed: Shift and Ctrl move a 0-1 lever, the
 * lever picks a target speed, and airspeed converges toward that target.
 * Lift is then read off airspeed - too slow and the aircraft stalls and
 * sinks hard, at cruise speed lift cancels gravity and level flight holds
 * altitude.
 */

// Speeds are in world units per second.
export const MIN_SPEED    = 40;    // below this the wing stalls
export const CRUISE_SPEED = 120;   // lift cancels gravity from here up
export const MAX_SPEED    = 200;   // speed at a full throttle setting

// Gravity in units per second squared, before any lift is subtracted.
export const GRAVITY = 12;

// A stalled wing sinks up to this multiple of the unlifted rate, reached at
// a dead stop and easing back to normal as the aircraft regains MIN_SPEED.
export const STALL_SINK_MULTIPLIER = 2;

// Throttle lever travel per second: a full 0-100% sweep takes two seconds.
export const THROTTLE_RATE = 0.5;

// How hard the engine pulls toward the target speed, and how quickly drag
// bleeds speed off when the throttle is pulled back. Units per second
// squared; drag is the gentler of the two.
export const SPEED_ACCEL = 60;
export const SPEED_DECEL = 40;

function clamp(value, low, high) {
    return Math.min(Math.max(value, low), high);
}

/**
 * Moves the throttle lever for one frame and returns the new 0-1 setting.
 * Holding both keys cancels out; the lever stops at each end rather than
 * winding past it.
 */
export function updateThrottle(throttle, input = {}, dt, rate = THROTTLE_RATE) {
    let next = throttle;
    if (input.throttleUp)   next += rate * dt;
    if (input.throttleDown) next -= rate * dt;
    return clamp(next, 0, 1);
}

/**
 * The speed a throttle setting asks for. A closed throttle asks for a dead
 * stop, which is what makes an idle aircraft stall and sink.
 */
export function targetSpeed(throttle, maxSpeed = MAX_SPEED) {
    return clamp(throttle, 0, 1) * maxSpeed;
}

/**
 * Steps airspeed toward the target for one frame, snapping to the target
 * once it is within a single step so speed settles instead of oscillating.
 */
export function convergeSpeed(speed, target, dt, accel = SPEED_ACCEL, decel = SPEED_DECEL) {
    const gap = target - speed;
    if (gap === 0) return target;
    const step = (gap > 0 ? accel : decel) * dt;
    return Math.abs(gap) <= step ? target : speed + Math.sign(gap) * step;
}

/**
 * Lift as a fraction of weight, from zero at a standstill to a full 1 at
 * cruise speed. Capped at 1 so extra speed never lifts the aircraft on its
 * own - climbing is done with the nose, not the engine.
 */
export function liftFactor(speed, cruiseSpeed = CRUISE_SPEED) {
    if (cruiseSpeed <= 0) return 1;
    const ratio = Math.max(speed, 0) / cruiseSpeed;
    return Math.min(1, ratio * ratio);
}

/**
 * True while the wing is below its stall speed.
 */
export function isStalled(speed, minSpeed = MIN_SPEED) {
    return speed < minSpeed;
}

/**
 * How fast the aircraft falls this frame, in units per second, before pitch
 * is taken into account. Gravity minus lift, multiplied by a stall penalty
 * that eases in from 1 at the stall speed to the full multiplier at a dead
 * stop. Zero at and above cruise speed, so level flight holds altitude.
 */
export function sinkRate(speed, options = {}) {
    const {
        gravity         = GRAVITY,
        minSpeed        = MIN_SPEED,
        cruiseSpeed     = CRUISE_SPEED,
        stallMultiplier = STALL_SINK_MULTIPLIER
    } = options;

    const sink = gravity * (1 - liftFactor(speed, cruiseSpeed));
    if (!isStalled(speed, minSpeed) || minSpeed <= 0) return sink;

    const severity = 1 + (1 - Math.max(speed, 0) / minSpeed) * (stallMultiplier - 1);
    return sink * severity;
}
