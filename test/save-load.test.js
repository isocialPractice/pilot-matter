import test from 'node:test';
import assert from 'node:assert/strict';

import {
    createSettingsState, settingsEntries, chooseSetting, currentEnvironment, readSettings, defaultSettings,
    setSettingsWorlds, loadedChosen, chooseLoadedWorld, setFileNotice, syncSettingsEntries,
    ENVIRONMENT_ENTRY, FILE_ENTRY, FILE_GROUP, SCREEN_ENTRY, BACK_ENTRY, SETTINGS_STORAGE_KEY,
    LOADED_ENVIRONMENT_ID, LOAD_ENVIRONMENT_ID, SAVE_ENVIRONMENT_ID, LOAD_ENVIRONMENT_LABEL, SAVE_ENVIRONMENT_LABEL
} from '../js/settings.js';
import {
    LOADED_WORLD_STORAGE_KEY, readLoadedWorld, writeLoadedWorld, loadedWorldFrom, loadedWorldOf, loadedWorldEntry
} from '../js/loaded-world.js';
import { environmentDocument, environmentText, readEnvironmentDocument } from '../js/environment-file.js';
import {
    createBuildState, openBuildMode, beginCanvas, chooseBuildTool, dropDraft, acceptDraft, buildModeTool, buildModeDrawing,
    requestLeave, answerConfirm, buildConfirm, confirmOpen, committedPlacements, worldRows,
    REPLACE_WORLD, CONFIRM_ENTRIES, CONFIRM_YES, CONFIRM_NO, CONFIRM_STAY, CONFIRM_HEADINGS,
    confirmEntries, requestLoad, loadCanvas, replacesBuild, sessionWorld, saveName, setSaveName, fileStatus, setFileStatus,
    BUILD_FROM_TITLE
} from '../js/build-mode.js';
import {
    dockContent, DOCK_FILES, DOCK_LOAD_ENVIRONMENT, DOCK_SAVE_ENVIRONMENT, FILES_SECTION, FILES_NAME_FIELD, ASSETS_SECTION, DOCK_DESELECT
} from '../js/build-panel.js';
import { statusLines, statusToShow } from '../js/panel-view.js';
import { createEditorState, canvasWorld, keepBuiltWorld, builtWorld, setEditorWorld, releaseBuiltWorld } from '../js/element-editor.js';
import { FILES_TOOL } from '../js/build-tools.js';
import { setSelection } from '../js/build-mode.js';

/** A storage as a browser's local storage behaves: strings in, strings out, and a quota. */
function memoryStorage(limit = Infinity) {
    const held = new Map();
    return {
        held,
        getItem: key => (held.has(key) ? held.get(key) : null),
        setItem: (key, value) => {
            if (String(value).length > limit) throw new Error('QuotaExceededError');
            held.set(key, String(value));
        },
        removeItem: key => held.delete(key)
    };
}

/** The text of a world built on `base` with one mountain on it, as a file would hold it. */
function worldText(base = 'highlands', name = 'Sample Valley') {
    const editor = createEditorState(base);
    const world = {
        environment: base,
        placements: [{ type: 'mountain', config: { count: 1, at: [1200, -800] }, seed: 7 }],
        world: canvasWorld(editor, base)
    };
    return environmentText(environmentDocument(world, { name, savedAt: '2026-11-05T12:00:00.000Z' }));
}

// --- The world the browser keeps ---------------------------------------------------

test('the last world a file brought is kept as the file\'s own text, and read back through the format', () => {
    const storage = memoryStorage();
    assert.equal(LOADED_WORLD_STORAGE_KEY, 'pilot-matter.environment');
    assert.equal(readLoadedWorld(storage), null, 'nothing kept, nothing read');

    const text = worldText();
    assert.equal(writeLoadedWorld(storage, text), true);
    assert.equal(storage.held.get(LOADED_WORLD_STORAGE_KEY), text, 'the file as it was, not a copy rewritten');

    const loaded = readLoadedWorld(storage);
    assert.equal(loaded.name, 'Sample Valley');
    assert.equal(loaded.base, 'highlands');
    assert.deepEqual(loaded.world, readEnvironmentDocument(text).world);
    assert.equal(loaded.text, text);
});

test('a kept world that no longer reads is no world, and a storage that is full keeps none', () => {
    const storage = memoryStorage();
    storage.setItem(LOADED_WORLD_STORAGE_KEY, '{ "format": "something-else" }');
    assert.equal(readLoadedWorld(storage), null);
    assert.equal(readLoadedWorld({ getItem() { throw new Error('denied'); } }), null, 'nor one that cannot be reached');
    assert.equal(writeLoadedWorld(memoryStorage(10), worldText()), false, 'too large to keep');
    assert.equal(writeLoadedWorld(null, worldText()), false);
});

test('a file read as a world says why it is not one', () => {
    assert.equal(loadedWorldFrom('not json'), null);
    const refused = loadedWorldOf('not json');
    assert.equal(refused.loaded, null);
    assert.match(refused.problems[0], /not JSON/);
    assert.equal(loadedWorldOf(worldText()).loaded.name, 'Sample Valley');
});

test('the loaded world is listed under its name, saying what it is and what it was built on', () => {
    assert.deepEqual(loadedWorldEntry(loadedWorldFrom(worldText('blank-canvas', 'Acme Field'))),
        { label: 'ACME FIELD', note: 'loaded from a file, built on BLANK CANVAS' });
    assert.equal(loadedWorldEntry(null), null);
});

// --- The settings: the loaded world, and the two file rows -------------------------------

const ENTRY = { label: 'SAMPLE VALLEY', note: 'loaded from a file, built on HIGHLANDS' };

test('the two file rows end the worlds, load first, each a verb, an object and an ellipsis', () => {
    const entries = settingsEntries();
    const ids = entries.map(entry => entry.id);
    const files = entries.filter(entry => entry.kind === FILE_ENTRY);
    assert.deepEqual(files.map(entry => entry.id), [LOAD_ENVIRONMENT_ID, SAVE_ENVIRONMENT_ID]);
    assert.deepEqual(files.map(entry => entry.label), ['LOAD ENVIRONMENT…', 'SAVE ENVIRONMENT…']);
    assert.deepEqual([LOAD_ENVIRONMENT_LABEL, SAVE_ENVIRONMENT_LABEL], files.map(entry => entry.label));
    assert.ok(files.every(entry => entry.group === FILE_GROUP && entry.note.length > 0));
    const lastWorld = Math.max(...entries.map((entry, at) => (entry.kind === ENVIRONMENT_ENTRY ? at : -1)));
    assert.equal(ids.indexOf(LOAD_ENVIRONMENT_ID), lastWorld + 1, 'straight after the last world, which they act on');
    assert.equal(ids.indexOf(SAVE_ENVIRONMENT_ID), lastWorld + 2);
});

test('the world a file brought is listed after the presets, and the file rows go while a game mode runs', () => {
    const withLoaded = settingsEntries(undefined, undefined, { loaded: ENTRY });
    const worlds = withLoaded.filter(entry => entry.kind === ENVIRONMENT_ENTRY);
    assert.deepEqual(worlds.at(-1), { kind: ENVIRONMENT_ENTRY, id: LOADED_ENVIRONMENT_ID, label: ENTRY.label, note: ENTRY.note, current: false });
    assert.equal(withLoaded.findIndex(entry => entry.id === LOADED_ENVIRONMENT_ID) + 1, withLoaded.findIndex(entry => entry.id === LOAD_ENVIRONMENT_ID));

    const inMode = settingsEntries(undefined, undefined, { loaded: ENTRY, files: false });
    assert.equal(inMode.some(entry => entry.kind === FILE_ENTRY), false);
    assert.equal(inMode.some(entry => entry.id === LOADED_ENVIRONMENT_ID), true, 'the world stays, as the presets do');
    assert.equal(inMode.at(-1).kind, BACK_ENTRY);
    assert.ok(inMode.some(entry => entry.kind === SCREEN_ENTRY));
});

test('whether the loaded world is chosen is held beside the environment, which stays a preset', () => {
    assert.equal(defaultSettings().loaded, false);
    const storage = memoryStorage();
    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ environment: 'dune-sea', loaded: true }));
    assert.deepEqual([readSettings(storage).environment, readSettings(storage).loaded], ['dune-sea', true]);
    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ environment: LOADED_ENVIRONMENT_ID, loaded: 'yes' }));
    assert.deepEqual([readSettings(storage).environment, readSettings(storage).loaded], ['highlands', false],
        'a stored environment is a preset or the default, and only true is chosen');
});

test('a loaded world chosen last session is chosen again only while the browser keeps it', () => {
    const storage = memoryStorage();
    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ environment: 'highlands', loaded: true }));

    const kept = createSettingsState(storage, undefined, undefined, { loaded: ENTRY });
    assert.equal(loadedChosen(kept), true);
    assert.deepEqual(kept.entries.filter(entry => entry.kind === ENVIRONMENT_ENTRY && entry.current).map(entry => entry.id), [LOADED_ENVIRONMENT_ID],
        'the one world marked as flown is the loaded one, not the preset it was built on');

    const gone = createSettingsState(storage, undefined, undefined, {});
    assert.equal(loadedChosen(gone), false);
    assert.deepEqual(gone.entries.filter(entry => entry.kind === ENVIRONMENT_ENTRY && entry.current).map(entry => entry.id), ['highlands']);
});

/**
 * A stale choice - stored as chosen last session, the world itself gone since -
 * is let go of as the panel is made. Kept, it would choose the next world a
 * file brought the moment it was listed, while the editor flew something else.
 */
test('a world loaded after one the browser lost is listed, not chosen by a choice left over', () => {
    const storage = memoryStorage();
    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ environment: 'highlands', loaded: true }));
    const state = createSettingsState(storage, undefined, undefined, {});
    assert.equal(state.values.loaded, false, 'the choice let go of with the world it was of');

    setSettingsWorlds(state, { loaded: ENTRY });
    assert.equal(loadedChosen(state), false, 'listed, and not chosen until it is');
    assert.deepEqual(state.entries.filter(entry => entry.kind === ENVIRONMENT_ENTRY && entry.current).map(entry => entry.id), ['highlands']);
});

test('the loaded world is chosen by its row, and a preset chosen over it is a new world, even its own', () => {
    const storage = memoryStorage();
    const state = createSettingsState(storage, undefined, undefined, { loaded: ENTRY });
    assert.equal(chooseSetting(state, LOADED_ENVIRONMENT_ID), LOADED_ENVIRONMENT_ID, 'answered as itself, for the caller to fly');
    assert.equal(loadedChosen(state), false, 'which the caller does through chooseLoadedWorld');

    assert.equal(chooseLoadedWorld(state, true, 'canyon-country'), true);
    assert.equal(loadedChosen(state), true);
    assert.equal(currentEnvironment(state), 'canyon-country', 'the settings hold the preset it was built on');
    assert.equal(JSON.parse(storage.held.get(SETTINGS_STORAGE_KEY)).loaded, true, 'and the choice is stored');
    assert.equal(chooseSetting(state, LOADED_ENVIRONMENT_ID), null, 'chosen again, nothing changes');

    assert.equal(chooseSetting(state, 'canyon-country'), 'canyon-country', 'the preset it was built on is a different world');
    assert.equal(loadedChosen(state), false);
    assert.equal(chooseSetting(state, 'canyon-country'), null, 'and then the same one');
});

test('a loaded world built on a canvas the settings do not offer leaves the environment as it was', () => {
    const state = createSettingsState(memoryStorage(), undefined, undefined, { loaded: ENTRY });
    chooseSetting(state, 'lakeside');
    chooseLoadedWorld(state, true, 'blank-canvas');
    assert.equal(currentEnvironment(state), 'lakeside');
    assert.equal(loadedChosen(state), true);
    assert.equal(chooseLoadedWorld(state, false), true, 'and let go of');
    assert.equal(loadedChosen(state), false);
});

test('with no loaded world there is nothing to choose, and the choice of one goes back to its preset', () => {
    const storage = memoryStorage();
    const state = createSettingsState(storage, undefined, undefined, { loaded: ENTRY });
    chooseLoadedWorld(state, true, 'highlands');
    setSettingsWorlds(state, { loaded: null });
    assert.equal(loadedChosen(state), false);
    assert.equal(state.values.loaded, false);
    assert.equal(JSON.parse(storage.held.get(SETTINGS_STORAGE_KEY)).loaded, false, 'written back');
    assert.equal(chooseSetting(state, LOADED_ENVIRONMENT_ID), null);
    assert.equal(chooseLoadedWorld(state, true, 'highlands'), false);
    assert.equal(state.entries.some(entry => entry.id === LOADED_ENVIRONMENT_ID), false);
});

test('a file row answers as itself, and says what it came to until the next is pressed', () => {
    const state = createSettingsState(memoryStorage());
    assert.equal(chooseSetting(state, LOAD_ENVIRONMENT_ID), LOAD_ENVIRONMENT_ID);
    assert.equal(chooseSetting(state, SAVE_ENVIRONMENT_ID), SAVE_ENVIRONMENT_ID);

    const row = id => state.entries.find(entry => entry.id === id);
    const was = row(SAVE_ENVIRONMENT_ID).note;
    setFileNotice(state, SAVE_ENVIRONMENT_ID, 'saved sample-valley.pilot-matter.json');
    assert.equal(row(SAVE_ENVIRONMENT_ID).note, 'saved sample-valley.pilot-matter.json');
    assert.equal(row(SAVE_ENVIRONMENT_ID).refused, false);
    assert.notEqual(row(LOAD_ENVIRONMENT_ID).note, 'saved sample-valley.pilot-matter.json', 'on its own row only');

    setFileNotice(state, LOAD_ENVIRONMENT_ID, 'could not load nope.json: the file is not JSON', { refused: true });
    assert.equal(row(LOAD_ENVIRONMENT_ID).refused, true);
    assert.equal(row(SAVE_ENVIRONMENT_ID).note, was, 'the save row back to what it does');

    setFileNotice(state, null, null);
    syncSettingsEntries(state);
    assert.equal(row(LOAD_ENVIRONMENT_ID).refused, false);

    setSettingsWorlds(state, { files: false });
    assert.equal(chooseSetting(state, LOAD_ENVIRONMENT_ID), null, 'and while a game mode runs, there is no row to answer');
});

// --- The editor: a loaded world kept, and let go of ----------------------------------------

test('a loaded world is kept on the editor as a build is, and let go of whole', () => {
    const loaded = loadedWorldFrom(worldText('highlands'));
    const editor = createEditorState('highlands');
    keepBuiltWorld(editor, loaded.world.environment, false, loaded.world.placements, 'highlands', loaded.world.world);
    assert.equal(builtWorld(editor).placements.length, 1);

    assert.equal(setEditorWorld(editor, 'highlands', false), false, 'the same preset keeps what was built on it');
    assert.equal(builtWorld(editor).placements.length, 1);

    releaseBuiltWorld(editor);
    assert.equal(setEditorWorld(editor, 'highlands', false), true, 'let go of, the same preset is drawn afresh');
    assert.equal(builtWorld(editor), null);
});

// --- The builder: what is saved, what a load asks, and what it opens ---------------------

function canvas(environment = 'highlands') {
    const state = createBuildState();
    openBuildMode(state, BUILD_FROM_TITLE);
    beginCanvas(state, environment, [], canvasWorld(createEditorState(environment), environment));
    return state;
}

function withMountain(state = canvas()) {
    chooseBuildTool(state, 'mountain');
    dropDraft(state, { x: 300, y: 40, z: -200 });
    acceptDraft(state);
    return state;
}

test('replacing the built world is asked with YES and CANCEL, there being nothing to keep beside it', () => {
    assert.equal(CONFIRM_HEADINGS[REPLACE_WORLD], 'REPLACE THE BUILT WORLD');
    assert.deepEqual(confirmEntries(REPLACE_WORLD).map(entry => entry.id), [CONFIRM_YES, CONFIRM_STAY]);
    assert.deepEqual(confirmEntries(REPLACE_WORLD).map(entry => entry.label), ['YES', 'CANCEL']);
    assert.equal(confirmEntries('save-and-exit'), CONFIRM_ENTRIES, 'the other two keep their three');
});

test('a load over nothing built goes straight to the file, and over a build asks first', () => {
    const fresh = canvas();
    assert.equal(replacesBuild(fresh), false);
    assert.deepEqual(requestLoad(fresh), { load: true });
    assert.equal(confirmOpen(fresh), false);

    const built = withMountain();
    assert.equal(replacesBuild(built), true);
    assert.deepEqual(requestLoad(built), { confirm: REPLACE_WORLD });
    assert.equal(buildConfirm(built), REPLACE_WORLD);
    assert.equal(requestLoad(built), null, 'nor asked twice');
    assert.deepEqual(answerConfirm(built, CONFIRM_YES), { load: true }, 'YES goes on to the file');

    for (const answer of [CONFIRM_STAY, CONFIRM_NO]) {
        const again = withMountain();
        requestLoad(again);
        assert.deepEqual(answerConfirm(again, answer), { stay: true }, `${answer} changes nothing`);
        assert.equal(committedPlacements(again).length, 1);
        assert.equal(buildModeDrawing(again), true);
    }
});

test('the world\'s rows changed is a build a load would take away too', () => {
    const state = canvas();
    state.world[0].config = { ...state.world[0].config, height: [300, 900] };
    assert.equal(replacesBuild(state), true);
});

test('no load is asked for off a canvas, under a question, or with an edit in hand', () => {
    assert.equal(requestLoad(createBuildState()), null);
    const asking = withMountain();
    requestLeave(asking);
    assert.equal(requestLoad(asking), null);
    const editing = canvas();
    chooseBuildTool(editing, 'mountain');
    dropDraft(editing, { x: 0, y: 40, z: 0 });
    assert.equal(requestLoad(editing), null);
    assert.equal(loadCanvas(editing, { environment: 'highlands' }), false);
});

test('a world loaded into a canvas is opened in its place, built as the file was, with SAVE / LOAD still live', () => {
    const state = withMountain(canvas('highlands'));
    chooseBuildTool(state, FILES_TOOL);
    setFileStatus(state, 'saved something');
    const loaded = loadedWorldFrom(worldText('dune-sea', 'Acme Dunes'));

    assert.equal(loadCanvas(state, loaded.world, loaded.name), true);
    assert.equal(state.environment, 'dune-sea');
    assert.deepEqual(committedPlacements(state), loaded.world.placements);
    assert.deepEqual(worldRows(state), loaded.world.world);
    assert.equal(buildModeTool(state), FILES_TOOL, 'the panel the load was asked from stays in front of the pilot');
    assert.equal(saveName(state), 'Acme Dunes', 'and saved again, under the name it came with');
    assert.equal(fileStatus(state), null, 'what the last answer came to is the caller\'s to say');
    assert.equal(replacesBuild(state), true, 'what it brought is a build a second load would replace');
    assert.equal(loadCanvas(state, { environment: '' }), false);
});

test('what a save writes is the canvas\'s world, and a file of it reads back the same world', () => {
    const state = withMountain();
    const world = sessionWorld(state);
    assert.deepEqual(Object.keys(world), ['environment', 'placements', 'world']);
    assert.equal(world.environment, 'highlands');
    assert.deepEqual(world.placements, committedPlacements(state));
    assert.deepEqual(world.world, worldRows(state));

    const read = readEnvironmentDocument(environmentText(environmentDocument(world, { name: 'Sample Valley' })));
    assert.equal(read.ok, true, read.problems.join('; '));
    assert.deepEqual(read.world, world);
    assert.equal(sessionWorld(createBuildState()), null);
});

test('the name a save writes under is the pilot\'s, and what it came to is held until the next', () => {
    const state = canvas();
    assert.equal(saveName(state), '');
    assert.equal(setSaveName(state, 'Sample Valley'), true);
    assert.equal(saveName(state), 'Sample Valley');
    assert.equal(setSaveName(state, 7), true);
    assert.equal(saveName(state), '', 'a name that is not text is none');
    assert.equal(setFileStatus(state, 'could not load nope.json: the file is not JSON', { refused: true }), true);
    assert.deepEqual(fileStatus(state), { text: 'could not load nope.json: the file is not JSON', refused: true });
    setFileStatus(state, '');
    assert.equal(fileStatus(state), null);
    assert.equal(setSaveName(createBuildState(), 'x'), false);
});

test('SAVE / LOAD\'s panel is the world\'s name, what the last answer came to, and the two answers, load first', () => {
    const state = canvas('river-basin');
    chooseBuildTool(state, FILES_TOOL);
    let content = dockContent(state);
    assert.equal(content.kind, DOCK_FILES);
    assert.equal(content.heading, 'SAVE / LOAD');
    assert.deepEqual(content.actions.slice(0, 2), [DOCK_LOAD_ENVIRONMENT, DOCK_SAVE_ENVIRONMENT]);
    assert.deepEqual(content.actions.map(action => action.label), ['LOAD ENVIRONMENT…', 'SAVE ENVIRONMENT…', 'LOAD ASSET…', 'REMOVE ASSET'],
        'the world first, then the models');
    const [section] = content.sections;
    assert.equal(section.id, FILES_SECTION);
    assert.equal(section.heading, 'ENVIRONMENT');
    assert.deepEqual(section.text, { id: FILES_NAME_FIELD, label: 'NAME', value: '', placeholder: 'River Basin', max: 60 },
        'the environment\'s own name until one is typed');
    assert.equal(section.status, null);
    assert.deepEqual(content.rows, [], 'and no range: the work is files');

    setSaveName(state, 'Sample Valley');
    setFileStatus(state, 'saved sample-valley.pilot-matter.json');
    content = dockContent(state);
    assert.equal(content.sections[0].text.value, 'Sample Valley');
    assert.deepEqual(content.sections[0].status, { text: 'saved sample-valley.pilot-matter.json', refused: false });

    // Both sections carry a line, so which of them the view scrolls to is a
    // question the content answers: the one whose words changed, and the
    // refused one first. ASSETS always says something, which is why a
    // section's first line is never news - see `js/panel-view.js`.
    assert.deepEqual(statusLines(content).map(line => line.id), [FILES_SECTION, ASSETS_SECTION]);
    const said = new Map(statusLines(content).map(line => [line.id, line.text]));
    assert.equal(statusToShow(content, said), null, 'nothing changed, so nothing is scrolled to');
    setFileStatus(state, 'could not load nope.json: the file is not JSON', { refused: true });
    assert.deepEqual(statusToShow(dockContent(state), said),
        { id: FILES_SECTION, text: 'could not load nope.json: the file is not JSON', refused: true });
    setFileStatus(state, '');

    setSelection(state, { kind: 'disc', x: 0, z: 0, radius: 500 });
    assert.deepEqual(dockContent(state).actions.map(action => action.id),
        [DOCK_LOAD_ENVIRONMENT.id, DOCK_SAVE_ENVIRONMENT.id, 'load-asset', 'remove-asset', DOCK_DESELECT.id], 'and DESELECT while something is selected');
});
