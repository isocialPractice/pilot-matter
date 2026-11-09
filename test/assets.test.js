import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

import {
    ASSET_FORMATS, ASSET_FILE_ACCEPT, ASSET_FILE_LIMIT, ASSET_TRIANGLE_LIMIT, ASSET_USES, ASSET_UPS, ASSET_FACINGS,
    MILLIMETRE_GUESS, ASSET_FIELDS, assetFormat, assetName, assetId, assetRef, refAsset, isAssetId,
    fitSize, guessScale, guessUp, guessFacing, facedSize, assetFit, suggestSection, assetDraft, settleDraft, assetSize,
    draftUsable, fitReasons, assetRecipe, placeAssetObject, placeAssetRunway, assetsFor, libraryAsset, assetsUsed, withoutAsset,
    toBase64, fromBase64, assetHash, assetForFile, readAsset, flyablePlanes,
    insideFile, outsideAddress, selfContained, glbJson
} from '../js/asset-fit.js';
import { readRecipe, recipeBounds, recipeGeometry, isAssetRecipe, ASSET_RECIPE_FIELDS } from '../js/prefabs.js';
import { expandGroup, GROUP_RANGES } from '../js/templates.js';
import { standingObjects } from '../js/objects.js';
import { environmentDocument, environmentText, readEnvironmentDocument, DOCUMENT_FIELDS } from '../js/environment-file.js';
import {
    createBuildState, openBuildMode, beginCanvas, chooseBuildTool, acceptDraft, buildDraft, committedPlacements, answerConfirm,
    CONFIRM_YES, CONFIRM_STAY, REMOVE_ASSET, confirmEntries, CONFIRM_ENTRIES,
    setAssetLibrary, assetLibrary, assetStep, beginAssetStep, writeAssetStep, setAssetStepName, finishAssetStep, cancelAssetStep,
    chooseLibraryAsset, chosenLibraryAsset, requestRemoveAsset, removeAssetFromCanvas,
    chooseCityPrefab, insertObject, chooseRunwayTemplate, insertTemplate, buildRunwayTemplate, chooseBuildPlane, buildPlane, sessionWorld,
    openCitySection
} from '../js/build-mode.js';
import {
    dockContent, DOCK_FILES, DOCK_ASSET, DOCK_LOAD_ASSET, DOCK_REMOVE_ASSET, ASSETS_SECTION, ASSET_MODEL_SECTION, ASSET_USE_SECTION,
    ASSET_NAME_FIELD, DOCK_ADD_ASSET, DOCK_CANCEL_ASSET
} from '../js/build-panel.js';
import { FILES_TOOL, CITY_TOOL, PLANE_TOOL } from '../js/build-tools.js';
import { planeIds } from '../js/planes.js';

const source = name => readFileSync(fileURLToPath(new URL(`../js/${name}`, import.meta.url)), 'utf8');
const schema = JSON.parse(readFileSync(new URL('../schemas/environment.schema.json', import.meta.url), 'utf8'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

function methodBody(text, name) {
    const match = new RegExp(`^\\s+(?:async\\s+)?${name}\\((?:[^()]|\\([^()]*\\))*\\)\\s*\\{`, 'm').exec(text);
    if (!match) return null;
    const from = match.index + match[0].length - 1;
    let depth = 0;
    for (let at = from; at < text.length; at += 1) {
        if (text[at] === '{') depth += 1;
        if (text[at] === '}') {
            depth -= 1;
            if (depth === 0) return text.slice(from, at + 1);
        }
    }
    return null;
}

/**
 * A GLB built round a JSON chunk, the way the format writes one: a 12 byte
 * header - the magic, the version, the file's length - then the chunk's length
 * and its four byte tag, then the JSON padded out to a four byte boundary with
 * spaces. `magic` and `tag` are open so a file that is not a GLB, and one whose
 * first chunk is not the JSON, can both be built.
 */
function glb(json, { magic = 'glTF', tag = 'JSON', length = null } = {}) {
    const chunk = new TextEncoder().encode(typeof json === 'string' ? json : JSON.stringify(json));
    const padded = chunk.byteLength + ((4 - chunk.byteLength % 4) % 4);
    const bytes = new Uint8Array(12 + 8 + padded).fill(0x20, 20);
    const words = new DataView(bytes.buffer);
    bytes.set(new TextEncoder().encode(magic), 0);
    words.setUint32(4, 2, true);
    words.setUint32(8, bytes.byteLength, true);
    words.setUint32(12, length ?? padded, true);
    bytes.set(new TextEncoder().encode(tag), 16);
    bytes.set(chunk, 20);
    return bytes;
}

/** An asset as the library holds one: bytes, the hash its id is drawn from, and the step's settings. */
function asset({ name = 'Sample Tower', format = 'obj', raw = { x: 20, y: 60, z: 20 }, bytes = new TextEncoder().encode(`# ${name}\n`), ...over } = {}) {
    const hash = sha(bytes);
    const draft = assetDraft({ fileName: `${name}.${format}`, format, raw, triangles: 12, hash, bytes });
    const { fit, settled, ...kept } = draft;
    return { ...kept, ...over, size: assetSize({ ...kept, ...over }) };
}

// --- Formats and names ---------------------------------------------------------------

test('five formats are read, each to the uses it can be put to, and nothing else is', () => {
    assert.deepEqual(Object.keys(ASSET_FORMATS), ['glb', 'gltf', 'obj', 'stl', 'svg']);
    assert.deepEqual(ASSET_FORMATS.svg.uses, ['city'], 'a plan is a building');
    for (const id of ['glb', 'gltf', 'obj', 'stl']) assert.deepEqual(ASSET_FORMATS[id].uses, ['plane', 'city', 'runway']);
    assert.deepEqual(Object.values(ASSET_FORMATS).filter(format => format.colours).map(format => format.id), ['glb', 'gltf'], 'only glTF brings its own colours');
    assert.equal(ASSET_FILE_ACCEPT, '.glb,.gltf,.obj,.stl,.svg');
    assert.equal(assetFormat('Sample Plane.GLB'), 'glb');
    assert.equal(assetFormat('plan.svg'), 'svg');
    assert.equal(assetFormat('model.fbx'), null, 'FBX is not offered');
    assert.equal(assetFormat('notes'), null);
    assert.equal(ASSET_FILE_LIMIT, 25 * 1024 * 1024);
    assert.equal(ASSET_TRIANGLE_LIMIT, 300000);
    assert.equal(assetName('my_sample_hangar.obj'), 'my sample hangar');
    assert.equal(assetName('.stl'), 'Asset');
    assert.equal(assetName(`${'x'.repeat(80)}.obj`).length, 60);
});

test('an asset is known by the hash of its bytes, and referred to by that', () => {
    const hash = 'ab'.repeat(32);
    assert.equal(assetId(hash), 'a-abababababababab');
    assert.equal(isAssetId(assetId(hash)), true);
    assert.equal(isAssetId('a-xyz'), false);
    assert.equal(assetRef('a-0123456789abcdef'), 'asset:a-0123456789abcdef');
    assert.equal(refAsset('asset:a-0123456789abcdef'), 'a-0123456789abcdef');
    assert.equal(refAsset('trainer'), null);
});

// --- Size and fit ---------------------------------------------------------------------

test('a model\'s size is taken through its scale and which axis is up, and turned to face along its length', () => {
    assert.deepEqual(fitSize({ x: 10, y: 4, z: 20 }), { width: 10, height: 4, depth: 20 });
    assert.deepEqual(fitSize({ x: 10, y: 20, z: 4 }, { up: 'z', scale: 0.5 }), { width: 5, height: 2, depth: 10 }, 'Z-up: its z is height, its y along');
    assert.deepEqual(facedSize({ width: 8, height: 3, depth: 11 }, '+x'), { width: 11, height: 3, depth: 8 });
    assert.deepEqual(facedSize({ width: 8, height: 3, depth: 11 }, '-z'), { width: 8, height: 3, depth: 11 });
    assert.deepEqual([ASSET_UPS, ASSET_FACINGS], [['y', 'z'], ['+z', '-z', '+x', '-x']]);
});

test('the step guesses millimetres for a long model of a format that names no unit, Z-up for an STL, and the longest side as its facing', () => {
    assert.equal(guessScale({ x: MILLIMETRE_GUESS + 1, y: 1, z: 1 }, 'stl'), 0.001);
    assert.equal(guessScale({ x: MILLIMETRE_GUESS, y: 1, z: 1 }, 'obj'), 1);
    assert.equal(guessScale({ x: 2400, y: 1, z: 60 }, 'gltf'), 1, 'glTF is metres by its own definition');
    assert.equal(guessScale({ x: 2400, y: 1, z: 60 }, 'glb'), 1);
    assert.equal(guessUp('stl'), 'z');
    assert.equal(guessUp('obj'), 'y');
    assert.equal(guessFacing({ x: 11, y: 3, z: 8 }), '+x');
    assert.equal(guessFacing({ x: 8, y: 3, z: 11 }), '+z');
    assert.equal(guessFacing({ x: 40, y: 30, z: 0 }, 'y', 'svg'), '+z', 'a plan is taken as drawn');
});

test('what fits where: a plane 3 to 90 m long and under half as high, the city to 600 m a side and 900 m high, a runway the size a strip is', () => {
    const fits = size => Object.fromEntries(Object.entries(assetFit(size)).map(([use, { fits }]) => [use, fits]));
    assert.deepEqual(fits({ width: 11, height: 3, depth: 9 }), { plane: true, city: true, runway: false });
    assert.equal(assetFit({ width: 2, height: 0.5, depth: 2.9 }).plane.fits, false);
    assert.equal(assetFit({ width: 2, height: 0.5, depth: 3 }).plane.fits, true, 'three metres is a plane');
    assert.equal(assetFit({ width: 40, height: 10, depth: 90.5 }).plane.fits, false);
    assert.equal(assetFit({ width: 10, height: 5, depth: 10 }).plane.fits, false, 'half as high as it is long is too tall');
    assert.match(assetFit({ width: 10, height: 5, depth: 10 }).plane.reason, /too tall for a plane/);
    assert.equal(assetFit({ width: 600, height: 900, depth: 600 }).city.fits, true);
    assert.match(assetFit({ width: 601, height: 10, depth: 20 }).city.reason, /too large for the city: 601 m a side/);
    assert.match(assetFit({ width: 20, height: 901, depth: 20 }).city.reason, /too tall for the city/);
    assert.equal(assetFit({ width: 100, height: 1, depth: 2400 }).runway.fits, true);
    assert.match(assetFit({ width: 100, height: 1, depth: 599 }).runway.reason, new RegExp(`the least is ${GROUP_RANGES.length.low} m`), 'no strip is shorter than the strip allows');
    assert.match(assetFit({ width: 100, height: 1, depth: 5001 }).runway.reason, /too long for a runway/);
    assert.match(assetFit({ width: 601, height: 1, depth: 2400 }).runway.reason, /too wide for a runway/);
    assert.match(assetFit({ width: 100, height: 49, depth: 2400 }).runway.reason, /too tall for a runway: 49 m high, no more than 2%/);
    assert.deepEqual([suggestSection(80), suggestSection(20), suggestSection(6)], ['skylines', 'commercial', 'residential']);
});

/**
 * The fit and the strip have to agree, because `placeAssetRunway` builds a real
 * strip of the asset's size and a strip can only be built between
 * `GROUP_RANGES.width.low` and `.high`. They used to disagree in both
 * directions, with nothing said either way: the figures below are the three
 * cases that were let through and silently resized.
 */
test('a runway asset is refused at a size no strip can be built at, rather than being clamped to one', () => {
    const runway = size => assetFit(size).runway;

    assert.equal(runway({ width: GROUP_RANGES.width.low, height: 1, depth: 2400 }).fits, true, 'the narrowest strip is a runway');
    assert.equal(runway({ width: GROUP_RANGES.width.high, height: 1, depth: 2400 }).fits, true, 'and so is the widest');

    // A 600 by 20 m model was given an 80 m strip: four times the landable
    // ground the pilot could see.
    const narrow = runway({ width: 20, height: 1, depth: 600 });
    assert.equal(narrow.fits, false);
    assert.match(narrow.reason, new RegExp(`too narrow for a runway: 20 m across, the least is ${GROUP_RANGES.width.low} m`));

    // A 5000 by 1200 m model was given a 600 m strip: the model hanging over
    // ground that is not runway. Its quarter-of-the-length bound passes at this
    // size, so the strip's own width is the only thing that catches it.
    const wide = runway({ width: 1200, height: 1, depth: 5000 });
    assert.equal(wide.fits, false);
    assert.match(wide.reason, new RegExp(`too wide for a runway: 1,?200 m across, the most is ${GROUP_RANGES.width.high} m`));
    assert.ok(1200 <= 5000 / 4, 'which a quarter of its length would have allowed');

    // A flat plan with no width at all was given an 80 m strip out of nothing,
    // where the city branch had a guard for it.
    assert.deepEqual(runway({ width: 0, height: 0, depth: 600 }), { fits: false, reason: 'nothing to place' });
    assert.deepEqual(runway({ width: 100, height: 1, depth: 0 }), { fits: false, reason: 'nothing to place' });

    // And the hold in the placement is now a guard rather than a resize: every
    // width the fit allows is a width the strip is built at unchanged.
    for (const width of [GROUP_RANGES.width.low, 240, GROUP_RANGES.width.high]) {
        const strip = asset({ name: 'strip', format: 'glb', raw: { x: width, y: 1, z: 2400 } });
        assert.equal(placeAssetRunway(strip, [0, 0], 0).config.width, width, `${width} m across is built at ${width} m`);
    }
});

test('a step starts with everything guessed, every use it fits switched on, and its section from its height', () => {
    const tower = assetDraft({ fileName: 'tower.obj', format: 'obj', raw: { x: 20, y: 60, z: 20 }, triangles: 12, hash: 'cd'.repeat(32) });
    assert.deepEqual(tower.uses, { plane: false, city: true, runway: false });
    assert.equal(tower.section, 'skylines');
    assert.equal(tower.name, 'tower');
    assert.equal(draftUsable(tower), true);
    assert.match(fitReasons(tower), /^PLANE: too tall for a plane.*; RUNWAY: too short for a runway/);

    const plan = assetDraft({ fileName: 'hall.svg', format: 'svg', raw: { x: 40, y: 30, z: 0 }, hash: 'ef'.repeat(32) });
    assert.deepEqual(plan.size, { width: 40, height: 12, depth: 30 }, 'a plan across and along its page, as high as asked');
    assert.deepEqual(plan.uses, { plane: false, city: true, runway: false });
    assert.match(plan.fit.plane.reason, /is a plan, so it is only a building/);

    const lowered = settleDraft({ ...tower, height: 5, scale: 0.001 }, { first: false });
    assert.equal(lowered.uses.city, true, 'a choice kept where it still fits');
    const turnedOff = settleDraft({ ...tower, uses: { plane: false, city: false, runway: false } }, { first: false });
    assert.equal(turnedOff.uses.city, false, 'and a use switched off stays off');
    assert.equal(draftUsable(turnedOff), false);
    const outgrown = settleDraft({ ...tower, scale: 20 }, { first: false });
    assert.equal(outgrown.uses.city, false, 'a use it no longer fits switched off');
});

// --- Placing one -----------------------------------------------------------------------

test('a placed asset refers to the model rather than copying it, at its size', () => {
    const tower = asset();
    assert.deepEqual(assetRecipe(tower), { asset: tower.id, size: [20, 60, 20] });
    const placed = placeAssetObject(tower, [100, 200], { heading: 30 });
    assert.deepEqual(placed, { type: 'object', prefab: assetRef(tower.id), recipe: { asset: tower.id, size: [20, 60, 20] }, config: { at: [100, 200], heading: 30, scale: 1 } });
    assert.equal(isAssetRecipe(placed.recipe), true);
    assert.deepEqual(recipeBounds(placed.recipe), { minX: -10, maxX: 10, minZ: -10, maxZ: 10, top: 60 }, 'a box of its size until the model is read');
    assert.equal(recipeGeometry(placed.recipe).count, 36);
    assert.deepEqual(readRecipe(placed.recipe).problems, []);
    assert.equal(placeAssetObject(tower, [1]), null);
});

test('a loaded runway is a real strip of its size, with the model drawn over it as an object facing the way it does', () => {
    const strip = asset({ name: 'long-strip', format: 'gltf', raw: { x: 100, y: 1, z: 2400 } });
    const group = placeAssetRunway(strip, [100, -50], 87);
    assert.equal(group.type, 'group');
    assert.equal(group.template, assetRef(strip.id));
    assert.deepEqual(group.config, { at: [100, -50], heading: 90, length: 2400, width: 100 }, 'the strip is the size the model is');
    const [runway, model] = expandGroup(group);
    assert.equal(runway.type, 'runway');
    assert.deepEqual([runway.config.length, runway.config.heading], [[2400, 2400], [90, 90]]);
    assert.equal(model.type, 'object');
    assert.equal(model.prefab, assetRef(strip.id));
    assert.equal(model.recipe.asset, strip.id);
    assert.equal(model.recipe.solid, false, 'the strip is landed on, not the model');
    assert.equal(model.config.heading, 90);
    assert.deepEqual(model.config.at, [100, -50]);
    assert.equal(standingObjects([model]).length, 1, 'and it stands as any object does');
});

test('a library offers its assets by use and section, and a world says which it uses and can let one go', () => {
    const tower = asset();
    const glider = asset({ name: 'glider', format: 'stl', raw: { x: 11000, y: 8000, z: 3000 }, bytes: new Uint8Array([1, 2, 3]) });
    const library = [tower, glider];
    assert.deepEqual(assetsFor(library, 'city').map(each => each.name), ['Sample Tower', 'glider']);
    assert.deepEqual(assetsFor(library, 'city', 'skylines').map(each => each.name), ['Sample Tower']);
    assert.deepEqual(assetsFor(library, 'plane').map(each => each.name), ['glider']);
    assert.equal(libraryAsset(library, assetRef(glider.id)), glider);
    assert.equal(libraryAsset(library, glider.id), glider);
    assert.deepEqual(flyablePlanes(library), [...planeIds(), assetRef(glider.id)]);

    const world = {
        placements: [placeAssetObject(tower, [0, 0]), { type: 'mountain', config: {} }, placeAssetRunway(asset({ name: 'strip', raw: { x: 100, y: 1, z: 2400 } }), [0, 0])],
        plane: assetRef(glider.id)
    };
    assert.equal(assetsUsed(world).length, 3);
    const left = withoutAsset(world, tower.id);
    assert.deepEqual(left.placements.map(p => p.type), ['mountain', 'group']);
    assert.equal(withoutAsset(world, glider.id).plane, null, 'the plane flown as it goes back to the trainer');
});

// --- Carried in a file -------------------------------------------------------------------

test('bytes go to base64 and back as the browser and Node write it', () => {
    for (const length of [0, 1, 2, 3, 4, 5, 31]) {
        const bytes = Uint8Array.from({ length }, (_, i) => (i * 97 + 13) % 256);
        assert.equal(toBase64(bytes), Buffer.from(bytes).toString('base64'));
        assert.deepEqual([...fromBase64(toBase64(bytes))], [...bytes]);
    }
    assert.equal(fromBase64('not base64!'), null);
    assert.equal(fromBase64('abc'), null);
});

test('an asset\'s hash is SHA-256, through the page\'s own crypto', async () => {
    assert.equal(await assetHash(new TextEncoder().encode('abc')), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('an asset is written into a file and read back the same, and a field out of place refuses it', () => {
    const tower = asset();
    const written = assetForFile(tower);
    assert.deepEqual(Object.keys(written), ASSET_FIELDS.filter(field => field in written));
    assert.deepEqual(Object.keys(schema.$defs.asset.properties), ASSET_FIELDS);
    const { asset: read, problems } = readAsset(JSON.parse(JSON.stringify(written)));
    assert.deepEqual(problems, []);
    assert.deepEqual([...read.bytes], [...tower.bytes]);
    assert.deepEqual(read.size, tower.size);
    const refused = extra => readAsset({ ...written, ...extra }, 'a').problems;
    assert.deepEqual(refused({ format: 'fbx' }), ['a: no format is called "fbx"']);
    assert.deepEqual(refused({ id: 'a-0000000000000000' }), ['a: id is not the one its hash names']);
    assert.deepEqual(refused({ data: '***' }), ['a: data is not base64']);
    assert.deepEqual(refused({ up: 'x' }), ['a: up is not y or z']);
    assert.deepEqual(refused({ fliesLike: 'airliner' }), ['a: fliesLike is not a plane there is']);
    assert.deepEqual(refused({ script: 'run()' }), ['a: script is not a field an asset has']);
});

test('a saved world carries the assets it uses, once each, and a file referring to one it does not carry is refused', () => {
    const tower = asset();
    const unused = asset({ name: 'unused', bytes: new Uint8Array([9]) });
    const glider = asset({ name: 'glider', format: 'stl', raw: { x: 11000, y: 8000, z: 3000 }, bytes: new Uint8Array([1, 2, 3]) });
    const world = {
        environment: 'highlands', world: [], plane: assetRef(glider.id),
        placements: [placeAssetObject(tower, [0, 0]), placeAssetObject(tower, [50, 0])]
    };
    const document = environmentDocument(world, { name: 'Sample Valley', library: [tower, unused, glider] });
    assert.deepEqual(document.assets.map(each => each.name), ['Sample Tower', 'glider'], 'the two it uses, the tower once');
    assert.equal(document.plane, assetRef(glider.id));
    assert.ok(DOCUMENT_FIELDS.includes('assets'));

    const read = readEnvironmentDocument(environmentText(document));
    assert.equal(read.ok, true, read.problems.join());
    assert.deepEqual(read.world.assets.map(each => each.id), [tower.id, glider.id]);
    assert.equal(read.world.plane, assetRef(glider.id));

    const missing = JSON.parse(environmentText(document));
    missing.assets = missing.assets.filter(each => each.name !== 'Sample Tower');
    assert.deepEqual(readEnvironmentDocument(JSON.stringify(missing)).problems, [`placements: asset ${tower.id} is used and not carried in assets`]);
    const noPlane = JSON.parse(environmentText(document));
    noPlane.assets = noPlane.assets.filter(each => each.name !== 'glider');
    assert.deepEqual(readEnvironmentDocument(JSON.stringify(noPlane)).problems, [`plane: no plane is called "${assetRef(glider.id)}"`]);
    assert.equal('assets' in environmentDocument({ environment: 'highlands', placements: [], world: [] }), false, 'a world using none carries none');
});

// --- The builder ---------------------------------------------------------------------------

function canvas(tool = FILES_TOOL) {
    const state = createBuildState();
    openBuildMode(state);
    beginCanvas(state, 'highlands', [], []);
    chooseBuildTool(state, tool);
    return state;
}

test('a loaded asset is a card on every insert menu it fits, and placed from there', () => {
    const tower = asset();
    const strip = asset({ name: 'strip', format: 'gltf', raw: { x: 100, y: 1, z: 2400 }, bytes: new Uint8Array([4]) });
    const glider = asset({ name: 'glider', format: 'stl', raw: { x: 11000, y: 8000, z: 3000 }, bytes: new Uint8Array([5]) });

    const city = canvas(CITY_TOOL);
    setAssetLibrary(city, [tower, strip, glider]);
    assert.equal(assetLibrary(city).length, 3);
    const cards = state => dockContent(state, {}).sections.flatMap(section => (section.shapes ?? []).flatMap(row => row.tools.map(card => card.id)));
    assert.ok(cards(city).includes(assetRef(tower.id)), 'the tower among the skylines');
    openCitySection(city, 'residential');
    assert.ok(cards(city).includes(assetRef(glider.id)), 'the glider, small enough for a house, under residential');
    assert.equal(chooseCityPrefab(city, assetRef(strip.id)), false, 'a runway is no building');
    assert.equal(chooseCityPrefab(city, assetRef(tower.id)), true);
    insertObject(city, { x: 100, z: 200 }, 0);
    assert.equal(buildDraft(city).recipe.asset, tower.id);

    const runway = canvas('runway');
    setAssetLibrary(runway, [tower, strip]);
    assert.ok(dockContent(runway, {}).shapes[0].tools.some(card => card.id === assetRef(strip.id)));
    assert.equal(chooseRunwayTemplate(runway, assetRef(tower.id)), false);
    assert.equal(chooseRunwayTemplate(runway, assetRef(strip.id)), true);
    insertTemplate(runway, { x: 0, z: 0 }, 0, { size: 16000 });
    assert.equal(buildDraft(runway).template, assetRef(strip.id));
    setAssetLibrary(runway, [tower]);
    assert.equal(buildRunwayTemplate(runway), null, 'an asset let go of disarms its card');

    const plane = canvas(PLANE_TOOL);
    setAssetLibrary(plane, [glider]);
    assert.ok(dockContent(plane, {}).sections[0].shapes[0].tools.some(card => card.id === assetRef(glider.id)));
    assert.equal(chooseBuildPlane(plane, assetRef(tower.id)), false);
    assert.equal(chooseBuildPlane(plane, assetRef(glider.id)), true);
    assert.equal(buildPlane(plane), assetRef(glider.id));
    assert.equal(sessionWorld(plane).plane, assetRef(glider.id));
});

test('the step after loading: its rows written back, its name typed, ADD only with a use on, CANCEL dropping it', () => {
    const state = canvas();
    assert.equal(assetStep(state), null);
    const draft = assetDraft({ fileName: 'tower.obj', format: 'obj', raw: { x: 20, y: 60, z: 20 }, triangles: 12, hash: 'cd'.repeat(32), bytes: new Uint8Array(1) });
    assert.equal(beginAssetStep(state, draft), true);
    const content = dockContent(state, {});
    assert.equal(content.kind, DOCK_ASSET);
    assert.equal(content.heading, 'LOADED ASSET');
    assert.deepEqual(content.sections.map(section => [section.id, section.heading]), [[ASSET_MODEL_SECTION, 'MODEL'], [ASSET_USE_SECTION, 'USE AS']]);
    const [model, use] = content.sections;
    assert.deepEqual(model.rows.map(row => row.row.label), ['SCALE', 'UP', 'FACING', 'COLOR'], 'a colour for a format that brings none');
    assert.equal(model.text.id, ASSET_NAME_FIELD);
    assert.match(model.status.text, /OBJ, 12 triangles - 20 x 60 x 20 m/);
    assert.deepEqual(use.rows.map(row => [row.row.label, row.live]), [['AS PLANE', false], ['AS CITY', true], ['AS RUNWAY', false], ['FLIES LIKE', false], ['SECTION', true]],
        'held shut where it does not fit; where each goes open only with its use on');
    assert.match(use.status.text, /too tall for a plane/);
    assert.deepEqual(content.actions, [{ ...DOCK_ADD_ASSET, disabled: false }, DOCK_CANCEL_ASSET]);

    writeAssetStep(state, { color: [1, 0, 0.5], section: 'commercial' });
    assert.equal(assetStep(state).color, 0xff0080, 'the colour row\'s channels kept as a colour');
    assert.equal(assetStep(state).section, 'commercial');
    setAssetStepName(state, '  Sample   Hall  ');
    assert.equal(assetStep(state).name, 'Sample Hall');
    writeAssetStep(state, { asCity: false });
    assert.equal(dockContent(state, {}).actions[0].disabled, true, 'nothing switched on, nothing to add');
    assert.equal(finishAssetStep(state), null);
    writeAssetStep(state, { asCity: true });
    const kept = finishAssetStep(state);
    assert.equal(kept.name, 'Sample Hall');
    assert.equal('fit' in kept || 'settled' in kept, false, 'what is worked out again is not kept');
    assert.equal(assetStep(state), null);
    assert.equal(dockContent(state, {}).kind, DOCK_FILES, 'SAVE / LOAD again');

    beginAssetStep(state, assetDraft({ fileName: 'strip.gltf', format: 'gltf', raw: { x: 100, y: 1, z: 2400 }, hash: 'aa'.repeat(32) }));
    assert.deepEqual(dockContent(state, {}).sections[0].rows.map(row => row.row.label), ['SCALE', 'UP', 'FACING'], 'a glTF brings its own colours');
    cancelAssetStep(state);
    beginAssetStep(state, assetDraft({ fileName: 'hall.svg', format: 'svg', raw: { x: 40, y: 30, z: 0 }, hash: 'ef'.repeat(32) }));
    assert.deepEqual(dockContent(state, {}).sections[0].rows.map(row => row.row.label), ['SCALE', 'FACING', 'COLOR', 'HEIGHT'], 'a plan: no up, and a height');
    assert.equal(cancelAssetStep(state), true);
    assert.equal(assetStep(state), null);
    assert.equal(cancelAssetStep(state), false);
});

test('SAVE / LOAD lists the loaded assets, and REMOVE asks first only when the canvas uses the one chosen', () => {
    const tower = asset();
    const glider = asset({ name: 'glider', format: 'stl', raw: { x: 11000, y: 8000, z: 3000 }, bytes: new Uint8Array([5]) });
    const state = canvas();
    let content = dockContent(state, {});
    assert.ok(content.actions.some(action => action.id === DOCK_LOAD_ASSET.id));
    assert.deepEqual(content.actions.find(action => action.id === DOCK_REMOVE_ASSET.id), { ...DOCK_REMOVE_ASSET, disabled: true });
    assert.match(content.sections.find(section => section.id === ASSETS_SECTION).status.text, /no assets loaded/);

    setAssetLibrary(state, [tower, glider]);
    assert.equal(chooseLibraryAsset(state, tower.id), true);
    assert.equal(chosenLibraryAsset(state), tower);
    content = dockContent(state, {});
    assert.deepEqual(content.sections.find(section => section.id === ASSETS_SECTION).shapes[0].tools.map(card => card.id), [tower.id, glider.id]);
    assert.match(content.sections.find(section => section.id === ASSETS_SECTION).status.text, /Sample Tower: used as CITY - 20 x 60 x 20 m/);
    assert.equal(content.actions.find(action => action.id === DOCK_REMOVE_ASSET.id).disabled, false);

    assert.deepEqual(requestRemoveAsset(state, tower.id), { remove: tower.id }, 'unused: gone at once');
    chooseBuildTool(state, CITY_TOOL);
    chooseCityPrefab(state, assetRef(tower.id));
    insertObject(state, { x: 0, z: 0 }, 0);
    acceptDraft(state);
    chooseBuildTool(state, FILES_TOOL);
    assert.deepEqual(requestRemoveAsset(state, tower.id), { confirm: REMOVE_ASSET });
    assert.deepEqual(confirmEntries(REMOVE_ASSET).map(entry => entry.id), CONFIRM_ENTRIES.filter(entry => entry.id !== 'no').map(entry => entry.id), 'YES or CANCEL');
    assert.deepEqual(answerConfirm(state, CONFIRM_STAY), { stay: true });
    requestRemoveAsset(state, tower.id);
    assert.deepEqual(answerConfirm(state, CONFIRM_YES), { remove: tower.id });
    assert.equal(removeAssetFromCanvas(state, tower.id), true);
    assert.equal(committedPlacements(state).length, 0, 'what used it went with it');
    assert.equal(chooseLibraryAsset(state, 'a-0000000000000000'), false);
});

test('an asset recipe is read whole or refused, and names no part', () => {
    assert.deepEqual(ASSET_RECIPE_FIELDS, ['asset', 'size', 'solid']);
    const recipe = { asset: 'a-0123456789abcdef', size: [20, 60, 20] };
    assert.deepEqual(readRecipe(recipe).problems, []);
    assert.deepEqual(readRecipe({ ...recipe, asset: 'tower' }, 'r').problems, ['r: asset is not an asset\'s id']);
    assert.deepEqual(readRecipe({ ...recipe, size: [1, 2] }, 'r').problems, ['r: size is not three lengths']);
    assert.deepEqual(readRecipe({ ...recipe, parts: [] }, 'r').problems, ['r: parts is not a field a recipe for an asset has']);
    assert.deepEqual(readRecipe({ asset: 'a-0123456789abcdef', size: [100, 1, 2400] }).problems, [], 'a runway asset kilometres long');
});

test('a glTF is held to what it names, and a GLB read through its own JSON chunk', () => {
    // The four ways a glTF can reach outside the file. A `.gltf` is its JSON
    // and a `.glb` carries the same JSON in its first chunk, so one rule reads
    // both - and the `.glb` image is the row that used to load untextured with
    // nothing said to the pilot, because three swallows the throw from the
    // manager inside its own texture loading.
    const inside = { buffers: [{ byteLength: 8 }], images: [{ bufferView: 0 }] };
    const apron = 'https://example.com/textures/apron.png';
    assert.equal(selfContained(inside), true, 'bytes in the file\'s own chunks name nothing');
    assert.equal(selfContained({}), true);
    assert.equal(selfContained({ buffers: [{ uri: 'data:application/octet-stream;base64,AAAA' }] }), true);
    assert.equal(selfContained({ images: [{ uri: 'DATA:image/png;base64,AAAA' }] }), true, 'the scheme either case');
    assert.equal(selfContained({ buffers: [{ uri: 'scene.bin' }] }), false);
    assert.equal(selfContained({ images: [{ uri: apron }] }), false);
    assert.equal(outsideAddress({ images: [{ uri: apron }] }), apron, 'named, so the refusal says which file');
    assert.equal(outsideAddress({ buffers: [{ uri: 'scene.bin' }], images: [{ uri: apron }] }), 'scene.bin', 'the first of them');
    assert.equal(outsideAddress(inside), null);

    // A `blob:` is the page's address, never a file's: three hands an embedded
    // texture to the image loader as a blob the page made from the file's own
    // bytes, and only the page that made one can name it. The manager allows
    // it; the rule a file is read by cannot.
    assert.equal(insideFile('data:image/png;base64,AAAA'), true);
    assert.equal(insideFile('blob:https://example.com/abc'), false, 'a blob can never be inside the file naming it');
    assert.equal(insideFile(null), false);
    assert.equal(selfContained({ images: [{ uri: 'blob:https://example.com/abc' }] }), false);

    // The JSON chunk read back out of a GLB, which is what puts the check in
    // reach of a format that arrives as bytes.
    assert.deepEqual(glbJson(glb(inside)), inside);
    assert.equal(selfContained(glbJson(glb({ images: [{ uri: apron }] }))), false);
    assert.equal(glbJson(glb(inside, { tag: 'BIN\0' })), null, 'a first chunk that is not the JSON');
    assert.equal(glbJson(glb(inside, { magic: 'FTLG' })), null, 'bytes that are not a GLB at all');
    assert.equal(glbJson(glb(inside, { length: 4096 })), null, 'a chunk running past the end of the file');
    assert.equal(glbJson(glb(inside, { length: 0 })), null, 'an empty chunk');
    assert.equal(glbJson(glb('{ "buffers": ')), null, 'a chunk that is not JSON');
    assert.equal(glbJson(glb(5)), null, 'a chunk holding JSON that is not an object');
    assert.equal(glbJson(new Uint8Array(8)), null, 'too few bytes to hold the two headers');
    assert.equal(glbJson(null), null);
});

// --- In the page ---------------------------------------------------------------------------

test('a model is read in the page by three\'s own loaders, a glTF only when it carries everything, and refused past its limits', () => {
    const loader = source('asset-loader.js');
    for (const name of ['GLTFLoader', 'OBJLoader', 'STLLoader', 'SVGLoader']) assert.match(loader, new RegExp(`import\\('three/addons/loaders/${name}\\.js'\\)`));
    assert.match(loader, /if \(!selfContained\(JSON\.parse\(source\)\)\) throw new AssetRefused/);

    // Both formats are refused from their own JSON before either is parsed: a
    // `.gltf`'s is the file, and a `.glb` carries the same JSON in its first
    // chunk, which `glbJson` reads. Three turns the manager's throw into a
    // rejected parse for a buffer but swallows it for an image, so the check
    // before the parse is what the pilot is actually told by.
    assert.match(loader, /import \{[^}]*\bglbJson\b[^}]*\boutsideAddress\b[^}]*\bselfContained\b[^}]*\} from '\.\/asset-fit\.js';/,
        'the file\'s own rule read from the pure module, where it is tested');
    assert.doesNotMatch(loader, /function selfContained/, 'and not a second copy of it here');
    assert.match(loader, /const json = glbJson\(bytes\);\n\s*const outside = json == null \? null : outsideAddress\(json\);\n\s*if \(outside != null\) throw new AssetRefused\(/,
        'a .glb refused before it is parsed, naming the address');

    // The manager stays as the backstop, and its rule is the wider one: what
    // the page may ask for while it reads a model, blobs of the file's own
    // bytes included.
    assert.match(loader, /new module\.GLTFLoader\(embeddedOnly\(\)\)/, 'the glTF loader reads addresses, so it is given the manager');
    assert.match(loader, /const EMBEDDED_ADDRESS = \/\^\(\?:data\|blob\):\/i;/, 'a data: address inside the file, or a blob: the page made from it');
    assert.match(loader, /manager\.setURLModifier\(url => \{\n\s*if \(embeddedAddress\(url\)\) return String\(url\);\n\s*throw new AssetRefused\(/,
        'and anything else refused before it is fetched, not after');
    assert.doesNotMatch(loader, /save it as a \.glb/, 'and the refusal does not steer a pilot at a format to get round it');
    assert.match(loader, /if \(triangles > ASSET_TRIANGLE_LIMIT\) \{/);
    assert.match(loader, /const data = new SVGLoader\(\)\.parse\(text\(\)\);/, 'a plan parsed as text');
    assert.doesNotMatch(loader, /innerHTML|DOMParser|appendChild|createElement/, 'and never put into the document');
    assert.match(loader, /anchor === 'centre' \? -\(box\.min\.y \+ box\.max\.y\) \/ 2 : -box\.min\.y/);

    const pick = source('environment-io.js');
    assert.match(pick, /if \(file\.size > limit\) return finish\(\{ name: file\.name, tooLarge: true \}\);/, 'refused before it is read');
    assert.match(pick, /bytes: new Uint8Array\(await file\.arrayBuffer\(\)\)/);

    const store = source('asset-store.js');
    assert.match(store, /export const ASSET_DATABASE = 'pilot-matter';/);
    assert.match(store, /export const ASSET_STORE = 'assets';/);
    assert.match(store, /db\.createObjectStore\(ASSET_STORE, \{ keyPath: 'id' \}\)/);
});

test('the page reads a model, takes it to the step, keeps it, and carries it in and out of a file checked against its hash', () => {
    const main = source('main.js');
    const load = methodBody(main, 'loadAssetFromBuilder');
    assert.ok(load.indexOf('assetFormat(picked.name)') < load.indexOf('readModel('), 'its format by its name first');
    assert.match(load, /pickAssetFile\(this\.assetFileInput, \{ accept: ASSET_FILE_ACCEPT, limit: ASSET_FILE_LIMIT \}\)/);
    assert.match(load, /const draft = assetDraft\(\{ fileName: picked\.name, format, raw: read\.raw, triangles: read\.triangles, hash, bytes: picked\.bytes \}\);/);
    assert.match(methodBody(main, 'adoptAssets'), /if \(await assetHash\(asset\.bytes\) !== asset\.hash\) return/);
    assert.match(methodBody(main, 'writeEnvironment'), /environmentDocument\(world, \{ name, library: this\.assets \}\)/);
    assert.match(methodBody(main, 'addAssetFromBuilder'), /const kept = await keepAsset\(asset\);/);
    assert.match(methodBody(main, 'removeAsset'), /await forgetAsset\(id\);\s*forgetModel\(id\);/);
    assert.match(main, /this\.animate\(\);\s*this\.restoreAssets\(\);/, 'the kept ones read back once the page is up');
    assert.match(methodBody(main, 'loadIntoCanvas'), /const assetsRefused = await this\.adoptAssets\(chosen\.loaded\.world\.assets\);/);
    assert.match(methodBody(main, 'loadEnvironmentFromSettings'), /const assetsRefused = await this\.adoptAssets\(chosen\.loaded\.world\.assets\);/);

    assert.match(source('aircraft.js'), /this\.group\.add\(\.\.\.\(model \? \[model\] : planeModel\(this\.plane\)\)\);/, 'a loaded plane flown as its own model');
    const mesh = source('object-mesh.js');
    assert.match(mesh, /if \(object\.recipe\?\.asset && hasAssetModel\(object\.recipe\.asset\)\) \{/);
    assert.match(mesh, /if \(mesh\.userData\?\.asset\) continue;/, 'a copy sharing the model is not the tile\'s to give back');
    assert.match(source('terrain.js'), /redrawObjects\(\) \{/);
});
