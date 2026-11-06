import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
    PREFABS, PREFAB_SHAPES, PREFAB_CATEGORIES, WEDGE_RIDGES, PART_FIELDS, RECIPE_FIELDS, RECIPE_PART_LIMIT, RECIPE_REACH,
    prefabById, prefabsIn, copyRecipe, recipeKey, recipeSolid, recipeGeometry, recipeBounds, linearColor, readRecipe
} from '../js/prefabs.js';
import {
    OBJECT_TYPE, OBJECT_RANGES, OBJECT_ERASE_STRENGTH, isObject, objectConfig, placeObject, objectFootprint, objectHeight,
    objectErased, standingObjects, insideObject, obstacleTop
} from '../js/objects.js';
import { buildEnvironment, getEnvironment, environmentElements } from '../js/environment/presets.js';
import { ERASE_TYPE, ERASE_ALL } from '../js/environment/erase.js';
import { placementAt, placementReach } from '../js/build-select.js';
import { boundHandles, dragHandle, gumballKind, GUMBALL_FLAT } from '../js/gumball.js';
import { placementOutline } from '../js/build-overlay.js';
import { panelRanges, draftHolderFor, dockContent } from '../js/build-panel.js';
import { createBuildState, openBuildMode, beginCanvas, selectPlacement, buildDraft } from '../js/build-mode.js';
import { createBuildCamera, DEFAULT_FOV } from '../js/build-camera.js';
import { environmentDocument, environmentText, readEnvironmentDocument, placementTypes } from '../js/environment-file.js';
import { bearingToDirection } from '../js/units.js';

const source = name => readFileSync(fileURLToPath(new URL(`../js/${name}`, import.meta.url)), 'utf8');
const schema = JSON.parse(readFileSync(new URL('../schemas/environment.schema.json', import.meta.url), 'utf8'));

/** The body of a method, from the brace that opens it after its parameters. */
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

const SIZE = 16000;
const near = (a, b, within = 1e-6) => Math.abs(a - b) <= within;

// --- Prefabs ----------------------------------------------------------------------------

test('every prefab is named once, offered under a category there is, and says the footprint its recipe has', () => {
    const ids = PREFABS.map(prefab => prefab.id);
    assert.equal(new Set(ids).size, ids.length, 'no id twice');
    const categories = PREFAB_CATEGORIES.map(category => category.id);
    assert.deepEqual(categories, ['skylines', 'factory', 'residential', 'commercial', 'infrastructure', 'parks']);
    for (const prefab of PREFABS) {
        assert.equal(prefabById(prefab.id), prefab);
        assert.ok(categories.includes(prefab.category), `${prefab.id} is offered somewhere`);
        assert.ok(prefabsIn(prefab.category).includes(prefab));
        const bounds = recipeBounds(prefab.recipe);
        assert.ok(near(bounds.maxX - bounds.minX, prefab.footprint[0], 0.05), `${prefab.id} is ${bounds.maxX - bounds.minX} across, not ${prefab.footprint[0]}`);
        assert.ok(near(bounds.maxZ - bounds.minZ, prefab.footprint[1], 0.05), `${prefab.id} is ${bounds.maxZ - bounds.minZ} along, not ${prefab.footprint[1]}`);
        assert.equal(readRecipe(prefab.recipe).problems.length, 0, `${prefab.id}'s recipe reads back`);
        assert.ok(Object.isFrozen(prefab.recipe.parts[0]), 'and cannot be rewritten');
    }
    assert.equal(prefabById('cathedral'), null);
});

test('every recipe builds: corners in threes, every number finite, a colour at every corner', () => {
    for (const prefab of PREFABS) {
        const shape = recipeGeometry(prefab.recipe);
        assert.ok(shape.count > 0 && shape.count % 3 === 0, prefab.id);
        assert.equal(shape.positions.length, shape.count * 3);
        assert.equal(shape.normals.length, shape.count * 3);
        assert.equal(shape.colors.length, shape.count * 3);
        assert.ok([...shape.positions, ...shape.normals, ...shape.colors].every(Number.isFinite));
        assert.ok([...shape.colors].every(value => value >= 0 && value <= 1));
    }
});

/** Every triangle of a one-part recipe faces out of its solid, and its normal agrees with the way its corners wind. */
function facesOut(part) {
    const shape = recipeGeometry({ parts: [part] });
    const p = shape.positions, n = shape.normals;
    let middle = [0, 0, 0];
    for (let i = 0; i < shape.count; i++) for (let k = 0; k < 3; k++) middle[k] += p[i * 3 + k] / shape.count;
    for (let t = 0; t < shape.count; t += 3) {
        const a = [0, 1, 2].map(k => p[t * 3 + k]), b = [0, 1, 2].map(k => p[t * 3 + 3 + k]), c = [0, 1, 2].map(k => p[t * 3 + 6 + k]);
        const normal = [0, 1, 2].map(k => n[t * 3 + k]);
        const u = b.map((v, k) => v - a[k]), v = c.map((w, k) => w - a[k]);
        const wound = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
        const length = Math.hypot(...wound);
        if (!(length > 1e-9)) continue;
        if (!wound.every((value, k) => near(value / length, normal[k], 1e-5))) return false;
        if (!near(Math.hypot(...normal), 1, 1e-5)) return false;
        const centre = [0, 1, 2].map(k => (a[k] + b[k] + c[k]) / 3 - middle[k]);
        if (centre[0] * normal[0] + centre[1] * normal[1] + centre[2] * normal[2] <= 0) return false;
    }
    return true;
}

test('every face is wound outward, its normal the way its corners turn, whatever shape it is', () => {
    const color = 0xffffff;
    assert.ok(facesOut({ shape: 'box', size: [4, 2, 6], at: [1, 0, 2], color }), 'a box');
    assert.ok(facesOut({ shape: 'box', size: [4, 2, 6], at: [0, 3, 0], turn: 37, color }), 'turned');
    assert.ok(facesOut({ shape: 'wedge', size: [4, 2, 6], at: [0, 0, 0], color }), 'a wedge');
    assert.ok(facesOut({ shape: 'wedge', size: [4, 2, 6], at: [0, 0, 0], ridge: 'edge', color }), 'a single slope');
    assert.ok(facesOut({ shape: 'cylinder', radius: 3, height: 5, at: [0, 0, 0], color }), 'a cylinder');
    assert.ok(facesOut({ shape: 'cylinder', radius: 3, top: 1, height: 5, at: [0, 0, 0], segments: 7, color }), 'narrowing');
    assert.ok(facesOut({ shape: 'cone', radius: 3, height: 5, at: [0, 0, 0], color }), 'a cone');
    assert.equal(recipeGeometry({ parts: [{ shape: 'box', size: [1, 1, 1], at: [0, 0, 0], color }] }).count, 36, 'twelve triangles to a box');
    assert.equal(recipeGeometry({ parts: [{ shape: 'cone', radius: 1, height: 1, at: [0, 0, 0], segments: 5, color }] }).count, (3 + 5) * 3, 'a cone: its base and a triangle a side');
});

/** The corners of a one-part recipe at its very top, as `[x, z]` pairs. */
function topCorners(part) {
    const { positions, count } = recipeGeometry({ parts: [part] });
    let top = -Infinity;
    for (let i = 0; i < count; i++) top = Math.max(top, positions[i * 3 + 1]);
    const corners = [];
    for (let i = 0; i < count; i++) if (near(positions[i * 3 + 1], top)) corners.push([positions[i * 3], positions[i * 3 + 2]]);
    return corners;
}

test('a wedge\'s ridge runs down its middle or along its +x edge, and a cylinder narrows to its top', () => {
    const middle = topCorners({ shape: 'wedge', size: [4, 2, 6], at: [0, 0, 0], color: 0 });
    assert.ok(middle.every(([x]) => near(x, 0)), 'a gable\'s ridge down the middle');
    const edge = topCorners({ shape: 'wedge', size: [4, 2, 6], at: [0, 0, 0], ridge: 'edge', color: 0 });
    assert.ok(edge.every(([x]) => near(x, 2)), 'a single slope\'s along its +x side');
    const narrowing = topCorners({ shape: 'cylinder', radius: 3, top: 1, height: 5, at: [0, 0, 0], color: 0 });
    assert.ok(narrowing.every(([x, z]) => near(Math.hypot(x, z), 1)), 'a cylinder\'s top ring at its top radius');
    const straight = topCorners({ shape: 'cylinder', radius: 3, height: 5, at: [0, 0, 0], color: 0 });
    assert.ok(straight.every(([x, z]) => near(Math.hypot(x, z), 3)), 'and at its radius with none named');
});

test('a part stands its base on its point, and turns about its own upright', () => {
    assert.deepEqual(recipeBounds({ parts: [{ shape: 'box', size: [4, 2, 6], at: [10, 3, -5], color: 0 }] }),
        { minX: 8, maxX: 12, minZ: -8, maxZ: -2, top: 5 });
    const turned = recipeBounds({ parts: [{ shape: 'box', size: [4, 2, 6], at: [0, 0, 0], turn: 90, color: 0 }] });
    assert.ok(near(turned.maxX - turned.minX, 6) && near(turned.maxZ - turned.minZ, 4), 'a quarter turn swaps across and along');
    const ridge = recipeBounds({ parts: [{ shape: 'wedge', size: [4, 2, 6], at: [0, 0, 0], color: 0 }] });
    assert.equal(ridge.top, 2);
    assert.equal(recipeBounds({ parts: [] }), null);
    assert.deepEqual(WEDGE_RIDGES, ['middle', 'edge']);
});

test('a colour is read as sRGB and handed on as the linear light a vertex colour is', () => {
    assert.deepEqual(linearColor(0xffffff), [1, 1, 1]);
    assert.deepEqual(linearColor(0x000000), [0, 0, 0]);
    const [r, g, b] = linearColor(0x808080);
    assert.ok(near(r, 0.21586, 1e-4) && r === g && g === b);
    assert.deepEqual(linearColor(0xff0000).map(value => value > 0), [true, false, false]);
});

test('a recipe read from a file is taken whole or refused, each problem named where it is', () => {
    const good = { parts: [{ shape: 'box', size: [1, 2, 3], at: [0, 0, 0], color: 0x123456 }], solid: false };
    const read = readRecipe(good);
    assert.deepEqual(read.recipe, good);
    assert.notEqual(read.recipe, good, 'a copy');
    const problems = value => readRecipe(value, 'r').problems;
    assert.deepEqual(problems(null), ['r: not a recipe']);
    assert.deepEqual(problems({ parts: [] }), ['r: parts is not a list of parts']);
    assert.deepEqual(problems({ parts: good.parts, roof: 1 }), ['r: roof is not a field a recipe has']);
    assert.deepEqual(problems({ parts: good.parts, solid: 'no' }), ['r: solid is not true or false']);
    assert.deepEqual(problems({ parts: Array(RECIPE_PART_LIMIT + 1).fill(good.parts[0]) }), [`r: more than ${RECIPE_PART_LIMIT} parts`]);
    const part = extra => problems({ parts: [{ ...good.parts[0], ...extra }] });
    assert.deepEqual(part({ shape: 'blob' }), ['r.parts[0]: no shape is called "blob"']);
    assert.deepEqual(part({ at: [0, 0] }), ['r.parts[0]: at is not a point']);
    assert.deepEqual(part({ at: [RECIPE_REACH + 1, 0, 0] }), ['r.parts[0]: at is not a point'], 'nor one too far out');
    assert.deepEqual(part({ color: 0x1000000 }), ['r.parts[0]: color is not a colour']);
    assert.deepEqual(part({ size: [1, 0, 1] }), ['r.parts[0]: size is not three lengths']);
    assert.deepEqual(part({ ridge: 'edge' }), ['r.parts[0]: ridge is not where a ridge runs'], 'a box has no ridge');
    assert.deepEqual(part({ turn: 'left' }), ['r.parts[0]: turn is not a number']);
    assert.deepEqual(part({ windows: 4 }), ['r.parts[0]: windows is not a field a part has']);
    const round = extra => problems({ parts: [{ shape: 'cone', radius: 2, height: 3, at: [0, 0, 0], color: 0, ...extra }] });
    assert.deepEqual(round({}), []);
    assert.deepEqual(round({ top: 1 }), ['r.parts[0]: top is not a radius'], 'a cone has no top');
    assert.deepEqual(round({ segments: 2 }), ['r.parts[0]: segments is not 3 to 32 sides']);
    assert.deepEqual(round({ radius: -1 }), ['r.parts[0]: radius is not a length']);
    assert.deepEqual(PART_FIELDS, Object.keys(schema.$defs.part.properties));
    assert.deepEqual(RECIPE_FIELDS, Object.keys(schema.$defs.recipe.properties));
    assert.deepEqual(PREFAB_SHAPES, schema.$defs.part.properties.shape.enum);
});

test('a recipe is copied out of its prefab, known by what it is, and solid unless it says not', () => {
    const recipe = copyRecipe(prefabById('cottage').recipe);
    recipe.parts[0].size[0] = 99;
    assert.equal(prefabById('cottage').recipe.parts[0].size[0], 8, 'the catalogue untouched');
    assert.equal(recipeKey(prefabById('cottage').recipe), recipeKey(copyRecipe(prefabById('cottage').recipe)));
    assert.notEqual(recipeKey(recipe), recipeKey(prefabById('cottage').recipe));
    assert.equal(recipeSolid(recipe), true);
    assert.equal(recipeSolid({ ...recipe, solid: false }), false);
});

// --- Objects --------------------------------------------------------------------------------

test('an object is a prefab placed with its recipe copied in, at a point, a heading and a scale', () => {
    const placed = placeObject('cottage', [100, 200], { heading: 30, scale: 2 });
    assert.equal(placed.type, OBJECT_TYPE);
    assert.equal(isObject(placed), true);
    assert.equal(placed.prefab, 'cottage');
    assert.deepEqual(placed.recipe, prefabById('cottage').recipe);
    assert.equal(Object.isFrozen(placed.recipe.parts[0]), false, 'its own, to keep');
    assert.deepEqual(placed.config, { at: [100, 200], heading: 30, scale: 2 });
    assert.equal(placeObject('cathedral', [0, 0]), null);
    assert.equal(placeObject('cottage', [0]), null);
    assert.deepEqual(objectConfig({ config: { at: [1, 2], heading: -30, scale: 9 } }), { at: [1, 2], heading: 330, scale: OBJECT_RANGES.scale.high });
    assert.deepEqual(objectConfig({}), { at: [0, 0], heading: 0, scale: 1 });
    assert.deepEqual([OBJECT_RANGES.scale.low, OBJECT_RANGES.scale.high, OBJECT_RANGES.heading.high], [0.5, 3, 359]);
    assert.equal(isObject({ type: 'mountain' }), false);
});

test('its footprint is its recipe\'s reach, scaled, turned to face its heading, hard-edged', () => {
    const placed = placeObject('cottage', [100, 200], { heading: 90, scale: 2 });
    const footprint = objectFootprint(placed);
    assert.equal(footprint.kind, 'rect');
    assert.ok(near(footprint.width, 8.6 * 2) && near(footprint.depth, 10.6 * 2));
    assert.equal(footprint.feather, 0, 'a house is far smaller than any feather');
    const ahead = bearingToDirection(90);
    const standing = standingObjects([placed]);
    assert.equal(insideObject(standing[0], 100 + ahead.x * 10.5, 200 + ahead.z * 10.5), true, 'its length runs the way it faces');
    assert.equal(insideObject(standing[0], 100 + ahead.x * 10.7, 200 + ahead.z * 10.7), false);
    assert.equal(insideObject(standing[0], 100 - ahead.z * 8.7, 200 + ahead.x * 8.7), false, 'and its width across');
    assert.equal(objectHeight(placed), 6 * 2);

    const lopsided = { type: OBJECT_TYPE, prefab: 'shed', recipe: { parts: [{ shape: 'box', size: [2, 2, 2], at: [10, 0, 0], color: 0 }] }, config: { at: [0, 0], heading: 0 } };
    assert.ok(near(objectFootprint(lopsided).x, 10) && near(objectFootprint(lopsided).z, 0), 'round the middle of its reach, not its point');
});

test('it stands on the highest ground under its footprint, its plinth down to the lowest, on every tile at its own point', () => {
    const placed = placeObject('water-tower', [100, 200], { scale: 1.5 });
    const slope = (x, z) => x * 0.5 + z * 0.1;
    const [here] = standingObjects([placed], { groundAt: slope });
    const half = 9.6 * 1.5 / 2;
    assert.ok(near(here.stand, slope(100 + half, 200 + half)), 'the highest corner');
    assert.ok(near(here.base, slope(100 - half, 200 - half)), 'and the lowest');
    assert.ok(near(here.top, here.stand + 22 * 1.5));
    assert.equal(here.solid, true);
    assert.equal(here.prefab, 'water-tower');
    assert.equal(here.key, recipeKey(placed.recipe));

    const [there] = standingObjects([placed], { groundAt: slope, originX: SIZE, originZ: -SIZE });
    assert.deepEqual([there.x, there.z], [100 + SIZE, 200 - SIZE], 'the same point of the next tile');
    assert.ok(near(there.stand, slope(100 + SIZE + half, 200 - SIZE + half)), 'on that tile\'s own ground');

    assert.deepEqual(standingObjects([{ type: 'mountain', config: {} }]), [], 'nothing but objects');
});

const eraseAll = (at, radius, extra = {}) => ({
    type: ERASE_TYPE, config: { target: ERASE_ALL, strength: 1, ...extra },
    footprint: { kind: 'disc', x: at[0], z: at[1], radius, feather: 0 }
});

test('Erase takes an object whole when a batch taking everything covers its middle, and a put-back gives it back', () => {
    const placed = placeObject('cottage', [0, 0]);
    assert.equal(objectErased(placed, [eraseAll([0, 0], 20)]), true);
    assert.equal(objectErased(placed, [eraseAll([30, 0], 20)]), false, 'not one that misses its middle');
    assert.equal(objectErased(placed, [eraseAll([0, 0], 20, { target: 'grass' })]), false, 'nor one taking only grass');
    assert.equal(objectErased(placed, [eraseAll([0, 0], 20, { strength: 0.3 })]), false, 'nor one too weak to take it');
    assert.equal(objectErased(placed, [eraseAll([0, 0], 20), eraseAll([0, 0], 20, { restore: true })]), false, 'put back');
    assert.equal(objectErased(placed, [eraseAll([0, 0], 20, { restore: true }), eraseAll([0, 0], 20)]), true, 'the last to reach it decides');
    assert.equal(OBJECT_ERASE_STRENGTH, 0.5);

    // A stroke narrower than its own feather thins the ground it crosses and
    // never takes all of it - but a building under it is there or it is not.
    const thin = {
        type: ERASE_TYPE, config: { target: ERASE_ALL, strength: 1 },
        footprint: { kind: 'placed', of: { kind: 'stroke', points: [[-10, 0], [10, 0]], stamp: { width: 60, depth: 60, corner: 30 } }, x: 0, z: 0, angle: 0, scaleX: 1, scaleZ: 1 }
    };
    assert.equal(objectErased(placed, [thin]), true, 'a narrow stroke over its middle takes it');
    assert.equal(objectErased(placed, [{ ...thin, footprint: { ...thin.footprint, z: 40 } }]), false, 'and one beside it does not');

    const list = [placed, eraseAll([0, 0], 20), placeObject('cottage', [0, 0])];
    assert.equal(standingObjects(list).length, 1, 'a batch takes only what was placed before it');
});

test('obstacleTop is the top of the solid object over a point, the highest where two overlap, and nothing elsewhere', () => {
    const low = placeObject('cottage', [0, 0]);
    const high = placeObject('water-tower', [2, 0]);
    const park = { ...placeObject('cottage', [500, 0]), recipe: { ...copyRecipe(prefabById('cottage').recipe), solid: false } };
    const standing = standingObjects([low, high, park], { groundAt: () => 10 });
    assert.ok(near(obstacleTop(standing, 1, 0), 10 + 22), 'the tower over the cottage');
    assert.ok(near(obstacleTop(standing, -4, -5), 10 + 6), 'the cottage alone');
    assert.equal(obstacleTop(standing, 50, 50), null, 'open ground');
    assert.equal(obstacleTop(standing, 500, 0), null, 'a park is flown over');
    assert.equal(obstacleTop([], 0, 0), null);
});

test('an object changes no ground: the field is drawn as it was without it', () => {
    const environment = getEnvironment('highlands');
    const base = environmentElements(environment, false);
    const without = buildEnvironment(environment, { elements: base });
    const withIt = buildEnvironment(environment, { elements: [...base, placeObject('cottage', [0, 0]), eraseAll([5000, 5000], 10)] });
    assert.deepEqual([...withIt.height], [...without.height]);
    assert.deepEqual([...withIt.color], [...without.color]);
});

// --- The builder's tools --------------------------------------------------------------------

test('Select picks an object inside its footprint, over the ground it stands on', () => {
    const placed = placeObject('cottage', [100, 200]);
    const mountain = { type: 'mountain', config: { count: 1, at: [100, 200] }, seed: 7 };
    assert.equal(placementAt([mountain, placed], 100, 200, SIZE), 1, 'the house, not the hill it stands on');
    assert.equal(placementAt([placed, mountain], 100, 200, SIZE), 0, 'whichever was placed first');
    assert.equal(placementAt([placed], 120, 200, SIZE), null);
    const reach = placementReach(placed, SIZE);
    assert.equal(reach(100, 200), 1);
    assert.equal(reach(100, 205.2), 1);
    assert.equal(reach(100, 205.5), 0, 'hard at its edge');
});

test('its outline is its footprint, traced round as it stands', () => {
    const placed = placeObject('cottage', [100, 200]);
    const outline = placementOutline(placed, SIZE);
    assert.equal(outline.length, 4, 'four sides');
    for (const [x1, z1, x2, z2] of outline) {
        assert.ok([x1, x2].every(x => near(Math.abs(x - 100), 4.3)) || [z1, z2].every(z => near(Math.abs(z - 200), 5.3)));
    }
    assert.ok(outline.every(([x, z], i) => { const [, , px, pz] = outline[(i + 3) % 4]; return near(x, px) && near(z, pz); }), 'a closed loop');
});

test('the Flat gumball moves it, turns it by its arc, and scales it evenly by its two squares', () => {
    const placed = placeObject('cottage', [100, 200], { heading: 30 });
    assert.equal(gumballKind(OBJECT_TYPE), GUMBALL_FLAT);
    assert.deepEqual(boundHandles(placed).map(handle => handle.id), ['move-uniform', 'move-3', 'move-2', 'scale-x', 'scale-y', 'rotate-blue']);
    assert.deepEqual(dragHandle(placed, 'move-uniform', { ground: { dx: 10.4, dz: -5 } }, { size: SIZE }), { config: { at: [110, 195] }, footprint: null });
    assert.deepEqual(dragHandle(placed, 'rotate-blue', { turn: Math.PI / 6 }), { config: { heading: 60 }, footprint: null });
    assert.deepEqual(dragHandle(placed, 'scale-x', { along: 160 }), { config: { scale: 2.7 } });
    assert.deepEqual(dragHandle(placed, 'scale-y', { along: 1000 }), { config: { scale: OBJECT_RANGES.scale.high } }, 'never past its largest');
    assert.deepEqual(dragHandle(placed, 'scale-x', { along: -1000 }), { config: { scale: OBJECT_RANGES.scale.low } }, 'nor under its smallest');
    assert.equal(dragHandle(placed, 'scale-z', { along: 160 }), null, 'no square stands up off the ground');
    assert.equal(dragHandle(placed, 'move', { along: 160 }), null, 'nor is it raised');
});

test('picked, its panel is its heading and scale under its prefab\'s name', () => {
    const placed = placeObject('water-tower', [100, 200], { heading: 45, scale: 1.5 });
    assert.deepEqual(Object.keys(panelRanges(placed)), ['heading', 'scale']);
    assert.deepEqual(draftHolderFor(placed), { config: { heading: 45, scale: 1.5 }, shades: {}, base: {} });

    const state = createBuildState();
    openBuildMode(state);
    beginCanvas(state, 'highlands', [placed], []);
    selectPlacement(state, 0);
    assert.equal(buildDraft(state).prefab, 'water-tower');
    const shown = dockContent(state, { camera: createBuildCamera(SIZE), fov: DEFAULT_FOV });
    const section = shown.sections.find(each => each.heading.startsWith('SELECTED'));
    assert.equal(section.heading, 'SELECTED WATER TOWER');
    assert.deepEqual(section.rows.map(row => row.row.label), ['HEADING', 'SCALE']);
});

// --- The environment file -------------------------------------------------------------------

test('an object is saved with its recipe, and read back held to what it may be', () => {
    const placed = placeObject('water-tower', [100, -200], { heading: 45, scale: 1.5 });
    const world = { environment: 'highlands', placements: [placed], world: [] };
    const text = environmentText(environmentDocument(world, { name: 'Sample Valley' }));
    const read = readEnvironmentDocument(text);
    assert.equal(read.ok, true);
    assert.deepEqual(read.world.placements, [placed]);
    assert.ok(placementTypes().includes(OBJECT_TYPE));

    const edited = extra => {
        const document = JSON.parse(text);
        Object.assign(document.placements[0], extra.placement ?? {});
        Object.assign(document.placements[0].config, extra.config ?? {});
        return document;
    };
    const held = readEnvironmentDocument(JSON.stringify(edited({ config: { scale: 9, heading: 400 } })));
    assert.equal(held.world.placements[0].config.scale, OBJECT_RANGES.scale.high);
    assert.equal(held.world.placements[0].config.heading, OBJECT_RANGES.heading.high);
    const problems = extra => readEnvironmentDocument(JSON.stringify(edited(extra))).problems;
    assert.deepEqual(problems({ placement: { prefab: '' } }), ['placements[0]: prefab is not named']);
    assert.deepEqual(problems({ placement: { recipe: { parts: [] } } }), ['placements[0].recipe: parts is not a list of parts']);
    assert.deepEqual(problems({ config: { heading: 'north' } }), ['placements[0]: heading is not a number']);
    const nowhere = JSON.parse(text);
    delete nowhere.placements[0].config.at;
    assert.deepEqual(readEnvironmentDocument(JSON.stringify(nowhere)).problems, ['placements[0]: at is missing, so the object stands nowhere']);
});

test('the schema takes a written object, and wants its prefab and its recipe', () => {
    assert.deepEqual(schema.$defs.placement.properties.type.anyOf[1].enum, ['erase', 'group', 'object']);
    const rule = schema.$defs.placement.allOf.find(each => each.if.properties.type.const === 'object');
    assert.deepEqual(rule.then.required, ['prefab', 'recipe']);
    assert.equal(schema.$defs.placement.properties.recipe.$ref, '#/$defs/recipe');
    assert.deepEqual(schema.$defs.recipe.required, ['parts']);
    assert.equal(schema.$defs.recipe.properties.parts.maxItems, RECIPE_PART_LIMIT);
});

// --- The world, the flight and the page --------------------------------------------------------

test('the aircraft hits an object at any speed, before the ground is ever asked about a landing', () => {
    const aircraft = source('aircraft.js');
    const update = methodBody(aircraft, 'update');
    assert.match(aircraft, /update\(dt, terrainHeight = 0, obstacle = null\) \{/);
    assert.match(update, /if \(Number\.isFinite\(obstacle\) && this\.position\.y - this\.clearance <= obstacle\) \{\s*recordTouchdown\(this\.crash, CRASHED\);\s*return this\.stopOnTheGround\(\);/);
    assert.ok(update.indexOf('Number.isFinite(obstacle)') < update.indexOf('const onGround'), 'read apart from the ground, so a roof is never landed on');

    const main = source('main.js');
    const frame = methodBody(main, 'animate');
    assert.match(frame, /const obstacle\s*= this\.terrain\.obstacleTopAt\(aircraftPos\.x, aircraftPos\.z\);/);
    assert.match(frame, /this\.aircraft\.update\(dt, groundH, obstacle\);/);
});

test('every tile stands the objects on its own ground once it is settled, and lets them go with it', () => {
    const terrain = source('terrain.js');
    const add = methodBody(terrain, 'addTile');
    assert.match(add, /const objects = standingObjects\(this\.built\.elements \?\? \[\], \{\s*groundAt: \(x, z\) => sampleHeight\(field, x, z\),\s*originX: middle\.x,\s*originZ: middle\.z,\s*size: this\.size\s*\}\);/);
    const joined = add.indexOf('const settled = this.joinTile(field, index);');
    assert.ok(joined >= 0 && joined < add.indexOf('standingObjects('), 'on ground already matched to its neighbours');
    assert.match(add, /objects, objectMesh: objectGroup\(objects\)/);
    assert.match(add, /if \(tile\.objectMesh\) this\.scene\.add\(tile\.objectMesh\);/);
    assert.match(methodBody(terrain, 'dropTile'), /if \(tile\.objectMesh\) \{\s*this\.scene\.remove\(tile\.objectMesh\);\s*disposeObjectGroup\(tile\.objectMesh\);/);
    const top = methodBody(terrain, 'obstacleTopAt');
    assert.match(top, /\[\[0, 0\], \[-OBJECT_REACH, 0\], \[OBJECT_REACH, 0\], \[0, -OBJECT_REACH\], \[0, OBJECT_REACH\]\]/, 'the tiles beside it are asked too');
    assert.match(top, /const over = obstacleTop\(tile\.objects, x, z\);/);
    assert.match(source('environment/presets.js'), /\.filter\(placement => !isObject\(placement\)\)/);
});

test('each recipe is one instanced mesh, lit and fogged by the ground\'s own material, over a plinth where the ground falls away', () => {
    const mesh = source('object-mesh.js');
    assert.match(mesh, /new THREE\.InstancedMesh\(geometry, objectMaterial\(\), standing\.length\)/);
    assert.match(mesh, /byRecipe\.get\(object\.key\)\.push\(object\)/, 'one mesh to a recipe');
    assert.match(mesh, /return holdGroundColor\(new THREE\.MeshLambertMaterial\(\{ vertexColors: true \}\)\);/);
    assert.match(mesh, /matrix\.compose\(position\.set\(object\.x, object\.stand, object\.z\), turn, scale\.setScalar\(object\.scale\)\);/);
    assert.match(mesh, /const plinths = objects\.filter\(object => object\.stand - object\.base > 0\.05\);/);
    assert.match(mesh, /scale\.set\(footprint\.width, object\.stand - object\.base \+ PLINTH_DEPTH, footprint\.depth\)/);
});
