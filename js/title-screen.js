/**
 * Title screen state - the screen the game opens on, before the first flight.
 * Pure module with no DOM or Three.js dependencies so the start rules and the
 * held pre-flight clock can be unit tested in Node.
 *
 * The screen carries a menu rather than a prompt, so the flight can be started,
 * the controls read, or the settings changed before anything is in the air. The
 * menu itself is the shared one in `js/menu.js`; all this module owns is
 * whether the flight has begun.
 */

export const TITLE_NAME = 'PILOT MATTER';

// What the screen says under the menu: the keys that work it, in the same
// words the pause menu uses for the same keys.
export const START_HINT = 'W/S TO SELECT, ENTER TO CHOOSE';

export function createTitleState() {
    return { started: false };
}

/**
 * Begins the flight. This is the opening screen rather than a menu to come
 * back to, so once it is answered it is gone for the session.
 *
 * Returns true when this call started the flight.
 */
export function startFlight(state) {
    const changed = !state.started;
    state.started = true;
    return changed;
}

/** True while the title screen still holds the flight on the ramp. */
export function titleShowing(state) {
    return !state.started;
}

/**
 * The delta time the simulation should advance by this frame. Held at zero
 * until the flight is started, so the aircraft is not already climbing away
 * behind the title screen, and the wait before someone chooses is not applied
 * in one jump on the frame the flight begins.
 */
export function preFlightDelta(state, dt) {
    return state.started ? dt : 0;
}
