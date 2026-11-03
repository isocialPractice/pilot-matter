import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createBuildState, openBuildMode, closeBuildMode, buildModeShowing,
    buildModePicking, buildModeDrawing, buildModeEnvironment, buildModeFrom,
    beginCanvas, isBuilderOpenKey, isBuilderCloseKey,
    BUILDER_LABEL, BUILDER_ENTRY_ID, BUILDER_OPEN_KEYS, BUILDER_CLOSE_KEYS,
    BUILD_FROM_TITLE, BUILD_FROM_PAUSE, BUILD_PICKER, BUILD_CANVAS
} from '../js/build-mode.js';
import { DEFAULT_KEYMAP, RESET_KEYS } from '../js/input-map.js';
import { SETTINGS_OPEN_KEYS } from '../js/settings.js';
import { HELP_KEY } from '../js/controls-help.js';
import { MUTE_KEY } from '../js/audio.js';
import { HUD_TOGGLE_KEY } from '../js/hud-visibility.js';
import { PAUSE_KEY } from '../js/pause.js';
import { PHOTO_KEY } from '../js/photo.js';
import { CAMERA_CYCLE_KEY } from '../js/camera-math.js';
import { reservedRole, isReservedKey } from '../js/reserved-keys.js';

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

test('the builder is backed out of the way every other panel is', () => {
    assert.deepEqual(BUILDER_CLOSE_KEYS, ['Escape', 'Backspace']);
    for (const code of BUILDER_CLOSE_KEYS) assert.ok(isBuilderCloseKey(code));
    assert.equal(isBuilderCloseKey('KeyZ'), false);
});

// One name, spelled with the second N, on the entry and on the picker it opens.
test('the builder has one name and one id', () => {
    assert.equal(BUILDER_LABEL, 'INTERACTIVE ENVIRONMENT BUILDER');
    assert.equal(BUILDER_ENTRY_ID, 'build');
});
