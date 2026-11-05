/**
 * Auto accept, and the builder's settings over a canvas - a pending draft kept
 * without being asked about at the next press that draws, at the way out and
 * at another tool, never on a release, with `all` over the three; a stroke
 * kept that way joined to the one kept before it when nothing about it
 * changed; and the screen opened over a canvas suspending the live tool the
 * way a held pan does, so opening it never keeps or drops a stroke.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createBuildState, openBuildMode, beginCanvas, chooseBuildTool, buildModeTool, buildDraft, draftPending, editPending,
    layStroke, setStrokeValues, strokeValues, acceptDraft, reviseDraft, cancelDraft, committedPlacements, dropDraft, insertTemplate,
    chooseRunwayTemplate, drawExtrudeShape, pressExtrudeStage, extrudeStage, toggleEyeDropper, selectPlacement,
    requestLeave, buildConfirm, confirmOpen, answerConfirm, acceptToolName, setSelection,
    setAutoAccept, autoAccepts, drawAgain, holdCamera, releaseCamera, cameraHeld,
    suspendForSettings, settingsOver, resumeFromSettings, toolSuspended,
    AUTO_ACCEPT_MOMENTS, ACCEPT_EDITS, SAVE_AND_EXIT, CONFIRM_STAY, CONFIRM_YES, BUILD_FROM_TITLE
} from '../js/build-mode.js';
import { EXTRUDE_DRAWING, EXTRUDE_EXTRUDING, EXTRUDE_SURFACES } from '../js/extrude.js';
import { DEFAULT_SIZE } from '../js/environment/elements.js';
import { footprintWeight } from '../js/environment/footprints.js';
import { buildEnvironment, getEnvironment } from '../js/environment/presets.js';

const SIZE = DEFAULT_SIZE;
const STAMP = { width: 1200, depth: 1200, corner: 600 };
const BOX = { kind: 'rect', x: 0, z: 0, width: 2400, depth: 1600, angle: 0, corner: 0 };

function onCanvas(tool = 'grass', moments = {}) {
    const state = createBuildState();
    openBuildMode(state, BUILD_FROM_TITLE);
    beginCanvas(state, 'highlands');
    setAutoAccept(state, moments);
    if (tool) chooseBuildTool(state, tool);
    return state;
}

const stroke = (state, x = 0) => layStroke(state, [[x - 1000, 0], [x + 1000, 300]], STAMP);
/** How many strokes the batch in hand is: one stroke, or a union of them. */
function strokes(state) {
    const count = shape => shape?.kind === 'stroke' ? 1 : shape?.kind === 'combine' ? count(shape.a) + count(shape.b) : 0;
    return count(buildDraft(state)?.footprint?.of);
}

// --- The moments ----------------------------------------------------------------------------

test('the moments are three, off where a session starts, and all turns every one on', () => {
    assert.deepEqual(AUTO_ACCEPT_MOMENTS, ['draw', 'exit', 'tool']);
    const state = onCanvas();
    assert.deepEqual(state.autoAccept, { all: false, draw: false, exit: false, tool: false });
    assert.ok(AUTO_ACCEPT_MOMENTS.every(moment => !autoAccepts(state, moment)));

    assert.deepEqual(setAutoAccept(state, { exit: true, draw: 'yes', stray: true }), { all: false, draw: false, exit: true, tool: false },
        'only what is plainly on, and only the four');
    assert.deepEqual(AUTO_ACCEPT_MOMENTS.map(moment => autoAccepts(state, moment)), [false, true, false]);

    setAutoAccept(state, { all: true });
    assert.ok(AUTO_ACCEPT_MOMENTS.every(moment => autoAccepts(state, moment)), 'all answers yes for every moment');
    assert.equal(autoAccepts(state, 'release'), false, 'and there is no moment for a release');
    assert.equal(autoAccepts(null, 'draw'), false);
    assert.deepEqual(createBuildState().autoAccept, { all: false, draw: false, exit: false, tool: false });
});

// --- Drawing again ----------------------------------------------------------------------

test('on for drawing, a release keeps nothing: the stroke just drawn stays editable until the next press keeps it', () => {
    const state = onCanvas('grass', { draw: true });
    stroke(state);
    assert.ok(draftPending(state), 'the stroke is still the draft after its release');
    setStrokeValues(state, { density: 0.9 });
    assert.equal(buildDraft(state).config.density, 0.9, 'so a panel edit after the release changes it');

    assert.equal(drawAgain(state), true, 'the next press keeps it');
    assert.equal(draftPending(state), false);
    assert.equal(committedPlacements(state).length, 1);
    assert.equal(committedPlacements(state)[0].config.density, 0.9, 'as it was changed');

    stroke(state, 2000);
    assert.equal(strokes(state), 1, 'and the stroke that press draws starts a draft of its own');
    setStrokeValues(state, { density: 0.3 });
    assert.equal(committedPlacements(state)[0].config.density, 0.9, 'the first keeps the value it was kept with');

    cancelDraft(state);
    assert.equal(committedPlacements(state).length, 1, 'cancel reaches only the stroke just drawn');
});

test('off for drawing, the next stroke folds into the draft in hand, as it always has', () => {
    const state = onCanvas('grass', { exit: true, tool: true });
    stroke(state);
    assert.equal(drawAgain(state), false);
    stroke(state, 2000);
    assert.equal(strokes(state), 2, 'one batch of two strokes');
    assert.equal(committedPlacements(state).length, 0);
});

test('a pan between two strokes keeps nothing', () => {
    const state = onCanvas('sand', { all: true });
    stroke(state);
    assert.equal(holdCamera(state), true);
    assert.equal(drawAgain(state), false, 'a press while the camera is held is the camera\'s');
    releaseCamera(state);
    assert.ok(draftPending(state));
    assert.equal(committedPlacements(state).length, 0, 'the pan committed nothing');
});

test('drawing again is every tool\'s that draws: a mountain dropped, a runway placed, a shape begun over a lifted extrusion', () => {
    const mountain = onCanvas('mountain', { draw: true });
    dropDraft(mountain, { x: 0, z: 0 });
    assert.equal(drawAgain(mountain), true);
    dropDraft(mountain, { x: 3000, z: 0 });
    assert.equal(committedPlacements(mountain).length, 1, 'the first kept, the second a new one in hand');
    assert.deepEqual(buildDraft(mountain).config.at, [3000, 0]);

    const runway = onCanvas('runway', { draw: true });
    chooseRunwayTemplate(runway, 'basic-runway');
    insertTemplate(runway, { x: 0, z: 0 }, 0, { size: SIZE });
    assert.equal(drawAgain(runway), true);
    assert.equal(committedPlacements(runway).length, 1);

    const extrude = onCanvas('extrude', { draw: true });
    drawExtrudeShape(extrude, BOX, 'union', { size: SIZE });
    assert.equal(drawAgain(extrude), false, 'shapes still being drawn are one region, not yet anything to keep');
    pressExtrudeStage(extrude, { size: SIZE });
    assert.equal(extrudeStage(extrude), EXTRUDE_EXTRUDING);
    pressExtrudeStage(extrude, { size: SIZE });
    assert.equal(extrudeStage(extrude), EXTRUDE_SURFACES);
    assert.equal(drawAgain(extrude), false, 'at the surfaces a press chooses a surface');
    pressExtrudeStage(extrude, { size: SIZE });
    assert.equal(drawAgain(extrude), true, 'lifted, the next press keeps it');
    assert.equal(extrudeStage(extrude), EXTRUDE_DRAWING, 'and is back at drawing, for the shape that press begins');
    assert.equal(committedPlacements(extrude).length, 1);
});

test('drawing again keeps nothing for a tool that does not draw, nor its draft for another', () => {
    const lasso = onCanvas('lasso', { all: true });
    setSelection(lasso, BOX);
    assert.equal(drawAgain(lasso), false, 'the lasso selects');

    const picking = onCanvas('mountain', { all: true });
    dropDraft(picking, { x: 0, z: 0 });
    acceptDraft(picking);
    chooseBuildTool(picking, 'select');
    selectPlacement(picking, 0);
    assert.ok(draftPending(picking));
    assert.equal(drawAgain(picking), false, 'Select picks, and a pick is not drawn');

    const dropping = onCanvas('paint', { all: true });
    layStroke(dropping, [[0, 0], [500, 0]], { width: 300, depth: 300, corner: 150 });
    toggleEyeDropper(dropping);
    assert.equal(drawAgain(dropping), false, 'a press with the dropper armed takes a colour');

    const asking = onCanvas('grass', { draw: true });
    stroke(asking);
    requestLeave(asking);
    assert.equal(confirmOpen(asking), true);
    assert.equal(drawAgain(asking), false, 'nor under a question');

    const nothing = onCanvas('grass', { draw: true });
    assert.equal(drawAgain(nothing), false, 'nothing in hand');
});

// --- Leaving, and another tool ------------------------------------------------------------

test('on for leaving, the way out keeps the draft and asks only whether to save', () => {
    const state = onCanvas('grass', { exit: true });
    stroke(state);
    assert.equal(acceptToolName(state), 'Save and exit', 'the tool says which question it will ask');
    assert.deepEqual(requestLeave(state), { confirm: SAVE_AND_EXIT }, 'no ACCEPT EDITS step');
    assert.equal(committedPlacements(state).length, 1, 'kept on the way');
    assert.equal(draftPending(state), false);
    assert.deepEqual(answerConfirm(state, CONFIRM_STAY), { stay: true }, 'SAVE AND EXIT MODE is still asked, and can be called off');

    const off = onCanvas('grass', { draw: true, tool: true });
    stroke(off);
    assert.equal(acceptToolName(off), 'Accept edits');
    assert.deepEqual(requestLeave(off), { confirm: ACCEPT_EDITS }, 'off, it asks');
    assert.equal(committedPlacements(off).length, 0);
});

test('on for changing tool, another tool keeps the draft without asking; off, it asks', () => {
    const state = onCanvas('snow', { tool: true });
    stroke(state);
    assert.equal(chooseBuildTool(state, 'water'), true, 'as if ACCEPT EDITS were answered YES');
    assert.equal(confirmOpen(state), false);
    assert.equal(buildModeTool(state), 'water');
    assert.equal(committedPlacements(state).length, 1);
    assert.equal(committedPlacements(state)[0].type, 'snow');
    assert.equal(draftPending(state), false);

    const off = onCanvas('snow', { draw: true, exit: true });
    stroke(off);
    assert.equal(chooseBuildTool(off, 'water'), false);
    assert.equal(buildConfirm(off), ACCEPT_EDITS);
    assert.equal(buildModeTool(off), 'snow', 'the tool waits on the answer');
    answerConfirm(off, CONFIRM_YES);
    assert.equal(buildModeTool(off), 'water');
});

// --- The builder's settings over a canvas ---------------------------------------------------

test('the builder\'s settings opened over a canvas suspend the tool, and closing them leaves the same draft on the same tool', () => {
    const state = onCanvas('paint');
    layStroke(state, [[0, 0], [800, 200]], { width: 300, depth: 300, corner: 150 });
    const draft = state.draft;
    const placement = structuredClone(buildDraft(state));

    assert.equal(suspendForSettings(state), true);
    assert.deepEqual(state.settingsOver, { resumes: 'paint' });
    assert.equal(settingsOver(state), true);
    assert.equal(toolSuspended(state), true);
    assert.equal(suspendForSettings(state), false, 'not twice');
    assert.equal(chooseBuildTool(state, 'grass'), false, 'no tool is chosen under them');
    assert.equal(confirmOpen(state), false, 'nor asked about');
    assert.equal(holdCamera(state), false, 'nor a pan held');
    assert.equal(drawAgain(state), false);

    // Turning auto accept on while a stroke is pending keeps nothing: it
    // changes what the next press does.
    setAutoAccept(state, { all: true });
    assert.equal(state.draft, draft, 'the stroke is still the draft');
    assert.equal(committedPlacements(state).length, 0);

    assert.equal(resumeFromSettings(state), 'paint');
    assert.equal(settingsOver(state), false);
    assert.equal(resumeFromSettings(state), null, 'nothing suspended');
    assert.equal(buildModeTool(state), 'paint');
    assert.equal(state.draft, draft);
    assert.deepEqual(buildDraft(state), placement, 'unchanged');
    assert.equal(drawAgain(state), true, 'and the next press is where auto accept, now on, keeps it');
});

test('the settings suspend nothing off a canvas, under a question or under a held pan, and a new canvas starts with nothing suspended', () => {
    assert.equal(suspendForSettings(createBuildState()), false, 'no canvas');

    const asking = onCanvas('grass');
    stroke(asking);
    requestLeave(asking);
    assert.equal(suspendForSettings(asking), false, 'under a question');

    const panning = onCanvas('grass');
    holdCamera(panning);
    assert.equal(cameraHeld(panning), true);
    assert.equal(suspendForSettings(panning), false, 'one suspension at a time');
    releaseCamera(panning);

    const selecting = onCanvas(null);
    assert.equal(suspendForSettings(selecting), true, 'Select is suspended too: the screen is modal over every tool');
    assert.equal(resumeFromSettings(selecting), 'select');

    const popup = onCanvas('grass');
    popup.popup = { x: 10, y: 10 };
    suspendForSettings(popup);
    assert.equal(popup.popup, null, 'the popup is shut');

    const state = onCanvas('grass');
    suspendForSettings(state);
    beginCanvas(Object.assign(state, { screen: 'picker' }), 'highlands');
    assert.equal(state.settingsOver, null);
    assert.equal(editPending(state), false);
});

// --- Auto accept merges -------------------------------------------------------------------

const FIRST = [[-2000, 0], [-500, 200]];
const SECOND = [[800, -300], [2200, 0]];
const covers = (placement, [x, z]) => footprintWeight(placement.footprint, x, z, SIZE) > 0.99;

test('two strokes kept in a row with nothing changed between are one placement, its footprint both', () => {
    const state = onCanvas('water', { draw: true });
    layStroke(state, FIRST, STAMP);
    drawAgain(state);
    layStroke(state, SECOND, STAMP);
    drawAgain(state);
    const kept = committedPlacements(state);
    assert.equal(kept.length, 1, 'one placement, as a batch accepted by hand would be');
    assert.equal(draftPending(state), false, 'and nothing left in hand, the stroke joined being kept');
    assert.ok(covers(kept[0], [-1200, 100]) && covers(kept[0], [1500, -150]), 'covering both strokes');
    assert.equal(state.kept, 0, 'and still the one the next is joined to');

    // The same ground a batch of the two accepted by hand draws.
    const hand = onCanvas('water');
    layStroke(hand, FIRST, STAMP);
    layStroke(hand, SECOND, STAMP);
    acceptDraft(hand);
    const env = getEnvironment('highlands');
    const ground = placements => buildEnvironment(env, { segments: 60, elements: placements });
    const a = ground(kept), b = ground(committedPlacements(hand));
    assert.ok(a.height.every((h, i) => Math.abs(h - b.height[i]) < 1e-6), 'the same heights');
    assert.ok(a.color.every((c, i) => Math.abs(c - b.color[i]) < 1e-6), 'and colours');
});

test('a stroke whose configuration changed starts a placement of its own, as the walkthrough\'s does', () => {
    const state = onCanvas('water', { all: true });
    layStroke(state, FIRST, STAMP);
    drawAgain(state);
    layStroke(state, SECOND, STAMP);
    setStrokeValues(state, { color: { ...strokeValues(state).color, dark: [0.1, 0.2, 0.6] } });
    drawAgain(state);
    assert.equal(committedPlacements(state).length, 2);
    assert.deepEqual(committedPlacements(state)[1].config.color.dark, [0.1, 0.2, 0.6], 'the second keeps what it was changed to');
    assert.notDeepEqual(committedPlacements(state)[0].config.color.dark, [0.1, 0.2, 0.6]);

    // And the next stroke, as the second was, joins the second.
    layStroke(state, [[0, 2000], [500, 2500]], STAMP);
    drawAgain(state);
    assert.equal(committedPlacements(state).length, 2);
    assert.ok(covers(committedPlacements(state)[1], [250, 2250]));
});

test('anything committed between ends the run, and only a stroke tool\'s batches are joined', () => {
    // An ACCEPT by hand between.
    const hand = onCanvas('grass', { draw: true });
    layStroke(hand, FIRST, STAMP);
    drawAgain(hand);
    layStroke(hand, SECOND, STAMP);
    acceptDraft(hand);
    assert.equal(hand.kept, null, 'a batch accepted by hand is closed');
    layStroke(hand, [[0, 2000], [500, 2500]], STAMP);
    drawAgain(hand);
    assert.equal(committedPlacements(hand).length, 3);

    // Another tool, kept on the way: the same element would join, another never does.
    const tools = onCanvas('grass', { all: true });
    layStroke(tools, FIRST, STAMP);
    drawAgain(tools);
    layStroke(tools, SECOND, STAMP);
    chooseBuildTool(tools, 'sand');
    assert.equal(committedPlacements(tools).length, 1, 'kept by the tool change, joined to the grass before it');
    layStroke(tools, [[0, 2000], [500, 2500]], STAMP);
    drawAgain(tools);
    assert.deepEqual(committedPlacements(tools).map(placement => placement.type), ['grass', 'sand']);

    // A different clip is a different placement.
    const clipped = onCanvas('paint', { draw: true });
    const brush = { width: 300, depth: 300, corner: 150 };
    layStroke(clipped, FIRST, brush);
    drawAgain(clipped);
    setSelection(clipped, { kind: 'rect', x: 1500, z: 0, width: 3000, depth: 3000, angle: 0, corner: 0, feather: 0 });
    layStroke(clipped, SECOND, brush);
    drawAgain(clipped);
    assert.equal(committedPlacements(clipped).length, 2, 'one clipped to a selection, one not');

    // Mountains are each where they stand.
    const mountains = onCanvas('mountain', { draw: true });
    dropDraft(mountains, { x: 0, z: 0 });
    drawAgain(mountains);
    dropDraft(mountains, { x: 3000, z: 0 });
    drawAgain(mountains);
    assert.equal(committedPlacements(mountains).length, 2);
    assert.equal(mountains.kept, null);
});

test('two extrusions kept in a row stay two, each levelled to its own ground', () => {
    const state = onCanvas('extrude', { draw: true });
    for (const x of [-3000, 3000]) {
        drawExtrudeShape(state, { ...BOX, x }, 'union', { size: SIZE });
        pressExtrudeStage(state, { size: SIZE });
        drawAgain(state);
    }
    assert.equal(committedPlacements(state).length, 2);
});

test('the way out keeps the stroke joined to the one kept before it, and a picked placement ends the run', () => {
    const state = onCanvas('snow', { all: true });
    layStroke(state, FIRST, STAMP);
    drawAgain(state);
    layStroke(state, SECOND, STAMP);
    requestLeave(state);
    assert.equal(committedPlacements(state).length, 1, 'joined on the way out');
    answerConfirm(state, CONFIRM_STAY);

    // Picked again with Select, changed, and kept by a tool change: a pick
    // starts no run, so the next stroke is a placement of its own.
    chooseBuildTool(state, 'select');
    selectPlacement(state, 0);
    reviseDraft(state, { config: { density: 0.5 } });
    assert.equal(chooseBuildTool(state, 'snow'), true, 'kept without a question');
    assert.equal(state.kept, null, 'a pick kept starts no run');
    assert.equal(committedPlacements(state).length, 1);
    stroke(state, 4000);
    drawAgain(state);
    assert.equal(committedPlacements(state).length, 2, 'so the stroke after it is not joined to it');

    // And a canvas begun again starts with nothing to join.
    beginCanvas(Object.assign(state, { screen: 'picker' }), 'highlands');
    assert.equal(state.kept, null);
});
