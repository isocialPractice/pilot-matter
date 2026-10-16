/**
 * Control settings - the panel the start screen and the pause menu both open
 * under the Control Settings entry: what the keys mean, how far the attitude may
 * go, and the way through to the reference list of every key.
 *
 * This is what that entry used to be. It showed the reference list and nothing
 * else, which answered "which key does what" and left "what do I want the keys
 * to do" with no answer anywhere in the game. The list is still here, one row
 * down the panel, because a pilot setting an axis is exactly the pilot who wants
 * to read the keys it belongs to.
 *
 * Pure module with no DOM or Three.js dependency: the browser's storage is
 * passed in rather than reached for, so a plain object stands in for it under
 * test. The panel is a keyboard menu like the other three, so what is declared
 * here is entries rather than widgets, and `js/menu.js` moves the cursor over
 * them.
 *
 * The rows are drawn, read, and stepped by the same functions the settings panel
 * uses, from `js/settings.js`, rather than by a second set written to look like
 * them. Those functions all take the options they are working on, which is what
 * makes one panel's vocabulary usable by another; what is not shared is the
 * storage key and the list of options, because those are what make this a
 * different panel rather than a second copy of that one.
 */

import {
    OPTION_ENTRY, TOGGLE_ENTRY, BACK_ENTRY,
    optionEntryText, optionValueLabel, cycleOptionValue, isOptionValue
} from './settings.js';
import { TOGGLE_FIELD } from './config.js';
import {
    AXIS_DIRECTIONAL, AXIS_INVERTED, AXIS_NAMES, DEFAULT_AXES, VERTICAL_CONTROLS, resolveAxes
} from './input-map.js';
import {
    BINDING_NAMES, BINDING_LABELS, DEFAULT_BINDINGS,
    bindingLabel, bindingOptional, keyLabel,
    isBindingCancelKey, isBindingClearKey,
    readKeyBindings, writeKeyBindings, rebind, clearBinding, restoreBindings, bindingsAreDefault
} from './key-bindings.js';

export const CONTROL_SETTINGS_STORAGE_KEY = 'pilot-matter.control-settings';

export const CONTROL_SETTINGS_TITLE = 'CONTROL SETTINGS';

export const CONTROL_AXES_HEADING      = 'AXES';
export const CONTROL_ATTITUDE_HEADING  = 'ATTITUDE';
export const CONTROL_LEVEL_OFF_HEADING = 'LEVEL OFF';
export const CONTROL_KEYS_HEADING      = 'KEYS';
export const CONTROL_REFERENCE_HEADING = 'REFERENCE';

// The row that opens the list of every key, and the row that is the way out of
// the panel for a pilot who has not found the key that closes it.
export const CONTROL_REFERENCE_ID    = 'reference';
export const CONTROL_REFERENCE_LABEL = 'CONTROL REFERENCE';
export const CONTROL_SETTINGS_BACK_ID    = 'back';
export const CONTROL_SETTINGS_BACK_LABEL = 'BACK';

export const CONTROL_SETTINGS_CLOSE_KEYS = ['Escape', 'Backspace'];

// A row that opens something rather than holding a value. Drawn as its own
// label, the way the way out is, because there is no reading to put beside it.
export const LIST_ENTRY = 'list';

// A row that holds a key rather than a value, and a row that does something to
// the whole map of them rather than to one binding.
export const BINDING_ENTRY = 'binding';
export const ACTION_ENTRY  = 'action';

// Which heading a row is drawn under. The cursor walks every row as one list
// whichever group it is in, so a group is a heading rather than a mode.
export const AXIS_GROUP      = 'axes';
export const ATTITUDE_GROUP  = 'attitude';
export const LEVEL_OFF_GROUP = 'levelOff';
export const BINDING_GROUP   = 'keys';
export const REFERENCE_GROUP = 'reference';

// The options by name, so what a setting drives is looked up by an id both sides
// agree on rather than by a string typed twice.
export const PITCH_AXIS_OPTION     = 'pitchAxis';
export const ROLL_AXIS_OPTION      = 'rollAxis';
export const TILT_AXES_OPTION      = 'tiltAxes';
export const FULL_ROTATION_OPTION  = 'fullRotation';
export const REFERENCE_OPEN_OPTION = 'referenceOpen';

/**
 * The option holding whether one control hands the aircraft back after a level
 * off. One per control rather than a list to pick from: the question is whether
 * each one counts, and the answers are independent of each other.
 */
export function levelOffOptionId(control) {
    return `levelOff.${control}`;
}

/** The control a level off option is the box for, or null for anything else. */
export function levelOffOptionControl(id) {
    const control = typeof id === 'string' && id.startsWith('levelOff.') ? id.slice('levelOff.'.length) : null;
    return VERTICAL_CONTROLS.includes(control) ? control : null;
}

// A key row answers to its binding under a prefix of its own, so a binding and
// an option can share a name without sharing a row.
export const BINDING_ENTRY_PREFIX = 'key.';

/** The row id a binding is drawn as. */
export function bindingEntryId(name) {
    return `${BINDING_ENTRY_PREFIX}${name}`;
}

/** The binding a row id belongs to, or null for a row that holds no key. */
export function bindingEntryName(id) {
    if (typeof id !== 'string' || !id.startsWith(BINDING_ENTRY_PREFIX)) return null;
    const name = id.slice(BINDING_ENTRY_PREFIX.length);
    return BINDING_NAMES.includes(name) ? name : null;
}

// The row that puts every key back where it started, which is the way out for a
// pilot who has bound themselves somewhere they cannot get back from.
export const RESTORE_BINDINGS_ID    = 'restoreKeys';
export const RESTORE_BINDINGS_LABEL = 'RESTORE DEFAULT KEYS';

// What sits between what a key row works and the key it is on. The same mark
// the objective card separates its halves with, so one game is punctuated one
// way.
export const BINDING_SEPARATOR = '  ·  ';

// What a row waiting for a key reads where the key goes, and what one that has
// just refused a press reads there instead. Both are answers to the question the
// row is already asking, so both are written in the place the answer sits.
export const BINDING_PROMPT       = 'PRESS A KEY';
export const BINDING_NEEDS_A_KEY  = 'NEEDS A KEY';

// Which axis each of the two axis options holds, so the pair handed to the input
// map is built from the options rather than from a second list of axis names.
export const AXIS_OPTIONS = Object.freeze({
    pitch: PITCH_AXIS_OPTION,
    roll:  ROLL_AXIS_OPTION
});

/** The two settings an axis can be read with, as the panel offers them. */
const AXIS_VALUES = Object.freeze([
    { value: AXIS_DIRECTIONAL, label: 'DIRECTIONAL' },
    { value: AXIS_INVERTED,    label: 'INVERTED'    }
]);

/** What a box reads as, which is the same pair every box in the game offers. */
const BOX_VALUES = Object.freeze([
    { value: true,  label: 'ON'  },
    { value: false, label: 'OFF' }
]);

/** What each control is called on the box that says whether it counts. */
const LEVEL_OFF_LABELS = Object.freeze({
    pitchUp:      'PITCH UP',
    pitchDown:    'PITCH DOWN',
    throttleUp:   'THROTTLE UP',
    throttleDown: 'THROTTLE DOWN'
});

/**
 * A box per control that can hand the aircraft back after a level off, each on
 * out of the box, which is the list `wantsVerticalChange` has always taken.
 *
 * Roll and yaw have no box because they are not in that list and are not meant
 * to be: an altitude held through a turn is what holding one is for, and the
 * reasoning is written where the list is, in `js/input-map.js`.
 *
 * Every box can be cleared, this one included, and a level off with no control
 * left to end it is held until the flight is reset. That is the pilot's answer
 * rather than an oversight: the question each box asks is whether that control
 * counts, and a box that refused to be the last one cleared would be answering
 * a different question.
 */
const LEVEL_OFF_OPTIONS = VERTICAL_CONTROLS.map(control => ({
    id: levelOffOptionId(control),
    label: LEVEL_OFF_LABELS[control] ?? control.toUpperCase(),
    note: `whether ${LEVEL_OFF_LABELS[control]?.toLowerCase() ?? control} hands the aircraft back`,
    group: LEVEL_OFF_GROUP,
    kind: TOGGLE_FIELD,
    default: true,
    values: BOX_VALUES
}));

/**
 * What the panel holds.
 *
 * The two axes are separate options rather than one four-way setting, because
 * the four states a pilot wants are the four combinations of two independent
 * choices, and a list of four reads as a scheme to pick from rather than as two
 * questions to answer.
 */
export const CONTROL_OPTIONS = Object.freeze([
    {
        id: PITCH_AXIS_OPTION,
        label: 'PITCH AXIS',
        note: 'whether the pitch keys point where the nose goes or where a stick would',
        group: AXIS_GROUP,
        default: AXIS_DIRECTIONAL,
        values: AXIS_VALUES
    },
    {
        id: ROLL_AXIS_OPTION,
        label: 'ROLL AXIS',
        note: 'whether the roll keys point where the wing goes or where a stick would',
        group: AXIS_GROUP,
        default: AXIS_DIRECTIONAL,
        values: AXIS_VALUES
    },
    {
        // Off by default, because the device is the aircraft: nose up is the top
        // of it coming toward the pilot whichever way the keys are read, which
        // is what `tiltToInput` in js/tilt-controls.js says and why. On is the
        // pilot who thinks of the device as a stick instead, and wants the one
        // answer to cover both ways of flying.
        id: TILT_AXES_OPTION,
        label: 'TILT READS AXES',
        note: 'whether the two settings above reach the tilt input as well',
        group: AXIS_GROUP,
        kind: TOGGLE_FIELD,
        default: false,
        values: BOX_VALUES
    },
    {
        // Off by default, and that is the setting rather than an oversight: the
        // clamp is what makes ordinary flight readable, so the pilot who wants a
        // loop asks for one and nobody else is handed it.
        id: FULL_ROTATION_OPTION,
        label: 'FULL ROTATION',
        note: 'whether the nose and the wings may go all the way round',
        group: ATTITUDE_GROUP,
        kind: TOGGLE_FIELD,
        default: false,
        values: BOX_VALUES
    },
    ...LEVEL_OFF_OPTIONS,
    {
        // Where the list of every key is remembered between sessions. It is the
        // same question the rest of the panel is asking - how this pilot wants
        // the controls to behave - so it is stored beside the rest rather than
        // as a third thing somewhere of its own.
        id: REFERENCE_OPEN_OPTION,
        label: 'LIST ON SCREEN',
        note: 'whether the control reference list is up, which the H key also sets',
        group: REFERENCE_GROUP,
        kind: TOGGLE_FIELD,
        default: true,
        values: BOX_VALUES
    }
]);

export const CONTROL_OPTION_IDS = Object.freeze(CONTROL_OPTIONS.map(option => option.id));

export function isControlSettingsCloseKey(code) {
    return CONTROL_SETTINGS_CLOSE_KEYS.includes(code);
}

/** The option answering to an id, or null when the panel has no such option. */
export function controlOption(id, options = CONTROL_OPTIONS) {
    return options.find(option => option.id === id) ?? null;
}

export function defaultControlSettings(options = CONTROL_OPTIONS) {
    const values = {};
    for (const option of options) values[option.id] = option.default;
    return values;
}

/**
 * Reads the stored choices. Anything other than a value this module wrote - no
 * key at all, a setting from a version that had one this one does not, or a
 * storage that throws - reads as the default. Every choice is checked on its
 * own, so one value this version has never heard of does not cost the others
 * their memory.
 */
export function readControlSettings(storage, options = CONTROL_OPTIONS) {
    const values = defaultControlSettings(options);

    try {
        const stored = JSON.parse(storage?.getItem(CONTROL_SETTINGS_STORAGE_KEY) ?? 'null');
        if (!stored || typeof stored !== 'object') return values;

        for (const option of options) {
            if (isOptionValue(option.id, stored[option.id], options)) {
                values[option.id] = stored[option.id];
            }
        }
    } catch {
        return defaultControlSettings(options);
    }

    return values;
}

/**
 * Stores the choices for the next session. A storage that refuses the write
 * costs the settings their memory and nothing else, so the flight goes on.
 *
 * Returns true when the choices were stored.
 */
export function writeControlSettings(storage, values) {
    try {
        storage?.setItem(CONTROL_SETTINGS_STORAGE_KEY, JSON.stringify(values));
        return storage != null;
    } catch {
        return false;
    }
}

/**
 * The rows one option is drawn as: a box for a toggle, and a stepped reading
 * for anything else.
 */
function optionEntries(option, options) {
    const group = option.group ?? AXIS_GROUP;

    if (option.kind === TOGGLE_FIELD) {
        return [{
            kind: TOGGLE_ENTRY,
            group,
            option: option.id,
            id: option.id,
            label: option.label,
            note: option.note,
            value: option.default,
            current: false
        }];
    }

    return [{
        kind: OPTION_ENTRY,
        group,
        id: option.id,
        label: option.label,
        note: option.note,
        value: option.default,
        valueLabel: optionValueLabel(option.id, option.default, options),
        current: false
    }];
}

/**
 * How a key row reads: what it works, and the key it is on. A row waiting for a
 * key says so where the key goes, and a row that has just refused one says why
 * in the same place - both answer the question the row is already asking, so
 * both are read where the answer sits rather than somewhere else on the panel.
 */
export function bindingEntryText(entry) {
    return `${entry.label}${BINDING_SEPARATOR}${entry.reading}`;
}

/** The rows the keys are drawn as: one per binding, then the way back. */
function bindingEntries(bindings = DEFAULT_BINDINGS) {
    return [
        ...BINDING_NAMES.map(name => ({
            kind: BINDING_ENTRY,
            group: BINDING_GROUP,
            binding: name,
            id: bindingEntryId(name),
            label: BINDING_LABELS[name] ?? name.toUpperCase(),
            note: bindingOptional(name)
                ? 'enter to rebind, delete for no key at all'
                : 'enter to rebind, then press the key it should be on',
            reading: bindingLabel(bindings?.[name]).toUpperCase(),
            arming: false,
            current: false
        })),
        {
            kind: ACTION_ENTRY,
            group: BINDING_GROUP,
            id: RESTORE_BINDINGS_ID,
            label: RESTORE_BINDINGS_LABEL,
            note: 'puts every key above back where it started',
            current: false
        }
    ];
}

/**
 * The panel's entries: every setting that governs the controls, then the key
 * each of them is on, then the way through to the list of every key, then the
 * way out.
 *
 * The key rows go in ahead of the reference group rather than at the end,
 * because the cursor walks the whole panel as one list and the lists it is
 * drawn into are filtered by group: a group split in two by another one would
 * be drawn under its heading in two places.
 */
export function controlSettingsEntries(options = CONTROL_OPTIONS, bindings = DEFAULT_BINDINGS) {
    const rows = options.flatMap(option => optionEntries(option, options));
    const at = rows.findIndex(entry => entry.group === REFERENCE_GROUP);
    const cut = at < 0 ? rows.length : at;

    return [
        ...rows.slice(0, cut),
        ...bindingEntries(bindings),
        ...rows.slice(cut),
        {
            kind: LIST_ENTRY,
            group: REFERENCE_GROUP,
            id: CONTROL_REFERENCE_ID,
            label: CONTROL_REFERENCE_LABEL,
            note: 'every key the aircraft and the game are flown with',
            current: false
        },
        {
            kind: BACK_ENTRY,
            group: REFERENCE_GROUP,
            id: CONTROL_SETTINGS_BACK_ID,
            label: CONTROL_SETTINGS_BACK_LABEL,
            note: '',
            current: false
        }
    ];
}

export function createControlSettingsState(storage = null, options = CONTROL_OPTIONS) {
    const bindings = readKeyBindings(storage);
    const state = {
        open: false,
        storage,
        options,
        values: readControlSettings(storage, options),
        bindings,
        // Which key row is waiting for a key, and what the last press on it came
        // to. Neither is remembered between sessions: a panel that opened still
        // waiting for a key would take the first thing pressed at it.
        arming: null,
        notice: null,
        entries: controlSettingsEntries(options, bindings)
    };

    syncControlSettingsEntries(state);
    return state;
}

/** Redraws the rows from the choices behind them. */
export function syncControlSettingsEntries(state) {
    const options = state.options ?? CONTROL_OPTIONS;

    for (const entry of state.entries ?? []) {
        if (entry.kind === OPTION_ENTRY) {
            entry.value = state.values[entry.id];
            entry.valueLabel = optionValueLabel(entry.id, entry.value, options);
        }

        if (entry.kind === TOGGLE_ENTRY) entry.value = state.values[entry.option] === true;

        if (entry.kind === BINDING_ENTRY) {
            entry.arming = state.arming === entry.binding;
            entry.reading = bindingReading(state, entry);
            entry.text = bindingEntryText(entry);
            continue;
        }

        entry.text = optionEntryText(entry);
    }

    return state.entries;
}

/** What a key row shows where the key goes, which is not always a key. */
function bindingReading(state, entry) {
    if (state.arming !== entry.binding) return bindingLabel(state.bindings?.[entry.binding]).toUpperCase();
    if (state.notice?.binding === entry.binding) return state.notice.text;
    return BINDING_PROMPT;
}

export function controlSettingsShowing(state) {
    return state?.open === true;
}

export function openControlSettings(state) {
    const changed = state.open !== true;
    state.open = true;
    // A panel that opened still waiting for a key would take the first thing
    // pressed at it as a binding, which is the one press nobody aimed at a row.
    state.arming = null;
    state.notice = null;
    syncControlSettingsEntries(state);
    return changed;
}

export function closeControlSettings(state) {
    const changed = state.open === true;
    state.open = false;
    state.arming = null;
    state.notice = null;
    syncControlSettingsEntries(state);
    return changed;
}

/** What an option is currently set to, for whatever the setting drives. */
export function currentControlOption(state, id) {
    return state?.values?.[id];
}

/**
 * The axes as `js/input-map.js` reads them, built from the two axis options
 * rather than stored in the shape that module wants. The panel holds one setting
 * per axis because that is what a pilot answers; the input map wants the pair,
 * and resolving on the way out means a value from somewhere else cannot reach it
 * unchecked.
 */
export function controlAxes(state) {
    const values = {};
    for (const axis of AXIS_NAMES) values[axis] = currentControlOption(state, AXIS_OPTIONS[axis]);
    return resolveAxes(values);
}

/** True while the pilot has opened the attitude up to the full turn. */
export function fullRotationWanted(state) {
    return currentControlOption(state, FULL_ROTATION_OPTION) === true;
}

/** True while the axis settings are to be read off the device as well. */
export function tiltReadsAxes(state) {
    return currentControlOption(state, TILT_AXES_OPTION) === true;
}

/**
 * The axes the tilt input is read through: the pilot's pair while they have
 * asked for the device to be read the way the keys are, and the directional
 * pair otherwise.
 *
 * Resolved into a pair rather than handed over as a flag, so `tiltToInput` in
 * js/tilt-controls.js takes the same thing `applyKeyToInput` does and neither
 * has to know a setting exists.
 */
export function tiltInputAxes(state) {
    return tiltReadsAxes(state) ? controlAxes(state) : DEFAULT_AXES;
}

/**
 * The controls that hand the aircraft back after a level off, as the list
 * `wantsVerticalChange` takes. An empty list is a level off nothing ends short
 * of a reset, which is what every box cleared means and what it is for.
 */
export function levelOffControls(state) {
    return VERTICAL_CONTROLS.filter(control => currentControlOption(state, levelOffOptionId(control)) === true);
}

/** True while the control reference list is one the pilot wants on screen. */
export function referenceOpenWanted(state) {
    return currentControlOption(state, REFERENCE_OPEN_OPTION) !== false;
}

/**
 * Keeps the answer the H key just gave, so the list opens next session the way
 * this one left it. Returns the option's id when the answer changed.
 */
export function rememberReferenceOpen(state, expanded) {
    return applyControlSetting(state, REFERENCE_OPEN_OPTION, expanded === true);
}

/** The keys every control and both instructions are currently on. */
export function controlBindings(state) {
    return state?.bindings ?? DEFAULT_BINDINGS;
}

/** True while every key is where the game put it. */
export function controlBindingsAreDefault(state) {
    return bindingsAreDefault(controlBindings(state));
}

/** The key row waiting for a key, or null while none is. */
export function bindingArmed(state) {
    return state?.arming ?? null;
}

/**
 * Puts a key row on the wait: the next key pressed becomes its key. Arming a
 * second row leaves the first as it was, there being one keyboard.
 *
 * Returns the binding now waiting, or null for a row that holds no key.
 */
export function armBinding(state, name) {
    if (!BINDING_NAMES.includes(name)) return null;

    state.arming = name;
    state.notice = null;
    syncControlSettingsEntries(state);
    return name;
}

/** Takes the wait off, leaving the key where it was. Returns what was waiting. */
export function cancelBinding(state) {
    const name = state.arming;
    if (name == null) return null;

    state.arming = null;
    state.notice = null;
    syncControlSettingsEntries(state);
    return name;
}

/** Writes the reason a press was refused onto the row that refused it. */
function refuseBinding(state, name, text) {
    state.notice = { binding: name, text };
    syncControlSettingsEntries(state);
}

/**
 * Applies a key press to the row waiting for one.
 *
 * Returns what the press came to, as `{ result, binding, conflict }`:
 * `bound` for a key taken, `cleared` for a binding left on no key, `held` for
 * the key it was already on, `cancelled` for the way out, and `taken`,
 * `reserved` or `needed` for a press refused - the first because another row
 * works the key, the second because the game itself reads it, the third because
 * the binding may not be left on nothing. A refused press leaves the row
 * waiting, so the next key is read as the answer rather than as a fresh start.
 *
 * Null when no row is waiting, which is every press the panel reads normally.
 */
export function bindArmedKey(state, code) {
    const name = state?.arming;
    if (name == null) return null;

    if (isBindingCancelKey(code)) return { result: 'cancelled', binding: cancelBinding(state), conflict: null };

    if (isBindingClearKey(code)) {
        if (!clearBinding(state.bindings, name)) {
            refuseBinding(state, name, BINDING_NEEDS_A_KEY);
            return { result: 'needed', binding: name, conflict: null };
        }

        settleBinding(state);
        return { result: 'cleared', binding: name, conflict: null };
    }

    const { result, conflict } = rebind(state.bindings, name, code);

    // A key another row holds and a key the game reads for itself are refused in
    // the same sentence, because they are the same thing to a pilot: the key is
    // spoken for, and the row says what by. `conflict` names a binding in the
    // first case and the game's own job in the second, and the label lookup
    // falls through to the job, which is already written the way a row reads.
    if (result === 'taken' || result === 'reserved') {
        refuseBinding(state, name, `${keyLabel(code).toUpperCase()} IS ${BINDING_LABELS[conflict] ?? conflict}`);
        return { result, binding: name, conflict };
    }

    if (result === 'unknown') return { result, binding: name, conflict: null };

    // A key already on this very binding is the pilot saying they meant it, so
    // the row stops waiting and nothing is written: the map has not changed.
    if (result === 'held') {
        cancelBinding(state);
        return { result, binding: name, conflict: null };
    }

    settleBinding(state);
    return { result, binding: name, conflict: null };
}

/** Takes the wait off a row whose key has just changed, and remembers the map. */
function settleBinding(state) {
    state.arming = null;
    state.notice = null;
    writeKeyBindings(state.storage, state.bindings);
    syncControlSettingsEntries(state);
}

/**
 * Puts every key back where it started, which is the way back for a pilot who
 * has bound themselves somewhere they cannot get out of. Returns the map.
 */
export function restoreControlBindings(state) {
    restoreBindings(state.bindings);
    settleBinding(state);
    return state.bindings;
}

/** The entry a row id belongs to, or null when the panel has no such row. */
export function controlSettingsEntry(state, id) {
    return state?.entries?.find(entry => entry.id === id) ?? null;
}

/**
 * Writes one setting and remembers it. Returns the id of the option that
 * changed, or null when it was already on that value.
 */
function applyControlSetting(state, id, value) {
    if (state.values[id] === value) return null;

    state.values[id] = value;
    syncControlSettingsEntries(state);
    writeControlSettings(state.storage, state.values);
    return id;
}

/** Turns a box over, which is the only step a box has to take. */
function flipToggle(state, entry) {
    return applyControlSetting(state, entry.option, !(state.values[entry.option] === true));
}

/**
 * Steps an option on to another of its settings, by one place in either
 * direction. The reference row and the way out hold no value, so the arrow keys
 * mean nothing on either.
 *
 * Returns the option's id when it moved, and null when nothing changed.
 */
export function adjustControlSetting(state, id, step) {
    if (!step) return null;

    const entry = controlSettingsEntry(state, id);
    if (entry?.kind === TOGGLE_ENTRY) return flipToggle(state, entry);

    const options = state.options ?? CONTROL_OPTIONS;
    if (!controlOption(id, options)) return null;

    return applyControlSetting(state, id, cycleOptionValue(id, state.values[id], step, options));
}

/**
 * Applies the row chosen in the panel.
 *
 * Returns `CONTROL_SETTINGS_BACK_ID` when the panel was closed,
 * `CONTROL_REFERENCE_ID` when the reference list was asked for,
 * `RESTORE_BINDINGS_ID` when every key was put back, the row id of a key row
 * now waiting for a key, the option's id when an option was stepped on, and
 * null when the choice changed nothing.
 *
 * `step` is which way the choice steps an option, for a caller that knows - a
 * click on the left of a row steps it down and a click on the right steps it up.
 * A key press knows nothing about halves of a row and takes the default, which
 * is the next setting along, the way choosing a row always has.
 */
export function chooseControlSetting(state, id, step = 1) {
    if (id === CONTROL_SETTINGS_BACK_ID) {
        closeControlSettings(state);
        return CONTROL_SETTINGS_BACK_ID;
    }

    if (id === RESTORE_BINDINGS_ID) {
        restoreControlBindings(state);
        return RESTORE_BINDINGS_ID;
    }

    // Choosing a key row is asking for the key, not giving it: the row waits,
    // and the next press is the answer. Choosing the row it is already waiting
    // on is the way out of the wait, so a pilot who opened it by mistake has
    // somewhere to go that is not a key they did not mean to bind.
    const binding = bindingEntryName(id);
    if (binding != null) {
        if (state.arming === binding) {
            cancelBinding(state);
            return null;
        }
        return armBinding(state, binding) == null ? null : id;
    }

    // The list is what this panel was before it was a panel, so choosing it
    // closes the panel over it: the list is read against the world rather than
    // against the rows that were covering it.
    if (id === CONTROL_REFERENCE_ID) {
        closeControlSettings(state);
        return CONTROL_REFERENCE_ID;
    }

    const entry = controlSettingsEntry(state, id);
    if (entry?.kind === TOGGLE_ENTRY) return flipToggle(state, entry);

    // An option has no single thing to choose, so choosing one steps it on to
    // its next setting - the same thing the arrow keys do to it.
    if (controlOption(id, state.options ?? CONTROL_OPTIONS)) return adjustControlSetting(state, id, step);

    return null;
}
