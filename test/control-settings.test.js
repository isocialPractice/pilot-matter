import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
    CONTROL_SETTINGS_STORAGE_KEY,
    CONTROL_SETTINGS_TITLE,
    CONTROL_AXES_HEADING,
    CONTROL_ATTITUDE_HEADING,
    CONTROL_REFERENCE_HEADING,
    CONTROL_REFERENCE_ID,
    CONTROL_REFERENCE_LABEL,
    CONTROL_SETTINGS_BACK_ID,
    CONTROL_SETTINGS_BACK_LABEL,
    CONTROL_SETTINGS_CLOSE_KEYS,
    CONTROL_OPTIONS,
    CONTROL_OPTION_IDS,
    PITCH_AXIS_OPTION,
    ROLL_AXIS_OPTION,
    FULL_ROTATION_OPTION,
    AXIS_OPTIONS,
    AXIS_GROUP,
    ATTITUDE_GROUP,
    REFERENCE_GROUP,
    LIST_ENTRY,
    isControlSettingsCloseKey,
    controlOption,
    defaultControlSettings,
    readControlSettings,
    writeControlSettings,
    controlSettingsEntries,
    createControlSettingsState,
    syncControlSettingsEntries,
    controlSettingsShowing,
    openControlSettings,
    closeControlSettings,
    currentControlOption,
    controlAxes,
    fullRotationWanted,
    controlSettingsEntry,
    adjustControlSetting,
    chooseControlSetting
} from '../js/control-settings.js';
import {
    OPTION_ENTRY, TOGGLE_ENTRY, BACK_ENTRY,
    TOGGLE_ON_MARK, TOGGLE_OFF_MARK, OPTION_LEFT_MARK, OPTION_RIGHT_MARK
} from '../js/settings.js';
import { AXIS_DIRECTIONAL, AXIS_INVERTED, AXIS_NAMES, DEFAULT_AXES } from '../js/input-map.js';
import { START_MENU_ENTRIES, PAUSE_MENU_ENTRIES } from '../js/menu.js';

// js/main.js imports Three.js, so what it does with the panel is read off its
// source rather than by opening one.
const mainSource = readFileSync(
    fileURLToPath(new URL('../js/main.js', import.meta.url)),
    'utf8'
);

// A storage that remembers, for the panel to write its choices into.
function fakeStorage(initial = {}) {
    const held = { ...initial };
    return {
        held,
        getItem: (key) => (key in held ? held[key] : null),
        setItem: (key, value) => { held[key] = String(value); }
    };
}

test('the panel is titled, and names each thing it sets', () => {
    assert.equal(CONTROL_SETTINGS_TITLE, 'CONTROL SETTINGS');
    for (const heading of [CONTROL_AXES_HEADING, CONTROL_ATTITUDE_HEADING, CONTROL_REFERENCE_HEADING]) {
        assert.ok(heading.length > 0, 'every section of the panel should carry a heading');
    }
    assert.equal(new Set([CONTROL_AXES_HEADING, CONTROL_ATTITUDE_HEADING, CONTROL_REFERENCE_HEADING]).size, 3,
        'two sections under one heading is one section');
});

// The panel remembers under a key of its own rather than inside the settings
// panel's: how a pilot flies outlives which world they were flying.
test('the panel remembers its choices somewhere of its own', () => {
    assert.ok(CONTROL_SETTINGS_STORAGE_KEY.startsWith('pilot-matter.'));
    assert.notEqual(CONTROL_SETTINGS_STORAGE_KEY, 'pilot-matter.settings');
});

test('every option answers to an id, and no two answer to one', () => {
    assert.deepEqual(CONTROL_OPTION_IDS, [PITCH_AXIS_OPTION, ROLL_AXIS_OPTION, FULL_ROTATION_OPTION]);
    assert.equal(new Set(CONTROL_OPTION_IDS).size, CONTROL_OPTION_IDS.length);

    for (const id of CONTROL_OPTION_IDS) {
        const option = controlOption(id);
        assert.ok(option, `${id} should be an option the panel holds`);
        assert.ok(option.label.length > 0, `${id} needs a label to be read by`);
        assert.ok(option.note.length > 0, `${id} should say what it changes`);
        assert.ok(Array.isArray(option.values) && option.values.length >= 2,
            `${id} should offer the settings it can be left on`);
    }

    assert.equal(controlOption('nothing-of-the-sort'), null);
});

// The two axes and the attitude are different questions, so they are drawn under
// different headings while the cursor walks them as one list.
test('each option is drawn under the heading it belongs to', () => {
    assert.equal(controlOption(PITCH_AXIS_OPTION).group, AXIS_GROUP);
    assert.equal(controlOption(ROLL_AXIS_OPTION).group, AXIS_GROUP);
    assert.equal(controlOption(FULL_ROTATION_OPTION).group, ATTITUDE_GROUP);
});

/**
 * Both axes open directional and the attitude opens clamped. The clamp is the
 * thing that makes ordinary flight readable, so the pilot who wants a loop asks
 * for one and nobody else is handed it.
 */
test('the panel opens on the controls the simulator has always had', () => {
    const values = defaultControlSettings();
    assert.deepEqual(values, {
        [PITCH_AXIS_OPTION]: AXIS_DIRECTIONAL,
        [ROLL_AXIS_OPTION]:  AXIS_DIRECTIONAL,
        [FULL_ROTATION_OPTION]: false
    });

    const state = createControlSettingsState(null);
    assert.deepEqual(controlAxes(state), { ...DEFAULT_AXES });
    assert.equal(fullRotationWanted(state), false);
});

test('the panel lists every setting, the reference list, and the way out', () => {
    const entries = controlSettingsEntries();
    const ids = entries.map(entry => entry.id);

    assert.deepEqual(ids, [...CONTROL_OPTION_IDS, CONTROL_REFERENCE_ID, CONTROL_SETTINGS_BACK_ID]);
    assert.equal(new Set(ids).size, ids.length, 'two rows answering to one id is one row too many');

    assert.equal(entries.at(-2).kind, LIST_ENTRY);
    assert.equal(entries.at(-2).label, CONTROL_REFERENCE_LABEL);
    assert.equal(entries.at(-1).kind, BACK_ENTRY);
    assert.equal(entries.at(-1).label, CONTROL_SETTINGS_BACK_LABEL);
    for (const entry of entries.slice(-2)) {
        assert.equal(entry.group, REFERENCE_GROUP, 'both rows sit under the last heading');
    }
});

test('an axis is drawn as a stepped reading and the attitude as the box it is', () => {
    const state = createControlSettingsState(null);
    const text = (id) => controlSettingsEntry(state, id).text;

    assert.equal(controlSettingsEntry(state, PITCH_AXIS_OPTION).kind, OPTION_ENTRY);
    assert.equal(text(PITCH_AXIS_OPTION), `PITCH AXIS  ${OPTION_LEFT_MARK} DIRECTIONAL ${OPTION_RIGHT_MARK}`);
    assert.equal(text(ROLL_AXIS_OPTION), `ROLL AXIS  ${OPTION_LEFT_MARK} DIRECTIONAL ${OPTION_RIGHT_MARK}`);

    assert.equal(controlSettingsEntry(state, FULL_ROTATION_OPTION).kind, TOGGLE_ENTRY);
    assert.equal(text(FULL_ROTATION_OPTION), `${TOGGLE_OFF_MARK} FULL ROTATION`);

    // The rows that open something rather than hold a value read as themselves.
    assert.equal(text(CONTROL_REFERENCE_ID), CONTROL_REFERENCE_LABEL);
    assert.equal(text(CONTROL_SETTINGS_BACK_ID), CONTROL_SETTINGS_BACK_LABEL);
});

test('the panel is closed until something opens it, and opens on its first row', () => {
    const state = createControlSettingsState(null);
    assert.equal(controlSettingsShowing(state), false);

    assert.equal(openControlSettings(state), true);
    assert.equal(controlSettingsShowing(state), true);
    assert.equal(openControlSettings(state), false, 'opening an open panel changes nothing');

    assert.equal(closeControlSettings(state), true);
    assert.equal(controlSettingsShowing(state), false);
    assert.equal(closeControlSettings(state), false);
});

test('escape and backspace both close the panel', () => {
    for (const code of CONTROL_SETTINGS_CLOSE_KEYS) {
        assert.equal(isControlSettingsCloseKey(code), true);
    }
    assert.equal(isControlSettingsCloseKey('KeyO'), false);
});

test('an axis steps to its other setting and wraps round rather than stopping', () => {
    const state = createControlSettingsState(null);

    assert.equal(adjustControlSetting(state, PITCH_AXIS_OPTION, 1), PITCH_AXIS_OPTION);
    assert.equal(currentControlOption(state, PITCH_AXIS_OPTION), AXIS_INVERTED);

    assert.equal(adjustControlSetting(state, PITCH_AXIS_OPTION, 1), PITCH_AXIS_OPTION);
    assert.equal(currentControlOption(state, PITCH_AXIS_OPTION), AXIS_DIRECTIONAL);

    assert.equal(adjustControlSetting(state, PITCH_AXIS_OPTION, -1), PITCH_AXIS_OPTION);
    assert.equal(currentControlOption(state, PITCH_AXIS_OPTION), AXIS_INVERTED);
});

test('a step of nowhere moves nothing, and a row with no value has nothing to step', () => {
    const state = createControlSettingsState(null);

    assert.equal(adjustControlSetting(state, PITCH_AXIS_OPTION, 0), null);
    assert.equal(adjustControlSetting(state, CONTROL_REFERENCE_ID, 1), null);
    assert.equal(adjustControlSetting(state, CONTROL_SETTINGS_BACK_ID, 1), null);
    assert.equal(adjustControlSetting(state, 'nothing-of-the-sort', 1), null);
    assert.deepEqual(controlAxes(state), { ...DEFAULT_AXES });
});

/**
 * The item the panel was built for: four states out of two toggles, and all four
 * wanted. Turning one axis over says nothing about the other.
 */
test('the two axes are turned over independently, and reach all four states', () => {
    const state = createControlSettingsState(null);
    const seen = [];

    for (const pitch of [AXIS_DIRECTIONAL, AXIS_INVERTED]) {
        for (const roll of [AXIS_DIRECTIONAL, AXIS_INVERTED]) {
            state.values[PITCH_AXIS_OPTION] = pitch;
            state.values[ROLL_AXIS_OPTION]  = roll;
            seen.push(controlAxes(state));
        }
    }

    assert.deepEqual(seen, [
        { pitch: AXIS_DIRECTIONAL, roll: AXIS_DIRECTIONAL },
        { pitch: AXIS_DIRECTIONAL, roll: AXIS_INVERTED },
        { pitch: AXIS_INVERTED,    roll: AXIS_DIRECTIONAL },
        { pitch: AXIS_INVERTED,    roll: AXIS_INVERTED }
    ]);
});

// The panel holds one setting per axis; the input map wants the pair. Naming the
// option each axis is held in is what keeps the two from being two lists.
test('every axis the input map reads has an option holding it', () => {
    for (const axis of AXIS_NAMES) {
        assert.ok(AXIS_OPTIONS[axis], `${axis} should be held by an option of the panel`);
        assert.ok(controlOption(AXIS_OPTIONS[axis]), `and that option should be one the panel lists`);
    }
    assert.equal(Object.keys(AXIS_OPTIONS).length, AXIS_NAMES.length);
});

test('the attitude box turns over, whether it is stepped or chosen', () => {
    const state = createControlSettingsState(null);

    assert.equal(adjustControlSetting(state, FULL_ROTATION_OPTION, 1), FULL_ROTATION_OPTION);
    assert.equal(fullRotationWanted(state), true);
    assert.equal(controlSettingsEntry(state, FULL_ROTATION_OPTION).text,
        `${TOGGLE_ON_MARK} FULL ROTATION`);

    assert.equal(chooseControlSetting(state, FULL_ROTATION_OPTION), FULL_ROTATION_OPTION);
    assert.equal(fullRotationWanted(state), false);
});

test('choosing an axis steps it on, the way the arrow keys do', () => {
    const state = createControlSettingsState(null);

    assert.equal(chooseControlSetting(state, PITCH_AXIS_OPTION), PITCH_AXIS_OPTION);
    assert.equal(currentControlOption(state, PITCH_AXIS_OPTION), AXIS_INVERTED);

    // A click on the left of a row steps it down, which on a list of two is the
    // same place and still a change worth reporting.
    assert.equal(chooseControlSetting(state, PITCH_AXIS_OPTION, -1), PITCH_AXIS_OPTION);
    assert.equal(currentControlOption(state, PITCH_AXIS_OPTION), AXIS_DIRECTIONAL);
});

test('the way out closes the panel and says so', () => {
    const state = createControlSettingsState(null);
    openControlSettings(state);

    assert.equal(chooseControlSetting(state, CONTROL_SETTINGS_BACK_ID), CONTROL_SETTINGS_BACK_ID);
    assert.equal(controlSettingsShowing(state), false);
});

/**
 * The reference list is read against the world rather than against the rows that
 * were covering it, so asking for it closes the panel. It is the one row that
 * answers with something for the caller to put on screen.
 */
test('the reference list closes the panel it was reached from', () => {
    const state = createControlSettingsState(null);
    openControlSettings(state);

    assert.equal(chooseControlSetting(state, CONTROL_REFERENCE_ID), CONTROL_REFERENCE_ID);
    assert.equal(controlSettingsShowing(state), false);
    assert.deepEqual(controlAxes(state), { ...DEFAULT_AXES }, 'and changes no setting on the way');
});

test('choosing a row the panel has never heard of changes nothing', () => {
    const state = createControlSettingsState(null);
    openControlSettings(state);

    assert.equal(chooseControlSetting(state, 'nothing-of-the-sort'), null);
    assert.equal(controlSettingsShowing(state), true);
});

test('a setting already on that value reports no change', () => {
    const state = createControlSettingsState(null);
    assert.equal(adjustControlSetting(state, PITCH_AXIS_OPTION, 1), PITCH_AXIS_OPTION);
    state.values[PITCH_AXIS_OPTION] = AXIS_INVERTED;
    assert.equal(adjustControlSetting(state, PITCH_AXIS_OPTION, 2), null,
        'two steps along a list of two is the setting it was already on');
});

test('a choice is remembered for the next session', () => {
    const storage = fakeStorage();
    const state = createControlSettingsState(storage);

    adjustControlSetting(state, PITCH_AXIS_OPTION, 1);
    adjustControlSetting(state, FULL_ROTATION_OPTION, 1);

    const read = readControlSettings(storage);
    assert.equal(read[PITCH_AXIS_OPTION], AXIS_INVERTED);
    assert.equal(read[FULL_ROTATION_OPTION], true);
    assert.equal(read[ROLL_AXIS_OPTION], AXIS_DIRECTIONAL);

    assert.deepEqual(controlAxes(createControlSettingsState(storage)),
        { pitch: AXIS_INVERTED, roll: AXIS_DIRECTIONAL });
});

test('every choice is read on its own, so one unreadable value costs nothing else', () => {
    const storage = fakeStorage({
        [CONTROL_SETTINGS_STORAGE_KEY]: JSON.stringify({
            [PITCH_AXIS_OPTION]: AXIS_INVERTED,
            [ROLL_AXIS_OPTION]: 'sideways',
            [FULL_ROTATION_OPTION]: 'yes'
        })
    });

    const values = readControlSettings(storage);
    assert.equal(values[PITCH_AXIS_OPTION], AXIS_INVERTED);
    assert.equal(values[ROLL_AXIS_OPTION], AXIS_DIRECTIONAL);
    assert.equal(values[FULL_ROTATION_OPTION], false);
});

test('a storage with nothing in it, or one that throws, reads as the defaults', () => {
    assert.deepEqual(readControlSettings(null), defaultControlSettings());
    assert.deepEqual(readControlSettings(fakeStorage()), defaultControlSettings());
    assert.deepEqual(
        readControlSettings(fakeStorage({ [CONTROL_SETTINGS_STORAGE_KEY]: 'not json' })),
        defaultControlSettings()
    );
    assert.deepEqual(
        readControlSettings({ getItem() { throw new Error('refused'); } }),
        defaultControlSettings()
    );
});

test('a storage that refuses the write costs the settings their memory and nothing else', () => {
    assert.equal(writeControlSettings(null, {}), false);
    assert.equal(writeControlSettings({ setItem() { throw new Error('full'); } }, {}), false);
    assert.equal(writeControlSettings(fakeStorage(), { a: 1 }), true);
});

test('redrawing the rows reads them off the choices behind them', () => {
    const state = createControlSettingsState(null);
    state.values[ROLL_AXIS_OPTION] = AXIS_INVERTED;
    state.values[FULL_ROTATION_OPTION] = true;

    syncControlSettingsEntries(state);
    assert.equal(controlSettingsEntry(state, ROLL_AXIS_OPTION).text,
        `ROLL AXIS  ${OPTION_LEFT_MARK} INVERTED ${OPTION_RIGHT_MARK}`);
    assert.equal(controlSettingsEntry(state, FULL_ROTATION_OPTION).text,
        `${TOGGLE_ON_MARK} FULL ROTATION`);
});

test('a row the panel has no entry for is no entry', () => {
    const state = createControlSettingsState(null);
    assert.equal(controlSettingsEntry(state, 'nothing-of-the-sort'), null);
    assert.equal(controlSettingsEntry(null, PITCH_AXIS_OPTION), null);
    assert.equal(currentControlOption(null, PITCH_AXIS_OPTION), undefined);
});

// --- What the entry that opens it says -------------------------------------

/**
 * The entry used to show the reference list and nothing else. Both menus carry
 * it under the same id, so renaming it is one label in two places rather than
 * two names for one thing.
 */
test('both menus name the entry after the panel it opens', () => {
    for (const entries of [START_MENU_ENTRIES, PAUSE_MENU_ENTRIES]) {
        const entry = entries.find(item => item.id === 'controls');
        assert.ok(entry, 'both menus should carry the entry');
        assert.equal(entry.label, CONTROL_SETTINGS_TITLE,
            'the entry should be named for the panel rather than for the list inside it');
    }
});

/**
 * Read off js/main.js because it imports Three.js: the entry opens the panel on
 * both screens, and the panel is modal over whatever it was opened from the way
 * the other three are.
 */
test('the entry opens the panel from the start screen and from the pause menu', () => {
    const opens = mainSource.match(/case 'controls':[\s\S]*?break;/g) ?? [];
    assert.equal(opens.length, 2, 'the start screen and the pause menu each carry the entry');
    for (const handler of opens) {
        assert.ok(handler.includes('this.openControlSettingsPanel()'),
            'both should open the control settings panel');
    }
});

test('the panel is modal over the flight, and takes the keys before it', () => {
    assert.ok(/controlSettingsShowing\(this\.controlSettings\)\)\s*\{\s*this\.onControlSettingsKey\(e\);/
        .test(mainSource),
        'an open panel should read the keys before anything behind it does');
    assert.equal(
        (mainSource.match(/this\.onControlSettingsKey\(e\);/g) ?? []).length, 2,
        'on the start screen and over a flight alike');
    assert.ok(/menuShowing\(\)\s*\{[\s\S]*?controlSettingsShowing\(this\.controlSettings\)/
        .test(mainSource),
        'and should count as a menu, so the keys that walk it are taken from the flight');
});

test('opening the panel closes whatever other panel was over the flight', () => {
    const open = mainSource.match(/openControlSettingsPanel\(\)\s*\{[\s\S]*?\n    \}/);
    assert.ok(open, 'js/main.js should open the panel somewhere');

    for (const closing of ['this.modesOpen = false', 'closeSettings(this.settings)', 'closeEditor(this.editor)']) {
        assert.ok(open[0].includes(closing), `opening the panel should also ${closing}`);
    }
    assert.ok(open[0].includes('resetSelection(this.controlState)'),
        'and should open it on its first row, the way the other panels do');
});

/**
 * The exclusion read both ways. The panel closing the other three is only half
 * of a set that is mutually exclusive: for a while the other three did not
 * close this one, and the set held together only because `syncOverlays` ranks
 * `controls` below `modes` and `settings` and because an open panel swallows
 * every key that would open another. Nothing reached it, so nothing broke - and
 * the next panel, or the next open key, is what would have made a closed panel
 * reappear from under the one over it.
 *
 * So each opener states what it closes, rather than resting on the order
 * something else happens to rank them in.
 */
test('every panel opener closes the other three', () => {
    const CLOSES = {
        settings: 'closeSettings(this.settings)',
        editor:   'closeEditor(this.editor)',
        modes:    'this.modesOpen = false',
        controls: 'closeControlSettings(this.controlSettings)'
    };
    const OPENERS = {
        openSettingsPanel:        'settings',
        openEditorPanel:          'editor',
        openGameModesPanel:       'modes',
        openControlSettingsPanel: 'controls'
    };

    for (const [opener, panel] of Object.entries(OPENERS)) {
        const body = mainSource.match(new RegExp(`${opener}\\(\\)\\s*\\{[\\s\\S]*?\\n    \\}`));
        assert.ok(body, `js/main.js should define ${opener}()`);

        for (const [other, closing] of Object.entries(CLOSES)) {
            if (other === panel) continue;
            assert.ok(body[0].includes(closing),
                `${opener}() should ${closing} so the ${other} panel cannot reappear behind it`);
        }
    }
});

/**
 * The start screen has no H key to collapse the list with, so the row that put
 * the list on screen has to be able to take it off again. Opening it with no way
 * back leaves a pilot working the menus from the keyboard with the list over the
 * title for the rest of the session - which is what the Controls entry answered
 * for, by toggling, before this panel was between them.
 */
test('on the start screen the reference row turns the list over rather than only opening it', () => {
    const chosen = mainSource.match(/chooseControlSettingsEntry\(id[\s\S]*?\n    \}/);
    assert.ok(chosen, 'js/main.js should apply the row the panel chose');

    assert.ok(/titleShowing\(this\.titleState\)\)\s*\{\s*\n\s*this\.titleHelp = !this\.titleHelp;/
        .test(chosen[0]),
        'the row should turn the list over on the start screen');
    assert.ok(/if \(this\.titleHelp\) expandHelp\(this\.helpState\)/.test(chosen[0]),
        'and only expand the list on the press that puts it on screen');
});

/**
 * An axis turned over should not rebuild the ground under the aircraft, which is
 * why this is its own step rather than part of the settings panel's.
 */
test('what the panel holds is handed to the aircraft and to nothing else', () => {
    const apply = mainSource.match(/applyControlSettings\(\)\s*\{[\s\S]*?\n    \}/);
    assert.ok(apply, 'js/main.js should apply what the panel holds');

    assert.ok(apply[0].includes('setAxes(controlAxes(this.controlSettings))'));
    assert.ok(apply[0].includes('setFullRotation(fullRotationWanted(this.controlSettings))'));
    assert.ok(!apply[0].includes('refreshWorld'), 'and should not rebuild the world');
    assert.ok(!apply[0].includes('syncEditor'), 'or redraw the editor');

    // Called at start-up as well, so a stored choice is in force on the first frame.
    assert.ok(/this\.applySettings\(\);\s*\n\s*this\.applyControlSettings\(\);/.test(mainSource));
});
