/**
 * Settings - the panel the start screen and the pause menu both open, and the
 * choices it holds. Pure module with no DOM or Three.js dependency: the
 * browser's storage is passed in rather than reached for, so a plain object
 * stands in for it under test.
 *
 * The panel is a keyboard menu like the other two, so what is listed here is
 * entries rather than widgets, and `js/menu.js` moves the cursor over them.
 */

import { ENVIRONMENTS, DEFAULT_ENVIRONMENT_ID, isEnvironmentId } from './environment/presets.js';

export const SETTINGS_STORAGE_KEY = 'pilot-matter.settings';

export const SETTINGS_TITLE = 'SETTINGS';
export const SETTINGS_HEADING = 'ENVIRONMENT';

// The last entry of the panel, and the way out of it for a pilot who has not
// found the key that closes it.
export const SETTINGS_BACK_ID    = 'back';
export const SETTINGS_BACK_LABEL = 'BACK';

export const SETTINGS_CLOSE_KEYS = ['Escape', 'Backspace'];

export function isSettingsCloseKey(code) {
    return SETTINGS_CLOSE_KEYS.includes(code);
}

export function defaultSettings() {
    return { environment: DEFAULT_ENVIRONMENT_ID };
}

/**
 * Reads the stored choices. Anything other than a value this module wrote - no
 * key at all, an environment from a version that had one this one does not, or
 * a storage that throws - reads as the default, which is what a first flight
 * should see.
 */
export function readSettings(storage) {
    const settings = defaultSettings();

    try {
        const stored = JSON.parse(storage?.getItem(SETTINGS_STORAGE_KEY) ?? 'null');
        if (stored && isEnvironmentId(stored.environment)) settings.environment = stored.environment;
    } catch {
        return defaultSettings();
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

/** The panel's entries: every environment that can be flown, then the way out. */
export function settingsEntries(environments = ENVIRONMENTS) {
    return [
        ...environments.map(environment => ({
            id: environment.id,
            label: environment.label,
            note: environment.description,
            current: false
        })),
        { id: SETTINGS_BACK_ID, label: SETTINGS_BACK_LABEL, note: '', current: false }
    ];
}

export function createSettingsState(storage = null, environments = ENVIRONMENTS) {
    const state = {
        open: false,
        storage,
        values: readSettings(storage),
        entries: settingsEntries(environments)
    };

    syncSettingsEntries(state);
    return state;
}

/** Marks the entry the flight is currently using, so the panel shows the pick. */
export function syncSettingsEntries(state) {
    for (const entry of state.entries) {
        entry.current = entry.id === state.values.environment;
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

/**
 * Applies the entry chosen in the panel.
 *
 * Returns `SETTINGS_BACK_ID` when the panel was closed, the environment id
 * when a different world was picked, and null when the choice changed nothing:
 * an unknown entry, or the environment already being flown.
 */
export function chooseSetting(state, id) {
    if (id === SETTINGS_BACK_ID) {
        closeSettings(state);
        return SETTINGS_BACK_ID;
    }

    if (!isEnvironmentId(id) || state.values.environment === id) return null;

    state.values.environment = id;
    syncSettingsEntries(state);
    writeSettings(state.storage, state.values);
    return id;
}
