/**
 * HUD visibility - the Tab key that clears the instruments off the screen for
 * clean flying, and the stored choice that survives a reload. Pure module
 * with no DOM or Three.js dependency: the browser's storage is passed in
 * rather than reached for, so a plain object stands in for it under test.
 */

export const HUD_TOGGLE_KEY = 'Tab';
export const HUD_STORAGE_KEY = 'pilot-matter.hud-visible';

export function isHudToggleKey(code) {
    return code === HUD_TOGGLE_KEY;
}

/**
 * The browser's localStorage, or null where there is none to reach: Node has
 * no storage under test, and a browser can refuse it outright in private
 * browsing or inside a sandboxed frame. Reaching for it is what throws, so
 * the reach is guarded once here rather than at every use.
 */
export function defaultStorage() {
    try {
        return globalThis.localStorage ?? null;
    } catch {
        return null;
    }
}

/**
 * Reads the stored choice. Anything other than a value this module wrote - a
 * missing key, a leftover from another version, or a storage that throws -
 * reads as visible, which is what a first flight should see.
 */
export function readHudVisibility(storage) {
    try {
        return storage?.getItem(HUD_STORAGE_KEY) !== 'false';
    } catch {
        return true;
    }
}

/**
 * Stores the choice for the next session. A storage that refuses the write
 * costs the setting its memory and nothing else, so the flight goes on.
 *
 * Returns true when the choice was stored.
 */
export function writeHudVisibility(storage, visible) {
    try {
        storage?.setItem(HUD_STORAGE_KEY, visible ? 'true' : 'false');
        return storage != null;
    } catch {
        return false;
    }
}

export function createHudVisibilityState(storage = null) {
    return { visible: readHudVisibility(storage), storage };
}

export function toggleHudVisibility(state) {
    state.visible = !state.visible;
    writeHudVisibility(state.storage, state.visible);
    return state.visible;
}

/**
 * Applies a key event to the HUD visibility. Key releases and auto-repeat are
 * ignored, so the instruments neither come back on the release of Tab nor
 * flicker while it is held.
 *
 * Returns true when the state changed.
 */
export function applyHudToggleKey(state, code, down, repeat = false) {
    if (!down || repeat || !isHudToggleKey(code)) return false;
    toggleHudVisibility(state);
    return true;
}
