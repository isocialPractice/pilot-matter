import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
    createHistory, clearHistory, pushHistory, endHistoryRun, stepBack, stepForward,
    canUndo, canRedo, historyDepth, historyKey,
    HISTORY_LIMIT, HISTORY_UNDO, HISTORY_REDO, UNDO_COMBOS, REDO_COMBOS
} from '../js/build-history.js';
import {
    createBuildState, openBuildMode, beginCanvas, loadCanvas, chooseBuildTool,
    dropDraft, acceptDraft, cancelDraft, selectPlacement, pickedIndex, reviseDraft,
    committedPlacements, buildDraft, layStroke, requestLeave, answerConfirm,
    undoBuild, redoBuild, canUndoBuild, canRedoBuild, markBuildEdit, endBuildEditRun,
    buildHistoryDepth, worldSnapshot, setBuildStartPoint, turnBuildStartPoint, chooseBuildPlane,
    buildStartPoint, buildPlane, setAssetLibrary, removeAssetFromCanvas, worldRows,
    BUILD_FROM_TITLE, CONFIRM_YES, START_RUN
} from '../js/build-mode.js';
import {
    dockBar, dockContent, DOCK_UNDO, DOCK_REDO, DOCK_SNAP_GRID, DOCK_SNAP_ANGLE,
    BAR_SNAP_TITLES, BAR_STEP_TITLES, BAR_NOTHING_TITLES, BAR_EDIT_TITLE, BAR_CONFIRM_TITLE
} from '../js/build-panel.js';
import { SELECT_TOOL } from '../js/build-tools.js';

const SIZE = 16000;

/** A session on a canvas, with Select live, which is where every canvas opens. */
function onCanvas(environment = 'highlands') {
    const state = createBuildState();
    openBuildMode(state, BUILD_FROM_TITLE);
    beginCanvas(state, environment);
    return state;
}

/** A mountain dropped at a point, committed - one step of the history. */
function dropMountain(state, at) {
    chooseBuildTool(state, 'mountain');
    dropDraft(state, { x: at[0], z: at[1] }, { size: SIZE });
    return acceptDraft(state);
}

// --- The stack ------------------------------------------------------------------------

test('a history starts with nothing either way', () => {
    const history = createHistory();
    assert.equal(canUndo(history), false);
    assert.equal(canRedo(history), false);
    assert.deepEqual(historyDepth(history), { past: 0, future: 0 });
});

test('a step pushed is a step to go back to, and taking one offers it forward again', () => {
    const history = createHistory();
    pushHistory(history, 'first');
    pushHistory(history, 'second');
    assert.deepEqual(historyDepth(history), { past: 2, future: 0 });

    assert.equal(stepBack(history, 'now'), 'second', 'the newest step comes back first');
    assert.deepEqual(historyDepth(history), { past: 1, future: 1 });
    assert.equal(stepForward(history, 'second'), 'now', 'and what was undone comes forward');
    assert.deepEqual(historyDepth(history), { past: 2, future: 0 });
});

test('a step taken after going back drops what had been undone', () => {
    const history = createHistory();
    pushHistory(history, 'first');
    stepBack(history, 'second');
    assert.equal(canRedo(history), true);

    pushHistory(history, 'another branch');
    assert.equal(canRedo(history), false, 'the branch that was undone is not reachable from the new one');
});

test('the stack reaches only so far back, and it is the oldest step that goes', () => {
    const history = createHistory();
    for (let step = 0; step <= HISTORY_LIMIT + 5; step++) pushHistory(history, step);

    assert.equal(historyDepth(history).past, HISTORY_LIMIT);
    assert.equal(history.past[0], 6, 'the first six are gone rather than the last six refused');
    assert.equal(history.past.at(-1), HISTORY_LIMIT + 5);
});

test('nothing is pushed for no snapshot, and nothing comes back from an empty stack', () => {
    const history = createHistory();
    assert.equal(pushHistory(history, null), false);
    assert.equal(stepBack(history, 'now'), null);
    assert.equal(stepForward(history, 'now'), null);
    assert.equal(stepBack(null, 'now'), null, 'and a history that is not one answers the same');
});

/**
 * A run is what keeps a drag one step. The world before the run began is the
 * one to come back to, so the first push wins and the rest are skipped - and
 * anything else ending the run is what lets the next drag open its own step.
 */
test('a run of pushes is one step, and anything else ends the run', () => {
    const history = createHistory();
    assert.equal(pushHistory(history, 'before the drag', 'turn'), true);
    assert.equal(pushHistory(history, 'mid drag', 'turn'), false);
    assert.equal(pushHistory(history, 'later in the drag', 'turn'), false);
    assert.deepEqual(historyDepth(history), { past: 1, future: 0 });
    assert.equal(history.past[0], 'before the drag');

    endHistoryRun(history);
    assert.equal(pushHistory(history, 'the next drag', 'turn'), true, 'the run ended, so this opens a step');
    assert.deepEqual(historyDepth(history), { past: 2, future: 0 });

    assert.equal(pushHistory(history, 'something else', null), true);
    assert.equal(pushHistory(history, 'and again', 'turn'), true, 'a push naming no run ended the run too');
});

test('going back ends the run, so a drag after an undo is its own step', () => {
    const history = createHistory();
    pushHistory(history, 'before', 'turn');
    stepBack(history, 'now');
    assert.equal(pushHistory(history, 'after the undo', 'turn'), true);
});

test('a history cleared has nothing either way', () => {
    const history = createHistory();
    pushHistory(history, 'first');
    stepBack(history, 'now');
    clearHistory(history);
    assert.deepEqual(historyDepth(history), { past: 0, future: 0 });
    assert.equal(history.run, null);
});

// --- The keys -------------------------------------------------------------------------

test('Ctrl+Z goes back and either forward spelling comes on', () => {
    assert.equal(historyKey({ code: 'KeyZ', ctrlKey: true }), HISTORY_UNDO);
    assert.equal(historyKey({ code: 'KeyZ', ctrlKey: true, shiftKey: true }), HISTORY_REDO);
    assert.equal(historyKey({ code: 'KeyY', ctrlKey: true }), HISTORY_REDO);
});

test('the platform modifier is either, so a Mac reaches both with Cmd', () => {
    assert.equal(historyKey({ code: 'KeyZ', metaKey: true }), HISTORY_UNDO);
    assert.equal(historyKey({ code: 'KeyZ', metaKey: true, shiftKey: true }), HISTORY_REDO);
});

test('the key alone is not the history, so Z and Y go on being whatever else reads them', () => {
    assert.equal(historyKey({ code: 'KeyZ' }), null);
    assert.equal(historyKey({ code: 'KeyY' }), null);
    assert.equal(historyKey({ code: 'KeyZ', shiftKey: true }), null);
    assert.equal(historyKey({ code: 'KeyW', ctrlKey: true }), null, 'and a key neither table names is not it');
    assert.equal(historyKey(null), null);
});

test('the combinations are declared once and read from there', () => {
    for (const combo of UNDO_COMBOS) {
        assert.equal(historyKey({ code: combo.code, ctrlKey: combo.ctrl, shiftKey: combo.shift }), HISTORY_UNDO);
    }
    for (const combo of REDO_COMBOS) {
        assert.equal(historyKey({ code: combo.code, ctrlKey: combo.ctrl, shiftKey: combo.shift }), HISTORY_REDO);
    }
});

// --- A session walked through -----------------------------------------------------------

test('a canvas opens with nothing to go back to', () => {
    const state = onCanvas();
    assert.deepEqual(buildHistoryDepth(state), { past: 0, future: 0 });
    assert.equal(canUndoBuild(state), false);
    assert.equal(canRedoBuild(state), false);
    assert.equal(undoBuild(state), false);
    assert.equal(redoBuild(state), false);
});

/**
 * The walk the item asked for: add, move, erase, undo and redo, each expecting
 * the world back as it was. It is written against the session rather than
 * against the stack, because what has to hold is that the ground the canvas is
 * drawn from comes back - not that a snapshot was stored.
 */
test('a session walked through add, move, erase, undo and redo gets each world back as it was', () => {
    const state = onCanvas();
    const worlds = [committedPlacements(state)];

    // Add: a mountain dropped and kept.
    dropMountain(state, [1000, 1000]);
    worlds.push(committedPlacements(state));
    assert.equal(worlds[1].length, 1);

    // Move: the same mountain picked up and put somewhere else.
    chooseBuildTool(state, SELECT_TOOL);
    selectPlacement(state, 0);
    reviseDraft(state, { config: { at: [2000, 2000] } });
    acceptDraft(state);
    worlds.push(committedPlacements(state));
    assert.deepEqual(worlds[2][0].config.at, [2000, 2000], 'the move is one placement, not two');
    assert.equal(worlds[2].length, 1);

    // Erase: a stroke that takes it away, which is a placement of its own.
    chooseBuildTool(state, 'erase');
    layStroke(state, [[2000, 2000], [2200, 2000]], { width: 400, depth: 400, corner: 0 }, { size: SIZE });
    acceptDraft(state);
    worlds.push(committedPlacements(state));
    assert.equal(worlds[3].length, 2, 'the batch is committed over the mountain');

    assert.deepEqual(buildHistoryDepth(state), { past: 3, future: 0 }, 'three settled edits, three steps');

    // And back through every one of them.
    for (let back = 2; back >= 0; back--) {
        assert.equal(undoBuild(state), true, `step ${back}`);
        assert.deepEqual(committedPlacements(state), worlds[back], `the world as it stood at ${back}`);
    }
    assert.equal(canUndoBuild(state), false, 'and the canvas it opened with is as far back as it goes');

    // And forward through every one of them.
    for (let on = 1; on <= 3; on++) {
        assert.equal(redoBuild(state), true, `forward to ${on}`);
        assert.deepEqual(committedPlacements(state), worlds[on], `the world as it stood at ${on}`);
    }
    assert.equal(canRedoBuild(state), false);
});

/**
 * The gumball writes through the draft on every pointer move, and the draft is
 * not the world: the step is pushed where the draft becomes the world, which is
 * the accept. So a drag of any length is one step.
 */
test('a drag is one step however many moves it was made of, because the step is pushed at the accept', () => {
    const state = onCanvas();
    dropMountain(state, [0, 0]);
    const before = buildHistoryDepth(state).past;

    chooseBuildTool(state, SELECT_TOOL);
    selectPlacement(state, 0);
    for (let move = 1; move <= 20; move++) reviseDraft(state, { config: { at: [move * 50, 0] } });
    assert.equal(buildHistoryDepth(state).past, before, 'nothing is pushed while the draft is being written');

    acceptDraft(state);
    assert.equal(buildHistoryDepth(state).past, before + 1, 'and one step when it is settled');
    assert.deepEqual(buildDraft(state), null);
});

test('an edit cancelled is no step, because the world never changed', () => {
    const state = onCanvas();
    chooseBuildTool(state, 'mountain');
    dropDraft(state, { x: 0, z: 0 }, { size: SIZE });
    cancelDraft(state);
    assert.deepEqual(buildHistoryDepth(state), { past: 0, future: 0 });
});

/**
 * A pick is accepted the same way a changed one is - the panel carries
 * `ACCEPT` from the moment something is picked, and auto accept settles one at
 * a change of tool - so a pick looked at and accepted is an ordinary press.
 * The world it commits is the placement exactly as it was committed, which is
 * no change, so it is no step either: one would be an `UNDO` lit up with
 * nothing to show for being pressed, and the press after it would be the one
 * that took the placement away.
 */
test('a pick accepted without being touched is no step, since the world is as it was', () => {
    const state = onCanvas();
    dropMountain(state, [0, 0]);
    const before = buildHistoryDepth(state).past;
    const world = committedPlacements(state);

    chooseBuildTool(state, SELECT_TOOL);
    selectPlacement(state, 0);
    assert.notEqual(acceptDraft(state), null, 'the accept is offered on a pick, and it commits');
    assert.equal(buildHistoryDepth(state).past, before, 'and pushes nothing');
    assert.deepEqual(committedPlacements(state), world, 'because the world never moved');

    // So the one step on the stack is the drop, and the first press back is
    // the one that takes the mountain away.
    assert.equal(undoBuild(state), true);
    assert.equal(committedPlacements(state).length, 0);
});

test('an accept that pushes no step still ends the run, so the next write of the flight opens one', () => {
    const state = onCanvas();
    dropMountain(state, [0, 0]);
    setBuildStartPoint(state, [1200, -800]);
    const after = buildHistoryDepth(state).past;

    chooseBuildTool(state, SELECT_TOOL);
    selectPlacement(state, 0);
    acceptDraft(state);
    assert.equal(buildHistoryDepth(state).past, after, 'the accept is no step');

    // An accept is never part of the start point's run, so the turn after it
    // is a step of its own rather than joining the run the placement opened.
    turnBuildStartPoint(state, 90);
    assert.equal(buildHistoryDepth(state).past, after + 1, 'and the turn after it opens one');
});

test('a step is refused while an edit is in hand, which is work the pilot has not settled either way', () => {
    const state = onCanvas();
    dropMountain(state, [0, 0]);

    chooseBuildTool(state, 'mountain');
    dropDraft(state, { x: 4000, z: 4000 }, { size: SIZE });
    assert.equal(canUndoBuild(state), false, 'there is a step, and something in hand');
    assert.equal(undoBuild(state), false);
    assert.equal(committedPlacements(state).length, 1, 'and nothing moved');

    cancelDraft(state);
    assert.equal(canUndoBuild(state), true);
});

/**
 * A pick nothing has been done to is not an edit - the whole session treats it
 * that way, and a click on bare ground lets go of it without asking - so a
 * step may be taken under one, and taking it lets the pick go.
 */
test('a pick nothing was done to is let go of by a step rather than refusing it', () => {
    const state = onCanvas();
    dropMountain(state, [0, 0]);
    chooseBuildTool(state, SELECT_TOOL);
    selectPlacement(state, 0);
    assert.equal(pickedIndex(state), 0);

    assert.equal(canUndoBuild(state), true);
    assert.equal(undoBuild(state), true);
    assert.equal(pickedIndex(state), null, 'the pick went with the placement it stood on');
    assert.equal(committedPlacements(state).length, 0);
});

test('a step is refused under a question, which is the one thing the pilot has been asked', () => {
    const state = onCanvas();
    dropMountain(state, [0, 0]);
    requestLeave(state);

    assert.equal(canUndoBuild(state), false);
    assert.equal(undoBuild(state), false);
    answerConfirm(state, CONFIRM_YES);
});

test('a step is refused off a canvas, where there is no world to change', () => {
    const state = createBuildState();
    assert.equal(canUndoBuild(state), false);
    assert.equal(markBuildEdit(state), false);
    assert.equal(worldSnapshot(state), null);
    openBuildMode(state, BUILD_FROM_TITLE);
    assert.equal(worldSnapshot(state), null, 'and on the picker there is still none');
});

// --- The world's own flight -------------------------------------------------------------

test('the start point and the plane are steps of their own, since neither is a draft', () => {
    const state = onCanvas();
    setBuildStartPoint(state, [500, 500]);
    endBuildEditRun(state);
    chooseBuildPlane(state, 'bush');
    assert.deepEqual(buildHistoryDepth(state), { past: 2, future: 0 });

    assert.equal(undoBuild(state), true);
    assert.equal(buildPlane(state), null, 'the plane goes back to none');
    assert.deepEqual(buildStartPoint(state).at, [500, 500], 'and the start point is still where it was put');

    assert.equal(undoBuild(state), true);
    assert.equal(buildStartPoint(state), null);
});

/**
 * The knob is read on every pointer move, so its writes belong to one run. The
 * run is closed when the drag ends - `endBuildEditRun`, which `js/main.js`
 * calls at the pointer up - and the next drag opens a step of its own.
 */
test('a knob dragged round is one step, and the next drag is another', () => {
    const state = onCanvas();
    setBuildStartPoint(state, [0, 0]);
    endBuildEditRun(state);
    const before = buildHistoryDepth(state).past;

    for (const heading of [10, 20, 30, 40]) turnBuildStartPoint(state, heading);
    assert.equal(buildHistoryDepth(state).past, before + 1, 'four moves of one drag, one step');
    assert.equal(state.history.run, START_RUN);

    endBuildEditRun(state);
    turnBuildStartPoint(state, 90);
    assert.equal(buildHistoryDepth(state).past, before + 2);

    assert.equal(undoBuild(state), true);
    assert.equal(buildStartPoint(state).heading, 40, 'back to where the first drag left it');
});

// --- What forgets ------------------------------------------------------------------------

test('a world loaded over a canvas is not a step of the world it replaced', () => {
    const state = onCanvas();
    dropMountain(state, [0, 0]);
    assert.equal(canUndoBuild(state), true);

    assert.equal(loadCanvas(state, { environment: 'lakeside', placements: [], world: [] }, 'Sample Valley'), true);
    assert.deepEqual(buildHistoryDepth(state), { past: 0, future: 0 }, 'the loaded world has nothing behind it');
});

/**
 * An asset removed is gone from the library and from the computer, so a step
 * back across it would put back placements referring to a model nothing can
 * draw. The history forgets rather than offering a world that cannot be built.
 */
test('an asset removed from the canvas forgets the history rather than offering a world without it', () => {
    const asset = {
        id: 'asset-1', name: 'Hangar', format: 'glb', bytes: new Uint8Array([1, 2, 3]),
        scale: 1, up: 'y', facing: 'north', height: 40, uses: { object: true, runway: false, plane: false }
    };
    const state = onCanvas();
    setAssetLibrary(state, [asset]);
    dropMountain(state, [0, 0]);
    state.placements.push({ type: 'object', prefab: 'asset:asset-1', recipe: { parts: [] }, config: { at: [100, 100] } });
    assert.equal(canUndoBuild(state), true);

    assert.equal(removeAssetFromCanvas(state, 'asset-1'), true);
    assert.deepEqual(buildHistoryDepth(state), { past: 0, future: 0 });
    assert.equal(canUndoBuild(state), false);
});

test('a step puts the world rows back as well, since they are part of what a save writes', () => {
    const state = createBuildState();
    openBuildMode(state, BUILD_FROM_TITLE);
    beginCanvas(state, 'highlands', [], [{ id: 'mountain-0', type: 'mountain', config: { count: 7 } }]);
    const before = worldRows(state);
    assert.equal(before[0].config.count, 7, 'the canvas opened with the environment\'s own row');

    markBuildEdit(state);
    state.world[0].config = { ...state.world[0].config, count: 11 };
    assert.equal(undoBuild(state), true);
    assert.deepEqual(worldRows(state), before);
});

// --- The dock's bar ----------------------------------------------------------------------

test('the bar is nothing off a canvas and the four answers on one', () => {
    assert.deepEqual(dockBar(createBuildState()), []);

    const state = onCanvas();
    assert.deepEqual(dockBar(state).map(answer => answer.id),
        [DOCK_UNDO.id, DOCK_REDO.id, DOCK_SNAP_GRID.id, DOCK_SNAP_ANGLE.id]);
});

test('the bar says whether there is a step to take, which is the one place that can be seen', () => {
    const state = onCanvas();
    const read = () => Object.fromEntries(dockBar(state).map(answer => [answer.id, answer.disabled]));

    assert.equal(read()[DOCK_UNDO.id], true, 'nothing to go back to');
    assert.equal(read()[DOCK_REDO.id], true);

    dropMountain(state, [0, 0]);
    assert.equal(read()[DOCK_UNDO.id], false);
    assert.equal(read()[DOCK_REDO.id], true, 'and nothing has been undone yet');

    undoBuild(state);
    assert.equal(read()[DOCK_UNDO.id], true);
    assert.equal(read()[DOCK_REDO.id], false);
});

test('the bar is on every panel, whatever the tool is pointed at', () => {
    for (const tool of [SELECT_TOOL, 'mountain', 'lasso', 'erase', 'files']) {
        const state = onCanvas();
        chooseBuildTool(state, tool);
        const shown = dockContent(state, {});
        assert.deepEqual(shown.bar.map(answer => answer.id),
            [DOCK_UNDO.id, DOCK_REDO.id, DOCK_SNAP_GRID.id, DOCK_SNAP_ANGLE.id], tool);
    }
});

/**
 * A dimmed step says why it is dimmed, because the two reasons look identical
 * and one of them - an edit in hand, with a step sitting in the history -
 * reads as a bar that has simply stopped working.
 */
test('a step says what it does, or dimmed, which of the reasons it is dimmed for', () => {
    const state = onCanvas();
    const title = id => dockBar(state).find(answer => answer.id === id)?.title;

    assert.equal(title(DOCK_UNDO.id), BAR_NOTHING_TITLES[DOCK_UNDO.id], 'nothing to go back to');
    assert.equal(title(DOCK_REDO.id), BAR_NOTHING_TITLES[DOCK_REDO.id]);

    dropMountain(state, [0, 0]);
    assert.equal(title(DOCK_UNDO.id), BAR_STEP_TITLES[DOCK_UNDO.id], 'a step that can be taken says what it takes back');
    assert.equal(title(DOCK_REDO.id), BAR_NOTHING_TITLES[DOCK_REDO.id], 'and nothing has been undone yet');

    // The reason the button could not say before: the history holds a step and
    // the draft in hand is what is refusing it.
    chooseBuildTool(state, 'mountain');
    dropDraft(state, { x: 2000, z: 2000 }, { size: SIZE });
    assert.equal(canUndoBuild(state), false);
    assert.equal(title(DOCK_UNDO.id), BAR_EDIT_TITLE);
    assert.equal(title(DOCK_REDO.id), BAR_EDIT_TITLE);

    acceptDraft(state);
    requestLeave(state);
    assert.equal(title(DOCK_UNDO.id), BAR_CONFIRM_TITLE, 'a question on the canvas is the third reason');
});

/**
 * The docstring over the titles is what a reader of `barStepTitle` reads
 * first, and it counted two of those reasons where the function answers three
 * - with `BAR_CONFIRM_TITLE` declared four lines under the sentence that left
 * it out. The count is pinned to the answers the function can give, so the
 * next one added cannot be added without the sentence being read again.
 */
test('the bar\'s docstring counts the same reasons the function answers with', () => {
    const source = readFileSync(fileURLToPath(new URL('../js/build-panel.js', import.meta.url)), 'utf8');

    // The comment immediately above the declaration and no earlier one, which
    // is what holding `*/` out of the capture is for.
    const docstring = source.match(/\/\*\*((?:(?!\*\/)[\s\S])*)\*\/\s*export const BAR_SNAP_TITLES/);
    assert.ok(docstring, 'BAR_SNAP_TITLES should carry a docstring');

    // Read as prose rather than as lines: every reason here wraps, so a phrase
    // matched against the raw comment is matched against a line break.
    const prose = docstring[1].replace(/^\s*\*/gm, '').replace(/\s+/g, ' ').trim();
    assert.match(prose, /dimmed for three quite different reasons/,
        'three, which is how many answers barStepTitle has for a dimmed step');
    assert.doesNotMatch(prose, /dimmed for two/, 'and not the two it counted before');
    assert.match(prose, /nothing to go back to/);
    assert.match(prose, /an edit is in hand/);
    assert.match(prose, /a question is standing on the canvas/,
        'the third reason named beside the other two');

    const step = source.match(/function barStepTitle\(state, id, disabled\) \{([\s\S]*?)\n\}/);
    assert.ok(step, 'barStepTitle should be findable');
    assert.equal((step[1].match(/\breturn\b/g) ?? []).length, 4,
        'one answer for a step that can be pressed, and three for one that cannot');
    for (const answer of ['BAR_CONFIRM_TITLE', 'BAR_EDIT_TITLE', 'BAR_NOTHING_TITLES']) {
        assert.match(step[1], new RegExp(`return ${answer}`), `${answer} is one of the three`);
    }
});

test('a switch says what it snaps, whichever way it is turned', () => {
    const state = onCanvas();
    const bar = Object.fromEntries(dockBar(state).map(answer => [answer.id, answer.title]));
    assert.equal(bar[DOCK_SNAP_GRID.id], BAR_SNAP_TITLES[DOCK_SNAP_GRID.id]);
    assert.equal(bar[DOCK_SNAP_ANGLE.id], BAR_SNAP_TITLES[DOCK_SNAP_ANGLE.id]);
});

test('the two snaps carry whether they are on and the two histories carry nothing of the kind', () => {
    const state = onCanvas();
    const bar = Object.fromEntries(dockBar(state).map(answer => [answer.id, answer.pressed]));
    assert.equal(bar[DOCK_SNAP_GRID.id], false);
    assert.equal(bar[DOCK_SNAP_ANGLE.id], false);
    assert.equal(bar[DOCK_UNDO.id], null, 'a step is not a switch');
    assert.equal(bar[DOCK_REDO.id], null);
});
