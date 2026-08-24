import test from 'node:test';
import assert from 'node:assert/strict';
import {
    SETTINGS_STORAGE_KEY,
    SETTINGS_BACK_ID,
    SETTINGS_CLOSE_KEYS,
    SETTINGS_OPEN_KEYS,
    SETTINGS_OPTIONS,
    START_OPTIONS,
    FLIGHT_OPTIONS,
    ENVIRONMENT_ENTRY,
    OPTION_ENTRY,
    BACK_ENTRY,
    START_GROUP,
    OPTION_GROUP,
    isRangeOption,
    startSettings,
    SENSITIVITY_OPTION,
    FOG_OPTION,
    SPEED_UNIT_OPTION,
    ALTITUDE_UNIT_OPTION,
    defaultSettings,
    readSettings,
    writeSettings,
    settingsEntries,
    settingsOption,
    isOptionValue,
    optionValueLabel,
    optionEntryText,
    cycleOptionValue,
    createSettingsState,
    syncSettingsEntries,
    settingsShowing,
    openSettings,
    closeSettings,
    currentEnvironment,
    currentOption,
    adjustSetting,
    chooseSetting,
    isSettingsCloseKey,
    isSettingsOpenKey
} from '../js/settings.js';
import { ENVIRONMENTS, DEFAULT_ENVIRONMENT_ID } from '../js/environment/presets.js';
import { SPEED_UNITS, ALTITUDE_UNITS } from '../js/units.js';
import { START_FIELDS, START_FIELD_IDS, startDefaults } from '../js/config.js';

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

test('a first flight gets the default environment, and every option where it starts', () => {
    const defaults = defaultSettings();
    assert.equal(defaults.environment, DEFAULT_ENVIRONMENT_ID);
    for (const option of SETTINGS_OPTIONS) {
        assert.equal(defaults[option.id], option.default, `${option.id} should start on its own default`);
        assert.ok(isOptionValue(option.id, option.default), `${option.id} should start on a setting it can hold`);
    }

    const state = createSettingsState(null);
    assert.equal(currentEnvironment(state), DEFAULT_ENVIRONMENT_ID);
    assert.equal(currentOption(state, SENSITIVITY_OPTION), 1, 'the controls start where they were tuned');
    assert.equal(currentOption(state, FOG_OPTION), 1, 'the world starts at the density it is drawn at');
});

test('the instrument scales are ones the instruments can be read on', () => {
    assert.ok(SPEED_UNITS[defaultSettings()[SPEED_UNIT_OPTION]], 'the airspeed scale should be a scale');
    assert.ok(ALTITUDE_UNITS[defaultSettings()[ALTITUDE_UNIT_OPTION]], 'the altitude scale should be a scale');

    for (const id of [SPEED_UNIT_OPTION, ALTITUDE_UNIT_OPTION]) {
        const scales = id === SPEED_UNIT_OPTION ? SPEED_UNITS : ALTITUDE_UNITS;
        for (const entry of settingsOption(id).values) {
            assert.ok(scales[entry.value], `${entry.value} is offered but is not a scale js/units.js knows`);
        }
    }
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

test('the panel lists every environment, then every option, then the way out', () => {
    const entries = settingsEntries();
    assert.equal(entries.length, ENVIRONMENTS.length + SETTINGS_OPTIONS.length + 1);

    assert.deepEqual(
        entries.filter(entry => entry.kind === ENVIRONMENT_ENTRY).map(entry => entry.id),
        ENVIRONMENTS.map(environment => environment.id)
    );
    assert.deepEqual(
        entries.filter(entry => entry.kind === OPTION_ENTRY).map(entry => entry.id),
        SETTINGS_OPTIONS.map(option => option.id)
    );

    assert.equal(entries.at(-1).id, SETTINGS_BACK_ID);
    assert.equal(entries.at(-1).kind, BACK_ENTRY);
    for (const entry of entries) {
        assert.ok(entry.label.length > 0, `${entry.id} needs a label to be read by`);
    }
});

test('an option reads as the setting it is on, and a world reads as its own name', () => {
    const state = createSettingsState(null);
    const option = state.entries.find(entry => entry.id === SENSITIVITY_OPTION);
    const world  = state.entries.find(entry => entry.kind === ENVIRONMENT_ENTRY);

    assert.ok(option.text.includes(option.label), 'the option should still say what it sets');
    assert.ok(option.text.includes(optionValueLabel(SENSITIVITY_OPTION, option.value)),
        'and what it is currently set to');
    assert.equal(optionEntryText(world), world.label, 'a world is chosen rather than stepped');
});

test('an option steps through its settings and wraps round both ends', () => {
    const values = settingsOption(FOG_OPTION).values.map(entry => entry.value);

    assert.equal(cycleOptionValue(FOG_OPTION, values[0], 1), values[1]);
    assert.equal(cycleOptionValue(FOG_OPTION, values.at(-1), 1), values[0], 'past the last is the first');
    assert.equal(cycleOptionValue(FOG_OPTION, values[0], -1), values.at(-1), 'before the first is the last');
    assert.equal(cycleOptionValue(FOG_OPTION, 'a setting it has never held', 1), values[0]);
    assert.equal(cycleOptionValue('an-option-that-does-not-exist', 7, 1), 7, 'and nothing else moves');
});

test('the arrow keys walk an option in both directions and remember where it landed', () => {
    const storage = fakeStorage();
    const state = createSettingsState(storage);
    const values = settingsOption(SENSITIVITY_OPTION).values.map(entry => entry.value);
    const start = values.indexOf(currentOption(state, SENSITIVITY_OPTION));

    assert.equal(adjustSetting(state, SENSITIVITY_OPTION, 1), SENSITIVITY_OPTION);
    assert.equal(currentOption(state, SENSITIVITY_OPTION), values[start + 1]);

    assert.equal(adjustSetting(state, SENSITIVITY_OPTION, -1), SENSITIVITY_OPTION);
    assert.equal(currentOption(state, SENSITIVITY_OPTION), values[start]);

    adjustSetting(state, SENSITIVITY_OPTION, 1);
    assert.equal(currentOption(createSettingsState(storage), SENSITIVITY_OPTION), values[start + 1],
        'a setting the panel changed should outlive the session that changed it');
});

test('a step that is no step, on a thing that is not an option, changes nothing', () => {
    const state = createSettingsState(null);
    assert.equal(adjustSetting(state, SENSITIVITY_OPTION, 0), null, 'a step of nowhere is not a change');
    assert.equal(adjustSetting(state, DEFAULT_ENVIRONMENT_ID, 1), null, 'a world is chosen rather than stepped');
    assert.equal(adjustSetting(state, SETTINGS_BACK_ID, 1), null);
    assert.deepEqual(state.values, defaultSettings());
});

test('choosing an option is the same as stepping it forward', () => {
    const state = createSettingsState(null);
    const values = settingsOption(FOG_OPTION).values.map(entry => entry.value);
    const start = values.indexOf(currentOption(state, FOG_OPTION));

    assert.equal(chooseSetting(state, FOG_OPTION), FOG_OPTION);
    assert.equal(currentOption(state, FOG_OPTION), values[(start + 1) % values.length]);
    assert.equal(settingsShowing(state), false, 'and it does not close the panel on the way');
});

test('the list redraws itself from the choices behind it', () => {
    const state = createSettingsState(null);
    const entry = () => state.entries.find(item => item.id === ALTITUDE_UNIT_OPTION);

    adjustSetting(state, ALTITUDE_UNIT_OPTION, 1);
    assert.equal(entry().value, currentOption(state, ALTITUDE_UNIT_OPTION));
    assert.equal(entry().valueLabel, optionValueLabel(ALTITUDE_UNIT_OPTION, entry().value));
    assert.ok(entry().text.includes(entry().valueLabel), 'the row should say what the option now reads');
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

test('the panel has a key of its own, and it is not one anything else answers to', () => {
    for (const code of SETTINGS_OPEN_KEYS) {
        assert.equal(isSettingsOpenKey(code), true);
        assert.equal(isSettingsCloseKey(code), false, 'the way in should not also be a way out by accident');
    }
    for (const code of ['KeyP', 'KeyH', 'KeyM', 'Tab', 'KeyR', 'KeyC']) {
        assert.equal(isSettingsOpenKey(code), false, `${code} already belongs to something else`);
    }
});

test('an option setting this version has never heard of reads as the default', () => {
    const storage = fakeStorage({
        [SETTINGS_STORAGE_KEY]: JSON.stringify({
            environment: DEFAULT_ENVIRONMENT_ID,
            [SENSITIVITY_OPTION]: 99,
            [FOG_OPTION]: 'PEA SOUP',
            [SPEED_UNIT_OPTION]: 'furlongs per fortnight',
            [ALTITUDE_UNIT_OPTION]: 'meters'
        })
    });

    const settings = readSettings(storage);
    assert.equal(settings[SENSITIVITY_OPTION], defaultSettings()[SENSITIVITY_OPTION]);
    assert.equal(settings[FOG_OPTION], defaultSettings()[FOG_OPTION]);
    assert.equal(settings[SPEED_UNIT_OPTION], defaultSettings()[SPEED_UNIT_OPTION]);
    assert.equal(settings[ALTITUDE_UNIT_OPTION], 'meters',
        'one setting it cannot read should not cost the others their memory');
});

// --- The start state -------------------------------------------------------

test('the panel offers every field of the start state, and offers it as declared', () => {
    assert.deepEqual(START_OPTIONS.map(option => option.id), START_FIELD_IDS);
    for (const option of START_OPTIONS) {
        assert.equal(option.group, START_GROUP, `${option.id} belongs under the start heading`);
        assert.deepEqual(
            option.default,
            START_FIELDS.find(field => field.id === option.id).default,
            `${option.id} should be offered on the value js/config.js declares`
        );
    }
});

test('the cursor walks the start state first, then the rest, as one list', () => {
    assert.deepEqual(SETTINGS_OPTIONS, [...START_OPTIONS, ...FLIGHT_OPTIONS]);
    for (const option of FLIGHT_OPTIONS) {
        assert.equal(option.group, OPTION_GROUP, `${option.id} belongs under the options heading`);
    }
});

test('a first flight opens on the configured start, and says so in the list', () => {
    const state = createSettingsState(null);
    assert.deepEqual(startSettings(state), startDefaults());

    const entry = state.entries.find(item => item.id === 'airspeedKnots');
    assert.equal(entry.group, START_GROUP);
    assert.ok(entry.text.includes('80 KTS'), 'the row should read the airspeed with its scale');
});

test('a range reads as a number and a list reads as a label', () => {
    assert.equal(isRangeOption(settingsOption('airspeedKnots')), true);
    assert.equal(isRangeOption(settingsOption('cameraMode')), false);
    assert.equal(isRangeOption(settingsOption(FOG_OPTION)), false);
    assert.equal(isRangeOption(null), false);
});

// A reading is punctuated the way an instrument punctuates it: three digits on
// the card, a sign on a climb, and the units hard against a percentage.
test('a reading is written the way its instrument writes it', () => {
    assert.equal(optionValueLabel('headingDegrees', 0), '000 DEG');
    assert.equal(optionValueLabel('headingDegrees', 45), '045 DEG');
    assert.equal(optionValueLabel('verticalSpeedFpm', 1260), '+1260 FT/MIN');
    assert.equal(optionValueLabel('verticalSpeedFpm', 0), '0 FT/MIN');
    assert.equal(optionValueLabel('verticalSpeedFpm', -500), '-500 FT/MIN');
    assert.equal(optionValueLabel('throttlePercent', 20), '20%');
    assert.equal(optionValueLabel('altitudeFeet', 1390), '1390 FT');
    assert.equal(optionValueLabel('cameraMode', 'ORBIT'), 'ORBIT');
    assert.equal(optionValueLabel('airspeedKnots', 'quite fast'), '', 'and nothing else reads at all');
});

test('a range steps by its own step in both directions', () => {
    const option = settingsOption('airspeedKnots');
    assert.equal(cycleOptionValue('airspeedKnots', 80, 1), 80 + option.step);
    assert.equal(cycleOptionValue('airspeedKnots', 80, -1), 80 - option.step);
    assert.equal(cycleOptionValue('airspeedKnots', 'a speed it has never held', 1),
        option.default + option.step, 'a value from nowhere starts from the configured one');
});

// A list wraps because its ends mean nothing; a range stops because its ends
// mean something. Past the fastest a flight can open at is not the slowest.
test('a range stops at its ends rather than wrapping round them', () => {
    const option = settingsOption('airspeedKnots');
    assert.equal(cycleOptionValue('airspeedKnots', option.max, 1), option.max);
    assert.equal(cycleOptionValue('airspeedKnots', option.min, -1), option.min);
});

test('a start field the panel steps is remembered for the next session', () => {
    const storage = fakeStorage();
    const state = createSettingsState(storage);
    const step = settingsOption('altitudeFeet').step;
    const start = currentOption(state, 'altitudeFeet');

    assert.equal(adjustSetting(state, 'altitudeFeet', 1), 'altitudeFeet');
    assert.equal(currentOption(state, 'altitudeFeet'), start + step);
    assert.equal(currentOption(createSettingsState(storage), 'altitudeFeet'), start + step,
        'a start edited before launch should outlive the session that edited it');
});

test('a step that would leave the range is not a change at all', () => {
    const state = createSettingsState(null);
    state.values.throttlePercent = settingsOption('throttlePercent').max;
    assert.equal(adjustSetting(state, 'throttlePercent', 1), null);
    assert.equal(currentOption(state, 'throttlePercent'), settingsOption('throttlePercent').max);
});

test('a stored start this version cannot read reads as the configured one', () => {
    const storage = fakeStorage({
        [SETTINGS_STORAGE_KEY]: JSON.stringify({
            environment: DEFAULT_ENVIRONMENT_ID,
            airspeedKnots: 120,
            altitudeFeet: 82,
            headingDegrees: 400,
            cameraMode: 'PERISCOPE'
        })
    });

    const settings = readSettings(storage);
    assert.equal(settings.airspeedKnots, 120, 'a value it can read is kept');
    assert.equal(settings.altitudeFeet, startDefaults().altitudeFeet, 'one between two steps is not');
    assert.equal(settings.headingDegrees, startDefaults().headingDegrees, 'nor one off the card');
    assert.equal(settings.cameraMode, startDefaults().cameraMode, 'nor a view there is no camera for');
});

test('the start the panel hands over is a start and nothing else', () => {
    const state = createSettingsState(null);
    adjustSetting(state, 'airspeedKnots', 1);

    const start = startSettings(state);
    assert.deepEqual(Object.keys(start), START_FIELD_IDS);
    assert.equal(start.airspeedKnots, currentOption(state, 'airspeedKnots'));
    assert.equal(start.environment, undefined, 'the world is not part of the start state');
    assert.equal(start[FOG_OPTION], undefined);
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
