/**
 * Crash detection - the rules for hitting the ground too hard. Pure module
 * with no DOM or Three.js dependencies so the impact threshold and the crash
 * timer can be unit tested in Node.
 *
 * Meeting terrain is not automatically a crash: settling onto a hillside at
 * the rate gravity pulls is a landing, and the aircraft keeps flying. Coming
 * down faster than the impact threshold is a crash, which locks the controls
 * for a moment and then resets the flight, instead of the aircraft silently
 * clamping to the ground height and carrying on.
 */

// How much clearance the aircraft keeps over the terrain below it, in world
// units. Ground contact happens at this height, not at zero.
export const GROUND_CLEARANCE = 5;

// Descent rate that turns ground contact into a crash, in world units per
// second. A stalled aircraft sinks at 24 units/s at the very worst, so an
// unpowered settle onto terrain survives and a dive into it does not.
export const CRASH_IMPACT_SPEED = 30;

// How long the wreck stays on screen before the flight resets, in seconds.
export const CRASH_DURATION = 2.5;

export function createCrashState() {
    return { crashed: false, timer: 0 };
}

/**
 * True when a vertical speed is a hard enough descent to break the aircraft.
 * Vertical speed is signed: descent is negative, so a climb into terrain -
 * which the ground clamp cannot produce - is never an impact.
 */
export function isCrashImpact(verticalSpeed, threshold = CRASH_IMPACT_SPEED) {
    return verticalSpeed <= -Math.abs(threshold);
}

/**
 * Starts a crash and its countdown. Returns true when this began a new crash,
 * and false when one was already running, so a wreck sliding along the ground
 * cannot keep restarting its own timer.
 */
export function beginCrash(state, duration = CRASH_DURATION) {
    if (state.crashed) return false;
    state.crashed = true;
    state.timer = duration;
    return true;
}

/**
 * Clears a crash without waiting out its timer, for a pilot who hits reset
 * rather than sitting through the countdown.
 */
export function clearCrash(state) {
    state.crashed = false;
    state.timer = 0;
}

/**
 * Runs the crash countdown for one frame. Returns true on the single frame
 * the timer runs out, which is the caller's cue to reset the flight.
 */
export function updateCrash(state, dt, duration = CRASH_DURATION) {
    if (!state.crashed) return false;
    state.timer = Math.max(0, state.timer - Math.max(dt, 0));
    if (state.timer > 0) return false;
    clearCrash(state);
    return true;
}

/**
 * True while the pilot's input should be ignored. The controls are dead
 * through a crash so the wreck cannot be flown out of.
 */
export function controlsLocked(state) {
    return state.crashed === true;
}

/**
 * The fraction of the crash countdown still to run, from 1 at the moment of
 * impact down to 0 at the reset, for anything that wants to fade with it.
 */
export function crashProgress(state, duration = CRASH_DURATION) {
    if (!state.crashed || duration <= 0) return 0;
    return Math.min(1, Math.max(0, state.timer / duration));
}
