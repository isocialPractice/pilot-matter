/**
 * The builder's palette folded away - the chevrons at the top of the tools that
 * fold the column into a small tab, so the canvas is clear while a handle is
 * dragged near where the tools sit, and the tab that brings them back.
 *
 * A stored choice rather than one a canvas starts afresh: a pilot who works
 * with the tools folded away wants them folded the next time too, the way the
 * instruments stay cleared off a flight once Tab has cleared them.
 *
 * Pure module with no DOM or Three.js dependency: the browser's storage is
 * passed in rather than reached for, so a plain object stands in for it under
 * test.
 */

import { BUILDER_ART } from './build-tools.js';

export const PALETTE_STORAGE_KEY = 'pilot-matter.builder-palette-folded';

/**
 * The art's folded palette: a small white tab with its chevrons pointing out.
 * The open palette's band carries the same chevrons turned to point in, so one
 * mark is both ways of the button.
 */
export const PALETTE_FOLD_MARK = `${BUILDER_ART}/palette-folded.svg`;

/**
 * Reads the stored choice. Anything other than a value this module wrote - a
 * missing key, a leftover, or a storage that throws - reads as open, which is
 * what a first canvas should show: the tools and the way out among them.
 */
export function readPaletteFolded(storage) {
    try {
        return storage?.getItem(PALETTE_STORAGE_KEY) === 'true';
    } catch {
        return false;
    }
}

/**
 * Stores the choice for the next session. A storage that refuses the write
 * costs the choice its memory and nothing else.
 *
 * Returns true when the choice was stored.
 */
export function writePaletteFolded(storage, folded) {
    try {
        storage?.setItem(PALETTE_STORAGE_KEY, folded ? 'true' : 'false');
        return storage != null;
    } catch {
        return false;
    }
}

export function createPaletteState(storage = null) {
    return { folded: readPaletteFolded(storage), storage };
}

export function paletteFolded(state) {
    return state?.folded === true;
}

/** Folds the tools away, or brings them back, and remembers which. Returns whether they are now folded. */
export function togglePalette(state) {
    state.folded = !state.folded;
    writePaletteFolded(state.storage, state.folded);
    return state.folded;
}

/**
 * What the one chevron button says, which is what pressing it will do: fold
 * the tools away while they are out, and bring them back while they are not.
 */
export function paletteFoldName(state) {
    return paletteFolded(state) ? 'Show the tools' : 'Hide the tools';
}
