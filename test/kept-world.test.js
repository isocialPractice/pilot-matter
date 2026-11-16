import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
    ASSET_DATABASE, ASSET_STORE, WORLD_STORE, ASSET_DATABASE_VERSION, KEPT_WORLD_KEY,
    readKeptWorld, keepWorld, forgetKeptWorld, readKeptAssets, keepAsset, forgetAsset
} from '../js/asset-store.js';
import {
    createSettingsState, settingsEntries, syncSettingsEntries, setSettingsBuilt, builtChosen,
    chooseSetting, chooseLoadedWorld, loadedChosen, currentEnvironment,
    ENVIRONMENT_ENTRY, LOADED_ENVIRONMENT_ID, BUILT_WORLD_NOTE
} from '../js/settings.js';
import { ENVIRONMENTS } from '../js/environment/presets.js';
import {
    createEditorState, keepBuiltWorld, releaseBuiltWorld, builtWorld
} from '../js/element-editor.js';
import { environmentDocument, environmentText } from '../js/environment-file.js';
import { loadedWorldOf } from '../js/loaded-world.js';
import { placeObject } from '../js/objects.js';

const source = name => readFileSync(fileURLToPath(new URL(`../js/${name}`, import.meta.url)), 'utf8');

function methodBody(text, name) {
    const match = new RegExp(`^\\s+(?:async\\s+)?${name}\\((?:[^()]|\\([^()]*\\))*\\)\\s*\\{`, 'm').exec(text);
    assert.ok(match, `no method named ${name}`);
    let depth = 0;
    for (let i = match.index + match[0].length - 1; i < text.length; i++) {
        if (text[i] === '{') depth++;
        else if (text[i] === '}' && --depth === 0) return text.slice(match.index + match[0].length - 1, i + 1);
    }
    assert.fail(`${name} never closes`);
}

// --- A standing-in IndexedDB ------------------------------------------------
//
// Enough of the interface for `js/asset-store.js` to be driven in Node: open
// with an upgrade, a transaction against one store, and get, getAll, put and
// delete inside it. Every callback fires on a later turn, the way the browser's
// does, so a module that assigns its handlers after the call still sees them.

function fakeIdb({ version = 0, data = {}, refuse = false, refuseWrite = false } = {}) {
    const state = { version, data, opened: 0, upgrades: 0 };

    const later = work => queueMicrotask(work);

    const db = () => ({
        objectStoreNames: { contains: name => Object.hasOwn(state.data, name) },
        createObjectStore(name) {
            state.data[name] = state.data[name] ?? new Map();
            return state.data[name];
        },
        transaction(name, mode) {
            if (!Object.hasOwn(state.data, name)) throw new Error(`no store named ${name}`);
            const rows = state.data[name];
            const transaction = { oncomplete: null, onerror: null, onabort: null };
            transaction.objectStore = () => ({
                get: key => {
                    const request = { result: rows.get(key) };
                    later(() => transaction.oncomplete?.());
                    return request;
                },
                getAll: () => {
                    const request = { result: [...rows.values()] };
                    later(() => transaction.oncomplete?.());
                    return request;
                },
                put: record => {
                    const request = {};
                    if (refuseWrite || mode !== 'readwrite') later(() => transaction.onerror?.());
                    else {
                        rows.set(record.id, record);
                        later(() => transaction.oncomplete?.());
                    }
                    return request;
                },
                delete: key => {
                    const request = {};
                    if (refuseWrite || mode !== 'readwrite') later(() => transaction.onerror?.());
                    else {
                        rows.delete(key);
                        later(() => transaction.oncomplete?.());
                    }
                    return request;
                }
            });
            return transaction;
        },
        close() {}
    });

    return {
        state,
        open(name, wanted) {
            state.opened++;
            const request = { onupgradeneeded: null, onsuccess: null, onerror: null, onblocked: null, result: null };
            later(() => {
                if (refuse) return request.onerror?.();
                request.result = db();
                if (wanted > state.version) {
                    state.version = wanted;
                    state.upgrades++;
                    request.onupgradeneeded?.();
                }
                request.onsuccess?.();
            });
            return request;
        }
    };
}

// --- The world kept beside the library -------------------------------------

test('the database holds the kept world in a store of its own, created beside the assets', async () => {
    assert.equal(ASSET_DATABASE, 'pilot-matter', 'the one database, as the library has always opened');
    assert.equal(ASSET_STORE, 'assets');
    assert.equal(WORLD_STORE, 'worlds');
    assert.notEqual(WORLD_STORE, ASSET_STORE, 'so a world is never listed as an asset');
    assert.ok(ASSET_DATABASE_VERSION >= 2, 'the version the second store was added at');

    // A browser that has only ever held assets, at version 1: the upgrade adds
    // the world store and leaves the assets it already had.
    const idb = fakeIdb({ version: 1, data: { [ASSET_STORE]: new Map([['a', { id: 'a', bytes: new Uint8Array([1]), added: 1 }]]) } });

    assert.equal(await readKeptWorld({ idb }), null, 'nothing kept yet');
    assert.equal(idb.state.upgrades, 1, 'the store was created rather than the read failing');

    const library = await readKeptAssets({ idb });
    assert.equal(library.length, 1, 'and the assets kept by version 1 are still there');
    assert.equal(library[0].id, 'a');
});

test('a world kept is the text handed over, read back whole, and let go of on asking', async () => {
    const idb = fakeIdb();

    assert.equal(await keepWorld('{"format":"pilot-matter.environment"}', { idb }), true);
    assert.equal(await readKeptWorld({ idb }), '{"format":"pilot-matter.environment"}');

    // One kept world rather than a library of them: the next replaces it.
    assert.equal(await keepWorld('second', { idb }), true);
    assert.equal(await readKeptWorld({ idb }), 'second');
    assert.equal([...idb.state.data[WORLD_STORE].values()].length, 1, 'under the one key');
    assert.equal([...idb.state.data[WORLD_STORE].keys()][0], KEPT_WORLD_KEY);

    assert.equal(await forgetKeptWorld({ idb }), true);
    assert.equal(await readKeptWorld({ idb }), null);
});

test('the world and the library are kept apart, each untouched by what the other does', async () => {
    const idb = fakeIdb();

    await keepWorld('a world', { idb });
    await keepAsset({ id: 'model', bytes: new Uint8Array([7]) }, { idb });

    assert.equal((await readKeptAssets({ idb })).length, 1, 'a kept world is no asset');
    assert.equal(await readKeptWorld({ idb }), 'a world');

    await forgetAsset('model', { idb });
    assert.equal(await readKeptWorld({ idb }), 'a world', 'and an asset let go of leaves the world kept');

    await keepAsset({ id: 'model', bytes: new Uint8Array([7]) }, { idb });
    await forgetKeptWorld({ idb });
    assert.equal((await readKeptAssets({ idb })).length, 1, 'as a world let go of leaves the library');
});

test('a browser that will not answer keeps nothing and says so, rather than throwing into the page', async () => {
    const closed = fakeIdb({ refuse: true });
    assert.equal(await readKeptWorld({ idb: closed }), null);
    assert.equal(await keepWorld('a world', { idb: closed }), false);
    assert.equal(await forgetKeptWorld({ idb: closed }), false);

    const full = fakeIdb({ refuseWrite: true });
    assert.equal(await keepWorld('a world', { idb: full }), false, 'a refused write is answered, not thrown');
    assert.equal(await readKeptWorld({ idb: full }), null);

    assert.equal(await readKeptWorld({ idb: null }), null, 'and a browser with no IndexedDB at all');
    assert.equal(await keepWorld('a world', { idb: null }), false);

    // Text is the only thing a world is kept as, so nothing else is written.
    const idb = fakeIdb();
    assert.equal(await keepWorld(undefined, { idb }), false);
    assert.equal(await keepWorld({ format: 'pilot-matter.environment' }, { idb }), false);
    assert.equal(await readKeptWorld({ idb }), null);
});

test('the kept world is the document a file would carry, and comes back as the build it was', async () => {
    // A build with everything the item names on it: a placement, a start point
    // and a plane.
    const editor = createEditorState('highlands', false);
    const placements = [placeObject('cottage', [200, -300], { heading: 45, scale: 1.5 })];
    keepBuiltWorld(editor, 'highlands', false, placements, 'highlands', null, {
        start: { at: [100, 200], heading: 90, heightFeet: 1200 },
        plane: 'jet'
    });

    const world = builtWorld(editor);
    assert.ok(world, 'something built is kept');

    const text = environmentText(environmentDocument(world, { name: 'Sample Valley', library: [] }));
    const idb = fakeIdb();
    assert.equal(await keepWorld(text, { idb }), true);

    // Read back the way the page reads it: through the environment file's own
    // reader, so a kept world a later version refuses is refused here too.
    const read = loadedWorldOf(await readKeptWorld({ idb }));
    assert.ok(read.loaded, read.problems[0]);
    assert.equal(read.loaded.world.environment, 'highlands');
    assert.equal(read.loaded.world.placements.length, 1);
    assert.deepEqual(read.loaded.world.start, { at: [100, 200], heading: 90, heightFeet: 1200 });
    assert.equal(read.loaded.world.plane, 'jet');

    // And put back on an editor, it is the build it was.
    const after = createEditorState('highlands', false);
    keepBuiltWorld(after, read.loaded.world.environment, false, read.loaded.world.placements,
        'highlands', read.loaded.world.world, read.loaded.world);
    assert.deepEqual(builtWorld(after).placements, world.placements);
    assert.deepEqual(builtWorld(after).start, world.start);
    assert.equal(builtWorld(after).plane, 'jet');
});

test('text that is no environment is refused on the way back in, and let go of rather than retried', async () => {
    const idb = fakeIdb();
    await keepWorld('{"format":"something else"}', { idb });

    const read = loadedWorldOf(await readKeptWorld({ idb }));
    assert.equal(read.loaded, null);
    assert.match(read.problems[0], /not an environment file/);

    // What the page does about it: the kept world goes, since a world this
    // version cannot read is not one a later run of it will read either.
    assert.match(methodBody(source('main.js'), 'restoreKeptWorld'),
        /if \(!read\.loaded\) \{\s*await forgetKeptWorld\(\);\s*return false;\s*\}/);
});

// --- The row that says what is being flown ---------------------------------

test('the chosen preset says when the world flown on it is the build kept on it', () => {
    const state = createSettingsState(null);
    const row = () => state.entries.find(entry => entry.kind === ENVIRONMENT_ENTRY && entry.current);
    const preset = ENVIRONMENTS.find(environment => environment.id === currentEnvironment(state));

    assert.equal(builtChosen(state), false);
    assert.equal(row().note, preset.description, 'the preset describes itself while it is the preset being flown');
    assert.equal(row().built, false);

    assert.equal(setSettingsBuilt(state, true), true, 'and it changed');
    assert.equal(builtChosen(state), true);
    assert.equal(row().note, BUILT_WORLD_NOTE);
    assert.equal(row().built, true);
    assert.match(BUILT_WORLD_NOTE, /built/, 'the row says a world was built on it');
    assert.match(BUILT_WORLD_NOTE, /again/, 'and that pressing it again is the way back');

    assert.equal(setSettingsBuilt(state, true), false, 'said twice, nothing moved');

    // Only the row being flown, never the rest of the list.
    for (const entry of state.entries.filter(entry => entry.kind === ENVIRONMENT_ENTRY && !entry.current)) {
        assert.equal(entry.built, false, `${entry.id} is not the world being flown`);
        assert.notEqual(entry.note, BUILT_WORLD_NOTE);
    }

    assert.equal(setSettingsBuilt(state, false), true);
    assert.equal(row().note, preset.description, 'and the row is its own description again once the build goes');
});

test('the world a file brought is listed as itself, so no preset claims its build', () => {
    const state = createSettingsState(null, ENVIRONMENTS, undefined,
        { loaded: { label: 'SAMPLE VALLEY', note: 'loaded from a file, built on Highlands' } });

    chooseLoadedWorld(state, true, currentEnvironment(state));
    setSettingsBuilt(state, true);

    assert.equal(loadedChosen(state), true);
    assert.equal(builtChosen(state), false, 'a file\'s world is its own row rather than a build on a preset');
    for (const entry of state.entries.filter(entry => entry.kind === ENVIRONMENT_ENTRY)) {
        assert.notEqual(entry.note, BUILT_WORLD_NOTE);
    }
    assert.equal(state.entries.find(entry => entry.id === LOADED_ENVIRONMENT_ID).current, true);
});

test('the chosen preset pressed again answers only when there is a build to let go of', () => {
    const state = createSettingsState(null);
    const chosen = currentEnvironment(state);
    const other = ENVIRONMENTS.find(environment => environment.id !== chosen).id;

    assert.equal(chooseSetting(state, chosen), null, 'the preset being flown, pressed: nothing to choose');

    setSettingsBuilt(state, true);
    assert.equal(chooseSetting(state, chosen), chosen, 'with a build on it: the way back, answered as the row itself');
    assert.equal(currentEnvironment(state), chosen, 'and the environment itself has not moved');

    assert.equal(chooseSetting(state, other), other, 'another preset is a different world, as it always was');
    assert.equal(currentEnvironment(state), other);
});

// --- The page's side of it -------------------------------------------------

test('the page keeps the built world where a reload finds it, and lets it go with the build', () => {
    const main = source('main.js');

    // Kept on the way out of the builder, after the editor is holding it.
    const save = methodBody(main, 'saveBuiltWorld');
    assert.ok(save.indexOf('keepBuiltWorld(') < save.indexOf('this.syncKeptWorld()'),
        'the editor is holding the build before the browser is asked to keep it');

    const sync = methodBody(main, 'syncKeptWorld');
    assert.match(sync, /const world = loadedChosen\(this\.settings\) \? null : builtWorld\(this\.editor\);/,
        'a file\'s world has a home of its own and is not kept twice');
    assert.match(sync, /if \(world == null\) \{\s*await forgetKeptWorld\(\);\s*return false;\s*\}/,
        'nothing built, nothing kept');
    assert.match(sync, /environmentDocument\(world, \{\s*name: defaultEnvironmentName\(world\.environment\),\s*library: this\.assets\s*\}\)/,
        'written as the document a file would carry, the models it uses in it');
    assert.match(sync, /return keepWorld\(environmentText\(document\)\);/);

    // And let go of wherever a world chosen in the settings lets go of a build.
    const choose = methodBody(main, 'chooseSettingsEntry');
    assert.match(choose, /const back    = builtChosen\(this\.settings\) && id === currentEnvironment\(this\.settings\);/);
    assert.match(choose, /if \(back\) releaseBuiltWorld\(this\.editor\);/);
    assert.ok(choose.indexOf('if (back) releaseBuiltWorld(this.editor);') < choose.indexOf('this.applySettings();'),
        'the build goes before the world is put in force, so what is laid is the preset');
    assert.match(choose, /if \(isEnvironmentId\(applied\)\) this\.syncKeptWorld\(\);/,
        'and only a world press opens the database');

    assert.match(methodBody(main, 'chooseLoaded'), /this\.syncKeptWorld\(\);/,
        'a file\'s world chosen lets go of the build it replaced');

    // A row moved over a kept build changes that build, so the kept copy moves
    // with it rather than holding how the world used to read.
    assert.match(methodBody(main, 'applyEditor'), /if \(builtWorld\(this\.editor\) != null\) this\.syncKeptWorld\(\);/);
    assert.match(methodBody(main, 'chooseEditorRow'), /this\.applyEditor\(false\);/,
        'every editor row goes through the one place that keeps it');
});

test('the kept world is read back after the library and before the ground is drawn again', () => {
    const main = source('main.js');
    const restore = methodBody(main, 'restoreAssets');

    assert.ok(restore.indexOf('readKeptAssets()') < restore.indexOf('this.restoreKeptWorld()'),
        'the library first, so the world\'s own models are not decoded a second time');
    assert.ok(restore.indexOf('this.restoreKeptWorld()') < restore.indexOf('this.assetsChanged()'),
        'and the world before anything is drawn from it');
    assert.match(restore, /if \(restored\) \{\s*this\.redrawEditor\(\);\s*this\.applySettings\(\);\s*\}/,
        'a world restored is put in force, as one chosen in the settings is');

    const kept = methodBody(main, 'restoreKeptWorld');
    assert.match(kept, /if \(loadedChosen\(this\.settings\)\) return false;/,
        'the world a file brought is the one chosen, and is restored from its own storage');
    assert.match(kept, /if \(await this\.adoptAssets\(world\.assets\)\) return false;/,
        'a model it carries that will not read leaves the world kept for the next session');
    assert.match(kept, /keepBuiltWorld\(this\.editor, world\.environment, runwayWanted\(startSettings\(this\.settings\)\),\s*world\.placements, currentEnvironment\(this\.settings\), world\.world, world\);/,
        'put back as the build it was, under the world the settings are holding');

    assert.match(methodBody(main, 'refreshWorld'), /setSettingsBuilt\(this\.settings, builtWorld\(this\.editor\) != null\);/,
        'and the row that says so is read off the editor whenever the world is put in force');
});

test('releasing a build leaves the preset as it is, which is what the row offers', () => {
    const editor = createEditorState('highlands', false);
    keepBuiltWorld(editor, 'highlands', false,
        [placeObject('cottage', [0, 0], {})],
        'highlands', null, { plane: 'bush' });

    assert.ok(builtWorld(editor), 'a build is kept');

    releaseBuiltWorld(editor);
    assert.equal(builtWorld(editor), null, 'and the way back leaves nothing built');
    assert.equal(editor.chosen, null, 'so the next world put in force is the preset\'s own rows afresh');
});
