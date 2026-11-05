/**
 * Extrusion surfaces, Extrusions settle into the ground and The camera from
 * inside a tool - a click on an extrusion's top or wall pointing the panel at
 * that surface's colour and outlining it, `BACK` dropping what was changed at
 * the surfaces where `APPLY` keeps it, an eye dropper on a surface's row, the
 * two surfaces taking the ground's own lightness at the `tint` blend, and a
 * pan held from inside a tool suspending it rather than changing it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createField, applyBase, getElement, readColor, fieldX, fieldZ, tintColor, luminance, DEFAULT_SIZE
} from '../js/environment/elements.js';
import { applyFootprintedElement } from '../js/environment/footprinted.js';
import { footprintWeight } from '../js/environment/footprints.js';
import {
    EXTRUDE_SURFACES_DECLARED, EXTRUDE_BACK, TOP_WEIGHT, surfaceAt, surfaceRows, EXTRUDE_EXTRUDING, EXTRUDE_SURFACES,
    EXTRUDE_DRAWING, EXTRUDE_STAGE_ACTION
} from '../js/extrude.js';
import {
    createBuildState, openBuildMode, beginCanvas, chooseBuildTool, buildModeTool, buildDraft, draftPending, reviseDraft,
    setSelection, drawExtrudeShape, pressExtrudeStage, extrudeStage, extrudeSurface, chooseExtrudeSurface,
    backFromSurfaces, acceptDraft, committedPlacements, eyeDropperArmed, toggleEyeDropper, takeEyeDropperColor,
    holdCamera, cameraHeld, releaseCamera, requestLeave, answerConfirm, confirmOpen, BUILD_FROM_TITLE
} from '../js/build-mode.js';
import { dockContent, DOCK_ACCEPT, DOCK_CANCEL } from '../js/build-panel.js';
import { surfaceEdges, EDGE_LEVEL } from '../js/build-overlay.js';

const near = (a, b, within = 1e-4) => Math.abs(a - b) <= within;
const SIZE = DEFAULT_SIZE;
const BOX = { kind: 'rect', x: 0, z: 0, width: 2400, depth: 1600, angle: 0, corner: 0 };
const TOP = getElement('extrude').ranges.topColor.default;
const WALL = getElement('extrude').ranges.wallColor.default;

function onCanvas(tool = 'extrude', environment = 'highlands') {
    const state = createBuildState();
    openBuildMode(state, BUILD_FROM_TITLE);
    beginCanvas(state, environment);
    if (tool) chooseBuildTool(state, tool);
    return state;
}

/** An extrusion lifted and at its surfaces. */
function atSurfaces() {
    const state = onCanvas();
    drawExtrudeShape(state, BOX, 'union', { size: SIZE });
    pressExtrudeStage(state, { size: SIZE });
    pressExtrudeStage(state, { size: SIZE });
    assert.equal(extrudeStage(state), EXTRUDE_SURFACES);
    return state;
}

const labels = shown => shown.rows.map(entry => entry.row.label);

// --- Extrusion surfaces --------------------------------------------------------------------------

test('an extrusion has two surfaces, the top where its footprint wholly covers the ground and the wall across its edge', () => {
    assert.deepEqual(EXTRUDE_SURFACES_DECLARED, { top: 'topColor', wall: 'wallColor' });
    assert.equal(TOP_WEIGHT, 1, 'the top is where the element paints the top: a weight of exactly 1');
    assert.equal(surfaceAt(1), 'top');
    assert.equal(surfaceAt(0.999), 'wall', 'short of the whole of it is the wall, as the element paints it');
    assert.equal(surfaceAt(0.02), 'wall');
    assert.equal(surfaceAt(0), null);
    assert.equal(surfaceAt(Number.NaN), null);
    assert.equal(surfaceAt(undefined), null);
    assert.deepEqual(surfaceRows('top'), ['topColor', 'blend']);
    assert.deepEqual(surfaceRows('wall'), ['wallColor', 'blend']);
    assert.deepEqual(surfaceRows(null), ['topColor', 'wallColor', 'blend'], 'nothing chosen, all three');
    assert.deepEqual(surfaceRows('side'), ['topColor', 'wallColor', 'blend']);
    assert.deepEqual(EXTRUDE_BACK, { id: 'extrude-back', label: 'BACK' });
});

test('a surface clicked points the panel at its colour and the blend, and a click off it at all three again', () => {
    const state = atSurfaces();
    assert.equal(extrudeSurface(state), null);
    assert.deepEqual(labels(dockContent(state, { size: SIZE })), ['TOP COLOR', 'WALL COLOR', 'BLEND']);

    assert.equal(chooseExtrudeSurface(state, 'top'), true);
    assert.equal(extrudeSurface(state), 'top');
    let shown = dockContent(state, { size: SIZE });
    assert.equal(shown.surface, 'top');
    assert.deepEqual(labels(shown), ['TOP COLOR', 'BLEND']);
    assert.equal(chooseExtrudeSurface(state, 'top'), false, 'the surface already chosen is not a change');

    assert.equal(chooseExtrudeSurface(state, 'wall'), true);
    shown = dockContent(state, { size: SIZE });
    assert.deepEqual(labels(shown), ['WALL COLOR', 'BLEND']);
    assert.deepEqual(shown.actions, [{ id: EXTRUDE_STAGE_ACTION, label: 'APPLY', disabled: false }, EXTRUDE_BACK]);

    assert.equal(chooseExtrudeSurface(state, null), true, 'off the extrusion');
    assert.deepEqual(labels(dockContent(state, { size: SIZE })), ['TOP COLOR', 'WALL COLOR', 'BLEND']);
    assert.equal(chooseExtrudeSurface(state, 'side'), false, 'nothing it does not have - which is no surface, as before');
    assert.equal(extrudeSurface(state), null);
});

test('a surface is chosen only at the surfaces, and is forgotten on the way out of them', () => {
    const state = onCanvas();
    assert.equal(chooseExtrudeSurface(state, 'top'), false, 'nothing drawn');
    drawExtrudeShape(state, BOX, 'union', { size: SIZE });
    assert.equal(chooseExtrudeSurface(state, 'top'), false, 'drawing');
    pressExtrudeStage(state, { size: SIZE });
    assert.equal(chooseExtrudeSurface(state, 'top'), false, 'extruding');
    assert.equal(extrudeSurface(state), null);

    pressExtrudeStage(state, { size: SIZE });
    chooseExtrudeSurface(state, 'wall');
    pressExtrudeStage(state, { size: SIZE });
    assert.equal(extrudeStage(state), EXTRUDE_EXTRUDING);
    assert.equal(extrudeSurface(state), null, 'APPLY forgets it');
    assert.equal('surface' in state.draft, false);
    pressExtrudeStage(state, { size: SIZE });
    assert.equal(extrudeSurface(state), null, 'and the surfaces open again on all three');

    chooseExtrudeSurface(state, 'top');
    backFromSurfaces(state);
    assert.equal(extrudeSurface(state), null, 'as BACK does');

    // A placement picked with Select has no surfaces stage to choose in.
    const picked = onCanvas('select');
    assert.equal(chooseExtrudeSurface(picked, 'top'), false);
});

test('an extrusion holds every value it is drawn with from the moment it is begun, less the level its footprint settles', () => {
    const state = onCanvas();
    drawExtrudeShape(state, BOX, 'union', { size: SIZE });
    assert.deepEqual(Object.keys(buildDraft(state).config).sort(), ['blend', 'flatten', 'height', 'topColor', 'wallColor'],
        'so what the surfaces stood at is the draft\'s own, with nothing to read through the element');
});

test('BACK comes back from the surfaces with the colours as they stood, where APPLY keeps them', () => {
    const state = atSurfaces();
    assert.deepEqual(state.draft.surfacesFrom, { topColor: TOP, wallColor: WALL, blend: 'tint' },
        'the surfaces as they stood on the way in');

    reviseDraft(state, { config: { topColor: [0.9, 0.1, 0.1], blend: 'normal' } });
    assert.equal(backFromSurfaces(state), true);
    assert.equal(extrudeStage(state), EXTRUDE_EXTRUDING);
    assert.deepEqual(buildDraft(state).config.topColor, TOP, 'the top put back');
    assert.equal(buildDraft(state).config.blend, 'tint', 'and the blend');
    assert.equal(buildDraft(state).config.height, 60, 'what was set before the surfaces is left alone');
    assert.equal('surfacesFrom' in state.draft, false);
    assert.equal(backFromSurfaces(state), false, 'refused away from the surfaces');

    // Kept by APPLY, then that kept change is what BACK comes back to.
    pressExtrudeStage(state, { size: SIZE });
    reviseDraft(state, { config: { wallColor: [0.1, 0.2, 0.9] } });
    pressExtrudeStage(state, { size: SIZE });
    assert.deepEqual(buildDraft(state).config.wallColor, [0.1, 0.2, 0.9], 'APPLY keeps it');
    pressExtrudeStage(state, { size: SIZE });
    reviseDraft(state, { config: { wallColor: [0.5, 0.5, 0.5], topColor: [0, 0, 0] } });
    backFromSurfaces(state);
    assert.deepEqual(buildDraft(state).config.wallColor, [0.1, 0.2, 0.9], 'BACK comes back to what APPLY kept');
    assert.deepEqual(buildDraft(state).config.topColor, TOP);

    assert.ok(draftPending(state), 'neither settles the extrusion');
    acceptDraft(state);
    assert.deepEqual(committedPlacements(state).at(-1).config.wallColor, [0.1, 0.2, 0.9]);
});

test('ACCEPT and CANCEL wait while the surfaces are open, and come back with BACK', () => {
    const state = atSurfaces();
    assert.deepEqual(dockContent(state, { size: SIZE }).actions.map(action => action.id), [EXTRUDE_STAGE_ACTION, EXTRUDE_BACK.id]);
    backFromSurfaces(state);
    assert.deepEqual(dockContent(state, { size: SIZE }).actions,
        [{ id: EXTRUDE_STAGE_ACTION, label: 'EDIT EXTRUSION', disabled: false }, DOCK_ACCEPT, DOCK_CANCEL]);
});

test('a surface\'s colour row offers the eye dropper, which fills the row it was pressed on', () => {
    const state = atSurfaces();
    let shown = dockContent(state, { size: SIZE });
    assert.equal(shown.dropping, false, 'offered, not armed');

    assert.equal(toggleEyeDropper(state, 'wallColor'), true);
    assert.equal(eyeDropperArmed(state), true);
    assert.equal(dockContent(state, { size: SIZE }).dropping, 'wallColor', 'pressed on the wall\'s row alone');
    assert.equal(takeEyeDropperColor(state, [0.2, 0.4, 1.4]), true);
    assert.deepEqual(buildDraft(state).config.wallColor, [0.2, 0.4, 1], 'the wall takes it, held to what a channel holds');
    assert.deepEqual(buildDraft(state).config.topColor ?? TOP, TOP, 'and the top does not');
    assert.equal(eyeDropperArmed(state), false, 'put down');
    assert.equal(dockContent(state, { size: SIZE }).dropping, false);

    assert.equal(toggleEyeDropper(state), true);
    assert.equal(state.dropper, 'topColor', 'pressed without a row, the top\'s');
    assert.equal(toggleEyeDropper(state, 'topColor'), false, 'pressed again, put down');
    assert.equal(toggleEyeDropper(state, 'height'), true);
    assert.equal(state.dropper, 'topColor', 'and a row that is not a surface\'s colour is the top\'s');

    chooseExtrudeSurface(state, 'wall');
    assert.equal(eyeDropperArmed(state), false, 'choosing a surface puts it down');
    toggleEyeDropper(state, 'wallColor');
    backFromSurfaces(state);
    assert.equal(eyeDropperArmed(state), false, 'as leaving the surfaces does');
    assert.equal(toggleEyeDropper(state, 'wallColor'), false, 'not offered while extruding');
    assert.equal(dockContent(state, { size: SIZE }).dropping, undefined, 'nor shown');
    assert.equal(takeEyeDropperColor(state, [0, 0, 0]), false);

    // Left by either answer, the surfaces open again with it put down rather
    // than still armed for the row it was pressed on.
    for (const leave of [backFromSurfaces, held => pressExtrudeStage(held, { size: SIZE })]) {
        const again = atSurfaces();
        toggleEyeDropper(again, 'wallColor');
        leave(again);
        assert.equal(again.dropper, false, `put down by ${leave === backFromSurfaces ? 'BACK' : 'APPLY'}`);
        pressExtrudeStage(again, { size: SIZE });
        assert.equal(extrudeStage(again), EXTRUDE_SURFACES);
        assert.equal(eyeDropperArmed(again), false, 'and not armed when the surfaces open again');
    }
});

test('Free Paint\'s eye dropper still fills the brush', () => {
    const state = onCanvas('paint');
    assert.equal(toggleEyeDropper(state, 'topColor'), true);
    assert.equal(state.dropper, true, 'the brush, whatever row is named');
    assert.equal(dockContent(state, { size: SIZE }).dropping, true);
});

test('a surface\'s edge is traced at the weights a click there reads it at', () => {
    const footprint = { ...BOX, feather: 240 };
    const top = surfaceEdges(footprint, 'top', SIZE);
    const wall = surfaceEdges(footprint, 'wall', SIZE);
    assert.equal(top.length, 1, 'the top round its rim, in one piece');
    assert.ok(top[0].length > 40);
    for (const [x, z] of top[0]) assert.ok(near(footprintWeight(footprint, x, z, SIZE), 1, 1e-5), `${x},${z} on the top`);
    assert.equal(wall.length, 2, 'the wall at its foot and its head');
    const levels = wall.map(run => footprintWeight(footprint, run[0][0], run[0][1], SIZE));
    assert.ok(levels.some(weight => near(weight, EDGE_LEVEL, 0.02)), 'its foot, where the footprint reaches all but nothing');
    assert.ok(levels.some(weight => near(weight, 1, 1e-5)), 'its head, where the top begins');

    // The top's rim lies a feather inside the wall's foot.
    const span = runs => Math.max(...runs.flat().map(([x]) => Math.abs(x)));
    assert.ok(span(top) < span(wall) - 200, `${span(top)} inside ${span(wall)}`);
    assert.deepEqual(surfaceEdges(footprint, 'side', SIZE), []);
    assert.deepEqual(surfaceEdges(footprint, 'top', 0), []);
    assert.deepEqual(surfaceEdges(null, 'top', SIZE), []);
});

// --- Extrusions settle into the ground ------------------------------------------------------------

test('at the tint blend each surface takes its colour\'s hue at the ground\'s own lightness, the wall fading at its foot', () => {
    const field = createField({ size: SIZE, segments: 100 });
    applyBase(field, { maxHeight: 400 });
    const before = [...field.color];
    const footprint = { ...BOX, feather: 240 };
    applyFootprintedElement(field, { type: 'extrude', config: { height: 120 }, footprint });

    const ground = i => before.slice(i * 3, i * 3 + 3);
    const tops = [];
    let band = 0;
    for (let i = 0; i < field.count; i++) {
        const w = footprintWeight(footprint, fieldX(field, i), fieldZ(field, i));
        if (w >= 1) {
            tops.push(i);
            const expected = tintColor(ground(i), TOP);
            assert.ok(readColor(field, i).every((c, k) => near(c, expected[k], 1e-5)), `vertex ${i} is the top, tinted`);
            assert.ok(near(luminance(readColor(field, i)), luminance(ground(i)), 1e-4), `vertex ${i} keeps its ground's lightness`);
        } else if (w > 0) {
            band++;
            const tinted = tintColor(ground(i), WALL);
            const expected = tinted.map((c, k) => ground(i)[k] + (c - ground(i)[k]) * w);
            assert.ok(readColor(field, i).every((c, k) => near(c, expected[k], 1e-5)), `vertex ${i} is the wall, tinted and faded to the ground`);
        } else {
            assert.ok(readColor(field, i).every((c, k) => near(c, ground(i)[k], 1e-6)), `vertex ${i} outside is untouched`);
        }
    }
    assert.ok(tops.length > 50 && band > 10, `${tops.length} on top, ${band} in the band`);

    // A top laid over ground of more than one lightness is shaded the way the ground was.
    const lightness = tops.map(i => luminance(readColor(field, i)));
    assert.ok(Math.max(...lightness) - Math.min(...lightness) > 0.01, 'not one printed colour');
});

test('at the normal blend the two colours are laid as they are', () => {
    const field = createField({ size: SIZE, segments: 60 });
    applyBase(field, { maxHeight: 400 });
    const footprint = { ...BOX, feather: 0 };
    applyFootprintedElement(field, { type: 'extrude', config: { blend: 'normal' }, footprint });
    const middle = 30 * 61 + 30;
    assert.ok(readColor(field, middle).every((c, k) => near(c, TOP[k], 1e-6)));
});

// --- The camera from inside a tool ----------------------------------------------------------------

test('a pan held from inside a tool suspends it, and letting go puts the same tool back', () => {
    const state = onCanvas();
    drawExtrudeShape(state, BOX, 'union', { size: SIZE });
    const draft = state.draft;
    const placement = structuredClone(buildDraft(state));

    assert.equal(holdCamera(state), true);
    assert.deepEqual(state.camera, { overriding: true, resumes: 'extrude' });
    assert.equal(cameraHeld(state), true);
    assert.equal(buildModeTool(state), 'extrude', 'suspended, not changed');
    assert.equal(state.draft, draft, 'the shape half drawn is the same draft');
    assert.equal(confirmOpen(state), false, 'and nothing asks about it');
    assert.equal(holdCamera(state), false, 'already held');

    assert.equal(chooseBuildTool(state, 'select'), false, 'no tool is chosen under a held pan');
    assert.equal(confirmOpen(state), false, 'nor asked about');
    assert.equal(buildModeTool(state), 'extrude');

    assert.equal(releaseCamera(state), 'extrude');
    assert.equal(state.camera, null);
    assert.equal(cameraHeld(state), false);
    assert.equal(releaseCamera(state), null, 'nothing held');
    assert.equal(state.draft, draft, 'a pan commits nothing');
    assert.deepEqual(buildDraft(state), placement, 'and changes nothing in the draft');
    assert.equal(extrudeStage(state), EXTRUDE_DRAWING);
    assert.equal(committedPlacements(state).length, 0);
});

test('a stroke pending and a selection live both survive a pan', () => {
    const state = onCanvas('water');
    setSelection(state, { kind: 'rect', x: 0, z: 0, width: 3000, depth: 3000, angle: 0, corner: 0, feather: 0 });
    holdCamera(state);
    releaseCamera(state);
    assert.ok(state.selection, 'the selection is kept');
    assert.equal(buildModeTool(state), 'water');
});

test('nothing overrides Select\'s own camera, and nothing holds the camera off a canvas or under a question', () => {
    assert.equal(holdCamera(onCanvas(null)), false, 'Select\'s gestures are its own');
    assert.equal(holdCamera(createBuildState()), false, 'no canvas');
    assert.equal(cameraHeld(null), false);

    const asking = onCanvas('lasso');
    requestLeave(asking);
    assert.equal(confirmOpen(asking), true);
    assert.equal(holdCamera(asking), false, 'under a question');
    answerConfirm(asking, 'stay');

    // A canvas begun again starts with nothing held.
    const state = onCanvas();
    holdCamera(state);
    beginCanvas(Object.assign(state, { screen: 'picker' }), 'highlands');
    assert.equal(state.camera, null);
});
