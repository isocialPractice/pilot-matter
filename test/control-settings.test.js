import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
    CONTROL_SETTINGS_STORAGE_KEY,
    CONTROL_SETTINGS_TITLE,
    CONTROL_AXES_HEADING,
    CONTROL_ATTITUDE_HEADING,
    CONTROL_LEVEL_OFF_HEADING,
    CONTROL_KEYS_HEADING,
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
    TILT_AXES_OPTION,
    FULL_ROTATION_OPTION,
    REFERENCE_OPEN_OPTION,
    levelOffOptionId,
    levelOffOptionControl,
    AXIS_OPTIONS,
    AXIS_GROUP,
    ATTITUDE_GROUP,
    LEVEL_OFF_GROUP,
    BINDING_GROUP,
    REFERENCE_GROUP,
    LIST_ENTRY,
    BINDING_ENTRY,
    ACTION_ENTRY,
    BINDING_SEPARATOR,
    BINDING_PROMPT,
    BINDING_NEEDS_A_KEY,
    RESTORE_BINDINGS_ID,
    RESTORE_BINDINGS_LABEL,
    bindingEntryId,
    bindingEntryName,
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
    tiltReadsAxes,
    tiltInputAxes,
    levelOffControls,
    referenceOpenWanted,
    rememberReferenceOpen,
    controlBindings,
    controlBindingsAreDefault,
    bindingArmed,
    armBinding,
    cancelBinding,
    bindArmedKey,
    restoreControlBindings,
    controlSettingsEntry,
    adjustControlSetting,
    chooseControlSetting
} from '../js/control-settings.js';
import {
    BINDING_NAMES, BINDING_LABELS, DEFAULT_BINDINGS, KEY_BINDINGS_STORAGE_KEY,
    RESET_BINDING, LEVEL_OFF_BINDING, UNBOUND_LABEL, defaultBindings, keyLabel
} from '../js/key-bindings.js';
import {
    OPTION_ENTRY, TOGGLE_ENTRY, BACK_ENTRY,
    TOGGLE_ON_MARK, TOGGLE_OFF_MARK, OPTION_LEFT_MARK, OPTION_RIGHT_MARK
} from '../js/settings.js';
import {
    AXIS_DIRECTIONAL, AXIS_INVERTED, AXIS_NAMES, DEFAULT_AXES, VERTICAL_CONTROLS
} from '../js/input-map.js';
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
    const headings = [
        CONTROL_AXES_HEADING, CONTROL_ATTITUDE_HEADING, CONTROL_LEVEL_OFF_HEADING,
        CONTROL_KEYS_HEADING, CONTROL_REFERENCE_HEADING
    ];
    for (const heading of headings) {
        assert.ok(heading.length > 0, 'every section of the panel should carry a heading');
    }
    assert.equal(new Set(headings).size, headings.length,
        'two sections under one heading is one section');
});

// The panel remembers under a key of its own rather than inside the settings
// panel's: how a pilot flies outlives which world they were flying.
test('the panel remembers its choices somewhere of its own', () => {
    assert.ok(CONTROL_SETTINGS_STORAGE_KEY.startsWith('pilot-matter.'));
    assert.notEqual(CONTROL_SETTINGS_STORAGE_KEY, 'pilot-matter.settings');
});

test('every option answers to an id, and no two answer to one', () => {
    assert.deepEqual(CONTROL_OPTION_IDS, [
        PITCH_AXIS_OPTION, ROLL_AXIS_OPTION, TILT_AXES_OPTION, FULL_ROTATION_OPTION,
        ...VERTICAL_CONTROLS.map(levelOffOptionId), REFERENCE_OPEN_OPTION
    ]);
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
    assert.equal(controlOption(TILT_AXES_OPTION).group, AXIS_GROUP,
        'the device is read through the two settings above it, so it is asked about beside them');
    assert.equal(controlOption(FULL_ROTATION_OPTION).group, ATTITUDE_GROUP);
    for (const control of VERTICAL_CONTROLS) {
        assert.equal(controlOption(levelOffOptionId(control)).group, LEVEL_OFF_GROUP);
    }
    assert.equal(controlOption(REFERENCE_OPEN_OPTION).group, REFERENCE_GROUP,
        'whether the list is up belongs with the row that opens it');
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
        [TILT_AXES_OPTION]: false,
        [FULL_ROTATION_OPTION]: false,
        ...Object.fromEntries(VERTICAL_CONTROLS.map(control => [levelOffOptionId(control), true])),
        [REFERENCE_OPEN_OPTION]: true
    });

    const state = createControlSettingsState(null);
    assert.deepEqual(controlAxes(state), { ...DEFAULT_AXES });
    assert.equal(fullRotationWanted(state), false);

    // The device is the aircraft until a pilot says otherwise, every control
    // counts after a level off, the list opens where it always has, and every
    // key is on the key the game ships it on.
    assert.equal(tiltReadsAxes(state), false);
    assert.deepEqual(tiltInputAxes(state), { ...DEFAULT_AXES });
    assert.deepEqual(levelOffControls(state), [...VERTICAL_CONTROLS]);
    assert.equal(referenceOpenWanted(state), true);
    assert.deepEqual(controlBindings(state), defaultBindings());
});

test('the panel lists every setting, the reference list, and the way out', () => {
    const entries = controlSettingsEntries();
    const ids = entries.map(entry => entry.id);

    // The key rows go in ahead of the reference group rather than at the end,
    // so no group is split in two by another one - the lists the panel is drawn
    // into are filtered by group, and a split group is drawn twice.
    const settings = CONTROL_OPTION_IDS.filter(id => id !== REFERENCE_OPEN_OPTION);
    assert.deepEqual(ids, [
        ...settings,
        ...BINDING_NAMES.map(bindingEntryId), RESTORE_BINDINGS_ID,
        REFERENCE_OPEN_OPTION, CONTROL_REFERENCE_ID, CONTROL_SETTINGS_BACK_ID
    ]);
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
    // Both key handlers route to the panel, and each of them twice: once for an
    // open panel, and once ahead of everything for a key row waiting for a key.
    for (const handler of ['onKeyDown', 'onStartKey']) {
        const body = mainSource.match(new RegExp(`${handler}\\(e\\)\\s*\\{[\\s\\S]*?\\n    \\}`));
        assert.ok(body, `js/main.js should read keys in ${handler}`);
        assert.equal((body[0].match(/this\.onControlSettingsKey\(e\);/g) ?? []).length, 2,
            `${handler} should hand the panel its keys, open or waiting`);
    }
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

// --- The level off ---------------------------------------------------------

/**
 * `VERTICAL_CONTROLS` is the list `wantsVerticalChange` takes, and the throttle
 * is in it: a nudge of the lever on an approach drops the altitude hold the
 * pilot set the approach up with. A box per control is what makes that one
 * answerable without answering for the nose at the same time.
 */
test('a box per control says whether it hands the aircraft back', () => {
    const state = createControlSettingsState(fakeStorage());

    for (const control of VERTICAL_CONTROLS) {
        const entry = controlSettingsEntry(state, levelOffOptionId(control));
        assert.ok(entry, `${control} should have a box of its own`);
        assert.equal(entry.kind, TOGGLE_ENTRY, 'the question is whether it counts, so it is a box');
        assert.equal(entry.group, LEVEL_OFF_GROUP);
        assert.equal(entry.value, true, 'and every one of them counts until a pilot says otherwise');
    }

    assert.deepEqual(levelOffControls(state), [...VERTICAL_CONTROLS]);
});

test('clearing a box takes that control off the list and leaves the rest on it', () => {
    const state = createControlSettingsState(fakeStorage());

    chooseControlSetting(state, levelOffOptionId('throttleUp'));
    chooseControlSetting(state, levelOffOptionId('throttleDown'));

    assert.deepEqual(levelOffControls(state), ['pitchUp', 'pitchDown'],
        'the lever is free and the nose still hands the aircraft back');

    chooseControlSetting(state, levelOffOptionId('throttleUp'));
    assert.deepEqual(levelOffControls(state), ['pitchUp', 'pitchDown', 'throttleUp'],
        'and the list is read in the order the input map writes it, not in the order of the presses');
});

/**
 * Every box cleared is a level off nothing in the input ends, and that is the
 * pilot's answer rather than a state to refuse: the question each box asks is
 * whether that control counts, and a box that would not be the last one cleared
 * is answering a different question.
 */
test('every box cleared is a hold nothing hands back, which is an answer', () => {
    const state = createControlSettingsState(fakeStorage());
    for (const control of VERTICAL_CONTROLS) chooseControlSetting(state, levelOffOptionId(control));

    assert.deepEqual(levelOffControls(state), []);
});

test('no box is offered for a control that is deliberately not on the list', () => {
    for (const control of ['rollLeft', 'rollRight', 'yawLeft', 'yawRight']) {
        assert.equal(controlOption(levelOffOptionId(control)), null,
            `${control} is out of the list on purpose - an altitude held through a turn is the point`);
    }

    assert.equal(levelOffOptionControl(levelOffOptionId('pitchUp')), 'pitchUp');
    assert.equal(levelOffOptionControl(levelOffOptionId('rollLeft')), null);
    assert.equal(levelOffOptionControl(PITCH_AXIS_OPTION), null);
    assert.equal(levelOffOptionControl(null), null);
});

// --- Reading the device through the axes -----------------------------------

/**
 * `tiltToInput` wrote the four controls itself and said so in as many words -
 * "neither needs inverting, and neither should be" - which was right while
 * nothing could invert them. Now a pilot can set pitch inverted and find it
 * applies to the keys and not to the device.
 */
test('the device is read through the axis settings only when the pilot asks', () => {
    const state = createControlSettingsState(fakeStorage());
    adjustControlSetting(state, PITCH_AXIS_OPTION, 1);

    assert.deepEqual(controlAxes(state), { pitch: AXIS_INVERTED, roll: AXIS_DIRECTIONAL });
    assert.equal(tiltReadsAxes(state), false);
    assert.deepEqual(tiltInputAxes(state), { ...DEFAULT_AXES },
        'off, the device goes on being the aircraft whatever the keys are doing');

    chooseControlSetting(state, TILT_AXES_OPTION);
    assert.equal(tiltReadsAxes(state), true);
    assert.deepEqual(tiltInputAxes(state), controlAxes(state),
        'on, the device is read through the same pair the keys are');
});

// --- Remembering the reference list ----------------------------------------

/**
 * `createHelpState(expanded = true)` took the state the list opens in and
 * nothing passed it anything, so every session opened with the list over the
 * corner of the window and the H key's answer was forgotten at the end of it.
 */
test('whether the list is up is a setting, stored beside the rest of the panel', () => {
    const storage = fakeStorage();
    const state = createControlSettingsState(storage);

    assert.equal(referenceOpenWanted(state), true, 'a first flight opens with the list up');

    assert.equal(rememberReferenceOpen(state, false), REFERENCE_OPEN_OPTION);
    assert.equal(referenceOpenWanted(state), false);
    assert.equal(rememberReferenceOpen(state, false), null, 'the same answer twice is one answer');

    assert.equal(referenceOpenWanted(createControlSettingsState(storage)), false,
        'and the next session opens the list the way this one left it');

    assert.ok(KEY_BINDINGS_STORAGE_KEY !== CONTROL_SETTINGS_STORAGE_KEY);
    assert.ok(storage.held[CONTROL_SETTINGS_STORAGE_KEY].includes(REFERENCE_OPEN_OPTION),
        'stored with the rest of what the panel holds rather than as a third thing');
});

test('the box and the key are two ways of writing one answer', () => {
    const state = createControlSettingsState(fakeStorage());
    const box = controlSettingsEntry(state, REFERENCE_OPEN_OPTION);

    assert.equal(box.kind, TOGGLE_ENTRY);
    assert.equal(box.group, REFERENCE_GROUP, 'drawn beside the row that opens the list');
    assert.equal(box.value, true);

    chooseControlSetting(state, REFERENCE_OPEN_OPTION);
    assert.equal(referenceOpenWanted(state), false);
    assert.equal(controlSettingsEntry(state, REFERENCE_OPEN_OPTION).value, false,
        'and the box reads what the setting now says');
});

// --- The keys --------------------------------------------------------------

test('every control and both instructions get a row showing the key it is on', () => {
    const state = createControlSettingsState(fakeStorage());

    for (const name of BINDING_NAMES) {
        const entry = controlSettingsEntry(state, bindingEntryId(name));
        assert.ok(entry, `${name} should have a row of its own`);
        assert.equal(entry.kind, BINDING_ENTRY);
        assert.equal(entry.group, BINDING_GROUP);
        assert.equal(entry.binding, name);
        assert.equal(entry.label, BINDING_LABELS[name]);
        assert.equal(entry.note.length > 0, true, 'and say how it is worked');
    }

    assert.equal(controlSettingsEntry(state, bindingEntryId('pitchUp')).text,
        `PITCH UP${BINDING_SEPARATOR}W/↑`);
    assert.equal(controlSettingsEntry(state, bindingEntryId(LEVEL_OFF_BINDING)).text,
        `LEVEL OFF${BINDING_SEPARATOR}SPACE`);

    const restore = controlSettingsEntry(state, RESTORE_BINDINGS_ID);
    assert.equal(restore.kind, ACTION_ENTRY);
    assert.equal(restore.group, BINDING_GROUP);
    assert.equal(restore.text, RESTORE_BINDINGS_LABEL, 'a row that does something reads as itself');
});

test('a row id names the binding it holds, and nothing else does', () => {
    assert.equal(bindingEntryName(bindingEntryId('pitchUp')), 'pitchUp');
    assert.equal(bindingEntryName(bindingEntryId(RESET_BINDING)), RESET_BINDING);
    assert.equal(bindingEntryName('key.nothingOfTheSort'), null);
    assert.equal(bindingEntryName(PITCH_AXIS_OPTION), null);
    assert.equal(bindingEntryName(levelOffOptionId('pitchUp')), null,
        'a box about the level off is not the row holding the level off key');
    assert.equal(bindingEntryName(null), null);
});

test('choosing a key row puts it on the wait rather than changing anything', () => {
    const state = createControlSettingsState(fakeStorage());
    const row = bindingEntryId('pitchUp');

    assert.equal(bindingArmed(state), null);
    assert.equal(chooseControlSetting(state, row), row);
    assert.equal(bindingArmed(state), 'pitchUp');
    assert.equal(controlSettingsEntry(state, row).text, `PITCH UP${BINDING_SEPARATOR}${BINDING_PROMPT}`);
    assert.deepEqual(controlBindings(state).pitchUp, [...DEFAULT_BINDINGS.pitchUp],
        'the key has not moved yet - the next press is what moves it');
});

test('the next key pressed is the key, and is remembered', () => {
    const storage = fakeStorage();
    const state = createControlSettingsState(storage);

    armBinding(state, 'pitchUp');
    assert.deepEqual(bindArmedKey(state, 'KeyI'),
        { result: 'bound', binding: 'pitchUp', conflict: null });

    assert.equal(bindingArmed(state), null, 'and the row stops waiting');
    assert.deepEqual(controlBindings(state).pitchUp, ['KeyI']);
    assert.equal(controlSettingsEntry(state, bindingEntryId('pitchUp')).text,
        `PITCH UP${BINDING_SEPARATOR}I`);

    assert.deepEqual(createControlSettingsState(storage).bindings.pitchUp, ['KeyI'],
        'the next session opens on the key the pilot chose');
});

/**
 * Two controls on one key is a keyboard flying two things at once with nothing
 * on screen to say which, so the press is refused - and the row says which row
 * already holds the key, because "that did not work" is not an answer a pilot
 * can act on. The row stays waiting, so the next key is read as the answer
 * rather than as a fresh start.
 */
test('a key another row holds is refused, and the row says which row holds it', () => {
    const state = createControlSettingsState(fakeStorage());
    armBinding(state, 'yawLeft');

    assert.deepEqual(bindArmedKey(state, 'KeyW'),
        { result: 'taken', binding: 'yawLeft', conflict: 'pitchUp' });

    assert.equal(bindingArmed(state), 'yawLeft', 'the row goes on waiting');
    assert.equal(controlSettingsEntry(state, bindingEntryId('yawLeft')).text,
        `YAW LEFT${BINDING_SEPARATOR}W IS ${BINDING_LABELS.pitchUp}`);
    assert.deepEqual(controlBindings(state).yawLeft, [...DEFAULT_BINDINGS.yawLeft]);

    assert.equal(bindArmedKey(state, 'KeyZ').result, 'bound', 'and the next key is read as the answer');
    assert.deepEqual(controlBindings(state).yawLeft, ['KeyZ']);
});

test('the key a row is already on stops the wait and changes nothing', () => {
    const state = createControlSettingsState(fakeStorage());
    armBinding(state, 'pitchUp');

    assert.equal(bindArmedKey(state, 'ArrowUp').result, 'held');
    assert.equal(bindingArmed(state), null);
    assert.deepEqual(controlBindings(state).pitchUp, [...DEFAULT_BINDINGS.pitchUp],
        'rather than dropping the other key the control is on');
});

test('escape is the way out of the wait, and so is choosing the row again', () => {
    const state = createControlSettingsState(fakeStorage());

    armBinding(state, 'pitchUp');
    assert.equal(bindArmedKey(state, 'Escape').result, 'cancelled');
    assert.equal(bindingArmed(state), null);
    assert.deepEqual(controlBindings(state).pitchUp, [...DEFAULT_BINDINGS.pitchUp]);
    assert.equal(controlSettingsEntry(state, bindingEntryId('pitchUp')).text,
        `PITCH UP${BINDING_SEPARATOR}W/↑`, 'and the row goes back to reading as its key');

    assert.equal(chooseControlSetting(state, bindingEntryId('pitchUp')), bindingEntryId('pitchUp'));
    assert.equal(chooseControlSetting(state, bindingEntryId('pitchUp')), null);
    assert.equal(bindingArmed(state), null);

    assert.equal(cancelBinding(state), null, 'cancelling nothing is nothing');
    assert.equal(bindArmedKey(state, 'KeyI'), null, 'and a press with no row waiting is read normally');
});

/**
 * `R` ends a flight on one press with nothing in between, so a pilot flying a
 * long route may well want it on no key at all. Every other row needs one: a
 * control surface with no key is a surface nothing can work.
 */
test('the reset can be left on no key, and a surface says it needs one', () => {
    const state = createControlSettingsState(fakeStorage());

    armBinding(state, RESET_BINDING);
    assert.deepEqual(bindArmedKey(state, 'Delete'),
        { result: 'cleared', binding: RESET_BINDING, conflict: null });
    assert.deepEqual(controlBindings(state)[RESET_BINDING], []);
    assert.equal(controlSettingsEntry(state, bindingEntryId(RESET_BINDING)).text,
        `${BINDING_LABELS[RESET_BINDING]}${BINDING_SEPARATOR}${UNBOUND_LABEL}`);

    armBinding(state, 'pitchUp');
    assert.equal(bindArmedKey(state, 'Delete').result, 'needed');
    assert.equal(bindingArmed(state), 'pitchUp', 'the row goes on waiting for a key it can take');
    assert.equal(controlSettingsEntry(state, bindingEntryId('pitchUp')).text,
        `PITCH UP${BINDING_SEPARATOR}${BINDING_NEEDS_A_KEY}`);
    assert.deepEqual(controlBindings(state).pitchUp, [...DEFAULT_BINDINGS.pitchUp]);
});

test('one row puts the whole map back as it was', () => {
    const storage = fakeStorage();
    const state = createControlSettingsState(storage);

    armBinding(state, 'pitchUp');
    bindArmedKey(state, 'KeyI');
    armBinding(state, RESET_BINDING);
    bindArmedKey(state, 'Delete');
    assert.equal(controlBindingsAreDefault(state), false);

    assert.equal(chooseControlSetting(state, RESTORE_BINDINGS_ID), RESTORE_BINDINGS_ID);
    assert.equal(controlBindingsAreDefault(state), true);
    assert.equal(controlSettingsEntry(state, bindingEntryId('pitchUp')).text,
        `PITCH UP${BINDING_SEPARATOR}W/↑`);
    assert.deepEqual(createControlSettingsState(storage).bindings, defaultBindings(),
        'and the map that is put back is the map the next session reads');
});

test('restoring the map from a row the panel is waiting on takes the wait off too', () => {
    const state = createControlSettingsState(fakeStorage());
    armBinding(state, 'pitchUp');

    restoreControlBindings(state);
    assert.equal(bindingArmed(state), null);
});

// A panel that opened still waiting would take the first thing pressed at it,
// which is the one press nobody aimed at a row.
test('opening or closing the panel takes any wait off it', () => {
    const state = createControlSettingsState(fakeStorage());

    openControlSettings(state);
    armBinding(state, 'pitchUp');
    closeControlSettings(state);
    assert.equal(bindingArmed(state), null);

    armBinding(state, 'pitchUp');
    openControlSettings(state);
    assert.equal(bindingArmed(state), null);
});

test('the arrow keys mean nothing on a row that holds a key rather than a value', () => {
    const state = createControlSettingsState(fakeStorage());

    assert.equal(adjustControlSetting(state, bindingEntryId('pitchUp'), 1), null);
    assert.equal(adjustControlSetting(state, RESTORE_BINDINGS_ID, 1), null);
    assert.deepEqual(controlBindings(state), defaultBindings());
});

/**
 * The map is the panel's to hold but not the panel's to store: it is a map of
 * codes rather than one of the values the options are checked against, so it is
 * written under a key of its own and read back through its own module.
 */
test('the map is remembered under a key of its own', () => {
    const storage = fakeStorage();
    const state = createControlSettingsState(storage);

    armBinding(state, 'pitchUp');
    bindArmedKey(state, 'KeyI');

    assert.ok(storage.held[KEY_BINDINGS_STORAGE_KEY], 'the map should be stored');
    assert.ok(!(storage.held[CONTROL_SETTINGS_STORAGE_KEY] ?? '').includes('KeyI'),
        'and not inside the values, which are checked against the options the panel declares');
});

test('a storage that refuses the write leaves the map in force for this session', () => {
    const state = createControlSettingsState({ getItem: () => null, setItem() { throw new Error('full'); } });

    armBinding(state, 'pitchUp');
    assert.equal(bindArmedKey(state, 'KeyI').result, 'bound');
    assert.deepEqual(controlBindings(state).pitchUp, ['KeyI'], 'the flight goes on with the key just set');
});

// --- What js/main.js does with the keys ------------------------------------

test('everything the panel holds is handed to the aircraft', () => {
    const apply = mainSource.match(/applyControlSettings\(\)\s*\{[\s\S]*?\n    \}/);
    assert.ok(apply, 'js/main.js should apply what the panel holds');

    assert.ok(apply[0].includes('setBindings(aircraftBindings(controlBindings(this.controlSettings)))'),
        'the keys each control is on');
    assert.ok(apply[0].includes('setVerticalControls(levelOffControls(this.controlSettings))'),
        'and the controls that hand the aircraft back');
    assert.ok(apply[0].includes('referenceOpenWanted(this.controlSettings)'),
        'and whether the reference list is up');
});

test('the list opens the way the pilot last left it', () => {
    assert.ok(mainSource.includes('createHelpState(referenceOpenWanted(this.controlSettings))'),
        'js/main.js should open the list on the stored answer rather than on the default');
    assert.ok(/rememberHelpState\(\)\s*\{\s*\n\s*rememberReferenceOpen\(this\.controlSettings, this\.helpState\.expanded\);/
        .test(mainSource),
        'and write the answer back wherever the list is turned over');
    assert.ok(/applyHelpKey\([^)]*\)\) \{\s*\n\s*this\.rememberHelpState\(\);/.test(mainSource),
        'which the H key does');
});

/**
 * A row waiting for a key has to be read before anything else that would have
 * read one. The aircraft listens on the way back up, so a press that was only
 * ever aimed at a row would otherwise also move a control surface - and the
 * key that moved it no longer works it by the time it comes back up.
 */
test('a row waiting for a key is read before the flight behind it', () => {
    assert.ok(/const binding = bindingArmed\(this\.controlSettings\) != null;/.test(mainSource),
        'js/main.js should know a row is waiting while it decides who reads the key');
    assert.ok(/if \(!onTitle && !binding && !\(this\.menuShowing\(\)/.test(mainSource),
        'and take the key on the way down the page rather than leaving it to the aircraft');

    const handler = mainSource.match(/onControlSettingsKey\(e\)\s*\{[\s\S]*?\n    \}/);
    assert.ok(handler, 'js/main.js should read the panel keys');
    assert.ok(handler[0].indexOf('bindingArmed(this.controlSettings)')
        < handler[0].indexOf('isControlSettingsCloseKey(e.code)'),
        'and read the wait before the key that would otherwise have closed the panel');
    assert.ok(handler[0].includes('bindArmedKey(this.controlSettings, e.code)'));
});

test('the device is read through whichever pair the panel resolved', () => {
    const track = mainSource.match(/trackTilt\(frozen\)\s*\{[\s\S]*?\n    \}/);
    assert.ok(track, 'js/main.js should hand the attitude of the device to the aircraft');
    assert.ok(track[0].includes('tiltInputAxes(this.controlSettings)'),
        'through the pair the TILT READS AXES box resolves to');
});

/**
 * A row waiting for a key is read ahead of the shutter as well. The photo key
 * is read before the panels on purpose - a picture is of the world, whatever
 * is over it - but a row that waits for any key at all keeps back exactly two,
 * and a third key that took a picture instead would be a third key nothing can
 * be bound to with nothing on the row to say why.
 */
test('a waiting row is read ahead of every other key, the shutter included', () => {
    for (const handler of ['onKeyDown', 'onStartKey']) {
        const body = mainSource.match(new RegExp(`${handler}\\(e\\)\\s*\\{[\\s\\S]*?\\n    \\}`));
        assert.ok(body, `js/main.js should read keys in ${handler}`);

        const waiting = body[0].indexOf('bindingArmed(this.controlSettings)');
        const shutter = body[0].indexOf('applyPhotoKey(');
        assert.ok(waiting >= 0, `${handler} should know a row is waiting`);
        assert.ok(shutter >= 0, `${handler} should read the shutter`);
        assert.ok(waiting < shutter, `${handler} should read the wait before the shutter`);
    }
});

/**
 * Choosing a key row hands the aircraft nothing, because the key that answers
 * it has not arrived yet. That is the row itself, not the wait: the cursor is
 * one list and the pointer reaches every row of it, so a box clicked while a
 * row waits has still changed a setting. Held back on the wait instead, the
 * box reads `ON`, stores `ON`, and leaves the aircraft on the clamp it had -
 * which is the panel reading one way and the flight flying the other, for the
 * rest of a session.
 */
test('the row that hands the aircraft nothing is the key row, not every row beside it', () => {
    const chosen = mainSource.match(/chooseControlSettingsEntry\(id[\s\S]*?\n    \}/);
    assert.ok(chosen, 'js/main.js should apply the row the panel chose');
    assert.ok(/if \(bindingEntryName\(applied\) != null\) return;/.test(chosen[0]),
        'and hold back the key row by its being one rather than by a row waiting somewhere');

    const state = createControlSettingsState(fakeStorage());
    const row = bindingEntryId('rollLeft');

    assert.equal(chooseControlSetting(state, row), row, 'the key row is the id it is drawn as');
    assert.equal(bindingEntryName(row), 'rollLeft', 'which is what holds it back');
    assert.equal(bindingArmed(state), 'rollLeft', 'and it is now waiting for a key');

    const applied = chooseControlSetting(state, FULL_ROTATION_OPTION);
    assert.equal(applied, FULL_ROTATION_OPTION, 'a box chosen while it waits still turns over');
    assert.equal(bindingEntryName(applied), null, 'and is not a key row, so it reaches the aircraft');
    assert.equal(fullRotationWanted(state), true, 'the panel having already stored it');
    assert.equal(bindingArmed(state), 'rollLeft', 'while the row goes on waiting for its key');
});
