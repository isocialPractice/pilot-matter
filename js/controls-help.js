/**
 * Controls help state - the on-screen control list and the H key that
 * collapses it down to a single hint line for a clearer view out of the
 * window. Pure module with no DOM or Three.js dependencies so the toggle
 * rules can be unit tested in Node.
 */

export const HELP_KEY = 'KeyH';

// What the collapsed list leaves on screen: enough to find the key that
// brings the rest of it back.
export const HELP_HINT = 'H - CONTROLS';

export function createHelpState(expanded = true) {
    return { expanded };
}

export function isHelpKey(code) {
    return code === HELP_KEY;
}

export function toggleHelp(state) {
    state.expanded = !state.expanded;
    return state.expanded;
}

/**
 * Opens the list back up, whatever it was doing. The pause menu's Controls
 * entry uses this, so a player who has collapsed the list and forgotten the
 * key still has a way back to it.
 *
 * Returns true when the list was collapsed and is now open.
 */
export function expandHelp(state) {
    const changed = !state.expanded;
    state.expanded = true;
    return changed;
}

/**
 * Applies a key event to the help state. Key releases are ignored so the
 * list is a latch rather than a hold, and auto-repeat is ignored so holding H
 * does not flicker the list.
 *
 * Returns true when the state changed.
 */
export function applyHelpKey(state, code, down, repeat = false) {
    if (!down || repeat || !isHelpKey(code)) return false;
    toggleHelp(state);
    return true;
}
