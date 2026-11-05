/**
 * Builder settings - the builder's own preferences, a third settings screen
 * made the way `js/settings.js` and `js/control-settings.js` are: declared
 * entries in groups under headings, storage handed in, drawn into grouped
 * menus in a card, closed on `Escape` or `Backspace`, and ending on `BACK`.
 * Pure module with no DOM or Three.js dependency, so a plain object stands in
 * for the browser's storage under test.
 *
 * A builder setting is how the editor behaves and never what it builds. The
 * editor reads it - when a draft is kept without asking, how fast the view
 * moves - and nothing under `js/environment/` does: no placement carries one,
 * and the same placements build the same ground whoever's preferences were on
 * while they were built. It is stored under a key of its own, beside the
 * game's two, so a change of shape in one never costs the others their values.
 *
 * The screen is reached from inside the builder - the gear on the palette's
 * header, or `O` - and from a `BUILDER SETTINGS` row on the game's settings,
 * and `BACK` returns to whichever opened it.
 */

import {
    OPTION_ENTRY, TOGGLE_ENTRY, BACK_ENTRY, SETTINGS_OPEN_KEYS,
    optionEntryText, optionValueLabel, cycleOptionValue, isOptionValue
} from './settings.js';
import { TOGGLE_FIELD } from './config.js';

export const BUILDER_SETTINGS_STORAGE_KEY = 'pilot-matter.builder-settings';

export const BUILDER_SETTINGS_TITLE = 'BUILDER SETTINGS';
export const AUTO_ACCEPT_HEADING    = 'AUTO ACCEPT';
export const VIEW_HEADING           = 'VIEW';

// The headings the rows are drawn under. The cursor walks the screen as one
// list whichever group a row is in, so a group is a heading rather than a mode.
export const AUTO_ACCEPT_GROUP = 'autoAccept';
export const VIEW_GROUP        = 'view';
export const BUILDER_END_GROUP = 'end';

// A row that does something rather than holding a value.
export const ACTION_ENTRY = 'action';

// The options by name, so what a setting drives is looked up by an id both
// sides agree on rather than by a string typed twice.
export const AUTO_ACCEPT_ALL_OPTION  = 'autoAcceptAll';
export const AUTO_ACCEPT_DRAW_OPTION = 'autoAcceptDraw';
export const AUTO_ACCEPT_EXIT_OPTION = 'autoAcceptExit';
export const AUTO_ACCEPT_TOOL_OPTION = 'autoAcceptTool';
export const CAMERA_SPEED_OPTION     = 'cameraSpeed';

/**
 * The moments a pending draft can be kept without the pilot being asked, each
 * the option that turns it on: the next press that draws, the way out, and
 * another tool. `ALL` is over the three of them.
 */
export const AUTO_ACCEPT_OPTIONS = Object.freeze({
    draw: AUTO_ACCEPT_DRAW_OPTION,
    exit: AUTO_ACCEPT_EXIT_OPTION,
    tool: AUTO_ACCEPT_TOOL_OPTION
});

export const RESET_BUILDER_SETTINGS_ID    = 'reset';
export const RESET_BUILDER_SETTINGS_LABEL = 'RESET TO DEFAULTS';
export const BUILDER_SETTINGS_BACK_ID     = 'back';
export const BUILDER_SETTINGS_BACK_LABEL  = 'BACK';

export const BUILDER_SETTINGS_CLOSE_KEYS = ['Escape', 'Backspace'];

/**
 * Where the screen was opened from, which is where `BACK` returns: the builder
 * - over its canvas, or its picker - or the game's own settings.
 */
export const BUILDER_SETTINGS_FROM_BUILDER  = 'builder';
export const BUILDER_SETTINGS_FROM_SETTINGS = 'settings';

/** What a box reads as, which is the same pair every box in the game offers. */
const BOX_VALUES = Object.freeze([
    Object.freeze({ value: true,  label: 'ON'  }),
    Object.freeze({ value: false, label: 'OFF' })
]);

/**
 * How fast the build camera's three gestures go together - an orbit, a pan and
 * the wheel's zoom - as a share of the speed they were made at. A trackpad and
 * a wheel mouse want different speeds; this is apart from the flight's orbit
 * sweep because orbiting an aircraft and orbiting a canvas are done at
 * different distances.
 */
export const CAMERA_SPEEDS = Object.freeze([
    Object.freeze({ value: 0.5, label: 'SLOW'   }),
    Object.freeze({ value: 1,   label: 'NORMAL' }),
    Object.freeze({ value: 2,   label: 'FAST'   })
]);

/**
 * The screen's options in the order they are drawn: `ALL` over the three
 * moments it covers, then the view.
 */
export const BUILDER_OPTIONS = Object.freeze([
    {
        id: AUTO_ACCEPT_ALL_OPTION,
        kind: TOGGLE_FIELD,
        label: 'ALL',
        note: 'every draft kept without being asked, at each moment below',
        group: AUTO_ACCEPT_GROUP,
        default: false,
        values: BOX_VALUES
    },
    {
        id: AUTO_ACCEPT_DRAW_OPTION,
        kind: TOGGLE_FIELD,
        label: 'WHEN DRAWING AGAIN',
        note: 'the next press that draws keeps what was drawn, and starts anew',
        group: AUTO_ACCEPT_GROUP,
        default: false,
        values: BOX_VALUES
    },
    {
        id: AUTO_ACCEPT_EXIT_OPTION,
        kind: TOGGLE_FIELD,
        label: 'WHEN LEAVING',
        note: 'the way out keeps the draft, and asks only whether to save',
        group: AUTO_ACCEPT_GROUP,
        default: false,
        values: BOX_VALUES
    },
    {
        id: AUTO_ACCEPT_TOOL_OPTION,
        kind: TOGGLE_FIELD,
        label: 'WHEN CHANGING TOOL',
        note: 'another tool keeps the draft rather than asking about it',
        group: AUTO_ACCEPT_GROUP,
        default: false,
        values: BOX_VALUES
    },
    {
        id: CAMERA_SPEED_OPTION,
        label: 'CAMERA SPEED',
        note: 'how fast the view orbits, pans and zooms over a canvas',
        group: VIEW_GROUP,
        default: 1,
        values: CAMERA_SPEEDS
    }
]);

export function isBuilderSettingsCloseKey(code) {
    return BUILDER_SETTINGS_CLOSE_KEYS.includes(code);
}

/** The key that opens the game's settings everywhere else opens the builder's own inside it. */
export function isBuilderSettingsOpenKey(code) {
    return SETTINGS_OPEN_KEYS.includes(code);
}

/** The option answering to an id, or null when the screen has no such option. */
export function builderOption(id, options = BUILDER_OPTIONS) {
    return options.find(option => option.id === id) ?? null;
}

export function defaultBuilderSettings(options = BUILDER_OPTIONS) {
    const values = {};
    for (const option of options) values[option.id] = option.default;
    return values;
}

/**
 * Reads the stored preferences. Anything other than a value this module
 * wrote - no key at all, a shape from another version, or a storage that
 * throws - reads as the default, and every value is checked on its own, so
 * one this version has never heard of does not cost the others their memory.
 */
export function readBuilderSettings(storage, options = BUILDER_OPTIONS) {
    const values = defaultBuilderSettings(options);

    try {
        const stored = JSON.parse(storage?.getItem(BUILDER_SETTINGS_STORAGE_KEY) ?? 'null');
        if (!stored || typeof stored !== 'object') return values;

        for (const option of options) {
            if (isOptionValue(option.id, stored[option.id], options)) values[option.id] = stored[option.id];
        }
    } catch {
        return defaultBuilderSettings(options);
    }

    return values;
}

/**
 * Stores the preferences for the next session. A storage that refuses the
 * write costs them their memory and nothing else. Returns true when stored.
 */
export function writeBuilderSettings(storage, values) {
    try {
        storage?.setItem(BUILDER_SETTINGS_STORAGE_KEY, JSON.stringify(values));
        return storage != null;
    } catch {
        return false;
    }
}

/** The row an option is drawn as: a box for a toggle, and a stepped reading for anything else. */
function optionEntry(option, options) {
    if (option.kind === TOGGLE_FIELD) {
        return {
            kind: TOGGLE_ENTRY,
            group: option.group,
            option: option.id,
            id: option.id,
            label: option.label,
            note: option.note,
            value: option.default,
            locked: false,
            current: false
        };
    }

    return {
        kind: OPTION_ENTRY,
        group: option.group,
        id: option.id,
        label: option.label,
        note: option.note,
        value: option.default,
        valueLabel: optionValueLabel(option.id, option.default, options),
        current: false
    };
}

/** The screen's rows: every option, then the way back to the defaults, then the way out. */
export function builderSettingsEntries(options = BUILDER_OPTIONS) {
    return [
        ...options.map(option => optionEntry(option, options)),
        {
            kind: ACTION_ENTRY,
            group: BUILDER_END_GROUP,
            id: RESET_BUILDER_SETTINGS_ID,
            label: RESET_BUILDER_SETTINGS_LABEL,
            note: 'puts every row above back where it started',
            current: false
        },
        {
            kind: BACK_ENTRY,
            group: BUILDER_END_GROUP,
            id: BUILDER_SETTINGS_BACK_ID,
            label: BUILDER_SETTINGS_BACK_LABEL,
            note: '',
            current: false
        }
    ];
}

export function createBuilderSettingsState(storage = null, options = BUILDER_OPTIONS) {
    const state = {
        open: false,
        // Where it was opened from, and so where `BACK` returns, while open.
        from: null,
        storage,
        options,
        values: readBuilderSettings(storage, options),
        entries: builderSettingsEntries(options)
    };

    syncBuilderSettingsEntries(state);
    return state;
}

/**
 * True for a moment's row while `ALL` is on: it reads on, because it is, and
 * does not step, because `ALL` is what holds it there. Turning `ALL` off gives
 * back whatever the row was left on.
 */
export function isMomentLocked(state, id) {
    return Object.values(AUTO_ACCEPT_OPTIONS).includes(id) && state?.values?.[AUTO_ACCEPT_ALL_OPTION] === true;
}

/** Redraws the rows from the values behind them. */
export function syncBuilderSettingsEntries(state) {
    const options = state.options ?? BUILDER_OPTIONS;

    for (const entry of state.entries ?? []) {
        if (entry.kind === OPTION_ENTRY) {
            entry.value = state.values[entry.id];
            entry.valueLabel = optionValueLabel(entry.id, entry.value, options);
        }

        if (entry.kind === TOGGLE_ENTRY) {
            entry.locked = isMomentLocked(state, entry.option);
            entry.value = entry.locked || state.values[entry.option] === true;
        }

        entry.text = optionEntryText(entry);
    }

    return state.entries;
}

export function builderSettingsShowing(state) {
    return state?.open === true;
}

/**
 * Opens the screen, remembering where from - `BUILDER_SETTINGS_FROM_BUILDER`
 * or `BUILDER_SETTINGS_FROM_SETTINGS` - so `BACK` can return there. Returns
 * true when it opened; one already open is not opened again over itself.
 */
export function openBuilderSettings(state, from = BUILDER_SETTINGS_FROM_BUILDER) {
    if (builderSettingsShowing(state)) return false;
    state.open = true;
    state.from = from === BUILDER_SETTINGS_FROM_SETTINGS ? BUILDER_SETTINGS_FROM_SETTINGS : BUILDER_SETTINGS_FROM_BUILDER;
    syncBuilderSettingsEntries(state);
    return true;
}

/**
 * Closes the screen. Returns where it was opened from, which is where the
 * caller goes back to, or null when it was not open.
 */
export function closeBuilderSettings(state) {
    if (!builderSettingsShowing(state)) return null;
    state.open = false;
    return state.from;
}

/** The entry a row id belongs to, or null when the screen has no such row. */
export function builderSettingsEntry(state, id) {
    return state?.entries?.find(entry => entry.id === id) ?? null;
}

/** Writes one value and remembers it. Returns the option's id, or null when it was already that. */
function applyBuilderSetting(state, id, value) {
    if (state.values[id] === value) return null;
    state.values[id] = value;
    syncBuilderSettingsEntries(state);
    writeBuilderSettings(state.storage, state.values);
    return id;
}

/** Turns a box over, unless `ALL` is holding it. */
function flipToggle(state, entry) {
    if (entry.locked) return null;
    return applyBuilderSetting(state, entry.option, !(state.values[entry.option] === true));
}

/**
 * Steps a row on by one place either way: a box turns over, and a reading moves
 * along its settings. The rows that hold no value mean nothing to the arrows.
 * Returns the option's id when it moved, and null when nothing changed.
 */
export function adjustBuilderSetting(state, id, step) {
    if (!step) return null;

    const entry = builderSettingsEntry(state, id);
    if (entry?.kind === TOGGLE_ENTRY) return flipToggle(state, entry);

    const options = state.options ?? BUILDER_OPTIONS;
    if (!builderOption(id, options)) return null;
    return applyBuilderSetting(state, id, cycleOptionValue(id, state.values[id], step, options));
}

/**
 * Puts every row back where it started, and writes that, so a pilot who has
 * lost track of what they changed has one way back. It touches no world.
 * Returns true when anything changed.
 */
export function resetBuilderSettings(state) {
    const defaults = defaultBuilderSettings(state.options ?? BUILDER_OPTIONS);
    const changed = Object.keys(defaults).some(id => state.values[id] !== defaults[id]);
    state.values = defaults;
    syncBuilderSettingsEntries(state);
    writeBuilderSettings(state.storage, state.values);
    return changed;
}

/**
 * Applies the row chosen.
 *
 * Returns `BUILDER_SETTINGS_BACK_ID` when the screen was closed - where it was
 * opened from is the caller's to read first, with `builderSettingsFrom` -
 * `RESET_BUILDER_SETTINGS_ID` when every row was put back, the option's id
 * when one was stepped, and null when the choice changed nothing.
 */
export function chooseBuilderSetting(state, id, step = 1) {
    if (id === BUILDER_SETTINGS_BACK_ID) {
        closeBuilderSettings(state);
        return BUILDER_SETTINGS_BACK_ID;
    }

    if (id === RESET_BUILDER_SETTINGS_ID) {
        resetBuilderSettings(state);
        return RESET_BUILDER_SETTINGS_ID;
    }

    // An option has no single thing to choose, so choosing one steps it on -
    // the same thing the arrows do to it.
    return adjustBuilderSetting(state, id, step);
}

/** Where the open screen was opened from, or null while it is shut. */
export function builderSettingsFrom(state) {
    return builderSettingsShowing(state) ? state.from : null;
}

/**
 * The moments auto accept covers, as the builder's state takes them: `all`
 * and each moment as the pilot left it. `ALL` is read over the others where
 * the moment is asked about, not folded into them here, so turning it off
 * gives back what each was.
 */
export function builderAutoAccept(state) {
    const values = state?.values ?? {};
    return {
        all: values[AUTO_ACCEPT_ALL_OPTION] === true,
        draw: values[AUTO_ACCEPT_DRAW_OPTION] === true,
        exit: values[AUTO_ACCEPT_EXIT_OPTION] === true,
        tool: values[AUTO_ACCEPT_TOOL_OPTION] === true
    };
}

/**
 * How fast the build camera's gestures go, as a share of their own speed: one
 * of `CAMERA_SPEEDS`, which is all a read or a step ever leaves it on.
 */
export function builderCameraSpeed(state) {
    return state?.values?.[CAMERA_SPEED_OPTION] ?? 1;
}
