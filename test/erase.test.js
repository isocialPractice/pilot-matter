/**
 * Deselect from anywhere, Erase, and Erasing water and runways - the answer
 * every panel carries while something is selected and the popup a right click
 * on the selection opens, the erase batch cut out of what was laid before it
 * and the put-back batch cut out of that, and the two things kept beside the
 * heights that a cut has to mean more for: the sea's line and the strip.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createField, applyBase, applyElement, readColor, fieldX, fieldZ, waterSurface, clearRunwayGround,
    isElementId, ELEMENTS, DEFAULT_SIZE
} from '../js/environment/elements.js';
import { buildEnvironment, getEnvironment } from '../js/environment/presets.js';
import { applyFootprintedElement, cutSampler } from '../js/environment/footprinted.js';
import { footprintWeight, placeFootprint } from '../js/environment/footprints.js';
import {
    ERASE_TYPE, ERASE_ALL, ERASE_TARGETS, ERASE_RANGES, isErase, eraseConfig, erases, eraseRegion, resolveErasures,
    placementRanges
} from '../js/environment/erase.js';
import {
    buildTool, isEraseTool, isStrokeTool, isChoosableTool, toolBrush, toolElementRows, toolRanges, strokeStamp,
    paintStamp, PAINT_BRUSH, ERASE_ELEMENT_ROWS
} from '../js/build-tools.js';
import {
    createBuildState, openBuildMode, beginCanvas, chooseBuildTool, strokeValues, setStrokeValues, layStroke,
    acceptDraft, buildDraft, committedPlacements, setSelection, deselect, selectionLive, requestLeave, answerConfirm,
    openDeselectPopup, deselectPopup, closeDeselectPopup, samePlacement, startDraft, dropDraft, chooseRunwayTemplate,
    insertTemplate, CONFIRM_STAY, BUILD_FROM_TITLE
} from '../js/build-mode.js';
import {
    dockContent, draftHolderFor, panelRanges, strokeRanges, DOCK_ERASE, DOCK_DESELECT, DOCK_ACCEPT, DOCK_CANCEL, DOCK_LASSO, DOCK_TOOL
} from '../js/build-panel.js';
import { placementAt, placementReach } from '../js/build-select.js';
import { gumballKind, boundHandles, GUMBALL_FLAT } from '../js/gumball.js';
import { createBuildCamera } from '../js/build-camera.js';
import { placeTemplate } from '../js/templates.js';

const near = (a, b, within = 1e-4) => Math.abs(a - b) <= within;
const SIZE = DEFAULT_SIZE;
const SEGMENTS = 80;

/** A stroke across the canvas's middle, hard-edged so a vertex is either taken or not. */
const ACROSS = { kind: 'stroke', points: [[-3000, 0], [3000, 0]], stamp: { width: 2400, depth: 2400, corner: 1200 }, feather: 0 };

/** An erase batch over a region. */
const erase = (footprint, config = {}) => ({ type: ERASE_TYPE, config: { target: ERASE_ALL, strength: 1, ...config }, footprint });

const build = (elements, base = { maxHeight: 400, scale: 3 }) =>
    buildEnvironment({ id: 'test', seed: 7, base, elements: [] }, { size: SIZE, segments: SEGMENTS, elements });

/** The vertices a footprint reaches whole, and the ones it does not reach at all. */
function splitBy(field, footprint) {
    const inside = [], outside = [];
    for (let i = 0; i < field.count; i++) {
        const w = footprintWeight(footprint, fieldX(field, i), fieldZ(field, i), field.size);
        if (w >= 1) inside.push(i);
        else if (w <= 0) outside.push(i);
    }
    return { inside, outside };
}

const MOUNTAIN = { type: 'mountain', config: { count: 6, height: [300, 400], radius: [1500, 2500] } };

function onCanvas(tool = 'erase', environment = 'highlands') {
    const state = createBuildState();
    openBuildMode(state, BUILD_FROM_TITLE);
    beginCanvas(state, environment);
    if (tool) chooseBuildTool(state, tool);
    return state;
}

const LINE = [[-3000, 0], [3000, 0]];

// --- The erase batch -------------------------------------------------------------------------

test('what a batch can take is ALL and then every element the registry holds, read off it', () => {
    assert.deepEqual([...ERASE_TARGETS], [ERASE_ALL, ...ELEMENTS.map(element => element.id)]);
    assert.ok(ERASE_TARGETS.includes('paint') && ERASE_TARGETS.includes('runway'));
    assert.deepEqual(ERASE_RANGES.target.values, ERASE_TARGETS);
    assert.equal(ERASE_RANGES.target.default, ERASE_ALL);
    assert.deepEqual(ERASE_RANGES.strength, { kind: 'scalar', low: 0, high: 1, default: 1, percent: true });
    assert.equal(isElementId(ERASE_TYPE), false, 'erase is not an element');
    assert.equal(placementRanges(ERASE_TYPE), ERASE_RANGES);
    assert.equal(placementRanges('grass').color.kind, 'gradient');
    assert.equal(placementRanges('volcano'), null);
});

test('a batch is filled in: ALL for a target it cannot take, its strength held, and put back only when asked', () => {
    assert.deepEqual(eraseConfig({ type: ERASE_TYPE }), { target: 'all', strength: 1, restore: false });
    assert.deepEqual(eraseConfig({ config: { target: 'volcano', strength: 3, restore: 'yes' } }), { target: 'all', strength: 1, restore: false });
    assert.deepEqual(eraseConfig({ config: { target: 'water', strength: -1, restore: true } }), { target: 'water', strength: 0, restore: true });
    assert.equal(isErase({ type: 'erase' }), true);
    assert.equal(isErase({ type: 'grass' }), false);
});

test('ALL takes every element but the strip, a target only its own, and a strip only a placed one, by name', () => {
    const all = erase(ACROSS), grass = erase(ACROSS, { target: 'grass' }), strip = erase(ACROSS, { target: 'runway' });
    assert.equal(erases(all, { type: 'mountain' }), true);
    assert.equal(erases(all, { type: 'paint' }), true);
    assert.equal(erases(all, { type: 'runway', config: { at: [0, 0] } }), false, 'ALL leaves the strip');
    assert.equal(erases(grass, { type: 'grass' }), true);
    assert.equal(erases(grass, { type: 'sand' }), false);
    assert.equal(erases(strip, { type: 'runway', config: { at: [0, 0] } }), true);
    assert.equal(erases(strip, { type: 'runway', config: {} }), false, 'never the strip a site search finds');
    assert.equal(erases(strip, { type: 'grass' }), false);
    assert.equal(erases(all, { type: ERASE_TYPE }), false, 'nor another batch');
});

test('a batch\'s region is its footprint inside the selection it was drawn within', () => {
    const clip = { kind: 'rect', x: 0, z: 0, width: 2000, depth: 6000, feather: 0 };
    const region = eraseRegion({ ...erase(ACROSS), clip });
    assert.equal(footprintWeight(region, 0, 0), 1);
    assert.equal(footprintWeight(region, 2500, 0), 0, 'on the stroke, outside the selection');
    assert.equal(eraseRegion(erase(ACROSS)), ACROSS);
    assert.equal(eraseRegion({ type: ERASE_TYPE }), null);
});

test('resolving cuts what came before each batch, drops the batches, and leaves the list as it was', () => {
    const grassBefore = { type: 'grass', config: {} };
    const grassAfter  = { type: 'grass', config: { band: [0, 10] } };
    const batch = erase(ACROSS, { strength: 0.6 });
    const back  = erase(ACROSS, { restore: true, strength: 0.5 });
    const list  = [grassBefore, batch, grassAfter, back, erase(ACROSS, { strength: 0 })];
    const copy  = structuredClone(list);

    const resolved = resolveErasures(list);
    assert.deepEqual(list, copy, 'the caller\'s list untouched');
    assert.equal(resolved.length, 2, 'the batches taken out');
    assert.deepEqual(resolved[0].cut, [{ footprint: ACROSS, strength: 0.6, kept: [{ footprint: ACROSS, strength: 0.5 }] }]);
    assert.equal(resolved[1], grassAfter, 'grass laid after the batch is not cut, and is the same object');
    assert.deepEqual(resolveErasures(), []);
    assert.deepEqual(resolveErasures('nothing'), []);
});

test('what is left of a placement is the product of its cuts, each less what was put back', () => {
    const half = { kind: 'rect', x: 0, z: 0, width: 100, depth: 100, feather: 0 };
    assert.equal(cutSampler([]), null);
    assert.equal(cutSampler(undefined), null);
    assert.equal(cutSampler([{ footprint: half, strength: 1, kept: [] }])(0, 0), 0);
    assert.equal(cutSampler([{ footprint: half, strength: 1, kept: [] }])(500, 0), 1);
    assert.ok(near(cutSampler([{ footprint: half, strength: 0.5, kept: [] }])(0, 0), 0.5));
    assert.ok(near(cutSampler([{ footprint: half, strength: 0.5, kept: [] }, { footprint: half, strength: 0.5, kept: [] }])(0, 0), 0.25),
        'a second pass thins it again');
    assert.ok(near(cutSampler([{ footprint: half, strength: 1, kept: [{ footprint: half, strength: 0.25 }] }])(0, 0), 0.25),
        'a quarter put back');
    assert.ok(near(cutSampler([{ footprint: half, strength: 2, kept: [] }])(0, 0), 0), 'strength held to whole');
});

test('an erase batch survives a copy and being written down, like any placement', () => {
    const batch = { ...erase(placeFootprint(ACROSS), { target: 'grass', strength: 0.4, restore: true }), clip: ACROSS };
    assert.deepEqual(structuredClone(batch), batch);
    assert.deepEqual(JSON.parse(JSON.stringify(batch)), batch);
});

// --- Subtraction --------------------------------------------------------------------------------

test('a stroke over a preset\'s mountain leaves the ground the mountain was raised from', () => {
    const bare   = build([]);
    const raised = build([MOUNTAIN]);
    const erased = build([MOUNTAIN, erase(ACROSS)]);
    const { inside, outside } = splitBy(erased, ACROSS);

    assert.ok(inside.some(i => raised.height[i] - bare.height[i] > 50), 'there was a mountain under the stroke');
    for (const i of inside) assert.ok(near(erased.height[i], bare.height[i]), `vertex ${i}: ${erased.height[i]} against ${bare.height[i]}`);
    for (const i of outside) assert.ok(near(erased.height[i], raised.height[i]), `vertex ${i} off the stroke kept its mountain`);
});

test('over grass, the colour from before the grass; targeting grass, sand under the same stroke stands', () => {
    // Grass on the low half of the ground under the stroke and sand on the high.
    const bare = build([]);
    const { inside } = splitBy(bare, ACROSS);
    const heights = inside.map(i => bare.height[i]).sort((a, b) => a - b);
    const middle = heights[Math.floor(heights.length / 2)];
    const covers = [{ type: 'grass', config: { band: [0, middle] } }, { type: 'sand', config: { band: [middle, 2000] } }];
    const laid = build(covers);
    const grassOnly = build([...covers, erase(ACROSS, { target: 'grass' })]);

    let grass = 0, sand = 0;
    for (const i of inside) {
        const h = laid.height[i];
        if (h < middle - 2) {
            grass++;
            assert.ok(readColor(grassOnly, i).every((c, k) => near(c, readColor(bare, i)[k])), `vertex ${i} keeps the ground's own colour`);
        } else if (h > middle + 2) {
            sand++;
            assert.ok(readColor(grassOnly, i).every((c, k) => near(c, readColor(laid, i)[k])), `vertex ${i} keeps its sand`);
        }
    }
    assert.ok(grass > 5 && sand > 5, `${grass} grass and ${sand} sand vertices under the stroke`);
});

test('a strength of a half takes half, and a put-back batch over it puts it back', () => {
    const bare   = build([]);
    const raised = build([MOUNTAIN]);
    const half   = build([MOUNTAIN, erase(ACROSS, { strength: 0.5 })]);
    const back   = build([MOUNTAIN, erase(ACROSS), erase(ACROSS, { restore: true })]);
    const partly = build([MOUNTAIN, erase(ACROSS), erase(ACROSS, { restore: true, strength: 0.25 })]);
    const { inside } = splitBy(raised, ACROSS);

    for (const i of inside) {
        const lift = raised.height[i] - bare.height[i];
        assert.ok(near(half.height[i], bare.height[i] + lift * 0.5), `vertex ${i} at half`);
        assert.ok(near(back.height[i], raised.height[i]), `vertex ${i} put back whole`);
        assert.ok(near(partly.height[i], bare.height[i] + lift * 0.25), `vertex ${i} a quarter put back`);
    }
});

test('a batch cuts only what was laid before it, and a put-back batch only what it names', () => {
    const grass = { type: 'grass', config: { band: [0, 400] } };
    const before = build([erase(ACROSS), grass]);
    const laid   = build([grass]);
    assert.deepEqual([...before.color], [...laid.color], 'grass laid after the stroke stands');

    const bare = build([]);
    const early = build([grass, erase(ACROSS, { restore: true }), erase(ACROSS)]);
    const wrongBack = build([grass, erase(ACROSS), erase(ACROSS, { restore: true, target: 'sand' })]);
    const { inside } = splitBy(bare, ACROSS);
    for (const i of inside) {
        assert.ok(readColor(wrongBack, i).every((c, k) => near(c, readColor(bare, i)[k])), 'putting back sand puts back no grass');
        assert.ok(readColor(early, i).every((c, k) => near(c, readColor(bare, i)[k])), 'a put-back batch hands back nothing taken after it');
    }
});

test('erasing part of a stroke of grass leaves the rest graded to the ground the whole stroke covered', () => {
    const stroke = { kind: 'stroke', points: [[-6000, 0], [6000, 0]], stamp: { width: 1600, depth: 1600, corner: 800 }, feather: 0 };
    const grass = { type: 'grass', config: {}, footprint: placeFootprint(stroke) };
    const corner = { kind: 'disc', x: 4500, z: 0, radius: 1500, feather: 0 };
    const whole = build([grass]);
    const cut   = build([grass, erase(corner, { target: 'grass' })]);
    const bare  = build([]);
    let kept = 0, taken = 0;
    for (let i = 0; i < whole.count; i++) {
        const x = fieldX(whole, i), z = fieldZ(whole, i);
        if (footprintWeight(stroke, x, z) < 1) continue;
        if (footprintWeight(corner, x, z) <= 0) {
            kept++;
            assert.ok(readColor(cut, i).every((c, k) => near(c, readColor(whole, i)[k])), `vertex ${i} kept its colour`);
        } else if (footprintWeight(corner, x, z) >= 1) {
            taken++;
            assert.ok(readColor(cut, i).every((c, k) => near(c, readColor(bare, i)[k])), `vertex ${i} is bare`);
        }
    }
    assert.ok(kept > 50 && taken > 5, `${kept} kept, ${taken} taken`);
});

test('a placement nothing erases keeps the way it was always drawn', () => {
    const preset = getEnvironment('highlands');
    const options = { size: SIZE, segments: SEGMENTS };
    const plain = buildEnvironment(preset, options);
    const missed = buildEnvironment(preset, { ...options, elements: [...preset.elements, erase(ACROSS, { target: 'forest' })] });
    assert.deepEqual([...missed.height], [...plain.height]);
    assert.deepEqual([...missed.color], [...plain.color]);
});

// --- Erasing water and runways -----------------------------------------------------------------

/** A field sunk under the sea's level at its middle: a basin either side of the stroke. */
const SEA = { type: 'water', config: { level: 200 } };

test('the sea erased is dry ground in its hole, though the ground there is under the sea\'s level', () => {
    const sea = build([SEA]);
    const holed = build([SEA, erase(ACROSS, { target: 'water' })]);
    const bare = build([]);
    const { inside, outside } = splitBy(holed, ACROSS);
    const under = inside.filter(i => bare.height[i] < 200);
    assert.ok(under.length > 10, `${under.length} vertices of the hole lie under the level`);

    const wetBefore = new Set(waterSurface(sea).vertices);
    const wetAfter  = new Set(waterSurface(holed).vertices);
    for (const i of under) {
        assert.ok(wetBefore.has(i), `vertex ${i} was sea`);
        assert.equal(wetAfter.has(i), false, `vertex ${i} is dry`);
        assert.ok(Number.isNaN(holed.water.line[i]), `vertex ${i} has no line`);
        assert.ok(near(holed.height[i], bare.height[i]), `vertex ${i} is the basin's own ground`);
    }
    for (const i of outside) assert.equal(wetAfter.has(i), wetBefore.has(i), `vertex ${i} off the stroke is as it was`);
    assert.equal(holed.water.level, 200, 'the sea\'s level is still the sea\'s');
});

test('drawn water erased is dry and uncut where it was taken, and a strip is not lifted over a dry hole', () => {
    const drawn = { type: 'water', config: {}, footprint: placeFootprint({ ...ACROSS, feather: 160 }) };
    const left = build([drawn]);
    const taken = build([drawn, erase({ kind: 'disc', x: 0, z: 0, radius: 900, feather: 0 }, { target: 'water' })]);
    const bare = build([]);
    let checked = 0;
    for (let i = 0; i < taken.count; i++) {
        if (Math.hypot(fieldX(taken, i), fieldZ(taken, i)) > 800) continue;
        checked++;
        assert.ok(Number.isNaN(taken.water.line[i]), 'no line');
        assert.ok(near(taken.height[i], bare.height[i]), 'the ground not cut');
    }
    assert.ok(checked > 5 && Number.isFinite(left.water.line[Math.floor(left.count / 2)]));

    // The sea under a strip lifts it; a hole erased in the sea under it does not.
    const sea = build([SEA]);
    const holed = build([SEA, erase({ kind: 'rect', x: 0, z: 0, width: 4000, depth: 4000, feather: 0 }, { target: 'water' })]);
    const strip = { x: 0, z: 0, heading: 0, length: 1200, width: 200 };
    assert.equal(clearRunwayGround(sea, 50, strip).elevation, 200 + 2, 'lifted clear of the sea');
    assert.deepEqual(clearRunwayGround(holed, 50, strip), { elevation: 50, cleared: [] }, 'a dry hole is no water');
    assert.equal(clearRunwayGround(holed, 50).elevation, 202, 'and asked without a strip, the sea\'s level answers');
});

const STRIP = { type: 'runway', config: { at: [0, 0], heading: [0, 0], length: [2400, 2400], width: [240, 240] } };

test('ALL leaves a strip standing; RUNWAY takes it whole - its record, its grading and all - when it reaches any of it', () => {
    const flat = { maxHeight: 50, scale: 0.5 };
    const bare = build([], flat);
    const kept = build([STRIP], flat);
    const all  = build([STRIP, erase(ACROSS)], flat);
    assert.equal(kept.runways.length, 1);
    assert.equal(all.runways.length, 1, 'ALL leaves it');
    assert.deepEqual([...all.height], [...kept.height]);

    // A small stroke over the far end alone takes the whole strip.
    const end = { kind: 'disc', x: 0, z: 1150, radius: 120, feather: 0 };
    const gone = build([STRIP, erase(end, { target: 'runway' })], flat);
    assert.equal(gone.runways.length, 0, 'no record');
    assert.deepEqual([...gone.height], [...bare.height], 'no grading');
    assert.deepEqual([...gone.color], [...bare.color]);

    // A stroke that misses the strip, on the apron graded beside it, leaves
    // all of it: the apron is the strip's, and is not thinned.
    const beside = { kind: 'disc', x: 300, z: 0, radius: 140, feather: 0 };
    const missed = build([STRIP, erase(beside, { target: 'runway' })], flat);
    assert.equal(missed.runways.length, 1);
    let apron = 0;
    for (let i = 0; i < kept.count; i++) {
        if (footprintWeight(beside, fieldX(kept, i), fieldZ(kept, i)) > 0
            && readColor(kept, i).some((c, k) => !near(c, readColor(bare, i)[k]))) apron++;
    }
    assert.ok(apron > 0, `the stroke lies on ground the strip graded: ${apron} vertices`);
    assert.deepEqual([...missed.height], [...kept.height], 'nothing of it thinned');
    assert.deepEqual([...missed.color], [...kept.color]);

    // Put back, it is laid again.
    const back = build([STRIP, erase(end, { target: 'runway' }), erase(end, { target: 'runway', restore: true })], flat);
    assert.equal(back.runways.length, 1);
});

test('a placed runway template is reached into member by member, and its strip taken by name', () => {
    const group = placeTemplate('basic-runway', [0, 0], 0);
    const flat = { maxHeight: 50, scale: 0.5 };
    assert.equal(build([group], flat).runways.length, 1);
    assert.equal(build([group, erase(ACROSS)], flat).runways.length, 1);
    assert.equal(build([group, erase(ACROSS, { target: 'runway' })], flat).runways.length, 0);
});

test('a strip the site search finds is never erased: it is not on the canvas the stroke was drawn over', () => {
    const searched = { type: 'runway', config: {} };
    const field = build([searched, erase({ kind: 'rect', x: 0, z: 0, width: SIZE * 2, depth: SIZE * 2, feather: 0 }, { target: 'runway' })]);
    assert.equal(field.runways.length, 1);
});

test('a placement drawn through a cut alone still takes the stream it always took', () => {
    const field = createField({ size: SIZE, segments: 40 });
    applyBase(field, { maxHeight: 300 });
    const other = createField({ size: SIZE, segments: 40 });
    applyBase(other, { maxHeight: 300 });
    let draws = 0;
    const random = () => { draws++; return 0.5; };
    let plain = 0;
    const counted = () => { plain++; return 0.5; };
    applyFootprintedElement(field, { ...MOUNTAIN, cut: [{ footprint: ACROSS, strength: 1, kept: [] }] }, random);
    applyElement(other, MOUNTAIN, counted);
    assert.equal(draws, plain);
});

// --- Erase, the tool -----------------------------------------------------------------------------

test('Erase is built: a stroke tool laying an erase batch with the paint brush, its rows what it takes and how much', () => {
    const tool = buildTool('erase');
    assert.equal(tool.element, ERASE_TYPE);
    assert.equal(tool.heading, 'ERASE');
    assert.equal(tool.mindsLasso, true);
    assert.equal(isEraseTool('erase'), true);
    assert.equal(isStrokeTool('erase'), true);
    assert.equal(isChoosableTool('erase'), true);
    assert.equal(toolBrush(tool), PAINT_BRUSH);
    assert.deepEqual(toolElementRows(tool), ERASE_ELEMENT_ROWS);
    assert.deepEqual([...ERASE_ELEMENT_ROWS], ['target', 'strength']);
    assert.equal(toolRanges(tool), ERASE_RANGES);
    assert.equal(toolRanges(buildTool('select')), null);
    assert.deepEqual(strokeStamp(tool, { size: 20, edge: 'soft' }, 10), paintStamp({ size: 20, edge: 'soft' }, 10));
    for (const id of ['select', 'paint', 'grass']) assert.equal(isEraseTool(id), false, id);
});

test('Erase\'s panel starts at ALL, whole, and the hard round 25 pixel brush', () => {
    const state = onCanvas();
    assert.deepEqual(strokeValues(state), { target: 'all', strength: 1, tip: 'round', edge: 'hard', size: 25 });
    const content = dockContent(state, {});
    assert.equal(content.kind, DOCK_ERASE);
    assert.equal(content.heading, 'ERASE');
    assert.deepEqual(content.rows.map(entry => [entry.row.label, entry.valueLabel]),
        [['TARGET', 'ALL'], ['STRENGTH', '100%'], ['TIP', 'ROUND'], ['EDGE', 'HARD'], ['SIZE', '25']]);
    assert.deepEqual(Object.keys(strokeRanges('erase')), ['target', 'strength', 'tip', 'edge', 'size']);
    assert.deepEqual(content.actions, []);
});

test('the first erase stroke begins a batch that takes, or with alt one that puts back', () => {
    const state = onCanvas();
    setStrokeValues(state, { target: 'grass', strength: 0.5 });
    assert.equal(layStroke(state, LINE, paintStamp({}, 20), { size: SIZE }), true);
    const batch = buildDraft(state);
    assert.equal(batch.type, ERASE_TYPE);
    assert.deepEqual(batch.config, { target: 'grass', strength: 0.5 });
    assert.deepEqual(dockContent(state, {}).actions, [DOCK_ACCEPT, DOCK_CANCEL]);

    const back = onCanvas();
    layStroke(back, LINE, paintStamp({}, 20), { size: SIZE, alt: true });
    assert.deepEqual(buildDraft(back).config, { target: 'all', strength: 1, restore: true });
});

test('a stroke the batch\'s own way joins it, and one the other way is cut out of it', () => {
    const state = onCanvas();
    const stamp = { width: 800, depth: 800, corner: 400 };
    layStroke(state, LINE, stamp, { size: SIZE });
    layStroke(state, [[0, 2000], [0, 2500]], stamp, { size: SIZE });
    assert.equal(buildDraft(state).footprint.of.op, 'union');
    assert.equal(layStroke(state, [[0, -500], [0, 500]], stamp, { size: SIZE, alt: true }), true);
    const footprint = buildDraft(state).footprint;
    assert.equal(footprint.of.op, 'subtract', 'an overshoot taken back');
    assert.equal(footprintWeight(footprint, 0, 0), 0, 'where the alt stroke went, nothing is erased');
    assert.ok(footprintWeight(footprint, -2000, 0) > 0, 'and the rest of the stroke still is');

    const back = onCanvas();
    layStroke(back, LINE, stamp, { size: SIZE, alt: true });
    layStroke(back, [[0, -500], [0, 500]], stamp, { size: SIZE, alt: true });
    assert.equal(buildDraft(back).footprint.of.op, 'union', 'a put-back batch grows with alt');
    layStroke(back, [[0, -500], [0, 500]], stamp, { size: SIZE });
    assert.equal(buildDraft(back).footprint.of.op, 'subtract', 'and is cut by a stroke without it');

    const grass = onCanvas('grass');
    layStroke(grass, LINE, { width: 400, depth: 400, corner: 0 }, { size: SIZE });
    layStroke(grass, LINE, { width: 400, depth: 400, corner: 0 }, { size: SIZE, alt: true });
    assert.equal(buildDraft(grass).footprint.of.op, 'union', 'alt means nothing to a cover stroke');
});

test('a committed erase batch is picked by its strokes, held on the Flat gumball, and edited by its own rows', () => {
    const batch = { ...erase(placeFootprint(ACROSS), { target: 'grass', strength: 0.5 }) };
    assert.equal(placementAt([batch], 0, 0, SIZE), 0);
    assert.equal(placementAt([batch], 0, 5000, SIZE), null);
    assert.ok(placementReach(batch, SIZE)(0, 0) > 0);
    assert.equal(gumballKind(ERASE_TYPE), GUMBALL_FLAT);
    assert.ok(boundHandles(batch).some(handle => handle.id === 'move-uniform'), 'its centre moves it');

    const holder = draftHolderFor(batch);
    assert.deepEqual(holder, { config: { target: 'grass', strength: 0.5 }, shades: {}, base: {} });
    assert.deepEqual(Object.keys(panelRanges(batch)), ['target', 'strength']);

    assert.equal(samePlacement(batch, { ...batch, config: { target: 'grass', strength: 0.5, restore: false } }), true);
    assert.equal(samePlacement(batch, { ...batch, config: { target: 'grass', strength: 0.4 } }), false);
});

test('the canvas is drawn with what an erase batch in hand takes', () => {
    const state = onCanvas('mountain', 'blank-canvas');
    dropDraft(state, { x: 0, y: 0, z: 0 });
    acceptDraft(state);
    chooseBuildTool(state, 'erase');
    layStroke(state, [[-2000, 0], [2000, 0]], { width: 3000, depth: 3000, corner: 1500 }, { size: SIZE });
    const placements = committedPlacements(state);
    const raised = buildEnvironment(getEnvironment('blank-canvas'), { size: SIZE, segments: SEGMENTS, elements: placements });
    const taken = buildEnvironment(getEnvironment('blank-canvas'), { size: SIZE, segments: SEGMENTS, elements: [...placements, buildDraft(state)] });
    const bare = buildEnvironment(getEnvironment('blank-canvas'), { size: SIZE, segments: SEGMENTS, elements: [] });
    const middle = (SEGMENTS / 2) * (SEGMENTS + 1) + SEGMENTS / 2;
    assert.ok(raised.height[middle] - bare.height[middle] > 50, 'a mountain at the middle');
    assert.ok(near(taken.height[middle], bare.height[middle]), 'and the stroke in hand takes it');
});

// --- Deselect from anywhere ------------------------------------------------------------------------

const SELECTION = { kind: 'rect', x: 0, z: 0, width: 4000, depth: 4000, feather: 0 };

test('every panel carries DESELECT while something is selected, and none does without', () => {
    for (const tool of ['select', 'mountain', 'grass', 'paint', 'erase', 'runway']) {
        const state = onCanvas(tool);
        const camera = createBuildCamera(SIZE);
        assert.equal((dockContent(state, { camera })?.actions ?? []).some(action => action.id === DOCK_DESELECT.id), false, `${tool} without`);
        setSelection(state, SELECTION);
        const actions = dockContent(state, { camera }).actions;
        assert.equal(actions.at(-1), DOCK_DESELECT, `${tool} with`);
    }

    // Mountain has no panel before a click drops one: with a selection live it
    // is its heading over the one answer.
    const before = onCanvas('mountain');
    assert.equal(dockContent(before, {}), null);
    setSelection(before, SELECTION);
    assert.deepEqual(dockContent(before, {}), {
        kind: DOCK_TOOL, heading: 'BUILD MOUNTAINS', ranges: {}, holder: { config: {} },
        rows: [], nudges: [], actions: [DOCK_DESELECT], sections: []
    });

    const state = onCanvas('mountain');
    setSelection(state, SELECTION);
    dropDraft(state, { x: 0, y: 0, z: 0 }, { size: SIZE });
    assert.deepEqual(dockContent(state, {}).actions, [DOCK_ACCEPT, DOCK_CANCEL, DOCK_DESELECT], 'after the edit\'s own answers');

    const lasso = onCanvas('lasso');
    setSelection(lasso, SELECTION);
    const content = dockContent(lasso, {});
    assert.equal(content.kind, DOCK_LASSO);
    assert.deepEqual(content.actions, [DOCK_DESELECT], 'the lasso keeps its own, once');

    deselect(lasso);
    assert.deepEqual(dockContent(lasso, {}).actions, []);
});

test('a right click on the selection opens the popup there, and nowhere else does', () => {
    const state = onCanvas('paint');
    assert.equal(openDeselectPopup(state, { x: 300, y: 200 }), false, 'nothing selected, nothing to offer');
    setSelection(state, SELECTION);
    assert.equal(openDeselectPopup(state, { x: 300, y: 200 }, false), false, 'off the selection');
    assert.equal(openDeselectPopup(state, { x: NaN, y: 200 }), false);
    assert.equal(openDeselectPopup(state, { x: 300, y: 200 }), true);
    const at = deselectPopup(state);
    assert.deepEqual(at, { x: 300, y: 200 });
    at.x = 0;
    assert.deepEqual(deselectPopup(state), { x: 300, y: 200 }, 'a copy');

    assert.equal(deselect(state), true, 'DESELECT on it is the panel\'s answer');
    assert.equal(selectionLive(state), false);
    assert.equal(deselectPopup(state), null, 'and shuts it');
    setSelection(state, SELECTION);
    assert.equal(deselectPopup(state), null, 'for good: a new selection does not bring it back');
});

test('the popup is shut by a press off it, Escape, a tool change, a question and a new canvas', () => {
    const state = onCanvas('grass');
    setSelection(state, SELECTION);
    openDeselectPopup(state, { x: 1, y: 1 });
    assert.equal(closeDeselectPopup(state), true);
    assert.equal(closeDeselectPopup(state), false, 'shut is shut');
    assert.equal(selectionLive(state), true, 'shutting it drops nothing');

    openDeselectPopup(state, { x: 1, y: 1 });
    chooseBuildTool(state, 'sand');
    assert.equal(deselectPopup(state), null, 'a tool change');

    openDeselectPopup(state, { x: 1, y: 1 });
    requestLeave(state);
    assert.equal(deselectPopup(state), null, 'a question');
    assert.equal(openDeselectPopup(state, { x: 1, y: 1 }), false, 'and none opens under one');
    answerConfirm(state, CONFIRM_STAY);
    assert.equal(deselectPopup(state), null, 'nor comes back after it');

    // A tool change with an edit in hand asks first; the popup does not come
    // back once the question is answered.
    layStroke(state, LINE, { width: 400, depth: 400, corner: 0 }, { size: SIZE });
    openDeselectPopup(state, { x: 1, y: 1 });
    chooseBuildTool(state, 'grass');
    assert.equal(deselectPopup(state), null, 'held under the question');
    answerConfirm(state, CONFIRM_STAY);
    assert.equal(deselectPopup(state), null, 'and shut once it is answered');

    openDeselectPopup(state, { x: 1, y: 1 });
    state.screen = 'picker';
    beginCanvas(state, 'lakeside');
    assert.equal(state.popup, null, 'a new canvas');
});
