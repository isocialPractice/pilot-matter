/**
 * Controls help state - the on-screen control list and the H key that
 * collapses it down to a single hint line for a clearer view out of the
 * window. Pure module with no DOM or Three.js dependencies so the toggle
 * rules can be unit tested in Node.
 */

import { DEFAULT_BINDINGS, keyLabel, UNBOUND_LABEL } from './key-bindings.js';
import { CANVAS_LEAVE_KEYS } from './build-mode.js';
import {
    CAMERA_GESTURES, CAMERA_ORBIT, CAMERA_PAN, BUILD_MOVE_KEYS, REFRAME_KEYS
} from './build-camera.js';
import { PHOTO_KEY } from './photo.js';
import { MENU_SELECT_KEYS } from './menu.js';
import { BUILD_TOOLS, SELECT_TOOL, isBuiltTool } from './build-tools.js';

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

/**
 * The builder's control list: what a canvas answers to, and nothing that is
 * planned.
 *
 * Each row carries what its handler reads rather than a spelling of it - the
 * key lists for a key, the gesture table's entries for a press, and the wheel
 * for the wheel - so the list cannot name an input the canvas does not answer
 * to, and an input moved in the module that reads it is a row that moves with
 * it. A binding the builder gains adds its row here in the same commit, the way
 * a tool adds its tile to the palette.
 *
 * A key row's `keys` is a list of controls, each a list of the codes that work
 * it, read down the alternatives the way the flight's rows are: the move row is
 * four controls of two keys each, and reads `W/A/S/D or ↑/←/↓/→`.
 *
 * A row's `click` is the tool whose own click on the ground the row is, listed
 * while that tool is built. A row with `handle` is a drag of the gumball on
 * the edit in hand, which every tool answers to. An input one tool answers to and the rest do not
 * is named with that tool, so a drag that orbits in Select and does nothing
 * with Mountain live says so on the line rather than leaving it to be found.
 *
 * The rows hold codes and are turned into text by `buildHelpLines`, not here:
 * `keyLabel` belongs to a module this one is in an import cycle with, and a
 * label worked out at load would read it before it exists - the trap
 * `js/reserved-keys.js` describes.
 */
export const BUILD_HELP_ROWS = Object.freeze([
    { id: 'orbit',   label: 'Orbit',   presses: CAMERA_GESTURES.filter(entry => entry.gesture === CAMERA_ORBIT) },
    { id: 'pan',     label: 'Pan',     presses: CAMERA_GESTURES.filter(entry => entry.gesture === CAMERA_PAN) },
    { id: 'zoom',    label: 'Zoom',    wheel: true },
    {
        id: 'move', label: 'Move',
        keys: [BUILD_MOVE_KEYS.forward, BUILD_MOVE_KEYS.left, BUILD_MOVE_KEYS.back, BUILD_MOVE_KEYS.right]
    },
    { id: 'reframe', label: 'Reframe',           keys: [REFRAME_KEYS] },
    { id: 'pick',    label: 'Pick a Built Element', click: SELECT_TOOL },
    ...(isBuiltTool('mountain') ? [{ id: 'drop', label: 'Drop a Mountain', click: 'mountain' }] : []),
    { id: 'handle',  label: 'Move or Shape What Is in Hand', handle: true },
    { id: 'leave',   label: 'Accept Edits or Save and Exit', keys: [CANVAS_LEAVE_KEYS] },
    { id: 'answer',  label: 'Answer a Question',             keys: [MENU_SELECT_KEYS.slice(0, 1)] },
    { id: 'help',    label: 'Collapse List',     keys: [[HELP_KEY]] },
    { id: 'photo',   label: 'Photo',             keys: [[PHOTO_KEY]] }
].map(row => Object.freeze(row)));

/** What a press is called on the list, by the button it is made with. */
const PRESS_LABELS = ['Drag', 'Middle Drag', 'Right Drag'];

/** The keys of a row, read down the alternatives rather than across the controls. */
function keysText(controls) {
    const depth = Math.max(0, ...controls.map(codes => codes.length));
    const alternatives = [];

    for (let at = 0; at < depth; at++) {
        const keys = controls.map(codes => codes[at]).filter(Boolean).map(keyLabel);
        if (keys.length) alternatives.push(keys.join('/'));
    }

    return alternatives.join(' or ');
}

/** A row's presses, each named for its button, whether `shift` is held with it, and the tool it is for. */
function pressText(presses) {
    return presses
        .map(press => `${press.shift ? 'Shift+' : ''}${PRESS_LABELS[press.button]}${forTools(press.tools)}`)
        .join(' or ');
}

/** The tools an input is answered by, as the line names them, or nothing for every tool. */
function forTools(tools) {
    if (!tools?.length) return '';
    return ` (${tools.map(toolName).join('/')})`;
}

/** A tool as the control list names it: its tile's label, in the list's case. */
function toolName(id) {
    const label = BUILD_TOOLS.find(tool => tool.id === id)?.label ?? id;
    return label.charAt(0) + label.slice(1).toLowerCase();
}

/** The builder's list, as the lines it is written on screen, in its order. */
export function buildHelpLines() {
    return BUILD_HELP_ROWS.map(row => {
        const input = row.keys ? keysText(row.keys)
            : row.presses ? pressText(row.presses)
            : row.click ? `Click${forTools([row.click])}`
            : row.handle ? 'Drag a Handle'
            : 'Wheel';
        return { id: row.id, text: `${input} - ${row.label}` };
    });
}

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
