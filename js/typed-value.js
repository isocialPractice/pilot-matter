/**
 * Typing a number into a row, rather than stepping it there.
 *
 * Both panels that hold numbers - the settings panel and the element editor -
 * offer every one of them as something the arrow keys move. That is the right
 * way to offer a position on a dial, and the wrong way to offer a figure the
 * pilot already knows: an altitude of 1390 feet is 139 presses from the ground
 * at ten feet a press, and a start airspeed is a number somebody has in mind
 * before they open the panel at all.
 *
 * So a row holding a number can be typed into as well. The two routes write the
 * same value through the same validator, which is the whole of why this is one
 * module rather than a keypad in each panel: a typed value allowed where a
 * stepped one is refused would be the panel disagreeing with itself about what
 * a range is.
 *
 * What is here is the keyboard half - which key types what, how the characters
 * accumulate, and what the accumulated text comes to as a number. What each
 * panel keeps for itself is the part that is actually different: which of its
 * rows hold numbers, what range each is held to, and where an accepted value is
 * written. Pure module with no DOM dependency, like every module either panel
 * is built out of.
 */

// The keys that end the typing, one way or the other. Enter is what the rest of
// both panels chooses a row with, and Escape is what closes them - so a row
// being typed into reads both before anything else does, the way a key row
// waiting for a key does in js/control-settings.js.
export const TYPED_COMMIT_KEYS = Object.freeze(['Enter', 'NumpadEnter']);
export const TYPED_CANCEL_KEYS = Object.freeze(['Escape']);
export const TYPED_ERASE_KEYS  = Object.freeze(['Backspace', 'Delete']);

// How many characters a row will take. Long enough for the widest figure either
// panel offers - a climb of -2000 feet a minute, an altitude of 8000 feet, a
// density of 0.015 - and short enough that a key held down cannot fill a row
// with digits nothing will ever accept.
export const TYPED_MAX = 8;

// What marks a row as being typed into rather than read. It sits where the
// stepped marks sit, so the row says which of the two things is happening to it
// in the place that already says what the row does.
export const TYPED_CARET = '_';

/**
 * The character a key code types, or null for a key that types nothing.
 *
 * Read off the code rather than off `event.key`, the way every other key in this
 * game is read: a layout that puts the digits somewhere else still reports
 * `Digit4` for the key with 4 on it, and the numpad is the same keys again for a
 * pilot who reaches for it.
 */
export function typedCharacter(code) {
    if (typeof code !== 'string') return null;

    const digit = /^(?:Digit|Numpad)([0-9])$/.exec(code);
    if (digit) return digit[1];

    if (code === 'Minus'  || code === 'NumpadSubtract') return '-';
    if (code === 'Period' || code === 'NumpadDecimal')  return '.';
    return null;
}

/**
 * True for a key that starts a pilot typing, which is a digit or a minus.
 *
 * A decimal point does not start one. It is a legal character inside a figure
 * and a plausible stray press on a panel being read rather than set, and a row
 * that went into typing on it would answer the next press as a digit instead of
 * as whatever the pilot aimed it at.
 */
export function startsTypedValue(code) {
    const character = typedCharacter(code);
    return character != null && character !== '.';
}

/**
 * The text with one more character on the end, or null where that character
 * cannot legally go there.
 *
 * A figure has one sign and one point, both in one place: a minus belongs at the
 * front and nowhere else, and a second point would make the text unreadable as a
 * number at all. Refusing the press leaves the text as it was, which is what
 * keeps the reading on the row something that could still be committed.
 */
export function extendTypedValue(text = '', character) {
    if (character == null) return null;
    if (text.length >= TYPED_MAX) return null;

    if (character === '-') return text.length === 0 ? '-' : null;
    if (character === '.') return text.includes('.') ? null : `${text}.`;
    return `${text}${character}`;
}

/**
 * What the typed text comes to as a number, or null when it is not yet one.
 *
 * A sign or a point on its own is a figure the pilot is partway through rather
 * than a figure, so it comes to null and is refused if committed. Nothing here
 * rounds or clamps: what a value is allowed to be is the panel's question, and
 * answering it here would be answering it in a second place.
 */
export function parseTypedValue(text) {
    if (typeof text !== 'string' || !/[0-9]/.test(text)) return null;
    if (!/^-?[0-9]*(?:\.[0-9]*)?$/.test(text)) return null;

    const value = Number(text);
    return Number.isFinite(value) ? value : null;
}

/**
 * How a row being typed into reads where its value goes: what has been typed so
 * far, with the caret after it.
 *
 * An empty text still reads as the caret, because a pilot who has erased back to
 * nothing is still typing - the row says so, and the next digit goes into it.
 */
export function typedValueLabel(text = '') {
    return `${text}${TYPED_CARET}`;
}

/**
 * One key, read against the text typed so far.
 *
 * Returns what the press came to, as `{ action, text, value }`:
 *
 * | `action` | Means |
 * | --- | --- |
 * | `typed` | `text` is the figure with the character on the end |
 * | `erased` | `text` is the figure one character shorter, down to nothing |
 * | `commit` | `value` is what was typed, or null for a figure left unfinished |
 * | `cancel` | the pilot wants the value the row already had |
 *
 * Null for a key that means nothing to a row being typed into - which the caller
 * then handles however it would have otherwise, rather than swallowing it: a
 * panel that ate every key while a row was being typed into would be a panel a
 * pilot could not walk away from.
 */
export function readTypedKey(text = '', code) {
    if (TYPED_CANCEL_KEYS.includes(code)) return { action: 'cancel', text, value: null };
    if (TYPED_COMMIT_KEYS.includes(code)) {
        return { action: 'commit', text, value: parseTypedValue(text) };
    }
    if (TYPED_ERASE_KEYS.includes(code)) {
        return { action: 'erased', text: text.slice(0, -1), value: null };
    }

    const extended = extendTypedValue(text, typedCharacter(code));
    if (extended == null) return null;

    return { action: 'typed', text: extended, value: null };
}
