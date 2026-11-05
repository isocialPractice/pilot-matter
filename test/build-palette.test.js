/**
 * Hide the tool palette - the chevrons that fold the builder's tools away so
 * the canvas is clear, and the tab that brings them back, kept for the next
 * canvas.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createPaletteState, paletteFolded, togglePalette, paletteFoldName,
    readPaletteFolded, writePaletteFolded, PALETTE_STORAGE_KEY, PALETTE_FOLD_MARK
} from '../js/build-palette.js';

/** A storage that holds what it is given, the way the browser's does. */
function memory(initial = {}) {
    const held = { ...initial };
    return {
        held,
        getItem: key => (key in held ? held[key] : null),
        setItem: (key, value) => { held[key] = String(value); }
    };
}

/** A storage that refuses everything, the way a private window's can. */
const refusing = {
    getItem() { throw new Error('denied'); },
    setItem() { throw new Error('denied'); }
};

test('a first canvas shows its tools, the way out among them', () => {
    assert.equal(paletteFolded(createPaletteState(memory())), false);
    assert.equal(paletteFolded(createPaletteState(null)), false, 'with no storage at all');
    assert.equal(paletteFolded(createPaletteState(refusing)), false, 'and with one that refuses');
    assert.equal(readPaletteFolded(memory({ [PALETTE_STORAGE_KEY]: 'yes' })), false, 'and anything this did not write reads as open');
});

test('the chevrons fold the tools away and bring them back, and the choice is kept', () => {
    const storage = memory();
    const state = createPaletteState(storage);

    assert.equal(togglePalette(state), true);
    assert.equal(paletteFolded(state), true);
    assert.equal(storage.held[PALETTE_STORAGE_KEY], 'true');
    assert.equal(paletteFolded(createPaletteState(storage)), true, 'so the next canvas opens with them folded');

    assert.equal(togglePalette(state), false);
    assert.equal(paletteFolded(createPaletteState(storage)), false);
});

test('a storage that refuses costs the choice its memory and nothing else', () => {
    const state = createPaletteState(refusing);
    assert.equal(togglePalette(state), true, 'the tools still fold');
    assert.equal(writePaletteFolded(refusing, true), false);
    assert.equal(writePaletteFolded(null, true), false);
    assert.equal(writePaletteFolded(memory(), true), true);
});

test('the one button says what pressing it will do', () => {
    const state = createPaletteState(memory());
    assert.equal(paletteFoldName(state), 'Hide the tools');
    togglePalette(state);
    assert.equal(paletteFoldName(state), 'Show the tools');
    assert.equal(PALETTE_FOLD_MARK, 'assets/builder/palette-folded.svg', 'drawn with the art\'s own folded tab');
});
