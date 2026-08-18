/**
 * Pause state - toggled with the P key. Pure module with no DOM or Three.js
 * dependencies so the toggle rules and the frozen simulation clock can be
 * unit tested in Node.
 */

export const PAUSE_KEY = 'KeyP';
export const PAUSE_LABEL = 'PAUSED';

export function createPauseState() {
    return { paused: false };
}

export function isPauseKey(code) {
    return code === PAUSE_KEY;
}

export function togglePause(state) {
    state.paused = !state.paused;
    return state.paused;
}

/**
 * Applies a key event to the pause state.
 *
 * Only the initial keydown toggles: key releases are ignored so pause is a
 * latch rather than a hold, and auto-repeat events are ignored so holding P
 * does not flicker between paused and running.
 *
 * Returns true when the state changed.
 */
export function applyPauseKey(state, code, down, repeat = false) {
    if (!down || repeat || !isPauseKey(code)) return false;
    togglePause(state);
    return true;
}

/**
 * The delta time the simulation should advance by this frame. Frozen at zero
 * while paused, which stops the flight model and the orbit camera without
 * stopping the render loop, so the paused frame stays on screen.
 */
export function simulationDelta(state, dt) {
    return state.paused ? 0 : dt;
}
