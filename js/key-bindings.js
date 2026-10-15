/**
 * Key bindings - which key works which control, and which works each of the
 * two instructions that are not control surfaces.
 *
 * `js/input-map.js` already holds the map from a control to the codes that work
 * it, and takes that map as an argument rather than reading the constant, which
 * is what lets a host embedding the Pilot API replace it. This module is what
 * lets the pilot replace it: the same shape, with the two instructions that are
 * bound apart from the control surfaces - reset and the level off - carried
 * alongside them, so one panel row per action answers one question.
 *
 * The instructions are here and not in the keymap because they are still not
 * control surfaces: a binding is what a key means, and what `applyKeyToInput`
 * writes is a different question that `keymapFor` below answers by handing it
 * the control surfaces alone.
 *
 * Pure module with no DOM or Three.js dependency: the browser's storage is
 * passed in rather than reached for, so a plain object stands in for it under
 * test.
 */

import {
    DEFAULT_KEYMAP, CONTROL_NAMES, RESET_KEYS, LEVEL_OFF_KEYS
} from './input-map.js';

export const KEY_BINDINGS_STORAGE_KEY = 'pilot-matter.key-bindings';

// The two actions that are not control surfaces, named the way the controls
// are so that one list covers everything a key can be put on.
export const RESET_BINDING     = 'reset';
export const LEVEL_OFF_BINDING = 'levelOff';

export const ACTION_BINDINGS = Object.freeze([RESET_BINDING, LEVEL_OFF_BINDING]);

/** Every key the game is flown with, as the keys it is on out of the box. */
export const DEFAULT_BINDINGS = Object.freeze({
    ...Object.fromEntries(CONTROL_NAMES.map(name => [name, Object.freeze([...DEFAULT_KEYMAP[name]])])),
    [RESET_BINDING]:     Object.freeze([...RESET_KEYS]),
    [LEVEL_OFF_BINDING]: Object.freeze([...LEVEL_OFF_KEYS])
});

export const BINDING_NAMES = Object.freeze(Object.keys(DEFAULT_BINDINGS));

/**
 * The bindings a pilot is allowed to leave on nothing at all.
 *
 * Only reset, and that is the whole of the reason it is a list rather than a
 * flag: `R` ends a flight on one press with nothing between, so a pilot flying
 * a long route may well want it on no key, while a control surface with no key
 * is an aircraft that cannot be flown.
 */
export const OPTIONAL_BINDINGS = Object.freeze([RESET_BINDING]);

/** What each binding is called where a pilot reads it. */
export const BINDING_LABELS = Object.freeze({
    pitchUp:      'PITCH UP',
    pitchDown:    'PITCH DOWN',
    rollLeft:     'ROLL LEFT',
    rollRight:    'ROLL RIGHT',
    yawLeft:      'YAW LEFT',
    yawRight:     'YAW RIGHT',
    throttleUp:   'THROTTLE UP',
    throttleDown: 'THROTTLE DOWN',
    [RESET_BINDING]:     'RESET FLIGHT',
    [LEVEL_OFF_BINDING]: 'LEVEL OFF'
});

/** What a binding on no key at all reads as. */
export const UNBOUND_LABEL = 'NONE';

// The keys a row waiting for one does not take as a binding. Escape is the way
// out of the wait and Delete is the way to leave an optional binding on nothing,
// so neither can be bound to anything - which is the trade every panel of this
// shape makes, and the reason the two chosen are the two nothing here flies
// with. Backspace clears as well, because it is the other key the panel already
// closes on and a pilot reaching to erase a binding reaches for it first.
export const BINDING_CANCEL_KEYS = Object.freeze(['Escape']);
export const BINDING_CLEAR_KEYS  = Object.freeze(['Delete', 'Backspace']);

// What is written on a key, where the code is not simply the letter on it. The
// two sides of a modifier read as one key, because that is what a keyboard
// shows and a pilot who bound the left Shift does not want a row saying so.
const KEY_LABELS = Object.freeze({
    ArrowUp:      '↑',
    ArrowDown:    '↓',
    ArrowLeft:    '←',
    ArrowRight:   '→',
    ShiftLeft:    'Shift',
    ShiftRight:   'Shift',
    ControlLeft:  'Ctrl',
    ControlRight: 'Ctrl',
    AltLeft:      'Alt',
    AltRight:     'Alt',
    MetaLeft:     'Meta',
    MetaRight:    'Meta',
    Space:        'Space',
    Escape:       'Esc',
    Enter:        'Enter',
    NumpadEnter:  'Num Enter',
    CapsLock:     'Caps',
    Backquote:    '`',
    Minus:        '-',
    Equal:        '=',
    BracketLeft:  '[',
    BracketRight: ']',
    Backslash:    '\\',
    Semicolon:    ';',
    Quote:        '\'',
    Comma:        ',',
    Period:       '.',
    Slash:        '/'
});

/**
 * What is written on the key a code names.
 *
 * `KeyW` is the W key and `Digit4` is the 4 key, which is most of the keyboard
 * and is read off the code rather than listed. A numpad key is named for the
 * pad it is on, because the pad has a second 4 on it. Anything this does not
 * know is shown as the code itself: a row naming a key nobody can place is
 * worse than one naming it awkwardly, and both are better than a blank row.
 */
export function keyLabel(code) {
    if (typeof code !== 'string' || code.length === 0) return '';
    if (code in KEY_LABELS) return KEY_LABELS[code];
    if (/^Key[A-Z]$/.test(code))   return code.slice(3);
    if (/^Digit[0-9]$/.test(code)) return code.slice(5);
    if (/^Numpad.+$/.test(code))   return `Num ${code.slice(6)}`;
    return code;
}

/**
 * The keys a binding is on, as one reading. A binding on more than one key
 * reads as all of them, because both are the key it is on.
 */
export function bindingLabel(codes = []) {
    const keys = [...new Set((codes ?? []).map(keyLabel).filter(Boolean))];
    return keys.length ? keys.join('/') : UNBOUND_LABEL;
}

/** True for a binding a pilot may leave on nothing at all. */
export function bindingOptional(name) {
    return OPTIONAL_BINDINGS.includes(name);
}

/** True for a key a row waiting for one reads as the way out rather than a key. */
export function isBindingCancelKey(code) {
    return BINDING_CANCEL_KEYS.includes(code);
}

/** True for a key a row waiting for one reads as "no key at all". */
export function isBindingClearKey(code) {
    return BINDING_CLEAR_KEYS.includes(code);
}

/** The bindings as they come out of the box, as a map nothing else is holding. */
export function defaultBindings() {
    const bindings = {};
    for (const name of BINDING_NAMES) bindings[name] = [...DEFAULT_BINDINGS[name]];
    return bindings;
}

/** A copy of a map, so a caller can hold one without holding somebody else's. */
export function cloneBindings(bindings = DEFAULT_BINDINGS) {
    const copy = {};
    for (const name of BINDING_NAMES) copy[name] = [...(bindings?.[name] ?? DEFAULT_BINDINGS[name])];
    return copy;
}

/**
 * The bindings as this module reads them, from values that came from somewhere
 * else - a stored choice, or a map a version with different controls wrote.
 *
 * Every binding is read on its own, so one this version has never heard of does
 * not cost the others their memory, and a code an earlier binding has already
 * taken is dropped rather than left on two controls: one key working two things
 * is the state the panel refuses, and a stored map is not a better reason to
 * allow it than a key press is. A binding emptied that way is given back
 * whichever of its own default keys are still free, which is what turns a
 * half-read map back into something flyable rather than something with a hole
 * in it.
 */
export function resolveBindings(values = {}) {
    const bindings = {};
    const taken = new Set();

    for (const name of BINDING_NAMES) {
        const stored = Array.isArray(values?.[name]) ? values[name] : DEFAULT_BINDINGS[name];
        const codes = [...new Set(
            stored.filter(code => typeof code === 'string' && code.length > 0 && !taken.has(code))
        )];

        if (codes.length === 0 && !bindingOptional(name)) {
            codes.push(...DEFAULT_BINDINGS[name].filter(code => !taken.has(code)));
        }

        for (const code of codes) taken.add(code);
        bindings[name] = codes;
    }

    return bindings;
}

/** The binding a key is on, or null for a key nothing is bound to. */
export function boundTo(bindings = DEFAULT_BINDINGS, code) {
    return BINDING_NAMES.find(name => (bindings?.[name] ?? []).includes(code)) ?? null;
}

/** The keys one binding is on. */
export function bindingKeys(bindings = DEFAULT_BINDINGS, name) {
    return [...(bindings?.[name] ?? [])];
}

/**
 * Puts a binding on a key, which is the whole of what a row waiting for one
 * does: the key pressed becomes the key, and whatever the binding was on before
 * is let go. A binding bound to two keys out of the box is on one afterwards,
 * because the pilot named one.
 *
 * Returns what the press came to: `bound` for a binding that moved, `held` for a
 * key already on this very binding, and `taken` for one already on another -
 * with `conflict` naming which. A key on something else is refused rather than
 * stolen from it, because two controls on one key is a keyboard that flies two
 * things at once and nothing on screen to say which.
 */
export function rebind(bindings, name, code) {
    if (!BINDING_NAMES.includes(name)) return { result: 'unknown', conflict: null };
    if (typeof code !== 'string' || code.length === 0) return { result: 'unknown', conflict: null };

    const holder = boundTo(bindings, code);
    if (holder === name) return { result: 'held', conflict: null };
    if (holder != null)  return { result: 'taken', conflict: holder };

    bindings[name] = [code];
    return { result: 'bound', conflict: null };
}

/**
 * Takes a binding off every key, for the one binding allowed to be on none.
 *
 * Returns true when the binding is now on nothing. A binding that may not be
 * left empty is refused, which is the answer rather than a failure: a control
 * surface with no key is an aircraft with a control nothing can work.
 */
export function clearBinding(bindings, name) {
    if (!bindingOptional(name)) return false;
    bindings[name] = [];
    return true;
}

/**
 * Puts the whole map back as it came, which is the way back for a pilot who has
 * bound themselves somewhere they cannot get out of.
 */
export function restoreBindings(bindings) {
    for (const name of BINDING_NAMES) bindings[name] = [...DEFAULT_BINDINGS[name]];
    return bindings;
}

/** True while the map is the one the game ships with, key for key. */
export function bindingsAreDefault(bindings = DEFAULT_BINDINGS) {
    return BINDING_NAMES.every(name => {
        const codes = bindings?.[name] ?? [];
        const fallback = DEFAULT_BINDINGS[name];
        return codes.length === fallback.length && codes.every((code, at) => code === fallback[at]);
    });
}

/**
 * The control surfaces alone, in the shape `applyKeyToInput` takes. The two
 * instructions are left out rather than filtered downstream, because a keymap
 * carrying them is a keymap that can write one into the input state.
 */
export function keymapFor(bindings = DEFAULT_BINDINGS) {
    const keymap = {};
    for (const name of CONTROL_NAMES) keymap[name] = [...(bindings?.[name] ?? DEFAULT_BINDINGS[name])];
    return keymap;
}

/**
 * The bindings as the aircraft takes them: the control surfaces as a keymap,
 * and the two instructions as the key lists they are read against.
 */
export function aircraftBindings(bindings = DEFAULT_BINDINGS) {
    return {
        keymap:       keymapFor(bindings),
        resetKeys:    bindingKeys(bindings, RESET_BINDING),
        levelOffKeys: bindingKeys(bindings, LEVEL_OFF_BINDING)
    };
}

/**
 * Reads the stored map. Anything other than something this module wrote - no
 * key at all, a map from a version with controls this one does not have, or a
 * storage that throws - reads as the bindings the game ships with.
 */
export function readKeyBindings(storage) {
    try {
        const stored = JSON.parse(storage?.getItem(KEY_BINDINGS_STORAGE_KEY) ?? 'null');
        if (!stored || typeof stored !== 'object') return defaultBindings();
        return resolveBindings(stored);
    } catch {
        return defaultBindings();
    }
}

/**
 * Stores the map for the next session. A storage that refuses the write costs
 * the bindings their memory and nothing else, so the flight goes on.
 *
 * Returns true when the map was stored.
 */
export function writeKeyBindings(storage, bindings) {
    try {
        storage?.setItem(KEY_BINDINGS_STORAGE_KEY, JSON.stringify(bindings));
        return storage != null;
    } catch {
        return false;
    }
}
