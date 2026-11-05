/**
 * Shape vocabulary, Extrude stages, Extrude, Sum of shapes and Extrude a
 * selection - the shapes built once and offered by the lasso and Extrude
 * alike, the element that levels a region and raises it, the stages Extrude's
 * draft goes through with the one button they share, several shapes lifted as
 * one region, and the selection lifted as it stands - with the airports laid
 * out from strips, aprons and extrusions now that every element they are is
 * drawn.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createField, applyElement, applyBase, getElement, isElementId, readColor, fieldX, fieldZ, ELEMENT_ORDER, DEFAULT_SIZE
} from '../js/environment/elements.js';
import { applyFootprintedElement, FOOTPRINT_SETTLERS } from '../js/environment/footprinted.js';
import { footprintWeight, placeFootprint, addToPlaced, isFootprint } from '../js/environment/footprints.js';
import { buildEnvironment, getEnvironment } from '../js/environment/presets.js';
import { SHAPES, shape, shapeFootprint, reshapeShape, modeTools, SHAPE_DRAG, SHAPE_CLICKS } from '../js/shapes.js';
import { LASSO_TOOLS, lassoTool, lassoFootprint } from '../js/lasso.js';
import {
    EXTRUDE_TOOLS, EXTRUDE_HEADING, EXTRUDE_ROWS, EXTRUDE_ART, extrudeTool, extrudeRows, extrudeToolArt, extrudeToolName,
    EXTRUDE_DRAWING, EXTRUDE_EXTRUDING, EXTRUDE_SURFACES, EXTRUDE_STAGES, EXTRUDE_STAGE_ROWS, EXTRUDE_STAGE_ACTION,
    extrudeStageAction, DEFAULT_EXTRUDE_TOOL
} from '../js/extrude.js';
import { buildTool, isExtrudeTool, isChoosableTool, toolRanges, BUILDER_ART } from '../js/build-tools.js';
import {
    createBuildState, openBuildMode, beginCanvas, chooseBuildTool, setSelection, buildDraft, builtPlacements,
    committedPlacements, acceptDraft, cancelDraft, draftPending, buildExtrudeTool, chooseExtrudeTool, extrudeValues,
    setExtrudeValues, extrudeStage, extrudeDrawing, extrudeRegion, extrudeReady, drawExtrudeShape, pressExtrudeStage,
    requestLeave, BUILD_FROM_TITLE
} from '../js/build-mode.js';
import { dockContent, DOCK_EXTRUDE, DOCK_ACCEPT, DOCK_CANCEL, DOCK_DESELECT } from '../js/build-panel.js';
import { handleBinding, dragHandle, boundHandles, gumballKind, GUMBALL_FLAT, RAISE_PIXELS } from '../js/gumball.js';
import { placementAt } from '../js/build-select.js';
import {
    placeTemplate, expandGroup, groupLots, groupStrips, groupReach, runwayTemplate, keepStripOnCanvas
} from '../js/templates.js';

const near = (a, b, within = 1e-4) => Math.abs(a - b) <= within;
const SIZE = DEFAULT_SIZE;

function onCanvas(tool = 'extrude', environment = 'highlands') {
    const state = createBuildState();
    openBuildMode(state, BUILD_FROM_TITLE);
    beginCanvas(state, environment);
    if (tool) chooseBuildTool(state, tool);
    return state;
}

const BOX = { kind: 'rect', x: 0, z: 0, width: 2400, depth: 1600, angle: 0, corner: 0 };
const SELECTION = { kind: 'rect', x: 0, z: 0, width: 3000, depth: 3000, angle: 0, corner: 0, feather: 0 };

// --- Shape vocabulary ------------------------------------------------------------------------

test('the vocabulary is ten shapes, each a kind and a gesture, written once', () => {
    assert.deepEqual(SHAPES.map(each => [each.id, each.kind, each.gesture]), [
        ['free', 'ring', SHAPE_DRAG], ['rectangle', 'rect', SHAPE_DRAG], ['ellipse', 'ellipse', SHAPE_DRAG],
        ['round-rect', 'rect', SHAPE_DRAG], ['triangle', 'polygon', SHAPE_DRAG], ['star', 'polygon', SHAPE_DRAG],
        ['polygon', 'polygon', SHAPE_DRAG], ['polyline', 'ring', SHAPE_CLICKS],
        ['curved-polygon', 'path', SHAPE_CLICKS], ['curved-polyline', 'path', SHAPE_CLICKS]
    ]);
    assert.equal(shape('hexagon'), null);
    assert.ok(Object.isFrozen(SHAPES) && SHAPES.every(Object.isFrozen));
});

test('the lasso offers all ten and Extrude seven, each a shape of the one vocabulary under its own name', () => {
    assert.deepEqual(LASSO_TOOLS.map(tool => tool.shape), SHAPES.map(each => each.id));
    assert.deepEqual(EXTRUDE_TOOLS.map(tool => [tool.id, tool.shape, tool.label]), [
        ['rectangle', 'rectangle', 'RECTANGLE'], ['circle', 'ellipse', 'CIRCLE'], ['triangle', 'triangle', 'TRIANGLE'],
        ['polygon', 'polygon', 'POLYGON'], ['star', 'star', 'STAR'], ['polyline', 'polyline', 'POLYLINE'],
        ['polycurve', 'curved-polyline', 'POLYCURVE']
    ]);
    // The plan's table: every one of Extrude's seven over a kind the lasso already draws.
    assert.deepEqual(EXTRUDE_TOOLS.map(tool => tool.kind), ['rect', 'ellipse', 'polygon', 'polygon', 'polygon', 'ring', 'path']);
    for (const tool of EXTRUDE_TOOLS) {
        assert.equal(tool.gesture, shape(tool.shape).gesture, tool.id);
        assert.equal(tool.ranges, shape(tool.shape).ranges, `${tool.id} has its shape's own fields, not a copy`);
        assert.ok(LASSO_TOOLS.some(lasso => lasso.shape === tool.shape), `${tool.id} is a shape the lasso draws too`);
    }
    assert.deepEqual(modeTools([{ id: 'x', shape: 'hexagon' }, { id: 'rectangle', label: 'BOX' }]).map(tool => tool.id), ['rectangle'],
        'a tool naming no shape the vocabulary holds is left out');
});

test('a shape comes to the same region whichever mode draws it', () => {
    const drag = [{ x: 0, z: 0 }, { x: 900, z: 600 }];
    const clicks = [{ x: 0, z: 0 }, { x: 900, z: 0 }, { x: 900, z: 700 }, { x: 0, z: 700 }];
    assert.deepEqual(lassoFootprint('ellipse', drag), shapeFootprint('ellipse', drag));
    assert.deepEqual(shapeFootprint('ellipse', drag), { kind: 'ellipse', x: 450, z: 300, radiusX: 450, radiusZ: 300, angle: 0 });
    assert.deepEqual(lassoFootprint('star', drag, { numberOfPoints: 7 }), shapeFootprint('star', drag, { numberOfPoints: 7 }));
    assert.equal(shapeFootprint('star', drag, { numberOfPoints: 7 }).sides, 7);
    assert.equal(shapeFootprint('curved-polyline', clicks).closed, false, 'a polycurve runs open, as the lasso\'s curved polyline does');
    assert.equal(shapeFootprint('curved-polygon', clicks).closed, true);
    assert.equal(shapeFootprint('triangle', drag).sides, 3);
    assert.equal(shapeFootprint('hexagon', drag), null);
    assert.equal(lassoFootprint('circle', drag), null, 'the lasso offers no circle by that name');
    assert.deepEqual(reshapeShape(shapeFootprint('polygon', drag), 'polygon', { numberOfSides: 8 }).sides, 8);
    assert.equal(reshapeShape(shapeFootprint('polygon', drag), 'rectangle', {}), null, 'a region another shape drew is not reshaped');
});

test('Extrude\'s shapes are tiles in the artwork\'s rows, each its icon cut from the panel\'s art', () => {
    assert.equal(EXTRUDE_HEADING, 'EXTRUDE SHAPE');
    assert.equal(EXTRUDE_ART, `${BUILDER_ART}/extrude-tools.svg`);
    assert.deepEqual(extrudeRows().map(row => [row.row, row.tools.map(tool => tool.id)]), [
        ['row-shapes-1', ['rectangle', 'circle', 'triangle']],
        ['row-shapes-2', ['polygon', 'star']],
        ['row-curves', ['polyline', 'polycurve']]
    ]);
    assert.deepEqual([...EXTRUDE_ROWS], ['row-shapes-1', 'row-shapes-2', 'row-curves']);
    assert.equal(extrudeToolArt('circle'), `${EXTRUDE_ART}#svgView(viewBox(107.4,116.4,42.4,42.4))`);
    assert.equal(extrudeToolArt('hexagon'), null);
    assert.equal(extrudeToolName('polycurve'), 'Polycurve');
    for (const tool of EXTRUDE_TOOLS) {
        const [x, y, w, h] = tool.art;
        assert.ok(x >= 0 && y >= 0 && w > 20 && h > 20 && x + w <= 253.11 && y + h <= 452, `${tool.id}'s box is on the art`);
    }
    assert.equal(DEFAULT_EXTRUDE_TOOL, 'rectangle');
});

// --- Extrude, the element ----------------------------------------------------------------------

test('extrude is in the registry, applied with the built things and before snow, its level settled by its footprint', () => {
    assert.equal(isElementId('extrude'), true);
    const { ranges, footprintSettles } = getElement('extrude');
    assert.deepEqual(Object.keys(ranges), ['height', 'flatten', 'topColor', 'wallColor', 'blend', 'level']);
    assert.deepEqual(ranges.blend, { kind: 'choice', values: ['tint', 'normal'], default: 'tint' });
    assert.deepEqual(ranges.height, { kind: 'scalar', low: -400, high: 1200, default: 60 });
    assert.deepEqual(ranges.flatten, { kind: 'scalar', low: 0, high: 1, default: 1 });
    assert.equal(ranges.topColor.kind, 'color');
    assert.equal(ranges.wallColor.kind, 'color');
    assert.deepEqual(footprintSettles, { level: 'mean', drawn: 'edge' });
    assert.equal(ELEMENT_ORDER[ELEMENT_ORDER.indexOf('extrude') - 1], 'town');
    assert.equal(ELEMENT_ORDER[ELEMENT_ORDER.indexOf('extrude') + 1], 'snow');
});

test('drawn without a footprint, an extrusion levels the whole field to its level and raises it', () => {
    const field = createField({ size: SIZE, segments: 20 });
    applyBase(field, { maxHeight: 300 });
    applyElement(field, { type: 'extrude', config: { level: 100, height: 40 } });
    assert.ok([...field.height].every(h => near(h, 140)), 'flat at 140');
    const half = createField({ size: SIZE, segments: 20 });
    applyBase(half, { maxHeight: 300 });
    const before = [...half.height];
    applyElement(half, { type: 'extrude', config: { level: 100, height: 0, flatten: 0.5, blend: 'normal' } });
    assert.ok([...half.height].every((h, i) => near(h, before[i] + (100 - before[i]) * 0.5, 1e-3)), 'half way to it at a flatten of a half');
    assert.ok(readColor(half, 0).every((c, k) => near(c, getElement('extrude').ranges.topColor.default[k])), 'all top');
});

test('the mean a footprint settles counts each vertex for as much of it as the region does', () => {
    const field = createField({ size: 400, segments: 4 });
    field.height.set([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 210, 220, 230, 240, 250]);
    const weights = new Float32Array(field.count);
    weights[0] = 1; weights[1] = 1; weights[2] = 0.5;
    assert.ok(near(FOOTPRINT_SETTLERS.mean({ field, weights }), (10 + 20 + 30 * 0.5) / 2.5));
    assert.equal(FOOTPRINT_SETTLERS.mean({ field, weights: new Float32Array(field.count) }), null, 'a region that covers nothing settles nothing');
    const edge = FOOTPRINT_SETTLERS.edge({ field, weights });
    assert.deepEqual([...edge.edge.slice(0, 4)], [1, 1, 0.5, 0]);
    assert.notEqual(edge.edge, weights, 'a copy of the weights');
});

test('through a footprint, an extrusion is a block: flat on top at its ground\'s mean plus its height, walled at its edge, nothing outside', () => {
    const field = createField({ size: SIZE, segments: 100 });
    applyBase(field, { maxHeight: 400 });
    const before = { height: [...field.height], color: [...field.color] };
    const footprint = { ...BOX, feather: 240 };
    applyFootprintedElement(field, { type: 'extrude', config: { height: 120, blend: 'normal' }, footprint });

    let inside = [], band = 0, outside = 0, total = 0, weight = 0;
    for (let i = 0; i < field.count; i++) {
        const w = footprintWeight(footprint, fieldX(field, i), fieldZ(field, i));
        if (w > 0) { total += before.height[i] * w; weight += w; }
        if (w >= 1) inside.push(i);
        else if (w > 0) {
            band++;
            const expected = getElement('extrude').ranges.wallColor.default.map((c, k) => before.color[i * 3 + k] + (c - before.color[i * 3 + k]) * w);
            assert.ok(readColor(field, i).every((c, k) => near(c, expected[k], 1e-5)), `vertex ${i} is the wall, fading to the ground`);
        } else {
            outside++;
            assert.equal(field.height[i], before.height[i], `vertex ${i} outside moved`);
        }
    }
    const level = total / weight;
    assert.ok(inside.length > 50 && band > 10 && outside > 1000, `${inside.length} inside, ${band} in the band`);
    for (const i of inside) {
        assert.ok(near(field.height[i], level + 120, 1e-3), `vertex ${i}: ${field.height[i]} against ${level + 120}`);
        assert.ok(readColor(field, i).every((c, k) => near(c, getElement('extrude').ranges.topColor.default[k])), 'the top');
    }
});

test('an extrusion can be a pit, and erasing part of one leaves the rest at the level it had', () => {
    const pit = createField({ size: SIZE, segments: 60 });
    applyBase(pit, { maxHeight: 300 });
    const ground = [...pit.height];
    const box = { ...BOX, feather: 0 };
    let total = 0, count = 0;
    for (let i = 0; i < pit.count; i++) if (footprintWeight(box, fieldX(pit, i), fieldZ(pit, i)) >= 1) { total += ground[i]; count++; }
    applyFootprintedElement(pit, { type: 'extrude', config: { height: -150 }, footprint: box });
    const middle = (30 * 61) + 30;
    assert.ok(near(pit.height[middle], total / count - 150, 1e-3), `sunk to 150 under its ground's mean: ${pit.height[middle]}`);

    const env = { id: 'test', seed: 3, base: { maxHeight: 400, scale: 3 }, elements: [] };
    const block = { type: 'extrude', config: { height: 200 }, footprint: placeFootprint({ ...BOX, feather: 0 }) };
    const whole = buildEnvironment(env, { size: SIZE, segments: 80, elements: [block] });
    const corner = { kind: 'disc', x: 1000, z: 0, radius: 300, feather: 0 };
    const cut = buildEnvironment(env, { size: SIZE, segments: 80, elements: [block, { type: 'erase', config: {}, footprint: corner }] });
    let kept = 0;
    for (let i = 0; i < whole.count; i++) {
        const x = fieldX(whole, i), z = fieldZ(whole, i);
        if (footprintWeight(BOX, x, z) < 1 || footprintWeight(corner, x, z) > 0) continue;
        kept++;
        assert.ok(near(cut.height[i], whole.height[i], 1e-3), `vertex ${i} kept the level it had`);
    }
    assert.ok(kept > 40, `${kept} vertices of the block left`);
});

// --- Extrude stages ----------------------------------------------------------------------------

test('the one button reads its label and whether it can be pressed off the stage', () => {
    assert.deepEqual(extrudeStageAction(EXTRUDE_DRAWING, false), { id: EXTRUDE_STAGE_ACTION, label: 'EXTRUDE', disabled: true });
    assert.deepEqual(extrudeStageAction(EXTRUDE_DRAWING, true), { id: EXTRUDE_STAGE_ACTION, label: 'EXTRUDE', disabled: false });
    assert.deepEqual(extrudeStageAction(EXTRUDE_EXTRUDING, false), { id: EXTRUDE_STAGE_ACTION, label: 'EDIT EXTRUSION', disabled: false });
    assert.deepEqual(extrudeStageAction(EXTRUDE_SURFACES), { id: EXTRUDE_STAGE_ACTION, label: 'APPLY', disabled: false });
    assert.deepEqual(extrudeStageAction('lost', true), { id: EXTRUDE_STAGE_ACTION, label: 'EXTRUDE', disabled: false });
    assert.deepEqual(Object.fromEntries(Object.entries(EXTRUDE_STAGES).map(([stage, { next }]) => [stage, next])),
        { drawing: 'extruding', extruding: 'surfaces', surfaces: 'extruding' });
    assert.deepEqual(EXTRUDE_STAGE_ROWS, { drawing: [], extruding: ['height', 'flatten'], surfaces: ['topColor', 'wallColor', 'blend'] });
});

test('Extrude is built, places an extrusion, and starts at drawing with nothing to lift', () => {
    const tool = buildTool('extrude');
    assert.equal(tool.element, 'extrude');
    assert.equal(tool.heading, 'EXTRUDE SHAPE');
    assert.equal(isExtrudeTool('extrude'), true);
    assert.equal(isExtrudeTool('lasso'), false);
    assert.equal(isChoosableTool('extrude'), true);
    assert.equal(toolRanges(tool), getElement('extrude').ranges);

    const state = onCanvas();
    assert.equal(extrudeStage(state), EXTRUDE_DRAWING);
    assert.equal(extrudeDrawing(state), true);
    assert.equal(extrudeRegion(state), null);
    assert.equal(extrudeReady(state, { size: SIZE }), false);
    assert.equal(pressExtrudeStage(state, { size: SIZE }), null, 'EXTRUDE cannot be pressed with nothing drawn');
    assert.equal(extrudeStage(onCanvas('lasso')), null, 'and no other tool has a stage');
    assert.equal(buildExtrudeTool(state), 'rectangle');
});

test('shapes drawn before EXTRUDE are one region, shown over the canvas and not yet ground', () => {
    const state = onCanvas();
    assert.equal(drawExtrudeShape(state, BOX, 'union', { size: SIZE }), true);
    const draft = buildDraft(state);
    assert.equal(draft.type, 'extrude');
    assert.equal(draft.footprint.kind, 'placed');
    assert.equal(state.draft.stage, EXTRUDE_DRAWING);
    assert.equal('level' in draft.config, false, 'the level is the footprint\'s to settle');
    assert.deepEqual(builtPlacements(state), [], 'nothing is levelled or raised while it is being drawn');

    const second = { kind: 'ellipse', x: 2500, z: 0, radiusX: 600, radiusZ: 600, angle: 0 };
    drawExtrudeShape(state, second, 'union', { size: SIZE });
    const region = extrudeRegion(state);
    assert.equal(region.of.op, 'union', 'a sum of shapes');
    assert.equal(footprintWeight(region, 2500, 0), 1);
    assert.equal(footprintWeight(region, 0, 0), 1);
    drawExtrudeShape(state, { kind: 'disc', x: 0, z: 0, radius: 300, feather: 0 }, 'subtract', { size: SIZE });
    assert.equal(footprintWeight(extrudeRegion(state), 0, 0), 0, 'alt cuts a shape out of it');
    assert.equal(drawExtrudeShape(state, { ...BOX, x: 9000 }, 'intersect', { size: SIZE }), false, 'a shape that leaves no ground is refused');
    assert.equal(extrudeReady(state, { size: SIZE }), true);
});

test('EXTRUDE lifts the region, EDIT EXTRUSION opens the surfaces, and APPLY comes back from them', () => {
    const state = onCanvas();
    drawExtrudeShape(state, BOX, 'union', { size: SIZE });
    assert.equal(pressExtrudeStage(state, { size: SIZE }), EXTRUDE_EXTRUDING);
    assert.equal(extrudeDrawing(state), false, 'the pointer no longer draws');
    assert.deepEqual(builtPlacements(state).map(placement => placement.type), ['extrude'], 'and the region is ground now');
    assert.equal(pressExtrudeStage(state, { size: SIZE }), EXTRUDE_SURFACES);
    assert.equal(pressExtrudeStage(state, { size: SIZE }), EXTRUDE_EXTRUDING);
    assert.equal(drawExtrudeShape(state, BOX, 'union', { size: SIZE }), false, 'no shape is drawn into a region already lifted');

    requestLeave(state);
    assert.equal(pressExtrudeStage(state, { size: SIZE }), null, 'and nothing moves on under a question');
});

test('a selection is a shape Extrude can lift: EXTRUDE is ready on arrival, and shapes are drawn within it', () => {
    const state = onCanvas('lasso');
    setSelection(state, SELECTION);
    chooseBuildTool(state, 'extrude');
    assert.deepEqual(extrudeRegion(state), SELECTION);
    assert.equal(extrudeReady(state, { size: SIZE }), true, 'ready with nothing drawn');
    assert.equal(pressExtrudeStage(state, { size: SIZE }), EXTRUDE_EXTRUDING);
    const draft = buildDraft(state);
    assert.equal(footprintWeight(draft.footprint, 0, 0), 1);
    assert.equal('clip' in draft, false, 'it is the region lifted, not a clip on it');

    const within = onCanvas('lasso');
    setSelection(within, SELECTION);
    chooseBuildTool(within, 'extrude');
    drawExtrudeShape(within, { ...BOX, x: 1500 }, 'intersect', { size: SIZE });
    const region = extrudeRegion(within);
    assert.equal(footprintWeight(region, 1000, 0), 1, 'inside both');
    assert.equal(footprintWeight(region, 2200, 0), 0, 'the shape past the selection is not lifted');
    assert.equal(footprintWeight(region, -1400, 0), 0, 'nor the selection past the shape');
});

test('picking a shape with an extrusion lifted keeps it and goes back to drawing; while drawing the shapes stay', () => {
    const state = onCanvas();
    drawExtrudeShape(state, BOX, 'union', { size: SIZE });
    assert.equal(chooseExtrudeTool(state, 'star'), true);
    assert.equal(buildExtrudeTool(state), 'star');
    assert.equal(draftPending(state), true, 'a change of shape while drawing keeps what was drawn');
    assert.equal(committedPlacements(state).length, 0);

    pressExtrudeStage(state, { size: SIZE });
    assert.equal(chooseExtrudeTool(state, 'circle'), true);
    assert.equal(committedPlacements(state).length, 1, 'kept, with nothing asked');
    assert.equal(draftPending(state), false);
    assert.equal(extrudeStage(state), EXTRUDE_DRAWING);
    assert.equal(chooseExtrudeTool(state, 'hexagon'), false);
    assert.equal(chooseExtrudeTool(onCanvas('lasso'), 'circle'), false);
});

test('a shape\'s own fields are kept for the next it draws', () => {
    const state = onCanvas();
    assert.deepEqual(extrudeValues(state), {}, 'a rectangle has none');
    chooseExtrudeTool(state, 'star');
    assert.deepEqual(extrudeValues(state), { numberOfPoints: 5, starRatio: 0.45 });
    assert.deepEqual(setExtrudeValues(state, { numberOfPoints: 8, starRatio: 'x', other: 3 }), { numberOfPoints: 8, starRatio: 0.45 });
    chooseExtrudeTool(state, 'polygon');
    assert.deepEqual(extrudeValues(state), { numberOfSides: 6 });
    chooseExtrudeTool(state, 'star');
    assert.equal(extrudeValues(state).numberOfPoints, 8);
});

test('the gumball\'s blue arrow pulls an extrusion up and down whole, held to its bounds', () => {
    const placement = { type: 'extrude', config: { height: 60 }, footprint: placeFootprint(BOX) };
    assert.equal(gumballKind('extrude'), GUMBALL_FLAT);
    assert.deepEqual(handleBinding('move', placement), { from: 'config', name: 'height', mode: 'lift' });
    assert.ok(boundHandles(placement).some(handle => handle.id === 'move'));
    const range = getElement('extrude').ranges.height;
    assert.deepEqual(dragHandle(placement, 'move', { along: 100 }), { config: { height: 60 + 100 * (range.high - range.low) / RAISE_PIXELS }, footprint: null });
    assert.equal(dragHandle(placement, 'move', { along: 100000 }).config.height, 1200);
    assert.equal(dragHandle(placement, 'move', { along: -100000 }).config.height, -400);
    assert.equal(dragHandle({ ...placement, config: {} }, 'move', { along: 0 }).config.height, 60, 'from the default when none is held');
    assert.equal(handleBinding('move', { type: 'mountain', config: {}, footprint: placeFootprint(BOX) }).mode, 'raise', 'a mountain\'s span still raises');
    assert.equal(handleBinding('move', { type: 'grass', config: {}, footprint: placeFootprint(BOX) }), null);
});

// --- The panel -----------------------------------------------------------------------------------

test('Extrude\'s panel is its shapes and the stage it is at, the one button under them', () => {
    const state = onCanvas();
    let shown = dockContent(state, { size: SIZE });
    assert.equal(shown.kind, DOCK_EXTRUDE);
    assert.equal(shown.heading, 'EXTRUDE SHAPE');
    assert.equal(shown.stage, EXTRUDE_DRAWING);
    assert.deepEqual(shown.shapes.map(row => row.tools.map(tool => `${tool.id}${tool.live ? '*' : ''}`)),
        [['rectangle*', 'circle', 'triangle'], ['polygon', 'star'], ['polyline', 'polycurve']]);
    assert.ok(shown.shapes[0].tools[0].art.startsWith(EXTRUDE_ART));
    assert.deepEqual(shown.rows, []);
    assert.deepEqual(shown.actions, [{ id: EXTRUDE_STAGE_ACTION, label: 'EXTRUDE', disabled: true }]);

    chooseExtrudeTool(state, 'star');
    shown = dockContent(state, { size: SIZE });
    assert.deepEqual(shown.rows.map(entry => entry.row.label), ['NUMBER OF POINTS', 'STAR RATIO'], 'the chosen shape\'s fields while drawing');

    drawExtrudeShape(state, BOX, 'union', { size: SIZE });
    shown = dockContent(state, { size: SIZE });
    assert.deepEqual(shown.actions, [{ id: EXTRUDE_STAGE_ACTION, label: 'EXTRUDE', disabled: false }, DOCK_CANCEL],
        'ready, with the shapes drawn to be cancelled - and nothing to accept until it is lifted');

    pressExtrudeStage(state, { size: SIZE });
    shown = dockContent(state, { size: SIZE });
    assert.deepEqual(shown.rows.map(entry => [entry.row.label, entry.valueLabel]), [['HEIGHT', '60'], ['FLATTEN', '1.00']]);
    assert.deepEqual(shown.actions, [{ id: EXTRUDE_STAGE_ACTION, label: 'EDIT EXTRUSION', disabled: false }, DOCK_ACCEPT, DOCK_CANCEL]);

    pressExtrudeStage(state, { size: SIZE });
    shown = dockContent(state, { size: SIZE });
    assert.deepEqual(shown.rows.map(entry => [entry.row.label, entry.valueLabel]),
        [['TOP COLOR', '#8C8A85'], ['WALL COLOR', '#615E5C'], ['BLEND', 'TINT']]);
    assert.deepEqual(shown.actions, [{ id: EXTRUDE_STAGE_ACTION, label: 'APPLY', disabled: false }, { id: 'extrude-back', label: 'BACK' }]);

    setSelection(state, SELECTION);
    assert.equal(dockContent(state, { size: SIZE }).actions.at(-1), DOCK_DESELECT, 'and DESELECT, as every panel has');
});

test('a lifted extrusion accepted is one placement, and a drawing cancelled leaves nothing', () => {
    const state = onCanvas();
    drawExtrudeShape(state, BOX, 'union', { size: SIZE });
    cancelDraft(state);
    assert.equal(committedPlacements(state).length, 0);
    drawExtrudeShape(state, BOX, 'union', { size: SIZE });
    pressExtrudeStage(state, { size: SIZE });
    acceptDraft(state);
    const [kept] = committedPlacements(state);
    assert.equal(kept.type, 'extrude');
    assert.ok(isFootprint(kept.footprint));
    assert.equal(extrudeStage(state), EXTRUDE_DRAWING, 'and the next is drawn');
});

test('a placed frame can keep only where both are, for a shape drawn within a selection', () => {
    const framed = placeFootprint(SELECTION);
    const within = addToPlaced(framed, { ...BOX, x: 1500, feather: 0 }, 'intersect');
    assert.equal(within.of.op, 'intersect');
    assert.equal(footprintWeight(within, 1000, 0), 1);
    assert.equal(footprintWeight(within, -1000, 0), 0);
    assert.equal(addToPlaced(framed, BOX, 'xor').of.op, 'union', 'an op it does not know adds');
});

// --- The airports ---------------------------------------------------------------------------------

test('an airport is a strip, an apron of paint beside it and buildings of extrusions beyond the apron', () => {
    for (const id of ['basic-airport', 'commercial-airport']) {
        const { members } = runwayTemplate(id);
        assert.equal(members[0].type, 'runway');
        const apron = members.find(member => member.role === 'apron');
        assert.equal(apron.type, 'paint');
        assert.deepEqual(apron.config, { color: [0.24, 0.24, 0.26], opacity: 1, blend: 'normal' }, 'the strip\'s grey, flat');
        const buildings = members.filter(member => member.type === 'extrude');
        assert.ok(buildings.length >= 3, `${id} has buildings`);
        for (const building of buildings) assert.ok(building.lot.gap >= apron.lot.gap + apron.lot.across, `${id}'s ${building.role} stands beyond the apron`);
    }
});

test('a lot keeps its distance from the paving as the strip widens, and turns with it', () => {
    const group = placeTemplate('basic-airport', [0, 0], 0);
    const lots = expandGroup(group).filter(member => member.footprint);
    const apron = lots.find(member => member.type === 'paint').footprint;
    assert.deepEqual([apron.x, apron.z, apron.width, apron.depth, apron.angle], [120 + 60 + 180, 0, 360, 900, 0], 'beside the strip, east of it at heading 0');
    assert.equal('at' in lots[0].config, false, 'a lot is laid out by its footprint');

    const wide = { ...group, config: { ...group.config, width: 400 } };
    const widened = expandGroup(wide).find(member => member.type === 'paint').footprint;
    assert.equal(widened.x - apron.x, (400 - 240) / 2, 'moved out by half the widening, its gap kept');

    const turned = expandGroup({ ...group, config: { ...group.config, heading: 90 } }).find(member => member.type === 'paint').footprint;
    assert.ok(near(turned.x, 0, 1e-6) && near(Math.abs(turned.z), 360, 1e-6), `turned a quarter about the middle: ${turned.x}, ${turned.z}`);
    assert.ok(near(turned.angle, Math.PI / 2));
    assert.deepEqual(groupLots(group).length, 4);
});

test('an airport reaches as far as its strip\'s apron or its farthest lot, and is held on the canvas whole', () => {
    const group = placeTemplate('commercial-airport', [0, 0], 0);
    const strip = groupStrips(group)[0];
    assert.ok(groupReach(group) >= Math.hypot(strip.width / 2, strip.depth / 2) - 1e-6, 'the strip, graded apron and all');
    for (const lot of groupLots(group)) {
        assert.ok(groupReach(group) >= Math.hypot(Math.abs(lot.x) + lot.width / 2, Math.abs(lot.z) + lot.depth / 2) - 1e-6, 'and every lot');
    }
    // A lot set far out is what the reach is then.
    const far = { ...group, members: [...group.members, { type: 'extrude', lot: { side: 1, gap: 3000, across: 200, along: 0, length: 200 }, config: {} }] };
    assert.ok(near(groupReach(far), Math.hypot(180 + 3000 + 200, 100), 1e-6), `a lot past the strip is the reach: ${groupReach(far)}`);
    const edge = placeTemplate('commercial-airport', [SIZE / 2 - 100, 0], 0);
    const members = expandGroup(edge, SIZE);
    const [held] = keepStripOnCanvas(edge.config.at, groupReach(edge), SIZE);
    assert.ok(held < SIZE / 2 - 2000, 'drawn in from the edge');
    for (const member of members.filter(each => each.footprint)) {
        assert.ok(Math.abs(member.footprint.x) + member.footprint.width / 2 <= SIZE / 2 + 1, `${member.type} lies on the canvas`);
    }
    assert.equal(members[0].config.at[0], held, 'the strip moved in with its lots');
});

test('a built airport is a paved apron and buildings raised off their own ground, picked as one', () => {
    const env = getEnvironment('blank-canvas');
    const group = placeTemplate('basic-airport', [0, 0], 0);
    const bare = buildEnvironment(env, { size: SIZE, segments: 200, elements: [] });
    const built = buildEnvironment(env, { size: SIZE, segments: 200, elements: [group] });
    const at = (x, z) => Math.round((z + SIZE / 2) / built.step) * built.stride + Math.round((x + SIZE / 2) / built.step);
    assert.equal(built.runways.length, 1);

    const apron = expandGroup(group).find(member => member.type === 'paint').footprint;
    assert.ok(readColor(built, at(apron.x, apron.z)).every((c, k) => near(c, [0.24, 0.24, 0.26][k], 0.02)), 'paved in the strip\'s grey');
    for (const member of expandGroup(group).filter(each => each.type === 'extrude')) {
        const i = at(member.footprint.x, member.footprint.z);
        assert.ok(near(built.height[i] - bare.height[i], member.config.height, 3), `${member.footprint.x}: raised ${built.height[i] - bare.height[i]}`);
    }

    const hangar = expandGroup(group).find(member => member.type === 'extrude').footprint;
    assert.equal(placementAt([group], hangar.x, hangar.z, SIZE), 0, 'a press on a building picks the airport');
});
