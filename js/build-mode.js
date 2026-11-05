/**
 * Build mode - the interactive environment builder's session: whether it is
 * open, which menu opened it, and which of its screens is showing.
 *
 * The builder is an editor laid over one tile of the world, where ground is
 * shaped by pointing at it rather than by stepping a number in a list. This
 * module is the session that holds while that is happening: the live tool, the
 * edit in hand and what has been committed, the placement picked up again with
 * Select, and the two questions asked before work is settled or the builder is
 * left. What the ground looks like is the generator's, drawn from the
 * placements this holds.
 *
 * There are three ways in - the title screen's entry, the pause menu's entry
 * and the `L` key - and they are one action, because three ways into the same
 * editor are three things that can drift into opening slightly different ones.
 * `from` is what the way out returns to.
 *
 * Pure module with no DOM or Three.js dependency, so the session can be unit
 * tested in Node - and so `js/reserved-keys.js` can read the key the builder
 * opens on without pulling in a renderer to do it.
 */

import { SELECT_TOOL, isChoosableTool, buildTool, droppedPlacement } from './build-tools.js';
import { getElement, isElementId, resolveConfig } from './environment/elements.js';

/**
 * The one name, on the menu entry and on the picker that entry opens. A pilot
 * who chooses one name should land on a screen carrying the same one.
 */
export const BUILDER_LABEL = 'INTERACTIVE ENVIRONMENT BUILDER';

/** The id both menus carry the entry under, so both screens open the same thing. */
export const BUILDER_ENTRY_ID = 'build';

/**
 * `L` for the level editor this is: the key already meant "edit the world", and
 * the builder is what that means now. Every other letter the editor might have
 * wanted already flies the aircraft.
 */
export const BUILDER_OPEN_KEYS = ['KeyL'];

export function isBuilderOpenKey(code) {
    return BUILDER_OPEN_KEYS.includes(code);
}

/**
 * The keys that leave the picker, which are the two every other panel here is
 * left by. The picker is a panel like any other, so it is closed like one.
 */
export const PICKER_CLOSE_KEYS = ['Escape', 'Backspace'];

/**
 * The key that asks to leave a canvas, which is the accept tool's key.
 *
 * One key rather than the picker's two. `Backspace` is kept off the canvas
 * because deleting a placement will want it - on a Mac the key labelled delete
 * is `Backspace` - and a key that leaves the builder in one press is the worst
 * key there is to share with a delete.
 */
export const CANVAS_LEAVE_KEYS = ['Escape'];

export function isPickerCloseKey(code) {
    return PICKER_CLOSE_KEYS.includes(code);
}

export function isCanvasLeaveKey(code) {
    return CANVAS_LEAVE_KEYS.includes(code);
}

/**
 * True for a key that asks to leave the builder from the screen it is on: either
 * close key off the picker, and only `Escape` off a canvas.
 */
export function leavesBuilder(state, code) {
    if (buildModePicking(state)) return isPickerCloseKey(code);
    if (buildModeDrawing(state)) return isCanvasLeaveKey(code);
    return false;
}

/** What the way out returns to, which is whichever menu the builder was opened from. */
export const BUILD_FROM_TITLE = 'title';
export const BUILD_FROM_PAUSE = 'pause';

/**
 * The screens a session is on. The picker is the builder's first screen rather
 * than a gate in front of it - the palette and the dock are already drawn
 * behind it - so leaving the picker leaves the builder.
 */
export const BUILD_PICKER = 'picker';
export const BUILD_CANVAS = 'canvas';

export function createBuildState() {
    return {
        // Where the session is, and null while there is no session. Held as the
        // screen rather than as a pair of flags, because the builder is on
        // exactly one of its screens whenever it is open at all.
        screen: null,
        from: BUILD_FROM_TITLE,
        // The canvas the session is building on, and null until the picker has
        // said which. It is the environment the ground is generated from, so a
        // session carries an id rather than a field.
        environment: null,
        // The tool the canvas is being worked with, and null until there is a
        // canvas to work.
        tool: null,
        // What has been built on the canvas: placements, each JSON-shaped data
        // in the canvas's frame, in the order they were committed. Concatenated
        // onto the environment's own, this is the whole description of the
        // built world, and it goes to `buildEnvironment` through the same door
        // a preset does.
        placements: [],
        // The edit in hand, and null while nothing is pending: a placement
        // being drawn or changed, the index of the committed placement it
        // replaces, or null for one drawn on bare ground, and the tool that
        // began it, or null for one picked up again. A placement picked with
        // Select is a draft standing on it, so the pick and the edit of it are
        // one thing rather than two that could disagree.
        draft: null,
        // The question waiting on the pilot, and null while nothing is asked:
        // which confirm is open, and what goes ahead once it is answered - the
        // tool a change was on its way to, or null for the way out.
        confirm: null,
        // Where each tool's panel was left when its last edit was settled, so
        // the next thing it drops starts from there rather than from the
        // element's defaults.
        toolValues: {},
        // How many placements this canvas has handed a seed, so each one it
        // drops draws from a stream of its own.
        dropped: 0
    };
}

/**
 * Opens the builder, remembering what opened it.
 *
 * On its picker the first time, and straight onto the built world every time
 * after that. `built` is the world an earlier session kept - `{ environment,
 * placements }` - and with one the session opens on its canvas with every
 * placement it had already committed, each still one that can be picked up and
 * changed: a pilot who comes back to their world wants their world, not a
 * choice of six and a blank canvas. With none, which is a world nothing has
 * been built on, it opens on the picker to choose what to start from.
 *
 * Starting again from another base is choosing another world in the settings,
 * which lets go of what was built on the old one, so the builder opens on the
 * picker again.
 */
export function openBuildMode(state, from = BUILD_FROM_TITLE, built = null) {
    state.screen = BUILD_PICKER;
    state.from = from === BUILD_FROM_PAUSE ? BUILD_FROM_PAUSE : BUILD_FROM_TITLE;
    state.environment = null;
    state.tool = null;
    state.confirm = null;

    if (built != null) beginCanvas(state, built.environment, built.placements);
    return state;
}

/** Leaves the builder, for whichever menu opened it. */
export function closeBuildMode(state) {
    state.screen = null;
    state.environment = null;
    state.tool = null;
    state.confirm = null;
    return state;
}

// --- The two confirms ---------------------------------------------------------

/** The question asked with an edit in hand: keep it, or drop it. */
export const ACCEPT_EDITS = 'accept-edits';

/** The question asked with nothing in hand: keep what was built, and leave. */
export const SAVE_AND_EXIT = 'save-and-exit';

/**
 * What each confirm is headed, in the artwork's own words. The original tour
 * wrote the second as "Do you want to keep the current built environment?";
 * the panel drawn for it says `SAVE AND EXIT MODE`, and the artwork settles it.
 */
export const CONFIRM_HEADINGS = Object.freeze({
    [ACCEPT_EDITS]: 'ACCEPT EDITS',
    [SAVE_AND_EXIT]: 'SAVE AND EXIT MODE'
});

/**
 * The answers a confirm takes: its two buttons, and calling it off - which is
 * `Escape`, or a click anywhere but the confirm. Anything that is not one of
 * the two buttons calls it off, so an answer that means nothing never commits
 * or drops anything.
 */
export const CONFIRM_YES  = 'yes';
export const CONFIRM_NO   = 'no';
export const CONFIRM_STAY = 'stay';

/**
 * The two buttons, as the entries of the menu a confirm is drawn and walked
 * as. `YES` first, so a confirm opens on it and `Enter` keeps the work.
 */
export const CONFIRM_ENTRIES = Object.freeze([
    Object.freeze({ id: CONFIRM_YES, label: 'YES' }),
    Object.freeze({ id: CONFIRM_NO,  label: 'NO' })
]);

/** How an edit was settled, as `answerConfirm` reports it. */
export const ACCEPTED  = 'accepted';
export const CANCELLED = 'cancelled';

/**
 * Asks to leave the builder. The accept tool, `Escape` and the picker's `BACK`
 * all come here.
 *
 * One function, for the reason there is one way in: three ways out are three
 * things that can drift into asking different questions. Each asks the one
 * question that applies, read off `draftPending` again on every ask:
 *
 * - **Off the picker** it leaves. Nothing has been built there to keep, and the
 *   picker is a panel, closed like one.
 * - **With an edit in hand** it asks `ACCEPT EDITS`. Either answer settles the
 *   edit and stays: committing work never doubles as leaving, so a pilot who
 *   wants to keep this batch and go on building is never made to answer No to
 *   a question about saving.
 * - **With nothing in hand** it asks `SAVE AND EXIT MODE`, whether or not
 *   anything was built - a session with nothing built meets it like any other.
 *   A placement picked and not changed is nothing in hand: there is no edit in
 *   it to keep or drop.
 *
 * So leaving by keyboard is `Escape` to ask and `Enter` on `YES`, and never one
 * press. With a confirm already open it asks nothing: `Escape` then calls that
 * one off, which is the caller's to do through `answerConfirm`.
 *
 * Returns what to do - `{ leave: true }` or `{ confirm }` naming the confirm
 * now open - or null for a session that is not open, or already asking.
 */
export function requestLeave(state) {
    if (!buildModeShowing(state) || confirmOpen(state)) return null;
    if (buildModePicking(state)) return { leave: true };

    const ask = editPending(state) ? ACCEPT_EDITS : SAVE_AND_EXIT;
    state.confirm = { ask, then: null };
    return { confirm: ask };
}

/** True while a confirm is waiting on the pilot, which holds every other change still. */
export function confirmOpen(state) {
    return state?.confirm != null;
}

/** The confirm waiting on the pilot - `ACCEPT_EDITS` or `SAVE_AND_EXIT` - or null. */
export function buildConfirm(state) {
    return state?.confirm?.ask ?? null;
}

/**
 * Answers the confirm that is open.
 *
 * `ACCEPT EDITS` settles the edit in hand - `YES` commits it, `NO` drops it -
 * and then does what it was asked on the way to: changes the tool a palette
 * click named, picks the placement a click with Select landed on, or, asked by
 * the way out, returns to the editor with the panel where it was left. `SAVE AND EXIT MODE` leaves either way: `YES` keeping what
 * was built, `NO` dropping it for the world the session opened on.
 *
 * Calling a confirm off settles nothing. The edit is still in hand, the tool
 * is still the one it was, and the canvas is still open.
 *
 * Returns what the caller has to do: `{ leave: true, keep, environment,
 * placements }` for the way out - the world to keep, read before the session
 * closes - `{ settled, tool, picked }` for an edit settled, `{ stay: true }`
 * for a confirm called off, or null when nothing was asked.
 */
export function answerConfirm(state, answer) {
    const asked = state?.confirm;
    if (asked == null) return null;
    state.confirm = null;

    if (answer !== CONFIRM_YES && answer !== CONFIRM_NO) return { stay: true };

    if (asked.ask === SAVE_AND_EXIT) {
        return {
            leave: true,
            keep: answer === CONFIRM_YES,
            environment: state.environment,
            placements: committedPlacements(state)
        };
    }

    if (answer === CONFIRM_YES) acceptDraft(state);
    else cancelDraft(state);

    const tool = asked.then?.tool;
    if (tool != null && tool !== state.tool && isChoosableTool(tool)) state.tool = tool;

    const pick = asked.then?.pick;
    if (Number.isInteger(pick)) pickUpPlacement(state, pick);

    return { settled: answer === CONFIRM_YES ? ACCEPTED : CANCELLED, tool: state.tool, picked: pickedIndex(state) };
}

/**
 * What the accept tool will ask if it is pressed now, as the name it carries.
 * "Invalid" in the walkthroughs never means a disabled tool: it stays live and
 * asks the question that applies, and its name says which before it is
 * pressed. `Escape` asks the same question, so the name says what that will
 * ask too.
 */
export function acceptToolName(state) {
    return editPending(state) ? 'Accept edits' : 'Save and exit';
}

// --- The draft and the built world --------------------------------------------

/**
 * A placement taken as the session's own: copied, so nothing the caller does
 * to the one it handed in afterwards reaches the draft or the committed list.
 * A placement is JSON-shaped, so a structured clone is the whole of a copy.
 */
function own(placement) {
    return structuredClone(placement);
}

/** True while a draft is held - something drawn, or a placement picked up. */
export function draftPending(state) {
    return state?.draft != null;
}

/**
 * True while there is work in hand that a question has to settle, which is the
 * one predicate every confirm reads: a placement drawn on bare ground, or a
 * picked one changed since it was picked.
 *
 * A pick nothing has been done to is not an edit. It is the placement as it
 * was committed, being looked at, and a question about keeping or dropping it
 * would be a question with the same answer either way - so it is let go
 * without one.
 */
export function editPending(state) {
    if (!draftPending(state)) return false;

    const picked = pickedIndex(state);
    if (picked == null) return true;
    return !samePlacement(state.draft.placement, state.placements[picked]);
}

/**
 * True for two placements that draw the same ground: the same element, seed and
 * footprint, and the same configuration once each is resolved against the
 * ranges the element declares - so a value the panel wrote out in full, or
 * stepped away and back again, is no change.
 */
export function samePlacement(a, b) {
    if (a == null || b == null) return a == null && b == null;
    return placementKey(a) === placementKey(b);
}

/** A placement written down so two can be compared: its configuration as the generator reads it. */
function placementKey(placement) {
    const config = isElementId(placement.type)
        ? resolveConfig(getElement(placement.type), placement.config)
        : placement.config ?? null;
    return JSON.stringify([placement.type, placement.seed ?? null, placement.footprint ?? null, config]);
}

/** The committed placement the draft stands on - the one picked - or null. */
export function pickedIndex(state) {
    const replaces = state?.draft?.replaces;
    return Number.isInteger(replaces) ? replaces : null;
}

/**
 * The placements a pick looks through: the committed ones, each as it stands
 * right now - the one picked with whatever has been done to it, so the reach a
 * click is measured against is the ground on the canvas. Indexed as the
 * committed list is, which is what a pick hands back.
 */
export function pickablePlacements(state) {
    return builtPlacements(state).slice(0, state?.placements?.length ?? 0);
}

/**
 * A click with Select on the canvas: `index` is the committed placement under
 * it, or null for bare ground.
 *
 * - **On a placement** it picks it, replacing whatever was picked before - the
 *   placement becomes the draft, so the dock draws its rows with the accept
 *   and cancel that settle them, and the ground it stands for is redrawn as
 *   they move.
 * - **On the placement already picked** it keeps it. A pick that let go on a
 *   second click would be one a pilot loses by clicking to be sure.
 * - **On bare ground** it lets go of the pick. A live lasso is a different
 *   selection, which only Deselect clears, and a click here never touches it.
 *
 * A pick that was changed is work in hand, so before it is let go of - for
 * another placement or for bare ground - `ACCEPT EDITS` is asked, with what
 * the click was on its way to held until it is answered. A pick nothing was
 * done to is let go without asking.
 *
 * Refused off a canvas, with a confirm open, and for any tool but Select.
 *
 * Returns `{ picked }` for the placement now picked, or null when the click
 * let go of it; `{ confirm }` when `ACCEPT EDITS` is now asking; or null when
 * nothing changed.
 */
export function selectPlacement(state, index = null) {
    if (!buildModeDrawing(state) || confirmOpen(state) || state.tool !== SELECT_TOOL) return null;

    const target = Number.isInteger(index) && index >= 0 && index < state.placements.length ? index : null;
    const picked = pickedIndex(state);

    if (target != null && target === picked) return null;
    if (target == null && !draftPending(state)) return null;

    if (editPending(state)) {
        state.confirm = { ask: ACCEPT_EDITS, then: { pick: target } };
        return { confirm: ACCEPT_EDITS };
    }

    state.draft = null;
    if (target != null) pickUpPlacement(state, target);
    return { picked: target };
}

/** The placement being drawn or changed, and null while nothing is pending. */
export function buildDraft(state) {
    return draftPending(state) ? state.draft.placement : null;
}

/** What has been committed, as a copy a caller can read without changing it. */
export function committedPlacements(state) {
    return (state?.placements ?? []).map(own);
}

/**
 * Begins an edit on bare ground: a placement drawn by a tool, which commits as
 * a new one. Refused off a canvas, with a confirm open, while another edit is
 * pending - that one has to be accepted or cancelled first - and for anything
 * that is not a placement.
 *
 * `tool` is the tool that drew it, whose panel the next draft it draws starts
 * from once this one is settled.
 */
export function startDraft(state, placement, tool = null) {
    if (!buildModeDrawing(state) || confirmOpen(state) || draftPending(state) || !isPlacement(placement)) return false;

    state.draft = { placement: own(placement), replaces: null, tool };
    return true;
}

/**
 * A click on the ground with a tool that drops what it builds there.
 *
 * With nothing in hand, it begins an edit at the click: the tool's placement,
 * started from where its panel was left, with a seed of its own. With the
 * tool's own edit already in hand, that edit is put down again at the click
 * instead - the mountain in hand moves, rather than a second one appearing or
 * the first being kept or dropped without being asked about. Keeping it is the
 * panel's `ACCEPT`, or the accept tool's `ACCEPT EDITS`.
 *
 * Refused off a canvas, with a confirm open, for a live tool that does not
 * drop, for a point that is not on the ground, and with an edit in hand that
 * this tool did not begin.
 *
 * Returns true when an edit was begun or moved.
 */
export function dropDraft(state, point) {
    if (!buildModeDrawing(state) || confirmOpen(state)) return false;

    const tool      = buildTool(state.tool);
    const placement = droppedPlacement(tool, state.toolValues?.[tool?.id], point);
    if (placement == null) return false;

    if (draftPending(state)) {
        const draft = state.draft;
        if (draft.tool !== tool.id || draft.replaces != null) return false;
        draft.placement.config = { ...draft.placement.config, at: placement.config.at };
        return true;
    }

    placement.seed = placementSeed(state.dropped);
    if (!startDraft(state, placement, tool.id)) return false;
    state.dropped += 1;
    return true;
}

/**
 * A seed for the `n`th placement a canvas drops, mixed so that neighbouring
 * counts give unrelated streams - a seed of 1, 2 or 3 taken as it is would
 * start the generator on draws close to nothing.
 */
export function placementSeed(n = 0) {
    let h = Math.imul((Math.trunc(n) + 1) >>> 0, 0x9e3779b1) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
    return (h ^ (h >>> 16)) >>> 0;
}

/**
 * The values a tool's next draft starts from: its panel as the last edit it
 * began was left, or nothing for a tool whose panel has not been used on this
 * canvas, which starts from the element's defaults.
 */
export function toolStartValues(state, tool) {
    return own(state?.toolValues?.[tool] ?? {});
}

/**
 * Keeps where a tool's panel was left as its edit is settled, kept or dropped
 * alike - a pilot who drops a mountain, sets it up and cancels it to try
 * somewhere else wants the next one set up the same way. The point it was
 * dropped on is the click's, not the panel's, so it is left behind.
 */
function rememberToolValues(state) {
    const { placement, tool } = state.draft;
    if (tool == null) return;

    const values = own(placement.config ?? {});
    delete values.at;
    state.toolValues = { ...state.toolValues, [tool]: values };
}

/**
 * Picks a committed placement up again to change it.
 *
 * The draft is a copy and the original stays in the committed list, which is
 * what makes cancelling an edit put the original back rather than delete it:
 * there was never a moment it was out of the list. `replaces` records which
 * one the draft stands on, so accepting swaps it rather than adding a second.
 */
export function pickUpPlacement(state, index) {
    if (!buildModeDrawing(state) || confirmOpen(state) || draftPending(state)) return false;
    if (!Number.isInteger(index) || index < 0 || index >= state.placements.length) return false;

    state.draft = { placement: own(state.placements[index]), replaces: index, tool: null };
    return true;
}

/**
 * Changes the edit in hand: the values the panel steps go into its `config`,
 * merged over what is there, and a new `footprint` replaces the old one. The
 * draft survives the change - it is the same edit, standing on the same
 * placement - which is what lets a value be stepped and stepped again before
 * anything is committed.
 */
export function reviseDraft(state, { config, footprint } = {}) {
    if (!draftPending(state)) return false;

    const placement = state.draft.placement;
    if (config != null) placement.config = { ...placement.config, ...own(config) };
    if (footprint !== undefined) placement.footprint = footprint == null ? undefined : own(footprint);
    if (placement.footprint === undefined) delete placement.footprint;
    return true;
}

/**
 * Commits the edit in hand, always. A draft on bare ground is added to the
 * committed list; one standing on a committed placement takes that
 * placement's place, so a changed mountain is one mountain and not two.
 *
 * Returns the placement committed, or null when nothing was pending.
 */
export function acceptDraft(state) {
    if (!draftPending(state)) return null;

    rememberToolValues(state);

    const { placement, replaces } = state.draft;
    if (replaces != null && replaces >= 0 && replaces < state.placements.length) {
        state.placements[replaces] = placement;
    } else {
        state.placements.push(placement);
    }

    state.draft = null;
    return own(placement);
}

/**
 * Drops the edit in hand, always. Nothing committed is touched: a draft on bare
 * ground is gone, and one standing on a committed placement leaves that
 * placement exactly as it was committed, because it never left the list.
 *
 * Returns true when there was something to drop.
 */
export function cancelDraft(state) {
    if (!draftPending(state)) return false;
    rememberToolValues(state);
    state.draft = null;
    return true;
}

/**
 * The placements the canvas is drawn from right now: everything committed,
 * with the edit in hand shown where it stands - in place of the placement it
 * replaces, or after the rest when it is new - so what is on screen is what an
 * accept would keep.
 */
export function builtPlacements(state) {
    const shown = committedPlacements(state);
    if (!draftPending(state)) return shown;

    const { placement, replaces } = state.draft;
    if (replaces != null && replaces >= 0 && replaces < shown.length) shown[replaces] = own(placement);
    else shown.push(own(placement));
    return shown;
}

/** True for something shaped like a placement: a type, and a config if it has one. */
function isPlacement(placement) {
    return placement != null
        && typeof placement === 'object'
        && typeof placement.type === 'string'
        && placement.type !== ''
        && (placement.config == null || typeof placement.config === 'object');
}

export function buildModeShowing(state) {
    return state?.screen != null;
}

/** Which menu the way out returns to, and null while nothing is open. */
export function buildModeFrom(state) {
    return buildModeShowing(state) ? state.from : null;
}

/** True while the picker is the screen, which is the one modal screen the builder has. */
export function buildModePicking(state) {
    return state?.screen === BUILD_PICKER;
}

/** True once a canvas is being built, which is the builder over the world itself. */
export function buildModeDrawing(state) {
    return state?.screen === BUILD_CANVAS;
}

/** The canvas being built, and null while the picker has not said which. */
export function buildModeEnvironment(state) {
    return buildModeDrawing(state) ? state.environment : null;
}

/**
 * Opens the canvas on a chosen environment, which is what the picker's `START`
 * does.
 *
 * `kept` is what an earlier session built on this environment and kept, which
 * the canvas opens with already committed - so a session that saves keeps
 * what the one before it saved as well as its own, rather than a canvas that
 * did not show the earlier work quietly replacing it. Anything in it that is
 * not a placement is left out.
 *
 * Refused for a session that is not open, so a canvas can never be begun from
 * under a screen that is not the picker.
 */
export function beginCanvas(state, environmentId, kept = []) {
    if (!buildModePicking(state)) return false;
    if (typeof environmentId !== 'string' || environmentId === '') return false;

    state.screen = BUILD_CANVAS;
    state.environment = environmentId;
    // Select is the navigation state, so a canvas opens on looking at it.
    state.tool = SELECT_TOOL;
    state.placements = (Array.isArray(kept) ? kept : []).filter(isPlacement).map(own);
    state.draft = null;
    state.confirm = null;
    // A canvas's panels start from the elements' defaults, and its seeds
    // count on from what it opened with, so a kept placement and a new one
    // do not start from the same stream.
    state.toolValues = {};
    state.dropped = state.placements.length;
    return true;
}

/** The tool the canvas is being worked with, and null while there is no canvas. */
export function buildModeTool(state) {
    return buildModeDrawing(state) ? state.tool : null;
}

/**
 * Makes a tool the live one.
 *
 * Refused off a canvas, with a confirm open, for a tool that is not built, and
 * for the accept tool, which is a way out rather than a mode. Choosing the tool
 * already live is not a change and is answered as one.
 *
 * With an edit pending it asks first. Changing tools decides what happens to
 * the work on the one being left - kept, or dropped - and that is the pilot's
 * to answer, so `ACCEPT EDITS` opens with the tool chosen held as what goes
 * ahead once it is answered, and the tool does not change yet: the panel stays
 * the one the edit is on until the answer changes both. A live selection is
 * not an edit, so leaving the lasso with one drawn will ask nothing - and nor
 * is a placement picked and left as it was, which is let go as the tool
 * changes.
 *
 * Returns true when the live tool changed, and false when it did not - which,
 * with an edit pending, is because `ACCEPT EDITS` is now asking.
 */
export function chooseBuildTool(state, id) {
    if (!buildModeDrawing(state) || confirmOpen(state) || !isChoosableTool(id)) return false;
    if (state.tool === id) return false;

    if (editPending(state)) {
        state.confirm = { ask: ACCEPT_EDITS, then: { tool: id } };
        return false;
    }

    state.draft = null;
    state.tool = id;
    return true;
}
