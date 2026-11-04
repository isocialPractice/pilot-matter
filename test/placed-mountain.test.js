/**
 * Placed mountains - a mountain dropped at a click, each one placement, each
 * edited alone - held from the generator up to the panel that edits one.
 *
 * The session's half, the click and the confirms, is in `build-mode.test.js`
 * with the rest of the session; this is what the click makes, and what the
 * world does with it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createField, createRandom, applyElement, resolveConfig, resolvePoint, wrapOffset,
    getElement, fieldX, fieldZ, DEFAULT_SIZE
} from '../js/environment/elements.js';
import { applyFootprintedElement, placementRandom } from '../js/environment/footprinted.js';
import {
    buildEnvironment, getEnvironment, environmentIds, environmentElements
} from '../js/environment/presets.js';
import {
    createBuildState, openBuildMode, beginCanvas, chooseBuildTool, dropDraft, reviseDraft,
    buildDraft, placementSeed, BUILD_FROM_TITLE
} from '../js/build-mode.js';
import { dockContent, draftHolderFor, panelRanges, canvasElements, DOCK_DRAFT } from '../js/build-panel.js';
import { createEditorState, keepBuiltWorld, keptPlacements, editorPlacements, setEditorWorld } from '../js/element-editor.js';

/** One peak of a known size, so where it stands can be read off the heights. */
const PEAK = { height: [500, 500], radius: [1000, 1000] };

/** A flat field to drop on, coarse enough to be quick. */
function flat(origin = {}) {
    return createField({ size: DEFAULT_SIZE, segments: 160, ...origin });
}

/** The vertex a field has nearest a point in the world's frame. */
function nearest(field, x, z) {
    let best = -1;
    let gap = Infinity;
    for (let i = 0; i < field.count; i++) {
        const d = Math.hypot(fieldX(field, i) - x, fieldZ(field, i) - z);
        if (d < gap) { gap = d; best = i; }
    }
    return best;
}

/** The highest vertex of a field. */
function summit(field) {
    let best = 0;
    for (let i = 1; i < field.count; i++) if (field.height[i] > field.height[best]) best = i;
    return best;
}

// --- The point -----------------------------------------------------------------

test('a configuration carries the point it was dropped on beside its ranges', () => {
    const mountain = getElement('mountain');
    assert.deepEqual(resolveConfig(mountain, { at: [120, -40] }).at, [120, -40]);
    assert.ok(!('at' in resolveConfig(mountain, {})), 'and nothing at all when none was given, which is every preset');
    assert.ok(!('at' in mountain.ranges), 'it is not a range: a click sets it, not a panel');
    assert.deepEqual(resolveConfig(mountain, null), resolveConfig(mountain, {}), 'and no configuration is the defaults');
});

test('a point is a pair of finite numbers, and anything else is no point', () => {
    assert.deepEqual(resolvePoint([3, -4]), [3, -4]);
    for (const given of [null, undefined, [], [1], [1, 2, 3], [1, NaN], [Infinity, 0], ['1', 2], { x: 1, z: 2 }, 7]) {
        assert.equal(resolvePoint(given), null, JSON.stringify(given));
    }
    const given = [5, 6];
    assert.notEqual(resolvePoint(given), given, 'and it is a copy');
});

test('an offset is taken to the nearest repeat of the square', () => {
    assert.equal(wrapOffset(100, 16000), 100);
    assert.equal(wrapOffset(15900, 16000), -100);
    assert.equal(wrapOffset(-15900, 16000), 100);
    assert.equal(wrapOffset(32100, 16000), 100);
    assert.equal(wrapOffset(12345, 0), 12345, 'a square of no size is no wrap');
});

// --- One peak, standing where it was dropped ------------------------------------

test('a mountain given a point is one peak, standing on it', () => {
    const field = flat();
    const peaks = applyElement(field, { type: 'mountain', config: { ...PEAK, at: [2000, -1500] } }, createRandom(9));

    assert.equal(peaks, 1);
    const top = summit(field);
    assert.ok(Math.hypot(fieldX(field, top) - 2000, fieldZ(field, top) + 1500) <= field.step,
        'the highest ground is under the point');
    assert.ok(Math.abs(field.height[top] - 500) < 5, `and as high as asked: ${field.height[top]}`);
});

test('the point settles the count: a mountain dropped is one whatever the count says', () => {
    for (const count of [0, 1, 12, 200]) {
        const peaks = applyElement(flat(), { type: 'mountain', config: { ...PEAK, count, at: [0, 0] } }, createRandom(3));
        assert.equal(peaks, 1, `count ${count}`);
    }
});

test('a dropped peak takes from a stream exactly what a peak laid out of it does', () => {
    function draws(config) {
        let taken = 0;
        const random = createRandom(11);
        applyElement(flat(), { type: 'mountain', config }, () => { taken++; return random(); });
        return taken;
    }
    assert.equal(draws({ ...PEAK, count: 1, at: [700, 700] }), draws({ ...PEAK, count: 1 }));
});

test('a point is in the square\'s own frame, so it lands in the same place on every tile', () => {
    for (const origin of [{ originX: 0, originZ: 0 }, { originX: 16000, originZ: -32000 }]) {
        const field = flat(origin);
        applyElement(field, { type: 'mountain', config: { ...PEAK, at: [-3000, 2500] } }, createRandom(1));
        const top = summit(field);
        assert.ok(Math.hypot(fieldX(field, top) - origin.originX + 3000, fieldZ(field, top) - origin.originZ - 2500) <= field.step);
    }
});

test('a peak dropped by an edge carries on across the seam into the next tile', () => {
    const config = { ...PEAK, at: [7700, 0] };
    const home = flat();
    const east = flat({ originX: DEFAULT_SIZE });
    applyElement(home, { type: 'mountain', config }, createRandom(1));
    applyElement(east, { type: 'mountain', config }, createRandom(1));

    const seamHome = nearest(home, DEFAULT_SIZE / 2, 0);
    const seamEast = nearest(east, DEFAULT_SIZE / 2, 0);
    assert.ok(home.height[seamHome] > 0, 'the mountain reaches the edge of its own tile');
    assert.ok(Math.abs(home.height[seamHome] - east.height[seamEast]) < 1e-9,
        'and the tile beside it stands at the same height on the seam they share');

    const far = nearest(home, -DEFAULT_SIZE / 2 + 100, 0);
    assert.ok(home.height[far] > 0, 'its own tile carries the slope in at the opposite edge too');
});

// --- A stream of its own ------------------------------------------------------

test('a seeded placement draws from its own stream, and an unseeded one from the world\'s', () => {
    const shared = createRandom(42);
    assert.equal(placementRandom({ type: 'mountain' }, shared), shared);
    for (const seed of [NaN, Infinity, '12', null]) {
        assert.equal(placementRandom({ type: 'mountain', seed }, shared), shared, `${seed} is no seed`);
    }

    const own = placementRandom({ type: 'mountain', seed: 1234 }, shared);
    assert.notEqual(own, shared);
    const again = placementRandom({ type: 'mountain', seed: 1234 }, shared);
    assert.deepEqual([own(), own(), own()], [again(), again(), again()], 'the same seed is the same stream');
});

test('a seeded placement takes nothing from the world\'s stream', () => {
    const shared = createRandom(42);
    applyFootprintedElement(flat(), { type: 'mountain', config: { ...PEAK, at: [0, 0] }, seed: placementSeed(0) }, shared);
    assert.equal(shared(), createRandom(42)(), 'the next draw is the stream\'s first');

    const sharing = createRandom(42);
    applyFootprintedElement(flat(), { type: 'mountain', config: { ...PEAK, at: [0, 0] } }, sharing);
    assert.notEqual(sharing(), createRandom(42)(), 'where an unseeded one shares it');
});

/**
 * The reason a built placement is seeded. It is applied among the preset's own
 * by type - a built mountain beside the preset's mountains, before its water,
 * forest and towns - and on the shared stream every draw after it would move,
 * so dropping one mountain would rearrange the whole canvas. Seeded, the
 * ground beyond the mountain's own reach is the ground it was, on every world.
 */
test('a dropped mountain leaves every world beyond its own reach exactly as it was', () => {
    const at = [-5000, 4000];
    const reach = 1000;
    const dropped = { type: 'mountain', config: { count: 1, at, ...PEAK }, seed: placementSeed(0) };

    for (const id of environmentIds()) {
        const environment = getEnvironment(id);
        const own = environmentElements(environment, false);
        const before = buildEnvironment(environment, { elements: own, segments: 100 });
        const after  = buildEnvironment(environment, { elements: [...own, dropped], segments: 100 });

        let raised = 0;
        for (let i = 0; i < before.count; i++) {
            const d = Math.hypot(fieldX(before, i) - at[0], fieldZ(before, i) - at[1]);
            if (d < reach) {
                if (after.height[i] > before.height[i]) raised++;
                continue;
            }
            assert.equal(after.height[i], before.height[i], `${id}: ground ${Math.round(d)} away moved`);
        }
        assert.ok(raised > 0, `${id}: the mountain stands where it was dropped`);
    }
});

// --- The canvas and its panel ---------------------------------------------------

function onCanvasWithMountain(point = { x: 1500, z: -800 }) {
    const state = createBuildState();
    openBuildMode(state, BUILD_FROM_TITLE);
    beginCanvas(state, 'blank-canvas');
    chooseBuildTool(state, 'mountain');
    dropDraft(state, point);
    return state;
}

test('a mountain dropped on the canvas stands at the click', () => {
    const state = onCanvasWithMountain({ x: 1500, z: -800 });
    const environment = getEnvironment('blank-canvas');
    const before = buildEnvironment(environment, { elements: environmentElements(environment, false) });
    const after  = buildEnvironment(environment, { elements: canvasElements(environment, state) });

    const at = nearest(after, 1500, -800);
    assert.ok(after.height[at] - before.height[at] > 100, 'the ground under the click rose');
    const away = nearest(after, -6000, 6000);
    assert.equal(after.height[away], before.height[away], 'and ground well away from it did not');
});

test('a dropped mountain\'s panel is its element\'s ranges less the count its click settled', () => {
    const state = onCanvasWithMountain();
    const ranges = panelRanges(buildDraft(state));

    assert.ok(!('count' in ranges), 'the count is the click\'s');
    assert.deepEqual(Object.keys(ranges), Object.keys(getElement('mountain').ranges).filter(name => name !== 'count'),
        'and everything else the element declares, in its order');

    const shown = dockContent(state);
    assert.equal(shown.kind, DOCK_DRAFT);
    assert.equal(shown.heading, 'BUILD MOUNTAINS');
    assert.deepEqual(shown.rows.slice(0, 5).map(row => row.row.label), ['HEIGHT MIN', 'HEIGHT MAX', 'RADIUS MIN', 'RADIUS MAX', 'GIRTH'],
        'led by the artwork\'s rows, in the artwork\'s order, its count taken by the click');
    assert.ok(shown.rows.every(row => row.name !== 'count' && row.name !== 'at'));
});

test('a mountain that was not dropped keeps its count on the panel', () => {
    assert.ok('count' in panelRanges({ type: 'mountain', config: { count: 3 } }));
    assert.deepEqual(panelRanges({ type: 'volcano' }), {});
    assert.deepEqual(panelRanges(null), {});
});

test('a value stepped on the panel never puts a moved mountain back where it was first dropped', () => {
    const state = onCanvasWithMountain({ x: 0, z: 0 });
    const holder = draftHolderFor(buildDraft(state));
    assert.ok(!('at' in holder.config), 'the holder does not hold the point');

    dropDraft(state, { x: 4000, z: 4000 });
    holder.config.height = [800, 900];
    reviseDraft(state, { config: holder.config });

    assert.deepEqual(buildDraft(state).config.at, [4000, 4000]);
    assert.deepEqual(buildDraft(state).config.height, [800, 900]);
});

// --- Kept -----------------------------------------------------------------------

const KEPT = [{ type: 'mountain', config: { count: 1, at: [100, 200], ...PEAK }, seed: placementSeed(0) }];

test('what the builder keeps is laid over its environment in the world a flight is drawn from', () => {
    const editor = createEditorState('highlands');
    keepBuiltWorld(editor, 'lakeside', true, KEPT);

    assert.equal(editor.environmentId, 'lakeside');
    assert.equal(editor.runway, true);
    const placements = editorPlacements(editor);
    assert.deepEqual(placements.at(-1), KEPT[0], 'drawn after the world\'s own elements');
    assert.equal(placements.length, environmentElements(getEnvironment('lakeside'), true).length + 1);

    placements.at(-1).config.count = 99;
    assert.equal(editorPlacements(editor).at(-1).config.count, 1, 'handed out as a copy');
});

test('what was kept is handed to a canvas opened on its world, and to no other', () => {
    const editor = createEditorState('highlands');
    keepBuiltWorld(editor, 'lakeside', false, KEPT);

    assert.deepEqual(keptPlacements(editor, 'lakeside'), KEPT);
    assert.deepEqual(keptPlacements(editor, 'highlands'), []);
    assert.deepEqual(keptPlacements(createEditorState('highlands'), 'highlands'), [], 'nothing kept is nothing handed');
});

test('what was kept goes with its environment, and not with the strip', () => {
    const editor = createEditorState('highlands');
    keepBuiltWorld(editor, 'lakeside', false, KEPT);

    setEditorWorld(editor, 'lakeside', true);
    assert.deepEqual(keptPlacements(editor, 'lakeside'), KEPT, 'a strip turned on keeps the built mountain');

    setEditorWorld(editor, 'highlands', true);
    setEditorWorld(editor, 'lakeside', true);
    assert.deepEqual(keptPlacements(editor, 'lakeside'), [], 'another world drops it, being ground it was never built on');
});
