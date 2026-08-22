/**
 * Camera math - the framerate-independent damping that gives the chase
 * camera its positional lag. Pure module with no DOM or Three.js
 * dependencies so the easing can be unit tested in Node.
 *
 * The camera does not sit at a fixed offset behind the aircraft any more: it
 * chases that offset, closing a constant fraction of the remaining gap per
 * second, so a turn or a pitch change swings the view around rather than
 * snapping it into place.
 */

// The views the C key cycles through, in the order it cycles them. The names
// live here rather than beside the Three.js camera so anything that only needs
// to name a mode - the configured start state, the API's options - can read
// them without pulling in a renderer.
export const CAMERA_MODES = ['CHASE', 'COCKPIT', 'ORBIT'];

/** Where a named mode sits in the cycle, falling back to the first one. */
export function modeIndexOf(mode) {
    const index = CAMERA_MODES.indexOf(mode);
    return index < 0 ? 0 : index;
}

// How quickly the camera closes on its offset, in reciprocal seconds. The
// position trails further than the point it looks at, so the aircraft leads
// the frame through a turn.
export const CHASE_POSITION_LAMBDA = 6;
export const CHASE_TARGET_LAMBDA   = 10;

// A gap this wide, in world units, is a teleport rather than a manoeuvre -
// a reset, a crash recovery, or a return from another camera mode - and the
// camera cuts to the new position instead of flying across the world to it.
export const CHASE_SNAP_DISTANCE = 200;

/**
 * The fraction of the remaining gap to close this frame. Derived from an
 * exponential decay so the result of many small frames matches the result of
 * one big one, which keeps the feel of the lag the same at any framerate.
 * Zero for a frozen clock, so a paused frame holds the camera still.
 */
export function dampFactor(lambda, dt) {
    if (!(dt > 0) || !(lambda > 0)) return 0;
    return 1 - Math.exp(-lambda * dt);
}

/**
 * Eases one value toward another by this frame's damping factor.
 */
export function damp(current, target, lambda, dt) {
    return current + (target - current) * dampFactor(lambda, dt);
}

/**
 * True when a gap is too wide to have been flown and should be cut across
 * rather than eased over.
 */
export function shouldSnap(distance, threshold = CHASE_SNAP_DISTANCE) {
    return distance > threshold;
}
