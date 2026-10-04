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
import { AXIS_DIRECTIONAL, AXIS_INVERTED, AXIS_NAMES, resolveAxes } from './input-map.js';

export const CONTROL_SETTINGS_STORAGE_KEY = 'pilot-matter.control-settings';

export const CONTROL_SETTINGS_TITLE = 'CONTROL SETTINGS';

export const CONTROL_AXES_HEADING      = 'AXES';
export const CONTROL_ATTITUDE_HEADING  = 'ATTITUDE';
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

// Which heading a row is drawn under. The cursor walks every row as one list
// whichever group it is in, so a group is a heading rather than a mode.
export const AXIS_GROUP      = 'axes';
export const ATTITUDE_GROUP  = 'attitude';
export const REFERENCE_GROUP = 'reference';

// The options by name, so what a setting drives is looked up by an id both sides
// agree on rather than by a string typed twice.
export const PITCH_AXIS_OPTION    = 'pitchAxis';
export const ROLL_AXIS_OPTION     = 'rollAxis';
export const FULL_ROTATION_OPTION = 'fullRotation';

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
        // Off by default, and that is the setting rather than an oversight: the
        // clamp is what makes ordinary flight readable, so the pilot who wants a
        // loop asks for one and nobody else is handed it.
        id: FULL_ROTATION_OPTION,
        label: 'FULL ROTATION',
        note: 'whether the nose and the wings may go all the way round',
        group: ATTITUDE_GROUP,
        kind: TOGGLE_FIELD,
        default: false,
        values: [
            { value: true,  label: 'ON'  },
            { value: false, label: 'OFF' }
        ]
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
 * The panel's entries: every setting that governs the controls, then the way
 * through to the list of every key, then the way out.
 */
export function controlSettingsEntries(options = CONTROL_OPTIONS) {
    return [
        ...options.flatMap(option => optionEntries(option, options)),
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
    const state = {
        open: false,
        storage,
        options,
        values: readControlSettings(storage, options),
        entries: controlSettingsEntries(options)
    };

    syncControlSettingsEntries(state);
    return state;
}

/** Redraws the rows from the choices behind them. */
export function syncControlSettingsEntries(state) {
    const options = state.options ?? CONTROL_OPTIONS;

    for (const entry of state.entries) {
        if (entry.kind === OPTION_ENTRY) {
            entry.value = state.values[entry.id];
            entry.valueLabel = optionValueLabel(entry.id, entry.value, options);
        }

        if (entry.kind === TOGGLE_ENTRY) entry.value = state.values[entry.option] === true;

        entry.text = optionEntryText(entry);
    }

    return state.entries;
}

export function controlSettingsShowing(state) {
    return state?.open === true;
}

export function openControlSettings(state) {
    const changed = state.open !== true;
    state.open = true;
    syncControlSettingsEntries(state);
    return changed;
}

export function closeControlSettings(state) {
    const changed = state.open === true;
    state.open = false;
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
 * `CONTROL_REFERENCE_ID` when the reference list was asked for, the option's id
 * when an option was stepped on, and null when the choice changed nothing.
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
