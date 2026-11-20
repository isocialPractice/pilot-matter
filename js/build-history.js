/**
 * The builder's undo and redo - a capped history of the session's world.
 *
 * What is remembered is the world, not the act that changed it: each step is a
 * snapshot of what a save would write - the committed placements, the
 * environment's own rows, the start point and the plane - so going back is
 * putting one of those back rather than running an act in reverse. A world the
 * builder keeps is JSON-shaped and a canvas holds a few hundred placements, so
 * a snapshot is a structured clone and a step costs what one costs. That is the
 * trade this makes: an inverse per act would be smaller and would have to be
 * written again, correctly, for every tool added.
 *
 * **A step is pushed when an edit is settled, never while it is being made.**
 * The gumball writes through the draft on every pointer move, and the draft is
 * not the world: one drag of a handle is one step, pushed when the draft is
 * accepted. The same holds for a figure stepped on the dock - the draft moves,
 * the world does not - which is why nothing in here is called from a drag.
 *
 * A few acts are not drafts and have no accept: the start point placed or
 * turned, its rows typed, the plane chosen. Those push their own step, and a
 * `run` is how a sequence of them stays one step: a push naming the run it
 * belongs to is skipped while that run is the one the last push named, because
 * the world before the run began is the one an undo should put back. Any push
 * naming no run, and every undo, ends the run - so the next act of the same
 * kind opens a new step.
 *
 * Pure module with no DOM or Three.js dependency: the stack is a pair of
 * arrays and the snapshots are handed in, so what an undo puts back can be
 * unit tested in Node.
 */

/**
 * How many steps back the history holds. Deep enough to cover an afternoon's
 * mistakes, shallow enough that a city canvas's snapshots are tens of
 * megabytes rather than hundreds - a step is the whole world, so the cap is
 * what bounds what the session holds.
 */
export const HISTORY_LIMIT = 50;

/** The two things the keys ask for. */
export const HISTORY_UNDO = 'undo';
export const HISTORY_REDO = 'redo';

/**
 * The key combinations each is asked by, as what a key event is read for:
 * `ctrl` is the platform's own modifier, so `Cmd` on a Mac answers it too.
 *
 * `Ctrl+Z` back, and forward by either of the two spellings every editor
 * answers to - `Ctrl+Shift+Z`, which is the same key read the other way, and
 * `Ctrl+Y`, which is the one a Windows pilot reaches for first.
 */
export const UNDO_COMBOS = Object.freeze([
    Object.freeze({ ctrl: true, shift: false, code: 'KeyZ' })
]);
export const REDO_COMBOS = Object.freeze([
    Object.freeze({ ctrl: true, shift: true,  code: 'KeyZ' }),
    Object.freeze({ ctrl: true, shift: false, code: 'KeyY' })
]);

/** True when a key event answers one combination: its code, its shift, and the platform's modifier. */
function matches(combo, event) {
    const modifier = event?.ctrlKey === true || event?.metaKey === true;
    return combo.code === event?.code
        && combo.ctrl === modifier
        && combo.shift === (event?.shiftKey === true);
}

/**
 * What a key event asks the history for - `HISTORY_UNDO`, `HISTORY_REDO` or
 * null for a key it is not.
 *
 * The order the two tables are asked in does not matter, and that is worth
 * saying because it looks as though it should: `Ctrl+Shift+Z` is in both
 * tables' key and in only one of their shifts, because `matches` reads the
 * shift exactly rather than ignoring it. A mutation run on 11.20.2026 is what
 * showed it - swapping these two lines passed the whole suite.
 */
export function historyKey(event) {
    if (REDO_COMBOS.some(combo => matches(combo, event))) return HISTORY_REDO;
    if (UNDO_COMBOS.some(combo => matches(combo, event))) return HISTORY_UNDO;
    return null;
}

/** An empty history: nothing to go back to, nothing to come forward to, no run under way. */
export function createHistory() {
    return { past: [], future: [], run: null };
}

/** Everything forgotten - what a canvas opened afresh, or a world loaded over one, leaves behind. */
export function clearHistory(history) {
    if (history == null) return history;
    history.past.length = 0;
    history.future.length = 0;
    history.run = null;
    return history;
}

export function canUndo(history) {
    return (history?.past?.length ?? 0) > 0;
}

export function canRedo(history) {
    return (history?.future?.length ?? 0) > 0;
}

/** How deep the history is either way, which is what the dock's two answers read. */
export function historyDepth(history) {
    return { past: history?.past?.length ?? 0, future: history?.future?.length ?? 0 };
}

/**
 * Remembers `snapshot` as the world to come back to, and drops whatever had
 * been undone - a step taken after going back is a new branch, and the old one
 * is not reachable from it.
 *
 * `run` names a sequence that is one step: a push naming the run the last push
 * named changes nothing, because the world before the run is already on the
 * stack. Anything else ends the run.
 *
 * Returns true when a step was pushed.
 */
export function pushHistory(history, snapshot, run = null) {
    if (history == null || snapshot == null) return false;

    if (run != null && history.run === run) return false;
    history.run = run;
    history.future.length = 0;
    history.past.push(snapshot);
    // The oldest step goes first, so the cap is how far back the history
    // reaches rather than how many steps it ever takes.
    while (history.past.length > HISTORY_LIMIT) history.past.shift();
    return true;
}

/** Ends the run under way, so the next push of that kind opens a step of its own. */
export function endHistoryRun(history) {
    if (history != null) history.run = null;
    return history;
}

/**
 * One step back: `now` is the world as it stands, which goes onto the forward
 * stack, and the snapshot to put back comes off the back one. Null when there
 * is nothing to go back to.
 */
export function stepBack(history, now) {
    if (!canUndo(history) || now == null) return null;
    history.future.push(now);
    history.run = null;
    return history.past.pop();
}

/** One step forward, the mirror of `stepBack`. Null when nothing has been undone. */
export function stepForward(history, now) {
    if (!canRedo(history) || now == null) return null;
    history.past.push(now);
    history.run = null;
    return history.future.pop();
}
