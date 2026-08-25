/**
 * Settings - the panel the start screen and the pause menu both open, the `O`
 * key opens directly, and the choices it holds. Pure module with no DOM or
 * Three.js dependency: the browser's storage is passed in rather than reached
 * for, so a plain object stands in for it under test.
 *
 * The panel is a keyboard menu like the other two, so what is listed here is
 * entries rather than widgets, and `js/menu.js` moves the cursor over them.
 * An entry is either a world to fly, which is chosen, or an option, which is a
 * value stepped either through a list of the settings it may take or along a
 * range of the numbers it may hold.
 *
 * The options come in two groups drawn under two headings. The start state is
 * the condition a flight opens in, and its fields are declared by
 * `js/config.js` rather than here, because what a start may be is a question
 * about flight rather than about a panel. The rest are the settings that hold
 * whichever world is flown, and they are declared below.
 */

import { ENVIRONMENTS, DEFAULT_ENVIRONMENT_ID, isEnvironmentId } from './environment/presets.js';
import {
    START_FIELDS, START_FIELD_IDS, CHOICE_FIELD, TOGGLE_FIELD, resolveStart, runwayForced
} from './config.js';

export { isEnvironmentId } from './environment/presets.js';

export const SETTINGS_STORAGE_KEY = 'pilot-matter.settings';

export const SETTINGS_TITLE = 'SETTINGS';
export const SETTINGS_HEADING = 'ENVIRONMENT';
export const SETTINGS_START_HEADING = 'START STATE';
export const SETTINGS_OPTIONS_HEADING = 'OPTIONS';

// The last entry of the panel, and the way out of it for a pilot who has not
// found the key that closes it.
export const SETTINGS_BACK_ID    = 'back';
export const SETTINGS_BACK_LABEL = 'BACK';

export const SETTINGS_CLOSE_KEYS = ['Escape', 'Backspace'];

// The panel is reached from either menu, and from the flight itself, so a
// setting can be changed without first pausing to go looking for it.
export const SETTINGS_OPEN_KEYS = ['KeyO'];

// What an entry in the panel is: a world, a value with settings of its own, one
// of a set of conditions only one of which can be in force, something that is
// simply on or off, or the way out.
export const ENVIRONMENT_ENTRY = 'environment';
export const OPTION_ENTRY      = 'option';
export const CHOICE_ENTRY      = 'choice';
export const TOGGLE_ENTRY      = 'toggle';
export const BACK_ENTRY        = 'back';

// Which heading an option is drawn under. The cursor walks every option as one
// list whichever group it is in, so a group is a heading rather than a mode.
export const START_GROUP  = 'start';
export const OPTION_GROUP = 'options';

// The options by name, so what a setting drives is looked up by an id both
// sides agree on rather than by a string typed twice.
export const SENSITIVITY_OPTION   = 'sensitivity';
export const FOG_OPTION           = 'fog';
export const SPEED_UNIT_OPTION    = 'speedUnit';
export const ALTITUDE_UNIT_OPTION = 'altitudeUnit';

/**
 * The condition a flight opens in, as options the panel can set. The fields
 * are `js/config.js`'s and are offered exactly as declared there.
 */
export const START_OPTIONS = START_FIELDS.map(field => ({ ...field, group: START_GROUP }));

/**
 * The settings that hold whichever world is flown, each as the values it is
 * allowed to take rather than a range with a step, so every one of them reads
 * as a labelled position on a dial and no combination of keys can land it
 * between two of them.
 */
export const FLIGHT_OPTIONS = [
    {
        id: SENSITIVITY_OPTION,
        label: 'CONTROL SENSITIVITY',
        note: 'how far a control surface moves per key press',
        default: 1,
        values: [
            { value: 0.5,  label: '50%'  },
            { value: 0.75, label: '75%'  },
            { value: 1,    label: '100%' },
            { value: 1.25, label: '125%' },
            { value: 1.5,  label: '150%' },
            { value: 2,    label: '200%' }
        ]
    },
    {
        id: FOG_OPTION,
        label: 'FOG DENSITY',
        note: 'how far into the distance the world is visible',
        default: 1,
        values: [
            { value: 0.25, label: 'CLEAR'  },
            { value: 0.5,  label: 'LIGHT'  },
            { value: 1,    label: 'NORMAL' },
            { value: 1.5,  label: 'HEAVY'  },
            { value: 2,    label: 'THICK'  }
        ]
    },
    {
        id: SPEED_UNIT_OPTION,
        label: 'AIRSPEED IN',
        note: 'the scale the airspeed readout is on',
        default: 'knots',
        values: [
            { value: 'knots', label: 'KNOTS' },
            { value: 'mph',   label: 'MPH'   }
        ]
    },
    {
        id: ALTITUDE_UNIT_OPTION,
        label: 'ALTITUDE IN',
        note: 'the scale the altimeter and the climb rate are on',
        default: 'feet',
        values: [
            { value: 'feet',   label: 'FEET'   },
            { value: 'meters', label: 'METERS' }
        ]
    }
].map(option => ({ ...option, group: OPTION_GROUP }));

/**
 * Every option the panel holds, in the order the cursor walks them: the start
 * state first, under its own heading, then the settings that hold whichever
 * world is flown.
 */
export const SETTINGS_OPTIONS = [...START_OPTIONS, ...FLIGHT_OPTIONS];

export function isSettingsCloseKey(code) {
    return SETTINGS_CLOSE_KEYS.includes(code);
}

export function isSettingsOpenKey(code) {
    return SETTINGS_OPEN_KEYS.includes(code);
}

/** The option answering to an id, or null when nothing does. */
export function settingsOption(id, options = SETTINGS_OPTIONS) {
    return options.find(option => option.id === id) ?? null;
}

/** True for an option stepped along a range of numbers rather than a list. */
export function isRangeOption(option) {
    return option != null && !option.values;
}

/**
 * True when the value is one the option can be left on: one of its listed
 * settings, or a number inside its range and on one of its steps. A reading
 * between two steps is refused rather than snapped to the nearest, because a
 * value the panel never offered is a value from somewhere else.
 */
export function isOptionValue(id, value, options = SETTINGS_OPTIONS) {
    const option = settingsOption(id, options);
    if (!option) return false;
    if (!isRangeOption(option)) return option.values.some(entry => entry.value === value);

    return Number.isFinite(value)
        && value >= option.min
        && value <= option.max
        && Number.isInteger((value - option.min) / option.step);
}

/**
 * What the panel writes beside an option, for the value it is currently on.
 *
 * A listed setting reads as its own label. A number reads as itself, zero
 * filled to the width the option asks for, signed where a `+` carries meaning,
 * and followed by the option's units exactly as they are declared - spacing
 * included, so a reading is punctuated where it should be.
 */
export function optionValueLabel(id, value, options = SETTINGS_OPTIONS) {
    const option = settingsOption(id, options);
    if (!option) return '';
    if (!isRangeOption(option)) {
        return option.values.find(entry => entry.value === value)?.label ?? '';
    }
    if (!Number.isFinite(value)) return '';

    const digits = String(Math.abs(value)).padStart(option.pad ?? 0, '0');
    const sign   = value < 0 ? '-' : (option.signed && value > 0 ? '+' : '');
    return `${sign}${digits}${option.unit ?? ''}`;
}

/**
 * The next value along from the one given.
 *
 * A list wraps round both ends, so an option chosen from one has no dead stop
 * at either, and a value the option has never held starts the walk from its
 * first setting rather than refusing to move. A range stops at its ends
 * instead, because the ends of a range mean something a list's do not: past the
 * fastest airspeed a flight can open at is not the slowest one.
 */
export function cycleOptionValue(id, value, step = 1, options = SETTINGS_OPTIONS) {
    const option = settingsOption(id, options);
    if (!option) return value;

    if (isRangeOption(option)) {
        const from = isOptionValue(id, value, options) ? value : option.default;
        return clamp(from + step * option.step, option.min, option.max);
    }

    const values = option.values;
    const at = values.findIndex(entry => entry.value === value);
    const index = at < 0 ? 0 : (((at + step) % values.length) + values.length) % values.length;
    return values[index].value;
}

function clamp(value, low, high) {
    return Math.min(Math.max(value, low), high);
}

export function defaultSettings(options = SETTINGS_OPTIONS) {
    const settings = { environment: DEFAULT_ENVIRONMENT_ID };
    for (const option of options) settings[option.id] = option.default;
    return settings;
}

/**
 * Reads the stored choices. Anything other than a value this module wrote - no
 * key at all, an environment or an option setting from a version that had one
 * this one does not, or a storage that throws - reads as the default, which is
 * what a first flight should see. Every choice is checked on its own, so one
 * value this version has never heard of does not cost the others their memory.
 */
export function readSettings(storage, options = SETTINGS_OPTIONS) {
    const settings = defaultSettings(options);

    try {
        const stored = JSON.parse(storage?.getItem(SETTINGS_STORAGE_KEY) ?? 'null');
        if (!stored || typeof stored !== 'object') return settings;

        if (isEnvironmentId(stored.environment)) settings.environment = stored.environment;
        for (const option of options) {
            if (isOptionValue(option.id, stored[option.id], options)) {
                settings[option.id] = stored[option.id];
            }
        }
    } catch {
        return defaultSettings(options);
    }

    return settings;
}

/**
 * Stores the choices for the next session. A storage that refuses the write
 * costs the settings their memory and nothing else, so the flight goes on.
 *
 * Returns true when the choices were stored.
 */
export function writeSettings(storage, values) {
    try {
        storage?.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(values));
        return storage != null;
    } catch {
        return false;
    }
}

/**
 * The id an entry answers to when an option is drawn as more than one row. Only
 * a choice needs it: every row of one names the same option, so the value it
 * stands for has to be part of what it is called.
 */
export function choiceEntryId(optionId, value) {
    return `${optionId}:${value}`;
}

/**
 * The rows one option is drawn as.
 *
 * Most are one row that steps through the settings it may take. A choice is one
 * row per condition, only one of which can be in force, so choosing one clears
 * whichever was: the panel has no space to explain a radio group, and a list
 * that marks the condition it is in explains itself. A toggle is one row that is
 * either on or off, drawn as the box it is.
 */
function optionEntries(option, options) {
    const group = option.group ?? OPTION_GROUP;

    if (option.kind === CHOICE_FIELD) {
        return option.values.map(entry => ({
            kind: CHOICE_ENTRY,
            group,
            option: option.id,
            id: choiceEntryId(option.id, entry.value),
            label: entry.label,
            note: entry.note ?? option.note,
            value: entry.value,
            current: false
        }));
    }

    if (option.kind === TOGGLE_FIELD) {
        return [{
            kind: TOGGLE_ENTRY,
            group,
            option: option.id,
            id: option.id,
            label: option.label,
            note: option.note,
            value: option.default,
            locked: false,
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
 * The panel's entries: every environment that can be flown, then every option
 * that can be set, then the way out.
 */
export function settingsEntries(environments = ENVIRONMENTS, options = SETTINGS_OPTIONS) {
    return [
        ...environments.map(environment => ({
            kind: ENVIRONMENT_ENTRY,
            id: environment.id,
            label: environment.label,
            note: environment.description,
            current: false
        })),
        ...options.flatMap(option => optionEntries(option, options)),
        { kind: BACK_ENTRY, id: SETTINGS_BACK_ID, label: SETTINGS_BACK_LABEL, note: '', current: false }
    ];
}

/**
 * How an option reads in the list: the setting it is on, between the marks
 * that say it is stepped rather than chosen. They are the same marks the
 * stylesheet puts beside the environment being flown, so one panel is written
 * in one set of characters.
 */
export const OPTION_LEFT_MARK  = '‹';
export const OPTION_RIGHT_MARK = '›';

// A toggle reads as the box it is, so what it is set to is legible without the
// row having to be under the cursor.
export const TOGGLE_ON_MARK  = '[X]';
export const TOGGLE_OFF_MARK = '[ ]';

export function optionEntryText(entry) {
    if (entry.kind === TOGGLE_ENTRY) {
        return `${entry.value ? TOGGLE_ON_MARK : TOGGLE_OFF_MARK} ${entry.label}`;
    }
    if (entry.kind !== OPTION_ENTRY) return entry.label;
    return `${entry.label}  ${OPTION_LEFT_MARK} ${entry.valueLabel} ${OPTION_RIGHT_MARK}`;
}

export function createSettingsState(storage = null, environments = ENVIRONMENTS, options = SETTINGS_OPTIONS) {
    const state = {
        open: false,
        storage,
        options,
        values: readSettings(storage, options),
        entries: settingsEntries(environments, options)
    };

    syncSettingsEntries(state);
    return state;
}

/**
 * Redraws the list from the choices behind it: the environment being flown is
 * marked, and every option carries the setting it is currently on.
 */
export function syncSettingsEntries(state) {
    const options = state.options ?? SETTINGS_OPTIONS;
    const start   = startSettings(state);

    for (const entry of state.entries) {
        entry.current = entry.kind === ENVIRONMENT_ENTRY && entry.id === state.values.environment;

        if (entry.kind === OPTION_ENTRY) {
            entry.value = state.values[entry.id];
            entry.valueLabel = optionValueLabel(entry.id, entry.value, options);
        }

        // A choice marks the one condition in force, the same way the list of
        // worlds marks the one being flown.
        if (entry.kind === CHOICE_ENTRY) {
            entry.current = state.values[entry.option] === entry.value;
        }

        // A toggle another setting is holding shows what it is being held at
        // rather than what the pilot last left it on, because a box that says
        // one thing while the world does another is a box nobody can read.
        if (entry.kind === TOGGLE_ENTRY) {
            entry.locked = isToggleLocked(entry.option, start);
            entry.value  = entry.locked ? true : state.values[entry.option] === true;
        }

        entry.text = optionEntryText(entry);
    }

    return state.entries;
}

/**
 * True while a toggle is being held by something other than the pilot. Only the
 * runway has such a holder: a start that rolls out of one cannot be flown in a
 * world with no strip in it, so that start owns the box for as long as it is set.
 */
export function isToggleLocked(id, start) {
    return id === 'runway' && runwayForced(start);
}

export function settingsShowing(state) {
    return state.open === true;
}

export function openSettings(state) {
    const changed = !state.open;
    state.open = true;
    syncSettingsEntries(state);
    return changed;
}

export function closeSettings(state) {
    const changed = state.open;
    state.open = false;
    return changed;
}

export function currentEnvironment(state) {
    return state.values.environment;
}

/** What an option is currently set to, for whatever the setting drives. */
export function currentOption(state, id) {
    return state.values[id];
}

/**
 * The start state the panel is holding, as the fields `js/config.js` declares
 * them and nothing else, so a flight is handed a start rather than the whole
 * settings object with a start somewhere inside it.
 *
 * Resolved on the way out rather than handed over raw, so what leaves the panel
 * is a start that hangs together: a takeoff carries the strip it needs, whatever
 * the pilot last left the box on for the start they were flying then.
 */
export function startSettings(state) {
    const held = {};
    for (const id of START_FIELD_IDS) held[id] = state.values[id];
    return resolveStart(held);
}

/** The entry a row id belongs to, or null when the panel has no such row. */
export function settingsEntry(state, id) {
    return state.entries?.find(entry => entry.id === id) ?? null;
}

/**
 * Writes one setting and remembers it. Returns the id of the option that
 * changed, or null when it was already on that value.
 */
function applySetting(state, id, value) {
    if (state.values[id] === value) return null;

    state.values[id] = value;
    syncSettingsEntries(state);
    writeSettings(state.storage, state.values);
    return id;
}

/**
 * Steps an option to another of its settings, by one place in either
 * direction. A choice steps to the condition its own row stands for, and a
 * toggle flips, because on a row that is one of a set the only step there is
 * to take is on to it. Anything else is left alone, so the arrow keys mean
 * nothing on a world or on the way out.
 *
 * Returns the option's id when it moved, and null when nothing changed.
 */
export function adjustSetting(state, id, step) {
    if (!step) return null;

    const entry = settingsEntry(state, id);
    if (entry?.kind === CHOICE_ENTRY) return applySetting(state, entry.option, entry.value);
    if (entry?.kind === TOGGLE_ENTRY) return flipToggle(state, entry);

    const options = state.options ?? SETTINGS_OPTIONS;
    if (!settingsOption(id, options)) return null;

    return applySetting(state, id, cycleOptionValue(id, state.values[id], step, options));
}

/**
 * Turns a toggle over, unless something else is holding it. A held box is not
 * refused because the pilot was wrong to press it: it is refused because the
 * start state it belongs to has already answered the question.
 */
function flipToggle(state, entry) {
    if (entry.locked) return null;
    return applySetting(state, entry.option, !(state.values[entry.option] === true));
}

/**
 * Applies the entry chosen in the panel.
 *
 * Returns `SETTINGS_BACK_ID` when the panel was closed, the environment id
 * when a different world was picked, the option's id when an option was
 * stepped on to its next setting, and null when the choice changed nothing:
 * an unknown entry, a held toggle, or the environment already being flown.
 */
export function chooseSetting(state, id) {
    if (id === SETTINGS_BACK_ID) {
        closeSettings(state);
        return SETTINGS_BACK_ID;
    }

    const entry = settingsEntry(state, id);
    if (entry?.kind === CHOICE_ENTRY) return applySetting(state, entry.option, entry.value);
    if (entry?.kind === TOGGLE_ENTRY) return flipToggle(state, entry);

    // An option has no single thing to choose, so choosing one steps it on to
    // its next setting - the same thing the right arrow does to it.
    if (settingsOption(id, state.options ?? SETTINGS_OPTIONS)) return adjustSetting(state, id, 1);

    if (!isEnvironmentId(id) || state.values.environment === id) return null;

    // A world answers as itself rather than as the setting holding it, because
    // what a caller does about a new world depends on which world it is.
    return applySetting(state, 'environment', id) == null ? null : id;
}
