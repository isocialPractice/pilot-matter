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

// Reset is not a control surface, so it is not part of the input state: it is
// an instruction to put the flight back where it started.
export const RESET_KEYS = ['KeyR'];

export const CONTROL_NAMES = Object.keys(DEFAULT_KEYMAP);

export function createInputState() {
    const input = {};
    for (const name of CONTROL_NAMES) input[name] = false;
    return input;
}

export function isResetKey(code, keys = RESET_KEYS) {
    return keys.includes(code);
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
