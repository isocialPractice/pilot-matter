/**
 * The active selection, and Clipping to a selection - the region the lasso
 * draws, held by the session across tool changes until a deselect, drawn as a
 * dashed line on the ground, and the tools that mind it drawn only inside it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createField, fieldX, fieldZ, DEFAULT_SIZE } from '../js/environment/elements.js';
import { applyFootprintedElement } from '../js/environment/footprinted.js';
import { footprintWeight } from '../js/environment/footprints.js';
import {
    createBuildState, openBuildMode, beginCanvas, chooseBuildTool, dropDraft, buildDraft, acceptDraft,
    requestLeave, answerConfirm, confirmOpen, draftPending,
    selectionLive, buildSelection, setSelection, deselect, buildLassoTool, chooseLassoTool, lassoValues, setLassoValues,
    BUILD_FROM_TITLE, SAVE_AND_EXIT, CONFIRM_STAY
} from '../js/build-mode.js';
import { placementReach, placementAt } from '../js/build-select.js';
import {
    footprintLoop, subdividePath, canvasPieces, projectPath, strokePaths, SELECTION_OUTLINE, DRAWING_OUTLINE, PATH_STEP
} from '../js/build-overlay.js';
import { dockContent, DOCK_LASSO, DOCK_DESELECT } from '../js/build-panel.js';
import { lassoFootprint } from '../js/lasso.js';

const HALF = DEFAULT_SIZE / 2;
const BOX = Object.freeze({ kind: 'rect', x: 0, z: 0, width: 4000, depth: 4000, angle: 0, corner: 0 });

function onCanvas() {
    const state = createBuildState();
    openBuildMode(state, BUILD_FROM_TITLE);
    beginCanvas(state, 'highlands');
    return state;
}

// --- The selection is session state ------------------------------------------------

test('a region drawn becomes the selection, in place of any before it', () => {
    const state = onCanvas();
    assert.equal(selectionLive(state), false, 'a canvas opens with nothing selected');
    assert.equal(setSelection(state, BOX), true);
    assert.deepEqual(buildSelection(state), BOX);

    const other = { kind: 'ellipse', x: 100, z: 100, radiusX: 500, radiusZ: 300, angle: 0 };
    setSelection(state, other);
    assert.deepEqual(buildSelection(state), other, 'a new lasso replaces the old');

    buildSelection(state).x = 999;
    assert.equal(buildSelection(state).x, 100, 'handed out as a copy');
    assert.equal(setSelection(state, { kind: 'ring', points: [[0, 0], [1, 1]] }), false, 'and a lasso of no region selects nothing');
    assert.deepEqual(buildSelection(state), other, 'leaving the selection as it was');
});

test('the selection outlives a tool change, and only a deselect drops it', () => {
    const state = onCanvas();
    chooseBuildTool(state, 'lasso');
    setSelection(state, BOX);
    chooseBuildTool(state, 'mountain');
    assert.equal(selectionLive(state), true, 'a lasso drawn once is the region every tool after it works in');
    chooseBuildTool(state, 'select');
    assert.equal(selectionLive(state), true);

    assert.equal(deselect(state), true);
    assert.equal(selectionLive(state), false);
    assert.equal(deselect(state), false, 'and with nothing selected there is nothing to drop');
});

test('a selection is not an edit: it asks nothing, and nothing keeps it', () => {
    const state = onCanvas();
    chooseBuildTool(state, 'lasso');
    setSelection(state, BOX);
    assert.equal(chooseBuildTool(state, 'mountain'), true, 'leaving the lasso with a region drawn asks nothing');
    assert.equal(draftPending(state), false);
    assert.deepEqual(requestLeave(state), { confirm: SAVE_AND_EXIT }, 'and the way out asks to save, not to accept');
    assert.ok(!('selection' in answerConfirm(state, CONFIRM_STAY)));

    beginCanvas(Object.assign(state, { screen: 'picker' }), 'lakeside');
    assert.equal(selectionLive(state), false, 'a new canvas starts with nothing selected');
});

test('nothing is selected or dropped under a question', () => {
    const state = onCanvas();
    requestLeave(state);
    assert.equal(confirmOpen(state), true);
    assert.equal(setSelection(state, BOX), false);
    state.confirm = null;
    setSelection(state, BOX);
    requestLeave(state);
    assert.equal(deselect(state), false);
});

test('the lasso starts on Free Select, chooses only tools that work, and keeps their fields', () => {
    const state = onCanvas();
    assert.equal(buildLassoTool(state), 'free');
    assert.equal(chooseLassoTool(state, 'lasso-of-truth'), false, 'a tool the lasso does not have');
    assert.equal(chooseLassoTool(state, 'round-rect'), true);
    assert.deepEqual(lassoValues(state), { corner: 600 }, 'its own field at its default');
    assert.deepEqual(setLassoValues(state, { corner: 250, sides: 9 }), { corner: 250 }, 'and only what it declares is kept');
    // The lasso's tools keep their fields in one place, so a value one tool
    // never declared would be waiting for the next tool that does.
    assert.ok(!('sides' in state.lassoValues), 'not even out of sight');
    chooseLassoTool(state, 'free');
    assert.deepEqual(lassoValues(state), {}, 'a tool with no fields has none');
    chooseLassoTool(state, 'round-rect');
    assert.deepEqual(lassoValues(state), { corner: 250 }, 'and coming back finds them where they were left');
});

// --- Clipping ----------------------------------------------------------------------------

test('a mountain dropped inside a selection carries the selection as its clip', () => {
    const state = onCanvas();
    setSelection(state, BOX);
    chooseBuildTool(state, 'mountain');
    assert.equal(dropDraft(state, { x: 500, z: 500 }, { size: DEFAULT_SIZE }), true);
    assert.deepEqual(buildDraft(state).clip, BOX);

    deselect(state);
    assert.deepEqual(buildDraft(state).clip, BOX, 'copied as it stood, so a selection changed later leaves it as dropped');
});

test('a click outside the selection drops nothing, and moves nothing in hand there', () => {
    const state = onCanvas();
    setSelection(state, BOX);
    chooseBuildTool(state, 'mountain');
    assert.equal(dropDraft(state, { x: 3000, z: 0 }, { size: DEFAULT_SIZE }), false, 'all of it would be cut away');
    assert.equal(draftPending(state), false);

    dropDraft(state, { x: 0, z: 0 }, { size: DEFAULT_SIZE });
    assert.equal(dropDraft(state, { x: 3000, z: 0 }, { size: DEFAULT_SIZE }), false);
    assert.deepEqual(buildDraft(state).config.at, [0, 0]);
});

test('with nothing selected a mountain drops anywhere, unclipped', () => {
    const state = onCanvas();
    chooseBuildTool(state, 'mountain');
    assert.equal(dropDraft(state, { x: 3000, z: 0 }, { size: DEFAULT_SIZE }), true);
    assert.ok(!('clip' in buildDraft(state)), 'a placement with no clip costs nothing for clips');
});

const PEAK = { type: 'mountain', config: { count: 1, height: [800, 800], radius: [3000, 3000], at: [0, 0] }, seed: 5 };

/** The ground a placement raises on a flat field, vertex by vertex. */
function raised(placement) {
    const field = createField({ size: DEFAULT_SIZE, segments: 100 });
    applyFootprintedElement(field, placement);
    return field;
}

test('a clipped mountain stands only where its selection reaches: the product of the two weights', () => {
    const whole = raised(PEAK);
    const clipped = raised({ ...PEAK, clip: BOX });

    let inside = 0, outside = 0, feather = 0;
    for (let i = 0; i < whole.count; i++) {
        const weight = footprintWeight(BOX, fieldX(whole, i), fieldZ(whole, i), DEFAULT_SIZE);
        assert.ok(Math.abs(clipped.height[i] - whole.height[i] * weight) < 1e-3, 'the mountain\'s rise times the selection\'s weight');
        if (weight === 1) inside++;
        else if (weight === 0 && whole.height[i] > 1) outside++;
        else if (weight > 0) feather++;
    }
    assert.ok(inside > 0 && outside > 0 && feather > 0, 'whole inside, nothing outside, and eased across the edge');
});

test('a clip and a footprint of its own weigh together, and a clip takes nothing from the stream', () => {
    const own = { kind: 'disc', x: 1500, z: 0, radius: 1200 };
    const both = raised({ ...PEAK, footprint: own, clip: BOX });
    const field = createField({ size: DEFAULT_SIZE, segments: 100 });
    const whole = raised(PEAK);
    for (let i = 0; i < field.count; i++) {
        const x = fieldX(field, i), z = fieldZ(field, i);
        const weight = footprintWeight(own, x, z, DEFAULT_SIZE) * footprintWeight(BOX, x, z, DEFAULT_SIZE);
        assert.ok(Math.abs(both.height[i] - whole.height[i] * weight) < 1e-3);
    }
});

test('a clipped mountain is picked only where it stands', () => {
    const clipped = { ...PEAK, clip: BOX };
    assert.equal(placementAt([clipped], 0, 0, DEFAULT_SIZE), 0);
    assert.equal(placementAt([PEAK], 2400, 0, DEFAULT_SIZE), 0, 'its slope out past the box would be picked unclipped');
    assert.equal(placementAt([clipped], 2400, 0, DEFAULT_SIZE), null, 'and is not, cut away');
    assert.equal(placementReach(clipped, DEFAULT_SIZE)(2400, 0), 0);
});

// --- Drawn on the ground -------------------------------------------------------------------

test('a region\'s edge is traced from what it is', () => {
    const box = footprintLoop(BOX);
    assert.deepEqual(box.map(([x, z]) => [Math.abs(x), Math.abs(z)]).every(([x, z]) => x === 2000 && z === 2000), true, 'a box\'s four corners');
    assert.equal(box.length, 4);

    const round = footprintLoop({ ...BOX, corner: 500 });
    assert.ok(round.length > 8 && round.every(([x, z]) => Math.abs(x) <= 2000 + 1e-9 && Math.abs(z) <= 2000 + 1e-9), 'rounded inside the box');
    assert.ok(!round.some(([x, z]) => Math.abs(x) === 2000 && Math.abs(z) === 2000), 'with no corner left square');

    for (const [x, z] of footprintLoop({ kind: 'ellipse', x: 100, z: 0, radiusX: 600, radiusZ: 300, angle: 0 })) {
        assert.ok(Math.abs(((x - 100) / 600) ** 2 + (z / 300) ** 2 - 1) < 1e-9, 'an ellipse on its curve');
    }
    assert.deepEqual(footprintLoop({ kind: 'ring', points: [[0, 0], [10, 0], [10, 10]] }), [[0, 0], [10, 0], [10, 10]]);
    assert.deepEqual(footprintLoop({ kind: 'stroke' }), []);
    assert.deepEqual(footprintLoop(null), []);
});

test('the traced edge is where a drop inside it stops being allowed', () => {
    for (const region of [BOX, lassoFootprint('ellipse', [{ x: -900, z: -300 }, { x: 900, z: 300 }])]) {
        for (const [x, z] of footprintLoop(region)) assert.ok(footprintWeight(region, x, z) < 1e-9, 'weight nothing on the edge');
    }
});

test('an edge is stood on the ground point by point, near enough to go over a hill', () => {
    const path = subdividePath([[0, 0], [1000, 0], [1000, 1000]], PATH_STEP, true);
    for (let i = 1; i < path.length; i++) {
        assert.ok(Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]) <= PATH_STEP + 1e-9);
    }
    assert.deepEqual(path.at(-1), [0, 0], 'a closed edge comes back to where it began');
    assert.deepEqual(subdividePath([[0, 0], [100, 0]], PATH_STEP, false), [[0, 0], [100, 0]], 'and an open one stops at its end');
});

test('a region over the canvas edge is drawn carrying on across the opposite one', () => {
    const over = subdividePath(footprintLoop({ ...BOX, x: HALF }), PATH_STEP, true);
    const pieces = canvasPieces(over, DEFAULT_SIZE);
    const xs = pieces.flat().map(([x]) => x);
    assert.ok(pieces.flat().every(([x, z]) => Math.abs(x) <= HALF && Math.abs(z) <= HALF), 'cut at the square');
    assert.ok(xs.some(x => x > HALF - 2100) && xs.some(x => x < -HALF + 2100), 'on both sides of it');
});

test('a run projected breaks wherever a point is out of view', () => {
    const project = (x) => (x === 2 ? null : { x, y: 0 });
    assert.deepEqual(projectPath([[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]], () => 0, project),
        [[{ x: 0, y: 0 }, { x: 1, y: 0 }], [{ x: 3, y: 0 }, { x: 4, y: 0 }]]);
});

test('the selection is a dashed white line, and a shape being drawn a solid one', () => {
    assert.deepEqual([...SELECTION_OUTLINE.dash], [10, 7]);
    assert.equal(SELECTION_OUTLINE.colour, '#ffffff');
    assert.ok(DRAWING_OUTLINE.dash == null);

    const dashes = [];
    const ctx = { setLineDash: d => dashes.push(d), set lineWidth(v) {}, set strokeStyle(v) {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {} };
    strokePaths(ctx, [[{ x: 0, y: 0 }, { x: 5, y: 5 }]], SELECTION_OUTLINE);
    assert.deepEqual(dashes, [[], [10, 7], []], 'the under-stroke solid, the line dashed, and the context left solid');
});

// --- The lasso's panel ----------------------------------------------------------------------

test('the lasso\'s panel is its built tools in the art\'s rows, the chosen one\'s fields, and a deselect only with a selection', () => {
    const state = onCanvas();
    chooseBuildTool(state, 'lasso');
    let shown = dockContent(state, {});
    assert.equal(shown.kind, DOCK_LASSO);
    assert.equal(shown.heading, 'LASSO SELECT TOOLS');
    assert.deepEqual(shown.shapes.map(row => row.tools.map(tool => tool.id)),
        [['free', 'rectangle', 'ellipse'], ['round-rect', 'triangle', 'star'], ['polygon', 'polyline'], ['curved-polygon', 'curved-polyline']],
        'all ten, now every kind they draw can be read');
    assert.deepEqual(shown.shapes.flatMap(row => row.tools).filter(tool => tool.live).map(tool => tool.id), ['free']);
    assert.deepEqual(shown.rows, [], 'Free Select has no fields of its own');
    assert.deepEqual(shown.actions, [], 'and with nothing selected there is no deselect');

    chooseLassoTool(state, 'round-rect');
    setSelection(state, BOX);
    shown = dockContent(state, {});
    assert.deepEqual(shown.rows.map(entry => entry.row.label), ['CORNER']);
    assert.deepEqual(shown.actions, [DOCK_DESELECT]);
    assert.equal(DOCK_DESELECT.label, 'DESELECT');
});
