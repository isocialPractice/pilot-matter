import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createBuildState, openBuildMode, closeBuildMode, buildModeShowing,
    buildModePicking, buildModeDrawing, buildModeEnvironment, buildModeFrom,
    beginCanvas, isBuilderOpenKey, isPickerCloseKey, isCanvasLeaveKey, leavesBuilder,
    requestLeave, buildModeTool, chooseBuildTool,
    draftPending, buildDraft, committedPlacements, startDraft, pickUpPlacement,
    reviseDraft, acceptDraft, cancelDraft, builtPlacements, ACCEPT_EDITS, SAVE_AND_EXIT,
    confirmOpen, buildConfirm, answerConfirm, acceptToolName, dropDraft, placementSeed,
    toolStartValues, CONFIRM_ENTRIES, CONFIRM_HEADINGS, CONFIRM_YES, CONFIRM_NO, CONFIRM_STAY,
    selectPlacement, pickedIndex, pickablePlacements, editPending, samePlacement,
    ACCEPTED, CANCELLED,
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
import { getElement, resolveConfig } from '../js/environment/elements.js';

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
 * The picker is a panel with nothing built on it, so asking to leave it is
 * leaving. A canvas always asks: with nothing in hand the question is
 * `SAVE AND EXIT MODE`, whether or not anything was built - the select
 * walkthrough states that branch - so a key that leaves a canvas is never a
 * key that leaves in one press.
 */
test('asking to leave the picker leaves, and asking to leave a canvas asks', () => {
    const picking = createBuildState();
    openBuildMode(picking, BUILD_FROM_PAUSE);
    assert.deepEqual(requestLeave(picking), { leave: true });
    assert.equal(confirmOpen(picking), false, 'the picker asks nothing');

    const drawing = createBuildState();
    openBuildMode(drawing, BUILD_FROM_TITLE);
    beginCanvas(drawing, 'blank-canvas');
    assert.deepEqual(requestLeave(drawing), { confirm: SAVE_AND_EXIT },
        'a canvas with nothing built still asks whether to save');
    assert.equal(buildConfirm(drawing), SAVE_AND_EXIT);

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

    answerConfirm(state, CONFIRM_STAY);
    acceptDraft(state);
    assert.deepEqual(requestLeave(state), { confirm: SAVE_AND_EXIT },
        'and with nothing pending it asks whether to save and leave');
});

test('a tool change asks while an edit is pending, leaving the edit and the tool where they were', () => {
    const state = onCanvas();
    startDraft(state, PEAK);
    state.tool = 'mountain';

    assert.equal(chooseBuildTool(state, SELECT_TOOL), false);
    assert.equal(buildConfirm(state), ACCEPT_EDITS, 'the change asks ACCEPT EDITS');
    assert.equal(buildModeTool(state), 'mountain', 'the tool has not changed - nor its panel');
    assert.deepEqual(buildDraft(state), PEAK, 'and the edit is neither kept nor dropped by the click');

    answerConfirm(state, CONFIRM_STAY);
    cancelDraft(state);
    assert.equal(chooseBuildTool(state, SELECT_TOOL), true, 'once it is settled, the tool changes');
    assert.equal(confirmOpen(state), false, 'asking nothing');
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

// --- The two confirms ---------------------------------------------------------------

/** A canvas with Mountain live and a mountain dropped at the middle of it. */
function withMountainDropped() {
    const state = onCanvas();
    chooseBuildTool(state, 'mountain');
    dropDraft(state, { x: 0, y: 40, z: 0 });
    return state;
}

test('a confirm is headed in the artwork\'s words and opens on YES', () => {
    assert.deepEqual(CONFIRM_HEADINGS, { [ACCEPT_EDITS]: 'ACCEPT EDITS', [SAVE_AND_EXIT]: 'SAVE AND EXIT MODE' });
    assert.deepEqual(CONFIRM_ENTRIES.map(entry => entry.id), [CONFIRM_YES, CONFIRM_NO],
        'YES first, so Enter on a confirm just opened keeps the work');
    assert.deepEqual(CONFIRM_ENTRIES.map(entry => entry.label), ['YES', 'NO']);
});

test('YES on ACCEPT EDITS from the way out commits the edit and stays, so accepting is never leaving', () => {
    const state = withMountainDropped();
    requestLeave(state);

    const answered = answerConfirm(state, CONFIRM_YES);
    assert.deepEqual(answered, { settled: ACCEPTED, tool: 'mountain', picked: null });
    assert.equal(buildModeDrawing(state), true, 'still on the canvas');
    assert.equal(confirmOpen(state), false);
    assert.equal(committedPlacements(state).length, 1, 'the mountain is kept');
    assert.equal(buildModeTool(state), 'mountain', 'and the tool is the one it was');

    assert.deepEqual(requestLeave(state), { confirm: SAVE_AND_EXIT },
        'only the next ask, with nothing in hand, reaches SAVE AND EXIT MODE');
});

test('NO on ACCEPT EDITS from the way out drops the edit and stays', () => {
    const state = withMountainDropped();
    requestLeave(state);

    assert.deepEqual(answerConfirm(state, CONFIRM_NO), { settled: CANCELLED, tool: 'mountain', picked: null });
    assert.equal(buildModeDrawing(state), true);
    assert.equal(draftPending(state), false);
    assert.deepEqual(committedPlacements(state), [], 'nothing was there before, so nothing is');
});

test('a confirm called off settles nothing, and anything but YES or NO calls it off', () => {
    for (const answer of [CONFIRM_STAY, 'maybe', undefined, null, 'YES']) {
        const state = withMountainDropped();
        const draft = buildDraft(state);
        chooseBuildTool(state, SELECT_TOOL);

        assert.deepEqual(answerConfirm(state, answer), { stay: true }, `${answer} calls it off`);
        assert.equal(confirmOpen(state), false);
        assert.deepEqual(buildDraft(state), draft, 'the edit is still in hand');
        assert.equal(buildModeTool(state), 'mountain', 'and the tool is still the one it was');
    }
});

test('YES on a tool change commits and changes, and NO drops and changes', () => {
    const kept = withMountainDropped();
    chooseBuildTool(kept, SELECT_TOOL);
    assert.deepEqual(answerConfirm(kept, CONFIRM_YES), { settled: ACCEPTED, tool: SELECT_TOOL, picked: null });
    assert.equal(buildModeTool(kept), SELECT_TOOL);
    assert.equal(committedPlacements(kept).length, 1);

    const dropped = withMountainDropped();
    chooseBuildTool(dropped, SELECT_TOOL);
    assert.deepEqual(answerConfirm(dropped, CONFIRM_NO), { settled: CANCELLED, tool: SELECT_TOOL, picked: null },
        'the click on the tile already said where the pilot is going');
    assert.equal(buildModeTool(dropped), SELECT_TOOL);
    assert.deepEqual(committedPlacements(dropped), []);
});

test('SAVE AND EXIT MODE leaves either way, YES keeping what was built and NO not', () => {
    const state = withMountainDropped();
    acceptDraft(state);
    requestLeave(state);

    const yes = answerConfirm(state, CONFIRM_YES);
    assert.equal(yes.leave, true);
    assert.equal(yes.keep, true);
    assert.equal(yes.environment, 'blank-canvas');
    assert.deepEqual(yes.placements, committedPlacements(state));
    yes.placements[0].config.count = 99;
    assert.equal(committedPlacements(state)[0].config.count, 1, 'what is handed back to keep is a copy');

    requestLeave(state);
    const no = answerConfirm(state, CONFIRM_NO);
    assert.equal(no.leave, true);
    assert.equal(no.keep, false);
});

test('nothing is answered when nothing was asked', () => {
    assert.equal(answerConfirm(onCanvas(), CONFIRM_YES), null);
    assert.equal(answerConfirm(createBuildState(), CONFIRM_YES), null);
    assert.equal(answerConfirm(null, CONFIRM_YES), null);
});

test('a confirm open holds every other change still', () => {
    const state = withMountainDropped();
    requestLeave(state);
    const draft = buildDraft(state);

    assert.equal(requestLeave(state), null, 'Escape again asks nothing new');
    assert.equal(buildConfirm(state), ACCEPT_EDITS, 'and leaves the question that was asked');
    assert.equal(chooseBuildTool(state, SELECT_TOOL), false);
    assert.equal(dropDraft(state, { x: 500, z: 500 }), false);
    assert.deepEqual(buildDraft(state), draft, 'nothing moved the edit');
    assert.equal(buildModeTool(state), 'mountain');

    answerConfirm(state, CONFIRM_YES);
    assert.equal(buildModeTool(state), 'mountain',
        'a tile clicked under the confirm did not turn its way back to the editor into a tool change');

    requestLeave(state);
    assert.equal(buildConfirm(state), SAVE_AND_EXIT);
    assert.equal(chooseBuildTool(state, SELECT_TOOL), false, 'with nothing in hand, a tile still waits on the answer');
    assert.equal(buildModeTool(state), 'mountain');
    assert.equal(startDraft(state, PEAK), false, 'nor begins one');
    assert.equal(pickUpPlacement(state, 0), false, 'nor picks one up');
});

test('a confirm does not outlive the session it was asked in', () => {
    const state = withMountainDropped();
    requestLeave(state);
    closeBuildMode(state);
    assert.equal(confirmOpen(state), false);

    openBuildMode(state, BUILD_FROM_TITLE);
    assert.equal(confirmOpen(state), false);
});

test('the accept tool is named for the question it will ask', () => {
    const state = onCanvas();
    assert.equal(acceptToolName(state), 'Save and exit');

    chooseBuildTool(state, 'mountain');
    dropDraft(state, { x: 0, z: 0 });
    assert.equal(acceptToolName(state), 'Accept edits');

    acceptDraft(state);
    assert.equal(acceptToolName(state), 'Save and exit',
        'a batch kept earlier does nothing to the name while nothing newer is in hand');
});

// --- A click that drops ---------------------------------------------------------------

test('a click with Mountain begins a mountain there, one peak, with a seed of its own', () => {
    const state = onCanvas();
    chooseBuildTool(state, 'mountain');

    assert.equal(dropDraft(state, { x: 1234.4, y: 80, z: -0.3 }), true);
    const draft = buildDraft(state);
    assert.equal(draft.type, 'mountain');
    assert.deepEqual(draft.config, { count: 1, at: [1234, 0] },
        'the click rounded to a whole unit - and -0 written 0 - with the count the click settles');
    assert.ok(Object.is(draft.config.at[1], 0));
    assert.equal(draft.seed, placementSeed(0));
    assert.equal(state.draft.tool, 'mountain', 'and the tool that began it is remembered');
    assert.equal(state.draft.replaces, null, 'on bare ground');
});

test('a click drops nothing for a tool that does not drop, or off the ground', () => {
    const selecting = onCanvas();
    assert.equal(dropDraft(selecting, { x: 0, z: 0 }), false, 'Select does not drop');

    const state = onCanvas();
    chooseBuildTool(state, 'mountain');
    for (const point of [null, undefined, {}, { x: NaN, z: 0 }, { x: 0 }, { x: Infinity, z: 0 }]) {
        assert.equal(dropDraft(state, point), false, `${JSON.stringify(point)} is not on the ground`);
    }
    assert.equal(draftPending(state), false);

    const picking = createBuildState();
    openBuildMode(picking, BUILD_FROM_TITLE);
    assert.equal(dropDraft(picking, { x: 0, z: 0 }), false, 'nor off a canvas');
});

test('a click with the mountain in hand puts it down there instead of adding another', () => {
    const state = withMountainDropped();
    reviseDraft(state, { config: { height: [900, 900] } });
    const seed = buildDraft(state).seed;

    assert.equal(dropDraft(state, { x: -2500, z: 3100 }), true);
    const draft = buildDraft(state);
    assert.deepEqual(draft.config.at, [-2500, 3100], 'it moved');
    assert.deepEqual(draft.config.height, [900, 900], 'with what the panel set on it');
    assert.equal(draft.seed, seed, 'and the same seed, so it is the same mountain moved');
    assert.deepEqual(committedPlacements(state), [], 'nothing was kept by the second click');
    assert.equal(builtPlacements(state).length, 1, 'and there is still one mountain');
});

test('a click does not move an edit the tool did not begin', () => {
    const state = withTwo();
    pickUpPlacement(state, 0);
    state.tool = 'mountain';
    const draft = buildDraft(state);

    assert.equal(dropDraft(state, { x: 10, z: 10 }), false);
    assert.deepEqual(buildDraft(state), draft);
});

test('each mountain dropped draws from a stream of its own', () => {
    const state = withMountainDropped();
    acceptDraft(state);
    dropDraft(state, { x: 100, z: 100 });
    cancelDraft(state);
    dropDraft(state, { x: 200, z: 200 });

    assert.equal(committedPlacements(state)[0].seed, placementSeed(0));
    assert.equal(buildDraft(state).seed, placementSeed(2), 'a dropped edit cancelled still used its seed');
});

test('a placement seed is a 32-bit count mixed so neighbours are unrelated', () => {
    const seeds = Array.from({ length: 1000 }, (_, n) => placementSeed(n));
    assert.equal(new Set(seeds).size, seeds.length, 'every one distinct');
    for (const seed of seeds) assert.ok(Number.isInteger(seed) && seed >= 0 && seed < 2 ** 32);
    assert.equal(placementSeed(7), placementSeed(7), 'and the same count is the same seed');
    assert.ok(seeds.slice(0, 8).every(seed => seed > 2 ** 16),
        'none of the first few is the small number that would start a stream near zero');
});

// --- The panel carried to the next draft --------------------------------------------

test('the next mountain starts from where the panel was left, and not from where the last one stood', () => {
    const state = withMountainDropped();
    reviseDraft(state, { config: { height: [700, 900], girth: 0.4 } });
    acceptDraft(state);

    assert.deepEqual(toolStartValues(state, 'mountain'), { count: 1, height: [700, 900], girth: 0.4 });

    dropDraft(state, { x: 3000, z: -3000 });
    assert.deepEqual(buildDraft(state).config, { count: 1, height: [700, 900], girth: 0.4, at: [3000, -3000] });
});

test('a mountain cancelled leaves its panel for the next one too', () => {
    const state = withMountainDropped();
    reviseDraft(state, { config: { radius: [2000, 2400] } });
    cancelDraft(state);

    dropDraft(state, { x: 50, z: 50 });
    assert.deepEqual(buildDraft(state).config.radius, [2000, 2400]);
});

test('an edit picked up again is not a tool\'s panel to carry', () => {
    const state = withTwo();
    pickUpPlacement(state, 0);
    reviseDraft(state, { config: { height: [1, 1] } });
    acceptDraft(state);
    assert.deepEqual(toolStartValues(state, 'mountain'), {});
});

test('what a tool starts from is a copy, and a new canvas starts from the defaults', () => {
    const state = withMountainDropped();
    reviseDraft(state, { config: { height: [700, 900] } });
    acceptDraft(state);

    toolStartValues(state, 'mountain').height[0] = 1;
    assert.deepEqual(toolStartValues(state, 'mountain').height, [700, 900]);

    closeBuildMode(state);
    openBuildMode(state, BUILD_FROM_TITLE);
    beginCanvas(state, 'blank-canvas');
    assert.deepEqual(toolStartValues(state, 'mountain'), {});
});

// --- A canvas opened on what was kept ---------------------------------------------

test('a canvas opens with what was kept on it already committed, as copies', () => {
    const kept = [{ ...PEAK, seed: placementSeed(0) }, MEADOW];
    const state = createBuildState();
    openBuildMode(state, BUILD_FROM_TITLE);
    beginCanvas(state, 'blank-canvas', [...kept, null, { config: {} }, 'mountain']);

    assert.deepEqual(committedPlacements(state), kept, 'anything that is not a placement is left out');
    committedPlacements(state)[0].config.count = 99;
    assert.equal(committedPlacements(state)[0].config.count, 1);

    chooseBuildTool(state, 'mountain');
    dropDraft(state, { x: 0, z: 0 });
    assert.equal(buildDraft(state).seed, placementSeed(2),
        'seeds count on from what it opened with');
});

// --- Picking a built element with Select ----------------------------------------

/** A canvas with two placements committed and Select live, which is where a pick is made. */
function withTwoToPick() {
    const state = withTwo();
    chooseBuildTool(state, SELECT_TOOL);
    return state;
}

test('a click on a placement picks it, as an edit standing on it', () => {
    const state = withTwoToPick();

    assert.deepEqual(selectPlacement(state, 1), { picked: 1 });
    assert.equal(pickedIndex(state), 1);
    assert.deepEqual(buildDraft(state), MEADOW, 'the draft is the placement as it was committed');
    assert.equal(state.draft.replaces, 1, 'and stands on it, so accepting changes it rather than adding one');
    assert.equal(editPending(state), false, 'but nothing has been done to it yet');
    assert.deepEqual(committedPlacements(state), [PEAK, MEADOW], 'and the committed list is untouched');
});

test('a second click on the picked placement keeps it, rather than letting it go', () => {
    const state = withTwoToPick();
    selectPlacement(state, 0);

    assert.equal(selectPlacement(state, 0), null, 'nothing changes');
    assert.equal(pickedIndex(state), 0, 'and it is still picked');
});

test('a click on another placement picks that one instead', () => {
    const state = withTwoToPick();
    selectPlacement(state, 0);

    assert.deepEqual(selectPlacement(state, 1), { picked: 1 });
    assert.equal(pickedIndex(state), 1);
    assert.equal(confirmOpen(state), false, 'without asking, because the first was not changed');
});

test('a click on bare ground lets go of the pick, and with nothing picked does nothing', () => {
    const state = withTwoToPick();
    assert.equal(selectPlacement(state, null), null, 'nothing picked, nothing to let go');

    selectPlacement(state, 1);
    assert.deepEqual(selectPlacement(state, null), { picked: null });
    assert.equal(draftPending(state), false);
    assert.equal(selectPlacement(state, 7), null, 'an index nothing is committed at is bare ground');
});

test('only Select picks, only on a canvas, and never under a question', () => {
    const mountain = withTwo();
    chooseBuildTool(mountain, 'mountain');
    assert.equal(selectPlacement(mountain, 0), null, 'a click with Mountain drops one rather than picking');
    assert.equal(draftPending(mountain), false);

    const asking = withTwoToPick();
    requestLeave(asking);
    assert.equal(selectPlacement(asking, 0), null);
    assert.equal(pickedIndex(asking), null);

    const picker = createBuildState();
    openBuildMode(picker, BUILD_FROM_TITLE);
    assert.equal(selectPlacement(picker, 0), null);
});

/**
 * A pick that was changed is work in hand, and letting it go decides what
 * happens to that work - so it is asked about, the way a tool change asks.
 */
test('letting go of a changed pick asks ACCEPT EDITS first, holding where the click was going', () => {
    const state = withTwoToPick();
    selectPlacement(state, 0);
    reviseDraft(state, { config: { height: [900, 900] } });
    assert.equal(editPending(state), true);

    assert.deepEqual(selectPlacement(state, 1), { confirm: ACCEPT_EDITS });
    assert.equal(pickedIndex(state), 0, 'the changed pick is still in hand while it is asked about');

    assert.deepEqual(answerConfirm(state, CONFIRM_YES), { settled: ACCEPTED, tool: SELECT_TOOL, picked: 1 },
        'YES keeps the change, then picks the one the click was on');
    assert.deepEqual(committedPlacements(state)[0].config.height, [900, 900]);
    assert.deepEqual(buildDraft(state), MEADOW);
});

test('NO drops the change and goes on; calling it off keeps the change in hand', () => {
    const dropped = withTwoToPick();
    selectPlacement(dropped, 0);
    reviseDraft(dropped, { config: { height: [900, 900] } });
    selectPlacement(dropped, null);
    assert.deepEqual(answerConfirm(dropped, CONFIRM_NO), { settled: CANCELLED, tool: SELECT_TOOL, picked: null },
        'a click on bare ground, once answered, leaves nothing picked');
    assert.deepEqual(committedPlacements(dropped), [PEAK, MEADOW], 'and the placement is as it was committed');

    const stayed = withTwoToPick();
    selectPlacement(stayed, 0);
    reviseDraft(stayed, { config: { height: [900, 900] } });
    selectPlacement(stayed, 1);
    assert.deepEqual(answerConfirm(stayed, CONFIRM_STAY), { stay: true });
    assert.equal(pickedIndex(stayed), 0);
    assert.deepEqual(buildDraft(stayed).config.height, [900, 900]);
});

/**
 * An edit nothing was done to is not an edit: the dock writes a placement's
 * whole configuration back as it is stepped, and stepping a value away and
 * back is the placement it was.
 */
test('a pick is changed only when what it draws changed', () => {
    const state = withTwoToPick();
    selectPlacement(state, 0);

    reviseDraft(state, { config: resolveConfig(getElement('mountain'), PEAK.config) });
    assert.equal(editPending(state), false, 'the defaults written out in full are no change');

    reviseDraft(state, { config: { height: [300, 310] } });
    assert.equal(editPending(state), true);
    reviseDraft(state, { config: { height: [300, 300] } });
    assert.equal(editPending(state), false, 'and a value stepped away and back is none either');

    assert.equal(samePlacement(PEAK, { ...PEAK, seed: 5 }), false, 'a different seed is different ground');
    assert.equal(samePlacement(PEAK, { ...PEAK, footprint: { ...PEAK.footprint, radius: 700 } }), false);
    assert.equal(samePlacement(null, null), true);
    assert.equal(samePlacement(PEAK, null), false);
});

test('a placement drawn on bare ground is always work in hand', () => {
    const state = withMountainDropped();
    assert.equal(editPending(state), true);
    assert.equal(pickedIndex(state), null, 'and is not a pick');
});

test('an untouched pick asks nothing: the way out asks to save, and a tool change just changes', () => {
    const leaving = withTwoToPick();
    selectPlacement(leaving, 1);
    assert.equal(acceptToolName(leaving), 'Save and exit');
    assert.deepEqual(requestLeave(leaving), { confirm: SAVE_AND_EXIT });

    const changing = withTwoToPick();
    selectPlacement(changing, 1);
    assert.equal(chooseBuildTool(changing, 'mountain'), true, 'the tool changes at once');
    assert.equal(draftPending(changing), false, 'and the pick is let go of');
    assert.equal(confirmOpen(changing), false);
});

test('a changed pick asks before the way out or a tool change, like any edit', () => {
    const state = withTwoToPick();
    selectPlacement(state, 1);
    reviseDraft(state, { config: { band: [0, 600] } });

    assert.equal(acceptToolName(state), 'Accept edits');
    assert.equal(chooseBuildTool(state, 'mountain'), false);
    assert.equal(buildConfirm(state), ACCEPT_EDITS);
});

test('a pick looks through the committed placements as they stand, the picked one with its changes', () => {
    const state = withTwoToPick();
    selectPlacement(state, 0);
    reviseDraft(state, { config: { height: [900, 900] } });

    const shown = pickablePlacements(state);
    assert.equal(shown.length, 2);
    assert.deepEqual(shown[0].config.height, [900, 900], 'its reach is the ground on the canvas');
    assert.deepEqual(shown[1], MEADOW);

    const drawing = withMountainDropped();
    assert.deepEqual(pickablePlacements(drawing), [], 'and a placement not yet committed is not one to pick');
});

// --- Back to the built world --------------------------------------------------------

test('a builder with a built world to go back to opens on it, with no picker', () => {
    const state = createBuildState();
    openBuildMode(state, BUILD_FROM_PAUSE, { environment: 'blank-canvas', placements: [PEAK, MEADOW] });

    assert.equal(buildModeDrawing(state), true, 'straight onto the canvas');
    assert.equal(buildModePicking(state), false);
    assert.equal(buildModeEnvironment(state), 'blank-canvas');
    assert.equal(buildModeFrom(state), BUILD_FROM_PAUSE, 'still returning to what opened it');
    assert.equal(buildModeTool(state), SELECT_TOOL, 'looking at it');
    assert.deepEqual(committedPlacements(state), [PEAK, MEADOW], 'with every placement it had committed');

    assert.deepEqual(selectPlacement(state, 0), { picked: 0 }, 'each one still a placement that can be picked up');
    reviseDraft(state, { config: { height: [500, 500] } });
    acceptDraft(state);
    assert.deepEqual(committedPlacements(state)[0].config.height, [500, 500], 'and changed');
});

test('a builder with nothing built opens on the picker, as the first session does', () => {
    const state = createBuildState();
    openBuildMode(state, BUILD_FROM_TITLE, null);
    assert.equal(buildModePicking(state), true);
    assert.deepEqual(committedPlacements(state), []);
});
