import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createBuildState, openBuildMode, closeBuildMode, buildModeShowing,
    buildModePicking, buildModeDrawing, buildModeEnvironment, buildModeFrom,
    beginCanvas, isBuilderOpenKey, isPickerCloseKey, isCanvasLeaveKey, leavesBuilder,
    requestLeave, buildModeTool, chooseBuildTool,
    draftPending, buildDraft, committedPlacements, startDraft, pickUpPlacement,
    reviseDraft, acceptDraft, cancelDraft, builtPlacements, ACCEPT_EDITS,
    BUILDER_LABEL, BUILDER_ENTRY_ID, BUILDER_OPEN_KEYS, PICKER_CLOSE_KEYS, CANVAS_LEAVE_KEYS,
    BUILD_FROM_TITLE, BUILD_FROM_PAUSE, BUILD_PICKER, BUILD_CANVAS
} from '../js/build-mode.js';
import {
    SELECT_TOOL, ACCEPT_TOOL, BUILD_TOOLS, BUILD_TOOL_IDS, BUILT_TOOLS, mindsLasso
} from '../js/build-tools.js';
import { DEFAULT_KEYMAP, RESET_KEYS } from '../js/input-map.js';
import { SETTINGS_OPEN_KEYS } from '../js/settings.js';
import { HELP_KEY } from '../js/controls-help.js';
import { MUTE_KEY } from '../js/audio.js';
import { HUD_TOGGLE_KEY } from '../js/hud-visibility.js';
import { PAUSE_KEY } from '../js/pause.js';
import { PHOTO_KEY } from '../js/photo.js';
import { CAMERA_CYCLE_KEY } from '../js/camera-math.js';
import { reservedRole, isReservedKey } from '../js/reserved-keys.js';

test('a session is closed until something opens it', () => {
    const state = createBuildState();

    assert.equal(buildModeShowing(state), false);
    assert.equal(buildModePicking(state), false);
    assert.equal(buildModeDrawing(state), false);
    assert.equal(buildModeFrom(state), null, 'and has nowhere to return to');
    assert.equal(buildModeEnvironment(state), null);
});

// There are three ways in and they are one action, so what each of them has to
// carry is where it came from - which is what the way out returns to.
test('opening the builder remembers what opened it', () => {
    for (const from of [BUILD_FROM_TITLE, BUILD_FROM_PAUSE]) {
        const state = createBuildState();
        openBuildMode(state, from);

        assert.equal(buildModeShowing(state), true);
        assert.equal(buildModeFrom(state), from);
    }
});

test('a way in nobody named opens from the title screen, which is where a flight starts', () => {
    const state = createBuildState();
    openBuildMode(state);
    assert.equal(buildModeFrom(state), BUILD_FROM_TITLE);

    openBuildMode(state, 'somewhere else');
    assert.equal(buildModeFrom(state), BUILD_FROM_TITLE,
        'and a name nothing answers to reads the same way');
});

// The picker is the builder's first screen rather than a gate in front of it,
// so a session begins on it and leaving it leaves the builder.
test('a session opens on the picker', () => {
    const state = createBuildState();
    openBuildMode(state, BUILD_FROM_PAUSE);

    assert.equal(state.screen, BUILD_PICKER);
    assert.equal(buildModePicking(state), true);
    assert.equal(buildModeDrawing(state), false, 'there is nothing being drawn yet');
    assert.equal(buildModeEnvironment(state), null, 'and no canvas chosen');
});

test('starting a canvas moves the session onto it, carrying what was chosen', () => {
    const state = createBuildState();
    openBuildMode(state, BUILD_FROM_PAUSE);

    assert.equal(beginCanvas(state, 'blank-canvas'), true);
    assert.equal(state.screen, BUILD_CANVAS);
    assert.equal(buildModePicking(state), false, 'the picker is behind it now');
    assert.equal(buildModeDrawing(state), true);
    assert.equal(buildModeEnvironment(state), 'blank-canvas');
    assert.equal(buildModeFrom(state), BUILD_FROM_PAUSE, 'and the way out is still the way in');
});

/**
 * A canvas can only be begun from the picker, which is the screen that says
 * which one. A session that is not open has not chosen anything, and one
 * already drawing has - starting a second canvas over it would throw away the
 * first without asking.
 */
test('a canvas is begun from the picker and from nowhere else', () => {
    const closed = createBuildState();
    assert.equal(beginCanvas(closed, 'highlands'), false);
    assert.equal(buildModeShowing(closed), false, 'and nothing was opened by the attempt');

    const drawing = createBuildState();
    openBuildMode(drawing, BUILD_FROM_TITLE);
    beginCanvas(drawing, 'highlands');

    assert.equal(beginCanvas(drawing, 'dune-sea'), false);
    assert.equal(buildModeEnvironment(drawing), 'highlands', 'the canvas in hand is kept');
});

test('a canvas with no name to generate from is refused', () => {
    for (const id of [null, undefined, '', 0, {}]) {
        const state = createBuildState();
        openBuildMode(state, BUILD_FROM_TITLE);

        assert.equal(beginCanvas(state, id), false, `${JSON.stringify(id)} names no environment`);
        assert.equal(buildModePicking(state), true, 'and the picker is still the screen');
    }
});

test('leaving puts the session back to having nothing open', () => {
    const state = createBuildState();
    openBuildMode(state, BUILD_FROM_PAUSE);
    beginCanvas(state, 'lakeside');

    closeBuildMode(state);

    assert.equal(buildModeShowing(state), false);
    assert.equal(buildModeDrawing(state), false);
    assert.equal(buildModeEnvironment(state), null);
    assert.equal(buildModeFrom(state), null);
});

test('a session reopens on the picker rather than on what it was last building', () => {
    const state = createBuildState();
    openBuildMode(state, BUILD_FROM_TITLE);
    beginCanvas(state, 'canyon-country');
    closeBuildMode(state);

    openBuildMode(state, BUILD_FROM_TITLE);
    assert.equal(buildModePicking(state), true);
    assert.equal(buildModeEnvironment(state), null,
        'the built world it reopens straight onto arrives with the built world');
});

test('a state nothing holds is read as closed rather than thrown over', () => {
    for (const nothing of [null, undefined, {}]) {
        assert.equal(buildModeShowing(nothing), false);
        assert.equal(buildModePicking(nothing), false);
        assert.equal(buildModeDrawing(nothing), false);
        assert.equal(buildModeEnvironment(nothing), null);
        assert.equal(buildModeFrom(nothing), null);
    }
});

// --- The way in ----------------------------------------------------------

test('the builder opens on L, which is the key that already meant edit the world', () => {
    assert.deepEqual(BUILDER_OPEN_KEYS, ['KeyL']);
    for (const code of BUILDER_OPEN_KEYS) assert.ok(isBuilderOpenKey(code));
    assert.equal(isBuilderOpenKey('KeyZ'), false);
});

// The key the builder opens on cannot be a key that already does something, or
// the pilot who reaches for it pitches the aircraft instead.
test('the key that opens the builder is a key nothing else has taken', () => {
    const taken = new Set([
        ...Object.values(DEFAULT_KEYMAP).flat(),
        ...RESET_KEYS, ...SETTINGS_OPEN_KEYS,
        HELP_KEY, MUTE_KEY, HUD_TOGGLE_KEY, PAUSE_KEY, PHOTO_KEY, CAMERA_CYCLE_KEY
    ]);

    for (const code of BUILDER_OPEN_KEYS) {
        assert.ok(!taken.has(code), `${code} already does something else`);
    }
});

/**
 * And the guard that keeps a control surface off it says what the key is now
 * doing rather than what it used to do.
 *
 * The notice a refused row shows is built from that role, so a key whose job
 * has moved and whose role has not is a panel telling the pilot `L IS ELEMENT
 * EDITOR` about a key that opens the builder.
 */
test('the reserved-key guard says the builder is what L is already doing', () => {
    for (const code of BUILDER_OPEN_KEYS) {
        assert.equal(isReservedKey(code), true, `${code} is read by the game`);
        assert.equal(reservedRole(code), 'ENVIRONMENT BUILDER');
    }
});

// --- The way out ---------------------------------------------------------

test('the picker is backed out of the way every other panel is', () => {
    assert.deepEqual(PICKER_CLOSE_KEYS, ['Escape', 'Backspace']);
    for (const code of PICKER_CLOSE_KEYS) assert.ok(isPickerCloseKey(code));
    assert.equal(isPickerCloseKey('KeyZ'), false);
});

/**
 * A canvas is left by Escape alone. Backspace is kept for deleting a placement,
 * which is what the key labelled delete on a Mac is - and a key that left the
 * builder in one press is the worst key to share with a delete.
 */
test('a canvas is left by Escape and not by Backspace', () => {
    assert.deepEqual(CANVAS_LEAVE_KEYS, ['Escape']);
    assert.ok(isCanvasLeaveKey('Escape'));
    assert.equal(isCanvasLeaveKey('Backspace'), false);
});

test('which keys leave depends on the screen the session is on', () => {
    const state = createBuildState();
    assert.equal(leavesBuilder(state, 'Escape'), false, 'a closed session has nothing to leave');

    openBuildMode(state, BUILD_FROM_TITLE);
    assert.equal(leavesBuilder(state, 'Escape'), true, 'Escape leaves the picker');
    assert.equal(leavesBuilder(state, 'Backspace'), true, 'and so does Backspace');
    assert.equal(leavesBuilder(state, 'KeyZ'), false);

    beginCanvas(state, 'highlands');
    assert.equal(leavesBuilder(state, 'Escape'), true, 'Escape leaves the canvas');
    assert.equal(leavesBuilder(state, 'Backspace'), false, 'and Backspace does not');
});

/**
 * Nothing a session could keep exists yet, so asking to leave is leaving - from
 * the picker and from a canvas alike. The confirms are asked from this same
 * call once a tool can write something worth keeping.
 */
test('asking to leave an open session leaves, from either screen', () => {
    const picking = createBuildState();
    openBuildMode(picking, BUILD_FROM_PAUSE);
    assert.deepEqual(requestLeave(picking), { leave: true });

    const drawing = createBuildState();
    openBuildMode(drawing, BUILD_FROM_TITLE);
    beginCanvas(drawing, 'blank-canvas');
    assert.deepEqual(requestLeave(drawing), { leave: true });

    assert.equal(buildModeShowing(drawing), true,
        'asking is not leaving - the caller leaves on the answer');
});

test('a session that is not open has nothing to ask about leaving', () => {
    for (const closed of [createBuildState(), null, undefined]) {
        assert.equal(requestLeave(closed), null);
    }
});

// --- The live tool -------------------------------------------------------

test('a canvas opens on Select, which is the navigation state', () => {
    const state = createBuildState();
    openBuildMode(state, BUILD_FROM_TITLE);
    assert.equal(buildModeTool(state), null, 'the picker has no tool');

    beginCanvas(state, 'highlands');
    assert.equal(buildModeTool(state), SELECT_TOOL);

    closeBuildMode(state);
    assert.equal(buildModeTool(state), null, 'and leaving takes the tool with it');
});

test('only a built tool that is a mode can be the live one', () => {
    const state = createBuildState();
    openBuildMode(state, BUILD_FROM_TITLE);
    beginCanvas(state, 'highlands');

    assert.equal(chooseBuildTool(state, ACCEPT_TOOL), false,
        'the accept tool is a way out, never the tool a canvas is worked with');
    assert.equal(buildModeTool(state), SELECT_TOOL);

    for (const id of BUILD_TOOL_IDS.filter(id => !BUILT_TOOLS.includes(id))) {
        assert.equal(chooseBuildTool(state, id), false, `${id} is not built, so it cannot be chosen`);
    }
    assert.equal(chooseBuildTool(state, 'not-a-tool'), false);
    assert.equal(buildModeTool(state), SELECT_TOOL, 'and nothing refused moved the live tool');

    assert.equal(chooseBuildTool(state, SELECT_TOOL), false,
        'choosing the tool already live is not a change');
});

test('a tool is chosen on a canvas and nowhere else', () => {
    const state = createBuildState();
    assert.equal(chooseBuildTool(state, SELECT_TOOL), false);

    openBuildMode(state, BUILD_FROM_TITLE);
    assert.equal(chooseBuildTool(state, SELECT_TOOL), false, 'the picker has no tool to change');
    assert.equal(state.tool, null);
});

// One name, spelled with the second N, on the entry and on the picker it opens.
test('the builder has one name and one id', () => {
    assert.equal(BUILDER_LABEL, 'INTERACTIVE ENVIRONMENT BUILDER');
    assert.equal(BUILDER_ENTRY_ID, 'build');
});

// --- The draft and the built world ---------------------------------------------

/** A session open on a canvas, which is where an edit can be made. */
function onCanvas() {
    const state = createBuildState();
    openBuildMode(state, BUILD_FROM_TITLE);
    beginCanvas(state, 'blank-canvas');
    return state;
}

const PEAK = { type: 'mountain', config: { count: 1, height: [300, 300] }, footprint: { kind: 'disc', x: 100, z: -200, radius: 600 } };
const MEADOW = { type: 'grass', config: { band: [0, 400] }, footprint: { kind: 'rect', x: -900, z: 400, width: 800, depth: 500 } };

test('a canvas opens with nothing built and nothing pending', () => {
    const state = onCanvas();
    assert.equal(draftPending(state), false);
    assert.equal(buildDraft(state), null);
    assert.deepEqual(committedPlacements(state), []);
    assert.deepEqual(builtPlacements(state), []);
});

/**
 * The rule the plan takes directly from the twelve configurations: an accept
 * always commits and a cancel always discards, whatever tool drew the draft.
 */
test('an accept always commits and a cancel always discards, whatever drew the draft', () => {
    for (const placement of [PEAK, MEADOW, { type: 'water', config: { level: 30 } }]) {
        const kept = onCanvas();
        startDraft(kept, placement);
        assert.deepEqual(acceptDraft(kept), placement, `${placement.type}: the accept returns what it committed`);
        assert.deepEqual(committedPlacements(kept), [placement]);
        assert.equal(draftPending(kept), false, 'and nothing is pending after it');

        const dropped = onCanvas();
        startDraft(dropped, placement);
        assert.equal(cancelDraft(dropped), true);
        assert.deepEqual(committedPlacements(dropped), [], `${placement.type}: the cancel keeps nothing`);
        assert.equal(draftPending(dropped), false);
    }
});

test('with nothing pending, accept and cancel change nothing', () => {
    const state = onCanvas();
    startDraft(state, PEAK);
    acceptDraft(state);

    assert.equal(acceptDraft(state), null);
    assert.equal(cancelDraft(state), false);
    assert.deepEqual(committedPlacements(state), [PEAK]);
});

/**
 * A panel steps a value and steps it again before anything is committed, so
 * the draft has to survive being changed: the same edit, with the new value in
 * it, standing on the same placement.
 */
test('a draft survives a range being stepped, and carries the step', () => {
    const state = onCanvas();
    startDraft(state, PEAK);

    reviseDraft(state, { config: { height: [300, 420] } });
    reviseDraft(state, { config: { girth: 0.5 } });
    assert.equal(draftPending(state), true);
    assert.deepEqual(buildDraft(state).config, { count: 1, height: [300, 420], girth: 0.5 },
        'each step lands on what the one before it left');
    assert.deepEqual(buildDraft(state).footprint, PEAK.footprint, 'and the footprint is where it was');

    reviseDraft(state, { footprint: { kind: 'disc', x: 0, z: 0, radius: 900 } });
    assert.equal(buildDraft(state).footprint.radius, 900, 'a new footprint replaces the old one');

    acceptDraft(state);
    assert.deepEqual(committedPlacements(state)[0].config.height, [300, 420], 'and what is committed is the stepped edit');
});

test('one edit at a time: a second draft waits for the first to be settled', () => {
    const state = onCanvas();
    assert.equal(startDraft(state, PEAK), true);
    assert.equal(startDraft(state, MEADOW), false);
    assert.equal(buildDraft(state).type, 'mountain', 'the first edit is the one still in hand');
});

test('an edit is made on a canvas and of a placement, and nowhere else', () => {
    const closed = createBuildState();
    assert.equal(startDraft(closed, PEAK), false, 'not with the builder closed');

    const picking = createBuildState();
    openBuildMode(picking, BUILD_FROM_TITLE);
    assert.equal(startDraft(picking, PEAK), false, 'not on the picker');

    const state = onCanvas();
    for (const nothing of [null, {}, { type: '' }, { type: 'grass', config: 7 }, 'grass']) {
        assert.equal(startDraft(state, nothing), false, `${JSON.stringify(nothing)} is not a placement`);
    }
});

test('the session keeps its own copy of what it was handed', () => {
    const state = onCanvas();
    const handed = structuredClone(PEAK);
    startDraft(state, handed);

    handed.config.count = 99;
    handed.footprint.radius = 1;
    assert.equal(buildDraft(state).config.count, 1);
    assert.equal(buildDraft(state).footprint.radius, 600);

    acceptDraft(state);
    committedPlacements(state)[0].config.count = 42;
    assert.equal(committedPlacements(state)[0].config.count, 1, 'and nothing read back writes into it');
});

test('the world is drawn from what is committed with the edit in hand shown after it', () => {
    const state = onCanvas();
    startDraft(state, PEAK);
    acceptDraft(state);
    startDraft(state, MEADOW);

    assert.deepEqual(builtPlacements(state), [PEAK, MEADOW], 'what an accept would keep');
    assert.deepEqual(committedPlacements(state), [PEAK], 'while only the first is committed');
});

// --- Re-editing a committed placement --------------------------------------------

function withTwo() {
    const state = onCanvas();
    startDraft(state, PEAK);
    acceptDraft(state);
    startDraft(state, MEADOW);
    acceptDraft(state);
    return state;
}

/**
 * The row of the re-edit table that deletes a mountain if it is wrong: cancel
 * an edit to something already committed, and the original is still there,
 * exactly as it was committed.
 */
test('cancelling an edit to a committed placement leaves the original exactly as it was', () => {
    const state = withTwo();
    assert.equal(pickUpPlacement(state, 0), true);

    reviseDraft(state, { config: { height: [900, 1100] }, footprint: { kind: 'disc', x: 3000, z: 3000, radius: 50 } });
    assert.equal(cancelDraft(state), true);

    assert.deepEqual(committedPlacements(state), [PEAK, MEADOW], 'both still there, and the first unchanged');
});

test('accepting an edit to a committed placement swaps it rather than adding a second', () => {
    const state = withTwo();
    pickUpPlacement(state, 1);
    reviseDraft(state, { config: { band: [0, 120] } });
    acceptDraft(state);

    const placements = committedPlacements(state);
    assert.equal(placements.length, 2, 'a changed meadow is one meadow, not two');
    assert.deepEqual(placements[0], PEAK, 'the other placement is untouched');
    assert.deepEqual(placements[1].config.band, [0, 120], 'and the meadow carries the change');
    assert.deepEqual(placements[1].footprint, MEADOW.footprint);
});

test('while it is being edited a placement is shown as the edit, in its own place', () => {
    const state = withTwo();
    pickUpPlacement(state, 0);
    reviseDraft(state, { config: { girth: 0.8 } });

    const shown = builtPlacements(state);
    assert.equal(shown.length, 2, 'shown in place of the original, not beside it');
    assert.equal(shown[0].config.girth, 0.8);
    assert.deepEqual(shown[1], MEADOW);
});

test('only a placement that was committed can be picked up', () => {
    const state = withTwo();
    for (const index of [-1, 2, 0.5, null, '0']) {
        assert.equal(pickUpPlacement(state, index), false, `${index} names no committed placement`);
    }
    assert.equal(pickUpPlacement(state, 1), true);
    assert.equal(pickUpPlacement(state, 0), false, 'and not while another edit is in hand');
});

// --- What a pending edit asks of leaving and of a tool change ----------------------

test('leaving with an edit pending asks ACCEPT EDITS rather than dropping it', () => {
    const state = onCanvas();
    startDraft(state, PEAK);
    assert.deepEqual(requestLeave(state), { confirm: ACCEPT_EDITS });
    assert.equal(draftPending(state), true, 'asking is not answering: the edit is still in hand');

    acceptDraft(state);
    assert.deepEqual(requestLeave(state), { leave: true }, 'and with nothing pending it leaves');
});

test('a tool change waits while an edit is pending, leaving the edit where it was', () => {
    const state = onCanvas();
    startDraft(state, PEAK);
    state.tool = 'mountain';

    assert.equal(chooseBuildTool(state, SELECT_TOOL), false);
    assert.equal(buildModeTool(state), 'mountain', 'the tool has not changed');
    assert.deepEqual(buildDraft(state), PEAK, 'and the edit is neither kept nor dropped by the click');

    cancelDraft(state);
    assert.equal(chooseBuildTool(state, SELECT_TOOL), true, 'once it is settled, the tool changes');
});

test('a canvas begun from the picker begins from nothing built', () => {
    const state = withTwo();
    startDraft(state, PEAK);
    closeBuildMode(state);
    openBuildMode(state, BUILD_FROM_TITLE);
    beginCanvas(state, 'highlands');

    assert.deepEqual(committedPlacements(state), []);
    assert.equal(draftPending(state), false);
});

// --- The twelve, and which of them mind the lasso ---------------------------------

/** The tour's own table, written out once here so the declarations are held to it. */
const TOUR_MINDS_LASSO = {
    select: false, lasso: false, mountain: true, grass: true, sand: true, water: true,
    snow: true, runway: false, paint: true, erase: true, extrude: true, accept: false
};

test('which tools mind the lasso is the tour\'s own column', () => {
    assert.deepEqual(Object.keys(TOUR_MINDS_LASSO), BUILD_TOOL_IDS, 'the twelve, in the tour\'s order');
    for (const tool of BUILD_TOOLS) {
        assert.equal(tool.mindsLasso, TOUR_MINDS_LASSO[tool.id], `${tool.id}`);
        assert.equal(mindsLasso(tool.id), TOUR_MINDS_LASSO[tool.id]);
    }
    assert.equal(mindsLasso('hammer'), false, 'and a name that is no tool minds nothing');
});
