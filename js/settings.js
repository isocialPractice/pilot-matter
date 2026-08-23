/**
 * Settings - the panel the start screen and the pause menu both open, the `O`
 * key opens directly, and the choices it holds. Pure module with no DOM or
 * Three.js dependency: the browser's storage is passed in rather than reached
 * for, so a plain object stands in for it under test.
 *
 * The panel is a keyboard menu like the other two, so what is listed here is
 * entries rather than widgets, and `js/menu.js` moves the cursor over them.
 * An entry is either a world to fly, which is chosen, or an option, which is
 * a value stepped through a list of the values it is allowed to take.
 */

import { ENVIRONMENTS, DEFAULT_ENVIRONMENT_ID, isEnvironmentId } from './environment/presets.js';

export { isEnvironmentId } from './environment/presets.js';

export const SETTINGS_STORAGE_KEY = 'pilot-matter.settings';

export const SETTINGS_TITLE = 'SETTINGS';
export const SETTINGS_HEADING = 'ENVIRONMENT';
export const SETTINGS_OPTIONS_HEADING = 'OPTIONS';

// The last entry of the panel, and the way out of it for a pilot who has not
// found the key that closes it.
export const SETTINGS_BACK_ID    = 'back';
export const SETTINGS_BACK_LABEL = 'BACK';

export const SETTINGS_CLOSE_KEYS = ['Escape', 'Backspace'];

// The panel is reached from either menu, and from the flight itself, so a
// setting can be changed without first pausing to go looking for it.
export const SETTINGS_OPEN_KEYS = ['KeyO'];

// What an entry in the panel is: a world, a value with a list of settings, or
// the way out.
export const ENVIRONMENT_ENTRY = 'environment';
export const OPTION_ENTRY      = 'option';
export const BACK_ENTRY        = 'back';

// The options by name, so what a setting drives is looked up by an id both
// sides agree on rather than by a string typed twice.
export const SENSITIVITY_OPTION   = 'sensitivity';
export const FOG_OPTION           = 'fog';
export const SPEED_UNIT_OPTION    = 'speedUnit';
export const ALTITUDE_UNIT_OPTION = 'altitudeUnit';

/**
 * The options the panel sets, each as the values it is allowed to take rather
 * than a range with a step, so every setting reads as a labelled position on a
 * dial and no combination of keys can land it between two of them.
 */
export const SETTINGS_OPTIONS = [
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
];

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

/** True when the value is one of the settings that option can be left on. */
export function isOptionValue(id, value, options = SETTINGS_OPTIONS) {
    return settingsOption(id, options)?.values.some(entry => entry.value === value) === true;
}

/** What the panel writes beside an option, for the value it is currently on. */
export function optionValueLabel(id, value, options = SETTINGS_OPTIONS) {
    const option = settingsOption(id, options);
    return option?.values.find(entry => entry.value === value)?.label ?? '';
}

/**
 * The next value along from the one given, wrapping round both ends so an
 * option has no dead stop at either. A value the option has never held starts
 * the walk from its first setting rather than refusing to move.
 */
export function cycleOptionValue(id, value, step = 1, options = SETTINGS_OPTIONS) {
    const option = settingsOption(id, options);
    if (!option) return value;

    const values = option.values;
    const at = values.findIndex(entry => entry.value === value);
    const index = at < 0 ? 0 : (((at + step) % values.length) + values.length) % values.length;
    return values[index].value;
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
        ...options.map(option => ({
            kind: OPTION_ENTRY,
            id: option.id,
            label: option.label,
            note: option.note,
            value: option.default,
            valueLabel: optionValueLabel(option.id, option.default, options),
            current: false
        })),
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

export function optionEntryText(entry) {
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

    for (const entry of state.entries) {
        entry.current = entry.kind === ENVIRONMENT_ENTRY && entry.id === state.values.environment;

        if (entry.kind === OPTION_ENTRY) {
            entry.value = state.values[entry.id];
            entry.valueLabel = optionValueLabel(entry.id, entry.value, options);
        }

        entry.text = optionEntryText(entry);
    }

    return state.entries;
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
 * Steps an option to another of its settings, by one place in either
 * direction. Anything that is not an option is left alone, so the arrow keys
 * mean nothing on a world or on the way out.
 *
 * Returns the option's id when it moved, and null when nothing changed.
 */
export function adjustSetting(state, id, step) {
    const options = state.options ?? SETTINGS_OPTIONS;
    if (!step || !settingsOption(id, options)) return null;

    const next = cycleOptionValue(id, state.values[id], step, options);
    if (next === state.values[id]) return null;

    state.values[id] = next;
    syncSettingsEntries(state);
    writeSettings(state.storage, state.values);
    return id;
}

/**
 * Applies the entry chosen in the panel.
 *
 * Returns `SETTINGS_BACK_ID` when the panel was closed, the environment id
 * when a different world was picked, the option's id when an option was
 * stepped on to its next setting, and null when the choice changed nothing:
 * an unknown entry, or the environment already being flown.
 */
export function chooseSetting(state, id) {
    if (id === SETTINGS_BACK_ID) {
        closeSettings(state);
        return SETTINGS_BACK_ID;
    }

    // An option has no single thing to choose, so choosing one steps it on to
    // its next setting - the same thing the right arrow does to it.
    if (settingsOption(id, state.options ?? SETTINGS_OPTIONS)) return adjustSetting(state, id, 1);

    if (!isEnvironmentId(id) || state.values.environment === id) return null;

    state.values.environment = id;
    syncSettingsEntries(state);
    writeSettings(state.storage, state.values);
    return id;
}
