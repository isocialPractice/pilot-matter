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
    CHOICE_ENTRY,
    TOGGLE_ENTRY,
    BACK_ENTRY,
    START_GROUP,
    OPTION_GROUP,
    TOGGLE_ON_MARK,
    TOGGLE_OFF_MARK,
    choiceEntryId,
    settingsEntry,
    isToggleLocked,
    isRangeOption,
    startSettings,
    SENSITIVITY_OPTION,
    ORBIT_RATE_OPTION,
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
    isSettingsOpenKey,
    isTypedSettingRow,
    typedSettingRow,
    typedSettingText,
    optionRangeNotice,
    beginTypedSetting,
    cancelTypedSetting,
    applyTypedSettingKey
} from '../js/settings.js';
import { TYPED_CARET, TYPED_MAX, typedValueLabel } from '../js/typed-value.js';
import { isMenuControlKey } from '../js/menu.js';
import { ENVIRONMENTS, DEFAULT_ENVIRONMENT_ID } from '../js/environment/presets.js';
import { SPEED_UNITS, ALTITUDE_UNITS } from '../js/units.js';
import {
    START_FIELDS, START_FIELD_IDS, START_MODES, START_FLYING, START_TAKEOFF, startDefaults
} from '../js/config.js';

const FLYING_ENTRY  = choiceEntryId('startMode', START_FLYING);
const TAKEOFF_ENTRY = choiceEntryId('startMode', START_TAKEOFF);

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

    assert.deepEqual(
        entries.filter(entry => entry.kind === ENVIRONMENT_ENTRY).map(entry => entry.id),
        ENVIRONMENTS.map(environment => environment.id)
    );

    // Most options are one row apiece. A choice is one row per condition, which
    // is why the rows are counted back to the options rather than the other way.
    assert.deepEqual(
        [...new Set(entries
            .filter(entry => entry.kind !== ENVIRONMENT_ENTRY && entry.kind !== BACK_ENTRY)
            .map(entry => entry.option ?? entry.id))],
        SETTINGS_OPTIONS.map(option => option.id)
    );
    assert.deepEqual(
        entries.filter(entry => entry.kind === OPTION_ENTRY).map(entry => entry.id),
        SETTINGS_OPTIONS.filter(option => !option.kind).map(option => option.id)
    );

    assert.equal(entries.at(-1).id, SETTINGS_BACK_ID);
    assert.equal(entries.at(-1).kind, BACK_ENTRY);
    assert.equal(new Set(entries.map(entry => entry.id)).size, entries.length,
        'two rows answering to one id is one row too many');
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

/**
 * Unless the choice knows which way it meant. A row is drawn with a mark either
 * side of its reading, so it reads as a control with a down at one end and an
 * up at the other - and a click on the left of it used to raise the value, in
 * this panel and the element editor at once.
 */
test('a choice that knows which way it went steps the option that way', () => {
    const state = createSettingsState(null);
    const values = settingsOption(FOG_OPTION).values.map(entry => entry.value);
    const start = values.indexOf(currentOption(state, FOG_OPTION));

    assert.equal(chooseSetting(state, FOG_OPTION, -1), FOG_OPTION);
    assert.equal(currentOption(state, FOG_OPTION),
        values[(start - 1 + values.length) % values.length],
        'the left of the row steps it back');

    chooseSetting(state, FOG_OPTION, 1);
    assert.equal(currentOption(state, FOG_OPTION), values[start], 'and the right steps it on');
});

test('a choice that knows nothing about halves of a row steps it on', () => {
    const state = createSettingsState(null);
    const values = settingsOption(FOG_OPTION).values.map(entry => entry.value);
    const start = values.indexOf(currentOption(state, FOG_OPTION));

    chooseSetting(state, FOG_OPTION);
    assert.equal(currentOption(state, FOG_OPTION), values[(start + 1) % values.length]);
});

// --- The orbit sweep -------------------------------------------------------

/**
 * The rate the orbit camera circles at was a constant in the camera code, which
 * left a sweep too fast to read the world from and nowhere for a pilot to say
 * so. It is an option beside the other camera settings now, so the new default
 * is a starting point rather than a second hardcoded number.
 */
test('the orbit sweep is a setting a pilot holds', () => {
    const option = settingsOption(ORBIT_RATE_OPTION);
    assert.ok(option, 'the panel should offer the sweep');
    assert.equal(option.group, OPTION_GROUP, 'among the settings that hold whichever world is flown');
    assert.ok(option.values.length > 1, 'with something to step between');
    assert.ok(option.values.some(entry => entry.value === option.default),
        'and a default that is one of them');
});

test('the sweep is remembered between flights like every other setting', () => {
    const storage = new Map();
    const store = {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, value)
    };

    const state = createSettingsState(store);
    const option = settingsOption(ORBIT_RATE_OPTION);
    const wanted = option.values.find(entry => entry.value !== option.default).value;

    adjustSetting(state, ORBIT_RATE_OPTION,
        option.values.findIndex(entry => entry.value === wanted)
        - option.values.findIndex(entry => entry.value === option.default));

    assert.equal(currentOption(state, ORBIT_RATE_OPTION), wanted);
    assert.equal(readSettings(store)[ORBIT_RATE_OPTION], wanted);
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
    const marked = () => state.entries
        .filter(entry => entry.kind === ENVIRONMENT_ENTRY && entry.current)
        .map(entry => entry.id);

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

// --- The condition a flight opens in ---------------------------------------

test('the condition a flight opens in is a row per condition, only one in force', () => {
    const state = createSettingsState(null);
    const rows = state.entries.filter(entry => entry.kind === CHOICE_ENTRY);

    assert.deepEqual(rows.map(entry => entry.value), START_MODES.map(mode => mode.value));
    for (const row of rows) {
        assert.equal(row.option, 'startMode', 'every row of a choice sets the same field');
        assert.equal(row.group, START_GROUP, 'and belongs under the start heading');
        assert.equal(row.text, row.label, 'a condition is chosen rather than stepped');
    }

    assert.deepEqual(rows.filter(entry => entry.current).map(entry => entry.value), [START_FLYING]);
});

test('choosing a condition clears whichever was in force', () => {
    const state = createSettingsState(null);
    const marked = () => state.entries
        .filter(entry => entry.kind === CHOICE_ENTRY && entry.current)
        .map(entry => entry.value);

    assert.equal(chooseSetting(state, TAKEOFF_ENTRY), 'startMode');
    assert.equal(currentOption(state, 'startMode'), START_TAKEOFF);
    assert.deepEqual(marked(), [START_TAKEOFF], 'a mark on two rows is a mark on neither');

    assert.equal(chooseSetting(state, TAKEOFF_ENTRY), null, 'the condition already set is not a change');
    assert.equal(chooseSetting(state, FLYING_ENTRY), 'startMode');
    assert.deepEqual(marked(), [START_FLYING]);
});

test('the roll keys pick the condition under the cursor rather than stepping past it', () => {
    const state = createSettingsState(null);
    assert.equal(adjustSetting(state, TAKEOFF_ENTRY, 1), 'startMode');
    assert.equal(currentOption(state, 'startMode'), START_TAKEOFF);

    assert.equal(adjustSetting(state, TAKEOFF_ENTRY, -1), null, 'and stepping back off it goes nowhere');
    assert.equal(currentOption(state, 'startMode'), START_TAKEOFF);
});

test('the condition outlives the session that chose it', () => {
    const storage = fakeStorage();
    chooseSetting(createSettingsState(storage), TAKEOFF_ENTRY);
    assert.equal(currentOption(createSettingsState(storage), 'startMode'), START_TAKEOFF);
});

// --- The runway box --------------------------------------------------------

test('a toggle reads as the box it is, so its setting is legible unselected', () => {
    const state = createSettingsState(null);
    const box = () => settingsEntry(state, 'runway');

    assert.equal(box().kind, TOGGLE_ENTRY);
    assert.equal(box().group, START_GROUP);
    assert.ok(box().text.startsWith(TOGGLE_ON_MARK), 'a world starts with a strip in it');
    assert.ok(box().text.includes(box().label), 'and the row still says what it is');

    chooseSetting(state, 'runway');
    assert.equal(currentOption(state, 'runway'), false);
    assert.ok(box().text.startsWith(TOGGLE_OFF_MARK));
});

test('choosing the box and stepping it both turn it over', () => {
    const state = createSettingsState(null);

    assert.equal(adjustSetting(state, 'runway', 1), 'runway');
    assert.equal(currentOption(state, 'runway'), false);
    assert.equal(chooseSetting(state, 'runway'), 'runway');
    assert.equal(currentOption(state, 'runway'), true);
});

test('a runway takeoff holds the box on, and the pilot cannot turn it off', () => {
    const state = createSettingsState(null);
    chooseSetting(state, 'runway');
    assert.equal(currentOption(state, 'runway'), false);

    chooseSetting(state, TAKEOFF_ENTRY);
    const box = settingsEntry(state, 'runway');
    assert.equal(box.locked, true, 'the start that needs a strip owns the box');
    assert.equal(box.value, true, 'and the box says what the world is going to be');
    assert.ok(box.text.startsWith(TOGGLE_ON_MARK));

    assert.equal(chooseSetting(state, 'runway'), null, 'pressing it changes nothing');
    assert.equal(adjustSetting(state, 'runway', 1), null);
    assert.equal(startSettings(state).runway, true, 'and the start handed over carries the strip');
});

test('the box comes back the moment the start stops needing it', () => {
    const state = createSettingsState(null);
    chooseSetting(state, 'runway');
    chooseSetting(state, TAKEOFF_ENTRY);
    chooseSetting(state, FLYING_ENTRY);

    const box = settingsEntry(state, 'runway');
    assert.equal(box.locked, false);
    assert.equal(box.value, false, 'and it remembers what the pilot had left it on');
    assert.equal(chooseSetting(state, 'runway'), 'runway');
});

test('only the runway box is ever held by something other than the pilot', () => {
    const takeoff = { startMode: START_TAKEOFF };
    assert.equal(isToggleLocked('runway', takeoff), true);
    assert.equal(isToggleLocked('runway', { startMode: START_FLYING }), false);
    assert.equal(isToggleLocked('somethingElse', takeoff), false);
});

test('the start the panel hands over still carries every field and nothing else', () => {
    const state = createSettingsState(null);
    chooseSetting(state, TAKEOFF_ENTRY);
    assert.deepEqual(Object.keys(startSettings(state)), START_FIELD_IDS);
    assert.equal(startSettings(state).startMode, START_TAKEOFF);
});

test('a row nothing answers to is a row nothing answers to', () => {
    const state = createSettingsState(null);
    assert.equal(settingsEntry(state, 'startMode:gliding'), null);
    assert.equal(chooseSetting(state, 'startMode:gliding'), null);
    assert.equal(adjustSetting(state, 'startMode:gliding', 1), null);
    assert.deepEqual(state.values, defaultSettings());
});

test('syncing the list is what marks it, so a reopened panel shows the pick', () => {
    const state = createSettingsState(null);
    state.values.environment = ENVIRONMENTS.at(-1).id;
    for (const entry of state.entries) entry.current = false;

    syncSettingsEntries(state);
    assert.deepEqual(
        state.entries
            .filter(entry => entry.kind === ENVIRONMENT_ENTRY && entry.current)
            .map(entry => entry.id),
        [ENVIRONMENTS.at(-1).id]
    );
});

// --- Typing a number into a row --------------------------------------------

/**
 * Every value in the panel is stepped by a key or a click, which is the right
 * way to offer a position on a dial and the wrong way to offer a figure the
 * pilot already knows: an altitude of 1390 feet is 139 presses from the ground
 * at ten feet a press.
 */
test('a row holding a number along a range can be typed into', () => {
    const state = createSettingsState(fakeStorage());

    for (const id of ['airspeedKnots', 'altitudeFeet', 'verticalSpeedFpm', 'headingDegrees']) {
        assert.equal(isTypedSettingRow(state, id), true, `${id} is a figure somebody knows`);
    }

    // A list offers positions rather than figures, and nobody has a number in
    // mind for CLEAR.
    for (const id of [FOG_OPTION, SENSITIVITY_OPTION, SPEED_UNIT_OPTION, 'cameraMode']) {
        assert.equal(isTypedSettingRow(state, id), false, `${id} is a position on a dial`);
    }

    assert.equal(isTypedSettingRow(state, 'runway'), false, 'a box is not a figure');
    assert.equal(isTypedSettingRow(state, FLYING_ENTRY), false, 'nor is one of a set of conditions');
    assert.equal(isTypedSettingRow(state, SETTINGS_BACK_ID), false);
    assert.equal(isTypedSettingRow(state, DEFAULT_ENVIRONMENT_ID), false);
    assert.equal(isTypedSettingRow(state, 'nothing-of-the-sort'), false);
});

test('a digit at such a row starts the figure it is the first character of', () => {
    const state = createSettingsState(fakeStorage());

    assert.equal(typedSettingRow(state), null, 'the panel opens typing nothing');
    assert.equal(beginTypedSetting(state, 'altitudeFeet', 'Digit1'), 'altitudeFeet');
    assert.equal(typedSettingRow(state), 'altitudeFeet');
    assert.equal(typedSettingText(state), '1');

    for (const code of ['Digit3', 'Digit9', 'Digit0']) {
        assert.equal(applyTypedSettingKey(state, code).result, 'typed');
    }
    assert.equal(typedSettingText(state), '1390');
});

test('a key that types nothing starts nothing, and nor does a row with no figure', () => {
    const state = createSettingsState(fakeStorage());

    assert.equal(beginTypedSetting(state, 'altitudeFeet', 'KeyW'), null);
    assert.equal(beginTypedSetting(state, 'altitudeFeet', 'Period'), null,
        'a point is a stray press on a panel being read rather than set');
    assert.equal(beginTypedSetting(state, FOG_OPTION, 'Digit1'), null);
    assert.equal(beginTypedSetting(state, SETTINGS_BACK_ID, 'Digit1'), null);
    assert.equal(typedSettingRow(state), null);
    assert.equal(applyTypedSettingKey(state, 'Digit1'), null, 'and nothing is being typed into');
});

test('the figure is written where committing it, and remembered like any other', () => {
    const storage = fakeStorage();
    const state = createSettingsState(storage);

    beginTypedSetting(state, 'altitudeFeet', 'Digit1');
    for (const code of ['Digit3', 'Digit9', 'Digit0']) applyTypedSettingKey(state, code);

    const committed = applyTypedSettingKey(state, 'Enter');
    assert.deepEqual(committed, { result: 'applied', option: 'altitudeFeet', value: 1390 });
    assert.equal(currentOption(state, 'altitudeFeet'), 1390);
    assert.equal(typedSettingRow(state), null, 'and the row stops taking characters');

    assert.equal(currentOption(createSettingsState(storage), 'altitudeFeet'), 1390,
        'a typed figure is stored the way a stepped one is, through the same place');
});

test('a descent is typed with the sign it is written with', () => {
    const state = createSettingsState(fakeStorage());

    assert.equal(beginTypedSetting(state, 'verticalSpeedFpm', 'Minus'), 'verticalSpeedFpm');
    for (const code of ['Digit5', 'Digit0', 'Digit0']) applyTypedSettingKey(state, code);

    assert.equal(applyTypedSettingKey(state, 'NumpadEnter').result, 'applied');
    assert.equal(currentOption(state, 'verticalSpeedFpm'), -500);
});

/**
 * The typed route and the stepped one are held to one validator, so a figure
 * typed in where a stepped one would be refused cannot happen - that would be
 * the panel disagreeing with itself about what a range is.
 */
test('a figure the stepper would not reach is refused, and the row says what is allowed', () => {
    const state = createSettingsState(fakeStorage());
    const was = currentOption(state, 'airspeedKnots');

    // 83 knots is inside the range and between two of its steps, which is the
    // case only a typed figure can produce.
    beginTypedSetting(state, 'airspeedKnots', 'Digit8');
    applyTypedSettingKey(state, 'Digit3');

    const refused = applyTypedSettingKey(state, 'Enter');
    assert.deepEqual(refused, { result: 'refused', option: 'airspeedKnots', value: 83 });
    assert.equal(currentOption(state, 'airspeedKnots'), was, 'nothing is written');
    assert.equal(typedSettingRow(state), 'airspeedKnots',
        'and the row goes on taking characters, so the next press carries on from what is there');

    const row = settingsEntry(state, 'airspeedKnots');
    assert.equal(row.valueLabel, optionRangeNotice('airspeedKnots'));
    assert.ok(row.valueLabel.includes('BY 5'),
        `the range is only half of what is allowed - the row reads "${row.valueLabel}"`);
    assert.ok(row.valueLabel.includes('200'), 'and the far end of it is named too');

    // Erasing the 3 and committing the 80 is a figure the stepper reaches.
    assert.equal(applyTypedSettingKey(state, 'Backspace').result, 'erased');
    assert.equal(typedSettingText(state), '8');
    applyTypedSettingKey(state, 'Digit0');
    assert.equal(applyTypedSettingKey(state, 'Enter').result, 'applied');
    assert.equal(currentOption(state, 'airspeedKnots'), 80);
});

test('a figure past the end of the range is refused the same way', () => {
    const state = createSettingsState(fakeStorage());
    const was = currentOption(state, 'throttlePercent');

    beginTypedSetting(state, 'throttlePercent', 'Digit5');
    applyTypedSettingKey(state, 'Digit0');
    applyTypedSettingKey(state, 'Digit0');

    assert.equal(applyTypedSettingKey(state, 'Enter').result, 'refused');
    assert.equal(currentOption(state, 'throttlePercent'), was);
});

test('a figure nobody finished is refused rather than read as nothing', () => {
    const state = createSettingsState(fakeStorage());
    const was = currentOption(state, 'altitudeFeet');

    beginTypedSetting(state, 'altitudeFeet', 'Minus');
    const refused = applyTypedSettingKey(state, 'Enter');
    assert.deepEqual(refused, { result: 'refused', option: 'altitudeFeet', value: null });
    assert.equal(currentOption(state, 'altitudeFeet'), was,
        'a sign on its own is a figure half written, not a request for zero');
});

test('giving up leaves the row on the value it already had', () => {
    const state = createSettingsState(fakeStorage());
    const was = currentOption(state, 'altitudeFeet');

    beginTypedSetting(state, 'altitudeFeet', 'Digit5');
    assert.deepEqual(applyTypedSettingKey(state, 'Escape'),
        { result: 'cancelled', option: 'altitudeFeet', value: null });

    assert.equal(typedSettingRow(state), null);
    assert.equal(currentOption(state, 'altitudeFeet'), was);
    assert.equal(cancelTypedSetting(state), null, 'and giving up twice gives up on nothing');
});

/**
 * And it leaves the whole panel reading as it did, which is what makes giving
 * up the right answer to the cursor walking off a row mid-figure: a caret left
 * behind says a row is taking characters that the highlight is nowhere near.
 */
test('and no row anywhere on the panel is left reading a caret', () => {
    const state = createSettingsState(fakeStorage());
    const before = state.entries.map(entry => entry.text);

    beginTypedSetting(state, 'altitudeFeet', 'Digit2');
    assert.equal(cancelTypedSetting(state), 'altitudeFeet');

    for (const [at, entry] of state.entries.entries()) {
        assert.equal(entry.text, before[at], `${entry.id} reads as it did before the figure`);
        assert.ok(!entry.typing, `${entry.id} is not being typed into`);
        assert.ok(!entry.text.includes(TYPED_CARET), `${entry.id} holds no caret`);
    }
});

/**
 * A key the figure has no use for is handed back, which is what keeps the cursor
 * able to walk off a row mid-figure: the panel reads that key as it always did.
 */
test('a key the figure has no use for is handed back to the panel', () => {
    const state = createSettingsState(fakeStorage());
    beginTypedSetting(state, 'altitudeFeet', 'Digit5');

    for (const code of ['KeyW', 'KeyS', 'ArrowUp', 'ArrowLeft', 'Space']) {
        assert.equal(applyTypedSettingKey(state, code), null, `${code} belongs to the panel`);
    }
    assert.equal(typedSettingText(state), '5', 'and none of them disturbed the figure');
});

/**
 * And a key neither the figure nor the panel claims leaves it alone, which is
 * the half the test above cannot show on its own: every key it presses is one
 * the panel works with, and those are exactly the keys the handler does give a
 * figure up for. A key no branch claims - yaw, the throttle, reset - has to
 * fall past all of them with the figure still in hand.
 *
 * Read in the order js/main.js reads the press, because the order is what the
 * behaviour rests on: the figure answers first and comes back null, the row
 * already being typed into is what stops a fresh figure beginning on that
 * nothing, and the giving up is reached only where the key is one the panel
 * works with. Giving up on a key outside that last branch is a figure thrown
 * away for every key at all, with nothing on the row to say it went - so the
 * digit after the press is what the assertion turns on. One that reads `3`
 * rather than `23` started afresh.
 */
test('a key neither the figure nor the panel claims leaves the figure in hand', () => {
    const state = createSettingsState(fakeStorage());

    for (const code of ['KeyQ', 'KeyE', 'KeyR', 'ShiftLeft', 'ControlLeft']) {
        assert.equal(isMenuControlKey(code), false,
            `${code} should not be a key the panel works with`);
        assert.ok(!SETTINGS_CLOSE_KEYS.includes(code), `${code} should not be the way out either`);

        beginTypedSetting(state, 'altitudeFeet', 'Digit2');
        assert.equal(applyTypedSettingKey(state, code), null,
            `${code} should not be the figure's to take`);
        assert.equal(typedSettingRow(state), 'altitudeFeet',
            `${code} should leave the row being typed into, so no fresh figure begins`);

        // The branch the handler reaches next, written as the handler writes it:
        // on a key like this it does not run at all.
        if (isMenuControlKey(code)) cancelTypedSetting(state);

        assert.equal(typedSettingText(state), '2', `${code} should leave the figure where it was`);
        applyTypedSettingKey(state, 'Digit3');
        assert.equal(typedSettingText(state), '23',
            `the digit after ${code} should carry on rather than start a fresh figure`);
        cancelTypedSetting(state);
    }
});

/**
 * A press the figure has no room for is refused, and refusing it leaves the
 * text as it was: the three digits already typed are what the row still holds.
 *
 * The press comes back as nothing, which is the same answer a menu key gets -
 * so the caller reads it however it would have otherwise, and must not read it
 * as the first character of a fresh figure. A minus is the key beside 0 and
 * under the thumb on a numpad, so catching it on the way to the last digit is
 * an ordinary slip, and the slip cost three digits with nothing on the row to
 * say they had gone.
 */
test('a press the figure cannot take leaves what is already typed where it was', () => {
    const state = createSettingsState(fakeStorage());

    beginTypedSetting(state, 'altitudeFeet', 'Digit1');
    for (const code of ['Digit3', 'Digit9']) applyTypedSettingKey(state, code);
    assert.equal(typedSettingText(state), '139');

    for (const code of ['Minus', 'NumpadSubtract']) {
        assert.equal(applyTypedSettingKey(state, code), null,
            `a ${code} part way along is not the figure's to take`);
        assert.equal(typedSettingText(state), '139', 'and the digits already typed are still there');
        assert.equal(typedSettingRow(state), 'altitudeFeet', 'on the row they were typed into');
    }
});

test('and a character past the ceiling leaves the ones under it', () => {
    const state = createSettingsState(fakeStorage());

    beginTypedSetting(state, 'altitudeFeet', 'Digit1');
    for (const code of ['Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8']) {
        applyTypedSettingKey(state, code);
    }
    assert.equal(typedSettingText(state).length, TYPED_MAX, 'the row is full');

    assert.equal(applyTypedSettingKey(state, 'Digit9'), null, 'so a ninth is not the figure\'s to take');
    assert.equal(typedSettingText(state), '12345678', 'and the eight it holds are untouched');
});

// --- How a row being typed into reads --------------------------------------

/**
 * The marks either side of a reading say the row is stepped. A caret inside them
 * would read as a value the row is on, so they come off for as long as the
 * typing is in hand.
 */
test('a row being typed into reads the figure rather than a value between step marks', () => {
    const state = createSettingsState(fakeStorage());
    const stepped = settingsEntry(state, 'altitudeFeet').text;

    beginTypedSetting(state, 'altitudeFeet', 'Digit1');
    const row = settingsEntry(state, 'altitudeFeet');

    assert.equal(row.typing, true);
    assert.equal(row.valueLabel, typedValueLabel('1'));
    assert.ok(row.text.includes(TYPED_CARET), 'the row says it is taking more characters');
    assert.ok(!row.text.includes(TOGGLE_ON_MARK));
    assert.notEqual(row.text, stepped);
    assert.equal(optionEntryText(row), row.text);

    applyTypedSettingKey(state, 'Escape');
    assert.equal(settingsEntry(state, 'altitudeFeet').typing, false);
    assert.equal(settingsEntry(state, 'altitudeFeet').text, stepped,
        'and the row reads exactly as it did once the typing is given up on');
});

test('every other row reads as it always did while one is being typed into', () => {
    const state = createSettingsState(fakeStorage());
    const before = state.entries.map(entry => entry.text);

    beginTypedSetting(state, 'altitudeFeet', 'Digit1');

    for (const [at, entry] of state.entries.entries()) {
        if (entry.id === 'altitudeFeet') continue;
        assert.equal(entry.text, before[at], `${entry.id} is not the row being typed into`);
    }
});

/**
 * A panel that opened half way through a figure would read the first digit
 * pressed at it as the rest of one.
 */
test('opening or closing the panel is giving up on whatever was being typed', () => {
    const state = createSettingsState(fakeStorage());

    beginTypedSetting(state, 'altitudeFeet', 'Digit1');
    closeSettings(state);
    assert.equal(typedSettingRow(state), null);

    beginTypedSetting(state, 'altitudeFeet', 'Digit1');
    openSettings(state);
    assert.equal(typedSettingRow(state), null);
});

test('the range a refusal names is written the way the row writes a value', () => {
    assert.equal(optionRangeNotice('headingDegrees'), '000 DEG TO 355 DEG BY 5',
        'a heading is padded and carries its units on both ends of the sentence');
    assert.equal(optionRangeNotice('verticalSpeedFpm'), '-2000 FT/MIN TO +3000 FT/MIN BY 20',
        'and a signed figure reads signed');

    for (const id of [FOG_OPTION, 'runway', 'cameraMode', 'nothing-of-the-sort']) {
        assert.equal(optionRangeNotice(id), '', `${id} holds no range to be refused against`);
    }
});
