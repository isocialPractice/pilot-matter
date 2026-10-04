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

// --- Which way an axis reads its keys --------------------------------------

/**
 * Directional means the key points where the aircraft goes: up raises the nose
 * and right drops the right wing. Inverted means the key points where a stick
 * would go, which is the other way round on both counts - up lowers the nose
 * and right turns left - and is what a pilot coming from a yoke reaches for.
 */
export const AXIS_DIRECTIONAL = 'directional';
export const AXIS_INVERTED    = 'inverted';

/**
 * The two controls each axis is flown with, as the pair an inverted axis
 * exchanges. Written as pairs rather than as a rule about names, because a
 * control is one end of an axis and which two ends make an axis is a fact about
 * flight rather than about spelling.
 */
export const AXIS_CONTROLS = Object.freeze({
    pitch: Object.freeze(['pitchUp', 'pitchDown']),
    roll:  Object.freeze(['rollLeft', 'rollRight'])
});

export const AXIS_NAMES = Object.freeze(Object.keys(AXIS_CONTROLS));

/** Every control an axis can turn over, which is both ends of both of them. */
export const AXIS_CONTROL_NAMES = Object.freeze(AXIS_NAMES.flatMap(axis => [...AXIS_CONTROLS[axis]]));

/** Both axes read the way the key is drawn, until a pilot asks otherwise. */
export const DEFAULT_AXES = Object.freeze({ pitch: AXIS_DIRECTIONAL, roll: AXIS_DIRECTIONAL });

/** The axis a control is one end of, or null for one no axis is flown with. */
export function controlAxis(name) {
    return AXIS_NAMES.find(axis => AXIS_CONTROLS[axis].includes(name)) ?? null;
}

/** True while an axis is reading its keys the other way round. */
export function isAxisInverted(axes = DEFAULT_AXES, axis) {
    return axes?.[axis] === AXIS_INVERTED;
}

/**
 * The control a key actually works, once the axes are applied: itself on a
 * directional axis, and the other end of its own axis on an inverted one.
 *
 * This is the one place either axis is turned over, which is what makes the two
 * settings independent without being two mechanisms. Both spellings of the
 * input come through here - `WASD` and the arrow keys are two names for one
 * control rather than two control schemes - so neither can be inverted without
 * the other, and nothing downstream has to know an axis was ever turned.
 */
export function axisControl(name, axes = DEFAULT_AXES) {
    const axis = controlAxis(name);
    if (!axis || !isAxisInverted(axes, axis)) return name;

    const pair = AXIS_CONTROLS[axis];
    return pair[pair.indexOf(name) === 0 ? 1 : 0];
}

/**
 * The axes as this module reads them, from values that came from somewhere else
 * - a stored choice, a host's options, a panel. Each axis is read on its own and
 * falls back to directional alone, so one setting this version cannot read does
 * not cost the other one its own.
 */
export function resolveAxes(values = {}) {
    const axes = { ...DEFAULT_AXES };
    for (const axis of AXIS_NAMES) {
        if (values?.[axis] === AXIS_INVERTED || values?.[axis] === AXIS_DIRECTIONAL) {
            axes[axis] = values[axis];
        }
    }
    return axes;
}

/**
 * Lets go of both ends of both axes.
 *
 * Called where the axes change rather than where a key does. A control held
 * while its axis is turned over is released by the other end of its pair when
 * the key finally comes up, which leaves the end that was pressed held down for
 * the rest of the flight - an aircraft rolling on its own with nothing on the
 * keyboard to stop it. Letting go of all four costs the pilot the press they
 * were in the middle of and nothing else.
 *
 * Returns the input state, so it reads the way the other input sources do.
 */
export function releaseAxisControls(input, controls = AXIS_CONTROL_NAMES) {
    for (const name of controls) if (name in input) input[name] = false;
    return input;
}

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
 * Applies a key event to the input state, reading each axis the way the pilot
 * has asked for it.
 *
 * Returns the name of the input field that changed, which on an inverted axis is
 * the other end of the pair the key is bound to - the field that moved rather
 * than the binding that moved it. Null when the key code is not bound to a
 * control at all.
 */
export function applyKeyToInput(input, code, down, keymap = DEFAULT_KEYMAP, axes = DEFAULT_AXES) {
    for (const [name, codes] of Object.entries(keymap)) {
        if (!codes.includes(code)) continue;
        const control = axisControl(name, axes);
        input[control] = down;
        return control;
    }
    return null;
}
