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
 * The keys that leave the builder, which are the two every other panel here is
 * left by.
 *
 * Leaving properly is two confirms in sequence - whether to accept the pending
 * edit, then whether to save and leave - and that is the accept tool's, which
 * arrives with the tools. These are the way out in the meantime, and the way
 * out of the picker for good: a screen with no way off it is worse than one
 * whose way off it is not the final one.
 */
export const BUILDER_CLOSE_KEYS = ['Escape', 'Backspace'];

export function isBuilderCloseKey(code) {
    return BUILDER_CLOSE_KEYS.includes(code);
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
        environment: null
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
    return state;
}

/** Leaves the builder, for whichever menu opened it. */
export function closeBuildMode(state) {
    state.screen = null;
    state.environment = null;
    return state;
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
    return true;
}
