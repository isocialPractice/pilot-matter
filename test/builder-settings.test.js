/**
 * Builder settings, Builder settings from the builder and Builder settings
 * from Settings - the builder's own preferences as a third settings screen,
 * stored under a key of their own and read by nothing that builds ground,
 * reached from the palette's gear, from `O` inside the builder and from a row
 * on the game's settings, with `BACK` returning to whichever opened it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import {
    BUILDER_SETTINGS_STORAGE_KEY, BUILDER_OPTIONS, AUTO_ACCEPT_GROUP, VIEW_GROUP, BUILDER_END_GROUP, ACTION_ENTRY,
    AUTO_ACCEPT_ALL_OPTION, AUTO_ACCEPT_DRAW_OPTION, AUTO_ACCEPT_EXIT_OPTION, AUTO_ACCEPT_TOOL_OPTION, AUTO_ACCEPT_OPTIONS,
    CAMERA_SPEED_OPTION, CAMERA_SPEEDS, RESET_BUILDER_SETTINGS_ID, BUILDER_SETTINGS_BACK_ID,
    BUILDER_SETTINGS_FROM_BUILDER, BUILDER_SETTINGS_FROM_SETTINGS, BUILDER_SETTINGS_CLOSE_KEYS,
    createBuilderSettingsState, builderSettingsEntries, readBuilderSettings, writeBuilderSettings, defaultBuilderSettings,
    openBuilderSettings, closeBuilderSettings, builderSettingsShowing, builderSettingsFrom, chooseBuilderSetting,
    adjustBuilderSetting, resetBuilderSettings, builderAutoAccept, builderCameraSpeed, isMomentLocked,
    isBuilderSettingsCloseKey, isBuilderSettingsOpenKey, builderSettingsEntry
} from '../js/builder-settings.js';
import {
    OPTION_ENTRY, TOGGLE_ENTRY, BACK_ENTRY, SETTINGS_OPEN_KEYS, TOGGLE_ON_MARK, TOGGLE_OFF_MARK,
    createSettingsState, chooseSetting, adjustSetting, settingsShowing, openSettings, BUILDER_SETTINGS_ID, SETTINGS_BACK_ID
} from '../js/settings.js';
import {
    createBuildState, openBuildMode, beginCanvas, chooseBuildTool, layStroke, setAutoAccept, acceptDraft,
    committedPlacements, BUILD_FROM_TITLE
} from '../js/build-mode.js';
import { buildEnvironment, getEnvironment } from '../js/environment/presets.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const read = path => readFileSync(join(ROOT, path), 'utf8');

function fakeStorage(initial = {}) {
    const data = { ...initial };
    return {
        data,
        getItem: key => (key in data ? data[key] : null),
        setItem: (key, value) => { data[key] = String(value); }
    };
}

const MOMENTS = [AUTO_ACCEPT_DRAW_OPTION, AUTO_ACCEPT_EXIT_OPTION, AUTO_ACCEPT_TOOL_OPTION];
const labelled = state => state.entries.map(entry => [entry.group, entry.kind, entry.label]);

// --- The screen ------------------------------------------------------------------------------

test('the rows come under their headings in the order the plan gives, each a kind the settings menus draw', () => {
    assert.deepEqual(labelled(createBuilderSettingsState()), [
        [AUTO_ACCEPT_GROUP, TOGGLE_ENTRY, 'ALL'],
        [AUTO_ACCEPT_GROUP, TOGGLE_ENTRY, 'WHEN DRAWING AGAIN'],
        [AUTO_ACCEPT_GROUP, TOGGLE_ENTRY, 'WHEN LEAVING'],
        [AUTO_ACCEPT_GROUP, TOGGLE_ENTRY, 'WHEN CHANGING TOOL'],
        [VIEW_GROUP, OPTION_ENTRY, 'CAMERA SPEED'],
        [BUILDER_END_GROUP, ACTION_ENTRY, 'RESET TO DEFAULTS'],
        [BUILDER_END_GROUP, BACK_ENTRY, 'BACK']
    ]);
    assert.deepEqual(AUTO_ACCEPT_OPTIONS, { draw: AUTO_ACCEPT_DRAW_OPTION, exit: AUTO_ACCEPT_EXIT_OPTION, tool: AUTO_ACCEPT_TOOL_OPTION });
    assert.deepEqual(defaultBuilderSettings(), {
        [AUTO_ACCEPT_ALL_OPTION]: false, [AUTO_ACCEPT_DRAW_OPTION]: false, [AUTO_ACCEPT_EXIT_OPTION]: false,
        [AUTO_ACCEPT_TOOL_OPTION]: false, [CAMERA_SPEED_OPTION]: 1
    }, 'every box off and the camera at its own speed');
    assert.deepEqual(CAMERA_SPEEDS.map(speed => [speed.value, speed.label]), [[0.5, 'SLOW'], [1, 'NORMAL'], [2, 'FAST']]);
    const ids = builderSettingsEntries().map(entry => entry.id);
    assert.equal(new Set(ids).size, ids.length, 'every row its own id');
    assert.equal(BUILDER_SETTINGS_STORAGE_KEY, 'pilot-matter.builder-settings', 'beside the game\'s two keys');
});

test('a box reads as the box it is, and the speed as the setting it is on', () => {
    const state = createBuilderSettingsState(fakeStorage());
    assert.equal(builderSettingsEntry(state, AUTO_ACCEPT_ALL_OPTION).text, `${TOGGLE_OFF_MARK} ALL`);
    assert.equal(builderSettingsEntry(state, CAMERA_SPEED_OPTION).text, 'CAMERA SPEED  ‹ NORMAL ›');
    adjustBuilderSetting(state, AUTO_ACCEPT_TOOL_OPTION, 1);
    assert.equal(builderSettingsEntry(state, AUTO_ACCEPT_TOOL_OPTION).text, `${TOGGLE_ON_MARK} WHEN CHANGING TOOL`);
    adjustBuilderSetting(state, CAMERA_SPEED_OPTION, 1);
    assert.equal(builderSettingsEntry(state, CAMERA_SPEED_OPTION).text, 'CAMERA SPEED  ‹ FAST ›');
    assert.equal(adjustBuilderSetting(state, CAMERA_SPEED_OPTION, 1), CAMERA_SPEED_OPTION, 'and round past the end');
    assert.equal(builderCameraSpeed(state), 0.5);
    assert.equal(adjustBuilderSetting(state, RESET_BUILDER_SETTINGS_ID, 1), null, 'the rows that hold nothing do not step');
    assert.equal(adjustBuilderSetting(state, BUILDER_SETTINGS_BACK_ID, 1), null);
    assert.equal(adjustBuilderSetting(state, CAMERA_SPEED_OPTION, 0), null);
});

// --- Kept --------------------------------------------------------------------------------------

test('every value reads back as written, under the builder\'s own key', () => {
    const storage = fakeStorage();
    const state = createBuilderSettingsState(storage);
    chooseBuilderSetting(state, AUTO_ACCEPT_DRAW_OPTION);
    chooseBuilderSetting(state, AUTO_ACCEPT_EXIT_OPTION);
    adjustBuilderSetting(state, CAMERA_SPEED_OPTION, -1);
    assert.deepEqual(Object.keys(storage.data), [BUILDER_SETTINGS_STORAGE_KEY], 'nothing written under another key');
    const again = createBuilderSettingsState(storage);
    assert.deepEqual(again.values, state.values);
    assert.equal(again.values[AUTO_ACCEPT_DRAW_OPTION], true);
    assert.equal(again.values[CAMERA_SPEED_OPTION], 0.5);
});

test('the defaults where nothing was stored, a shape from another version, or a storage that fails', () => {
    assert.deepEqual(readBuilderSettings(null), defaultBuilderSettings());
    assert.deepEqual(readBuilderSettings(fakeStorage()), defaultBuilderSettings());
    assert.deepEqual(readBuilderSettings(fakeStorage({ [BUILDER_SETTINGS_STORAGE_KEY]: 'not json' })), defaultBuilderSettings());
    assert.deepEqual(readBuilderSettings(fakeStorage({ [BUILDER_SETTINGS_STORAGE_KEY]: '[true]' })), defaultBuilderSettings());

    // One value this version has never heard of costs the others nothing.
    const mixed = readBuilderSettings(fakeStorage({
        [BUILDER_SETTINGS_STORAGE_KEY]: JSON.stringify({ [AUTO_ACCEPT_ALL_OPTION]: true, [CAMERA_SPEED_OPTION]: 3, gone: 1, [AUTO_ACCEPT_TOOL_OPTION]: 'yes' })
    }));
    assert.equal(mixed[AUTO_ACCEPT_ALL_OPTION], true);
    assert.equal(mixed[CAMERA_SPEED_OPTION], 1, 'a speed it does not offer');
    assert.equal(mixed[AUTO_ACCEPT_TOOL_OPTION], false, 'a box that is not a box');
    assert.equal('gone' in mixed, false);

    const throwing = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('full'); } };
    assert.deepEqual(readBuilderSettings(throwing), defaultBuilderSettings());
    assert.equal(writeBuilderSettings(throwing, defaultBuilderSettings()), false, 'a refused write costs the memory and nothing else');
    const state = createBuilderSettingsState(throwing);
    assert.equal(chooseBuilderSetting(state, AUTO_ACCEPT_ALL_OPTION), AUTO_ACCEPT_ALL_OPTION, 'and the screen still works');
    assert.equal(writeBuilderSettings(null, {}), false);
});

// --- ALL over the moments ------------------------------------------------------------------

test('with ALL on the three moments read on and do not step, and ALL off gives back what they were', () => {
    const state = createBuilderSettingsState(fakeStorage());
    chooseBuilderSetting(state, AUTO_ACCEPT_EXIT_OPTION);
    chooseBuilderSetting(state, AUTO_ACCEPT_ALL_OPTION);

    for (const id of MOMENTS) {
        const entry = builderSettingsEntry(state, id);
        assert.equal(entry.locked, true, `${id} held by ALL`);
        assert.equal(entry.value, true, `${id} reads on`);
        assert.equal(isMomentLocked(state, id), true);
        assert.equal(chooseBuilderSetting(state, id), null, `${id} does not step`);
        assert.equal(adjustBuilderSetting(state, id, -1), null);
    }
    assert.equal(isMomentLocked(state, AUTO_ACCEPT_ALL_OPTION), false, 'ALL is never held');
    assert.deepEqual(builderAutoAccept(state), { all: true, draw: false, exit: true, tool: false },
        'each moment as the pilot left it, ALL read over them where a moment is asked about');

    chooseBuilderSetting(state, AUTO_ACCEPT_ALL_OPTION);
    assert.deepEqual(MOMENTS.map(id => builderSettingsEntry(state, id).value), [false, true, false], 'given back');
    assert.ok(MOMENTS.every(id => builderSettingsEntry(state, id).locked === false));
});

test('RESET TO DEFAULTS puts every row back and writes it', () => {
    const storage = fakeStorage();
    const state = createBuilderSettingsState(storage);
    for (const id of [AUTO_ACCEPT_ALL_OPTION, AUTO_ACCEPT_TOOL_OPTION]) chooseBuilderSetting(state, id);
    adjustBuilderSetting(state, CAMERA_SPEED_OPTION, 1);
    assert.equal(chooseBuilderSetting(state, RESET_BUILDER_SETTINGS_ID), RESET_BUILDER_SETTINGS_ID);
    assert.deepEqual(state.values, defaultBuilderSettings());
    assert.deepEqual(JSON.parse(storage.data[BUILDER_SETTINGS_STORAGE_KEY]), defaultBuilderSettings());
    assert.ok(state.entries.filter(entry => entry.kind === TOGGLE_ENTRY).every(entry => entry.value === false && !entry.locked));
    assert.equal(resetBuilderSettings(state), false, 'nothing left to put back');
});

// --- Where it opens from, and where BACK goes ------------------------------------------------

test('the screen remembers what opened it, and closing it says where to go back to', () => {
    const state = createBuilderSettingsState();
    assert.equal(builderSettingsShowing(state), false);
    assert.equal(closeBuilderSettings(state), null, 'nothing to close');

    assert.equal(openBuilderSettings(state, BUILDER_SETTINGS_FROM_SETTINGS), true);
    assert.equal(builderSettingsFrom(state), BUILDER_SETTINGS_FROM_SETTINGS);
    assert.equal(openBuilderSettings(state, BUILDER_SETTINGS_FROM_BUILDER), false, 'not opened again over itself');
    assert.equal(builderSettingsFrom(state), BUILDER_SETTINGS_FROM_SETTINGS);
    assert.equal(chooseBuilderSetting(state, BUILDER_SETTINGS_BACK_ID), BUILDER_SETTINGS_BACK_ID);
    assert.equal(builderSettingsShowing(state), false);

    openBuilderSettings(state, 'somewhere');
    assert.equal(builderSettingsFrom(state), BUILDER_SETTINGS_FROM_BUILDER, 'anywhere else is the builder');
    assert.equal(closeBuilderSettings(state), BUILDER_SETTINGS_FROM_BUILDER);
    assert.equal(builderSettingsFrom(state), null);

    assert.deepEqual(BUILDER_SETTINGS_CLOSE_KEYS, ['Escape', 'Backspace']);
    assert.ok(BUILDER_SETTINGS_CLOSE_KEYS.every(isBuilderSettingsCloseKey));
    assert.equal(isBuilderSettingsOpenKey('KeyO'), true, 'the key that opens the game\'s settings everywhere else');
    assert.ok(SETTINGS_OPEN_KEYS.every(isBuilderSettingsOpenKey));
    assert.equal(isBuilderSettingsOpenKey('KeyL'), false);
});

test('the game\'s settings carry a row that opens the builder\'s in their place, and stepping it changes nothing', () => {
    const settings = createSettingsState(fakeStorage());
    openSettings(settings);
    const values = structuredClone(settings.values);
    assert.equal(adjustSetting(settings, BUILDER_SETTINGS_ID, 1), null, 'it holds no value');
    assert.equal(adjustSetting(settings, BUILDER_SETTINGS_ID, -1), null);
    assert.deepEqual(settings.values, values);
    assert.equal(settingsShowing(settings), true);
    assert.equal(chooseSetting(settings, BUILDER_SETTINGS_ID), BUILDER_SETTINGS_ID);
    assert.equal(settingsShowing(settings), false, 'closed for the builder\'s to open in its place');
    assert.deepEqual(settings.values, values);
    assert.equal(chooseSetting(settings, SETTINGS_BACK_ID), SETTINGS_BACK_ID);
});

// --- The editor's preferences and never the world's -----------------------------------------

test('nothing that builds ground reads a builder setting', () => {
    const files = dir => readdirSync(join(ROOT, dir), { withFileTypes: true })
        .flatMap(entry => entry.isDirectory() ? files(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`]);
    for (const path of files('js/environment').filter(path => path.endsWith('.js'))) {
        assert.doesNotMatch(read(path), /builder-settings/, `${path} reads the builder's settings`);
    }
    assert.doesNotMatch(read('js/build-mode.js'), /from '\.\/builder-settings\.js'/,
        'the session is handed the moments rather than reading the screen');
    assert.doesNotMatch(read('js/build-panel.js'), /builder-settings/);
});

test('the same strokes build the same ground under every builder setting', () => {
    const stroke = { points: [[-2000, 0], [2000, 400]], stamp: { width: 1200, depth: 1200, corner: 600 } };

    // Each stroke kept by hand, with every builder setting off, and kept by
    // auto accept with every one on: the world built is the same.
    const built = moments => {
        const state = createBuildState();
        openBuildMode(state, BUILD_FROM_TITLE);
        beginCanvas(state, 'highlands');
        setAutoAccept(state, moments);
        chooseBuildTool(state, 'grass');
        layStroke(state, stroke.points, stroke.stamp);
        acceptDraft(state);
        layStroke(state, [[-1000, -1500], [1000, -1200]], stroke.stamp);
        acceptDraft(state);
        return committedPlacements(state);
    };
    const off = built({});
    const on = built({ all: true, draw: true, exit: true, tool: true });
    assert.deepEqual(on, off, 'no placement carries a builder setting');
    for (const placement of on) assert.doesNotMatch(JSON.stringify(placement), /autoAccept|cameraSpeed/);

    const env = getEnvironment('highlands');
    const ground = placements => buildEnvironment(env, { segments: 40, elements: placements });
    assert.deepEqual([...ground(on).height], [...ground(off).height]);
    assert.deepEqual([...ground(on).color], [...ground(off).color]);
});
