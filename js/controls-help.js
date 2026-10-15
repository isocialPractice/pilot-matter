/**
 * Controls help state - the on-screen control list and the H key that
 * collapses it down to a single hint line for a clearer view out of the
 * window. Pure module with no DOM or Three.js dependencies so the toggle
 * rules can be unit tested in Node.
 */

import { DEFAULT_BINDINGS, keyLabel, UNBOUND_LABEL } from './key-bindings.js';

export const HELP_KEY = 'KeyH';

/**
 * The rows of the list that name a key the pilot can move, as the bindings each
 * is written from. Every other row names a key nothing rebinds and is left in
 * the page exactly as it is written there.
 *
 * A list that went on naming the keys the game shipped with would be the one
 * thing on screen contradicting the panel that moved them, and it is the thing
 * a pilot who has just rebound something reads first.
 */
export const HELP_BINDING_ROWS = Object.freeze([
    { id: 'pitch',        label: 'Pitch',         bindings: Object.freeze(['pitchUp', 'pitchDown']) },
    { id: 'roll',         label: 'Roll',          bindings: Object.freeze(['rollLeft', 'rollRight']) },
    { id: 'yaw',          label: 'Yaw',           bindings: Object.freeze(['yawLeft', 'yawRight']) },
    { id: 'throttleUp',   label: 'Throttle Up',   bindings: Object.freeze(['throttleUp']) },
    { id: 'throttleDown', label: 'Throttle Down', bindings: Object.freeze(['throttleDown']) },
    { id: 'levelOff',     label: 'Level Off',     bindings: Object.freeze(['levelOff']) },
    { id: 'reset',        label: 'Reset Position', bindings: Object.freeze(['reset']) }
]);

/**
 * The keys one row names, read down the alternatives rather than across the
 * controls: `W/S or ↑/↓` is one way to fly the axis and then another, which is
 * how the list has always been written and how a pilot reads it.
 *
 * Two controls bound to a different number of keys simply run out at different
 * depths, and the shorter one drops out of the later alternatives rather than
 * leaving a gap. Alternatives that read the same are shown once, which is what
 * turns the two Shift keys into one `Shift`.
 */
export function helpRowKeys(row, bindings = DEFAULT_BINDINGS) {
    const lists = row.bindings.map(name => bindings?.[name] ?? []);
    const depth = Math.max(0, ...lists.map(codes => codes.length));
    const alternatives = [];

    for (let at = 0; at < depth; at++) {
        const keys = lists.map(codes => codes[at]).filter(Boolean).map(keyLabel);
        if (keys.length) alternatives.push(keys.join('/'));
    }

    const read = [...new Set(alternatives)];
    return read.length ? read.join(' or ') : UNBOUND_LABEL;
}

/** One row of the list, as the line it is written on screen. */
export function helpRowText(row, bindings = DEFAULT_BINDINGS) {
    return `${helpRowKeys(row, bindings)} - ${row.label}`;
}

/** Every row the bindings write, as the lines they are, keyed by row id. */
export function helpRowLines(bindings = DEFAULT_BINDINGS) {
    return Object.fromEntries(HELP_BINDING_ROWS.map(row => [row.id, helpRowText(row, bindings)]));
}

// What the collapsed list leaves on screen: enough to find the key that
// brings the rest of it back.
//
// Named for the list it reopens, which is CONTROL REFERENCE - the heading the
// expanded list carries and the label on the control settings panel row that
// also opens it. One name for one list, so collapsing it does not look like
// swapping it for something else. The key stays at the front because saying
// which key brings the list back is the whole reason the line is left behind.
export const HELP_HINT = 'H - CONTROL REFERENCE';

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
