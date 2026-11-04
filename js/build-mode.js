/**
 * Build mode - the interactive environment builder's session: whether it is
 * open, which menu opened it, and which of its screens is showing.
 *
 * The builder is an editor laid over one tile of the world, where ground is
 * shaped by pointing at it rather than by stepping a number in a list. This
 * module is the session that holds while that is happening, and nothing about
 * what is being drawn: the tools, the draft and the accept and cancel rules
 * join it as they are built.
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

import { SELECT_TOOL, isChoosableTool } from './build-tools.js';

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
        // being drawn or changed, and the index of the committed placement it
        // replaces, or null for one drawn on bare ground.
        draft: null
    };
}

/**
 * Opens the builder, remembering what opened it.
 *
 * On its picker, which is where a session with nothing built yet starts. A
 * session that reopens straight onto what was built is the branch that arrives
 * with the built world; until there is one, every session starts by choosing
 * what to start from.
 */
export function openBuildMode(state, from = BUILD_FROM_TITLE) {
    state.screen = BUILD_PICKER;
    state.from = from === BUILD_FROM_PAUSE ? BUILD_FROM_PAUSE : BUILD_FROM_TITLE;
    state.environment = null;
    state.tool = null;
    return state;
}

/** Leaves the builder, for whichever menu opened it. */
export function closeBuildMode(state) {
    state.screen = null;
    state.environment = null;
    state.tool = null;
    return state;
}

/** The question asked before leaving with an edit still pending. */
export const ACCEPT_EDITS = 'accept-edits';

/**
 * Asks to leave the builder. The accept tool, `Escape` and the picker's `BACK`
 * all come here.
 *
 * One function, for the reason there is one way in: three ways out are three
 * things that can drift into asking different questions. With an edit pending
 * it asks `ACCEPT EDITS` first, so a key that leaves is never a key that drops
 * work without asking; with none it leaves. `SAVE AND EXIT MODE`, the question
 * asked with nothing pending, arrives with the accept tool's confirms, and is
 * asked from here too.
 *
 * Returns what to do - `{ leave: true }` or `{ confirm: ACCEPT_EDITS }` - or
 * null for a session that is not open, which has nothing to leave.
 */
export function requestLeave(state) {
    if (!buildModeShowing(state)) return null;
    if (draftPending(state)) return { confirm: ACCEPT_EDITS };
    return { leave: true };
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

/** True while an edit is in hand, which is the one predicate every confirm reads. */
export function draftPending(state) {
    return state?.draft != null;
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
 * a new one. Refused off a canvas, while another edit is pending - that one has
 * to be accepted or cancelled first - and for anything that is not a placement.
 */
export function startDraft(state, placement) {
    if (!buildModeDrawing(state) || draftPending(state) || !isPlacement(placement)) return false;

    state.draft = { placement: own(placement), replaces: null };
    return true;
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
    if (!buildModeDrawing(state) || draftPending(state)) return false;
    if (!Number.isInteger(index) || index < 0 || index >= state.placements.length) return false;

    state.draft = { placement: own(state.placements[index]), replaces: index };
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
 * Refused for a session that is not open, so a canvas can never be begun from
 * under a screen that is not the picker.
 */
export function beginCanvas(state, environmentId) {
    if (!buildModePicking(state)) return false;
    if (typeof environmentId !== 'string' || environmentId === '') return false;

    state.screen = BUILD_CANVAS;
    state.environment = environmentId;
    // Select is the navigation state, so a canvas opens on looking at it.
    state.tool = SELECT_TOOL;
    // A canvas begun from the picker begins from nothing built. Reopening onto
    // what an earlier session built is the branch that arrives with the built
    // world, which skips the picker rather than coming through here.
    state.placements = [];
    state.draft = null;
    return true;
}

/** The tool the canvas is being worked with, and null while there is no canvas. */
export function buildModeTool(state) {
    return buildModeDrawing(state) ? state.tool : null;
}

/**
 * Makes a tool the live one.
 *
 * Refused off a canvas, for a tool that is not built, and for the accept tool,
 * which is a way out rather than a mode. Choosing the tool already live is not
 * a change and is answered as one.
 *
 * Refused too while an edit is pending. Changing tools decides what happens to
 * the work on the one being left - kept, or dropped - and that is the pilot's
 * to answer, which `ACCEPT EDITS` asks once a tool change can ask it. Until
 * then the edit stays exactly where it was rather than being settled either way
 * by a click on a tile.
 *
 * Returns true when the live tool changed.
 */
export function chooseBuildTool(state, id) {
    if (!buildModeDrawing(state) || !isChoosableTool(id)) return false;
    if (state.tool === id || draftPending(state)) return false;

    state.tool = id;
    return true;
}
