/**
 * Title screen state - the overlay the game opens on, before the first
 * flight. Pure module with no DOM or Three.js dependencies so the start rules
 * and the held pre-flight clock can be unit tested in Node.
 */

export const TITLE_NAME   = 'PILOT MATTER';
export const START_PROMPT = 'PRESS ANY KEY TO START';

// Keys that are held rather than pressed. A modifier on its own is half of a
// shortcut rather than an answer to the prompt, so resting a hand on Shift
// leaves the title up.
export const MODIFIER_KEYS = [
    'ShiftLeft', 'ShiftRight',
    'ControlLeft', 'ControlRight',
    'AltLeft', 'AltRight',
    'MetaLeft', 'MetaRight',
    'CapsLock', 'NumLock', 'ScrollLock'
];

export function createTitleState() {
    return { started: false };
}

export function isStartKey(code) {
    return !MODIFIER_KEYS.includes(code);
}

/**
 * Applies a key event to the title state. Only the initial keydown of a key
 * that is actually a key press starts the flight, and once started the title
 * is gone for the session: this is the opening screen, not a menu to come
 * back to.
 *
 * Returns true when the flight started on this key.
 */
export function applyStartKey(state, code, down, repeat = false) {
    if (state.started || !down || repeat || !isStartKey(code)) return false;
    state.started = true;
    return true;
}

/** True while the title screen still holds the flight on the ramp. */
export function titleShowing(state) {
    return !state.started;
}

/**
 * The delta time the simulation should advance by this frame. Held at zero
 * until the first key press, so the aircraft is not already gliding toward
 * the terrain behind the title screen, and the wait before someone presses a
 * key is not applied in one jump on the frame the flight starts.
 */
export function preFlightDelta(state, dt) {
    return state.started ? dt : 0;
}
