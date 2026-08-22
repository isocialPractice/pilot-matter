import test from 'node:test';
import assert from 'node:assert/strict';
import {
    SETTINGS_STORAGE_KEY,
    SETTINGS_BACK_ID,
    SETTINGS_CLOSE_KEYS,
    defaultSettings,
    readSettings,
    writeSettings,
    settingsEntries,
    createSettingsState,
    syncSettingsEntries,
    settingsShowing,
    openSettings,
    closeSettings,
    currentEnvironment,
    chooseSetting,
    isSettingsCloseKey
} from '../js/settings.js';
import { ENVIRONMENTS, DEFAULT_ENVIRONMENT_ID } from '../js/environment/presets.js';

// Enough of a storage for the settings to remember something, with no browser
// to remember it in.
function fakeStorage(initial = {}) {
    const values = { ...initial };
    return {
        getItem: (key) => (key in values ? values[key] : null),
        setItem: (key, value) => { values[key] = String(value); },
        values
    };
}

function refusingStorage() {
    return {
        getItem() { throw new Error('storage is blocked'); },
        setItem() { throw new Error('storage is blocked'); }
    };
}

test('a first flight gets the default environment', () => {
    assert.deepEqual(defaultSettings(), { environment: DEFAULT_ENVIRONMENT_ID });
    assert.equal(currentEnvironment(createSettingsState(null)), DEFAULT_ENVIRONMENT_ID);
});

test('the panel starts closed, and opens and closes on request', () => {
    const state = createSettingsState(null);
    assert.equal(settingsShowing(state), false);
    assert.equal(openSettings(state), true);
    assert.equal(settingsShowing(state), true);
    assert.equal(openSettings(state), false, 'opening an open panel changes nothing');
    assert.equal(closeSettings(state), true);
    assert.equal(settingsShowing(state), false);
});

test('the panel lists every environment, then the way out of it', () => {
    const entries = settingsEntries();
    assert.equal(entries.length, ENVIRONMENTS.length + 1);
    assert.deepEqual(
        entries.slice(0, -1).map(entry => entry.id),
        ENVIRONMENTS.map(environment => environment.id)
    );
    assert.equal(entries.at(-1).id, SETTINGS_BACK_ID);
    for (const entry of entries) {
        assert.ok(entry.label.length > 0, `${entry.id} needs a label to be read by`);
    }
});

test('the environment being flown is the one marked in the list', () => {
    const state = createSettingsState(null);
    const marked = () => state.entries.filter(entry => entry.current).map(entry => entry.id);

    assert.deepEqual(marked(), [DEFAULT_ENVIRONMENT_ID]);

    const other = ENVIRONMENTS.find(environment => environment.id !== DEFAULT_ENVIRONMENT_ID);
    chooseSetting(state, other.id);
    assert.deepEqual(marked(), [other.id], 'a mark on two rows is a mark on neither');
});

test('choosing an environment reports the change, and choosing it again does not', () => {
    const state = createSettingsState(null);
    const other = ENVIRONMENTS.find(environment => environment.id !== DEFAULT_ENVIRONMENT_ID);

    assert.equal(chooseSetting(state, other.id), other.id);
    assert.equal(currentEnvironment(state), other.id);
    assert.equal(chooseSetting(state, other.id), null, 'the world it is already flying is not a change');
});

test('choosing the way out closes the panel and changes no setting', () => {
    const state = createSettingsState(null);
    openSettings(state);
    assert.equal(chooseSetting(state, SETTINGS_BACK_ID), SETTINGS_BACK_ID);
    assert.equal(settingsShowing(state), false);
    assert.equal(currentEnvironment(state), DEFAULT_ENVIRONMENT_ID);
});

test('an entry nothing answers to changes nothing', () => {
    const state = createSettingsState(null);
    assert.equal(chooseSetting(state, 'an-environment-that-does-not-exist'), null);
    assert.equal(currentEnvironment(state), DEFAULT_ENVIRONMENT_ID);
});

test('the choice outlives the session that made it', () => {
    const storage = fakeStorage();
    const state = createSettingsState(storage);
    const other = ENVIRONMENTS.find(environment => environment.id !== DEFAULT_ENVIRONMENT_ID);

    chooseSetting(state, other.id);
    assert.equal(currentEnvironment(createSettingsState(storage)), other.id);
});

test('a stored environment this version has never heard of reads as the default', () => {
    const storage = fakeStorage({
        [SETTINGS_STORAGE_KEY]: JSON.stringify({ environment: 'a-world-from-another-version' })
    });
    assert.equal(readSettings(storage).environment, DEFAULT_ENVIRONMENT_ID);
});

test('a storage holding something that is not settings at all reads as the default', () => {
    for (const stored of ['', 'not json', '[]', 'null', '{"environment":7}']) {
        const storage = fakeStorage({ [SETTINGS_STORAGE_KEY]: stored });
        assert.deepEqual(readSettings(storage), defaultSettings(), `"${stored}" should read as the default`);
    }
});

test('a storage that refuses costs the settings their memory and nothing else', () => {
    assert.deepEqual(readSettings(refusingStorage()), defaultSettings());
    assert.equal(writeSettings(refusingStorage(), defaultSettings()), false);
    assert.equal(writeSettings(null, defaultSettings()), false);

    const state = createSettingsState(refusingStorage());
    const other = ENVIRONMENTS.find(environment => environment.id !== DEFAULT_ENVIRONMENT_ID);
    assert.equal(chooseSetting(state, other.id), other.id, 'the flight goes on either way');
    assert.equal(currentEnvironment(state), other.id);
});

test('the keys that close the panel are the ones that back out of anything', () => {
    for (const code of SETTINGS_CLOSE_KEYS) {
        assert.equal(isSettingsCloseKey(code), true);
    }
    for (const code of ['KeyW', 'Enter', 'KeyP']) {
        assert.equal(isSettingsCloseKey(code), false, `${code} is a menu key, not a way out`);
    }
});

test('syncing the list is what marks it, so a reopened panel shows the pick', () => {
    const state = createSettingsState(null);
    state.values.environment = ENVIRONMENTS.at(-1).id;
    for (const entry of state.entries) entry.current = false;

    syncSettingsEntries(state);
    assert.deepEqual(
        state.entries.filter(entry => entry.current).map(entry => entry.id),
        [ENVIRONMENTS.at(-1).id]
    );
});
