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
        tool: null
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

/**
 * Asks to leave the builder. The accept tool, `Escape` and the picker's `BACK`
 * all come here.
 *
 * One function, for the reason there is one way in: three ways out are three
 * things that can drift into asking different questions. Nothing a session
 * could keep exists yet - no tool writes a placement - so it leaves on the
 * spot. The two confirms, whether to accept the pending edit and then whether
 * to save and leave, are asked from here once a session can hold work, so a
 * key that leaves is never a key that drops work without asking.
 *
 * Returns what to do - `{ leave: true }` - or null for a session that is not
 * open, which has nothing to leave.
 */
export function requestLeave(state) {
    if (!buildModeShowing(state)) return null;
    return { leave: true };
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
 * Returns true when the live tool changed.
 */
export function chooseBuildTool(state, id) {
    if (!buildModeDrawing(state) || !isChoosableTool(id)) return false;
    if (state.tool === id) return false;

    state.tool = id;
    return true;
}
