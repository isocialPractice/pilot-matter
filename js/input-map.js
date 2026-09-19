/**
 * Input map - translates keyboard event codes into aircraft input state.
 * Pure module with no DOM or Three.js dependencies so the input-to-state
 * mapping can be unit tested in Node.
 *
 * The bindings are a plain map from a control to the codes that work it, so a
 * host embedding the Pilot API can remap them, or ignore them entirely and
 * write the input state from an input source of its own.
 */

/** The controls the flight model reads, and the keys the game binds to them. */
export const DEFAULT_KEYMAP = {
    pitchUp:      ['KeyW', 'ArrowUp'],
    pitchDown:    ['KeyS', 'ArrowDown'],
    rollLeft:     ['KeyA', 'ArrowLeft'],
    rollRight:    ['KeyD', 'ArrowRight'],
    yawLeft:      ['KeyQ'],
    yawRight:     ['KeyE'],
    throttleUp:   ['ShiftLeft', 'ShiftRight'],
    throttleDown: ['ControlLeft', 'ControlRight']
};

// The controls that mean the pilot wants a different vertical state, which is
// what hands the aircraft back after a level off. Roll and yaw are not among
// them: an altitude held through a turn is the whole point of holding one.
export const VERTICAL_CONTROLS = ['pitchUp', 'pitchDown', 'throttleUp', 'throttleDown'];

// Reset is not a control surface, so it is not part of the input state: it is
// an instruction to put the flight back where it started.
export const RESET_KEYS = ['KeyR'];

// Levelling off is not a control surface either, and is bound here beside
// reset for the same reason: it is an instruction to trim the climb out and
// ease the nose down to level over LEVEL_OFF_SECONDS, rather than a surface
// held while a key is down. The interval is in js/flight-model.js; nothing
// about the ease is configured here, because a binding is what the key means
// rather than how long it takes.
//
// It also has to stay out of the input state because space is the key a menu
// is chosen with. A menu takes its own keys before the flight behind it reads
// them, but a control surface a menu key could write to is a control surface
// waiting for the one path that forgets to.
export const LEVEL_OFF_KEYS = ['Space'];

export const CONTROL_NAMES = Object.keys(DEFAULT_KEYMAP);

export function createInputState() {
    const input = {};
    for (const name of CONTROL_NAMES) input[name] = false;
    return input;
}

export function isResetKey(code, keys = RESET_KEYS) {
    return keys.includes(code);
}

export function isLevelOffKey(code, keys = LEVEL_OFF_KEYS) {
    return keys.includes(code);
}

/**
 * True when the input is calling for a different vertical state, which is what
 * ends a level off. The pilot asked for the climb to be trimmed out; the next
 * thing they ask of the nose or the lever is them taking it back.
 */
export function wantsVerticalChange(input, controls = VERTICAL_CONTROLS) {
    return controls.some(name => input?.[name] === true);
}

/**
 * Applies a key event to the input state.
 * Returns the name of the input field that changed, or null when the
 * key code is not bound to a control.
 */
export function applyKeyToInput(input, code, down, keymap = DEFAULT_KEYMAP) {
    for (const [name, codes] of Object.entries(keymap)) {
        if (!codes.includes(code)) continue;
        input[name] = down;
        return name;
    }
    return null;
}
