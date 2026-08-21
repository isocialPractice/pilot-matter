import test from 'node:test';
import assert from 'node:assert/strict';
import {
    HUD_TOGGLE_KEY,
    HUD_STORAGE_KEY,
    isHudToggleKey,
    defaultStorage,
    readHudVisibility,
    writeHudVisibility,
    createHudVisibilityState,
    toggleHudVisibility,
    applyHudToggleKey
} from '../js/hud-visibility.js';
import { createInputState, applyKeyToInput } from '../js/input-map.js';

// A stand-in for the browser's localStorage: the same string-keyed contract,
// with no browser to run in.
function fakeStorage(initial = {}) {
    const values = new Map(Object.entries(initial));
    return {
        getItem: (key) => (values.has(key) ? values.get(key) : null),
        setItem: (key, value) => values.set(key, String(value)),
        size: () => values.size
    };
}

function brokenStorage() {
    const refuse = () => { throw new Error('storage is blocked'); };
    return { getItem: refuse, setItem: refuse };
}

test('isHudToggleKey matches only the Tab key code', () => {
    assert.equal(isHudToggleKey(HUD_TOGGLE_KEY), true);
    assert.equal(isHudToggleKey('Tab'), true);
    assert.equal(isHudToggleKey('KeyT'), false);
});

test('a first flight sees its instruments', () => {
    assert.equal(readHudVisibility(fakeStorage()), true);
    assert.equal(createHudVisibilityState(fakeStorage()).visible, true);
});

test('a stored choice is the one the next flight opens with', () => {
    assert.equal(readHudVisibility(fakeStorage({ [HUD_STORAGE_KEY]: 'false' })), false);
    assert.equal(readHudVisibility(fakeStorage({ [HUD_STORAGE_KEY]: 'true' })), true);
});

test('a stored value from somewhere else reads as instruments on', () => {
    for (const stored of ['', 'no', 'FALSE', '0', 'undefined']) {
        assert.equal(readHudVisibility(fakeStorage({ [HUD_STORAGE_KEY]: stored })), true,
            `a stored "${stored}" should not be taken for a hidden HUD`);
    }
});

test('the choice survives the session that made it', () => {
    const storage = fakeStorage();
    const state = createHudVisibilityState(storage);

    assert.equal(toggleHudVisibility(state), false);
    assert.equal(storage.getItem(HUD_STORAGE_KEY), 'false');
    assert.equal(createHudVisibilityState(storage).visible, false, 'the next session opens clean');

    toggleHudVisibility(state);
    assert.equal(createHudVisibilityState(storage).visible, true, 'and turning them back on sticks too');
});

test('pressing Tab hides the instruments and pressing it again brings them back', () => {
    const state = createHudVisibilityState(fakeStorage());
    assert.equal(applyHudToggleKey(state, 'Tab', true), true);
    assert.equal(state.visible, false);
    assert.equal(applyHudToggleKey(state, 'Tab', true), true);
    assert.equal(state.visible, true);
});

test('releasing Tab does not toggle, so the HUD is a latch and not a hold', () => {
    const state = createHudVisibilityState(fakeStorage());
    applyHudToggleKey(state, 'Tab', true);
    assert.equal(applyHudToggleKey(state, 'Tab', false), false);
    assert.equal(state.visible, false, 'the instruments stay off after Tab is released');
});

test('auto-repeat while holding Tab does not flicker the instruments', () => {
    const state = createHudVisibilityState(fakeStorage());
    applyHudToggleKey(state, 'Tab', true, false);
    for (let i = 0; i < 5; i++) {
        assert.equal(applyHudToggleKey(state, 'Tab', true, true), false);
    }
    assert.equal(state.visible, false);
});

test('other keys leave the instruments where they are', () => {
    const state = createHudVisibilityState(fakeStorage());
    for (const code of ['KeyH', 'KeyP', 'Enter', 'ShiftLeft']) {
        assert.equal(applyHudToggleKey(state, code, true), false);
    }
    assert.equal(state.visible, true);
});

// A browser can refuse storage outright - private browsing, a sandboxed
// frame, a full quota - and none of that is a reason to lose the flight.
test('a storage that refuses to be read leaves the instruments on', () => {
    assert.equal(readHudVisibility(brokenStorage()), true);
    assert.equal(createHudVisibilityState(brokenStorage()).visible, true);
});

test('a storage that refuses to be written costs the choice its memory, nothing more', () => {
    const state = createHudVisibilityState(brokenStorage());
    assert.equal(writeHudVisibility(brokenStorage(), false), false);
    assert.equal(toggleHudVisibility(state), false, 'the toggle still works this session');
});

test('having no storage at all is not an error either', () => {
    const state = createHudVisibilityState(null);
    assert.equal(state.visible, true);
    assert.equal(toggleHudVisibility(state), false);
    assert.equal(writeHudVisibility(null, true), false);
});

test('defaultStorage answers with whatever the platform has, without throwing', () => {
    const storage = defaultStorage();
    assert.ok(storage === null || typeof storage.getItem === 'function');
    assert.equal(typeof createHudVisibilityState(storage).visible, 'boolean');
});

test('Tab is not a flight control, so clearing the screen never moves a surface', () => {
    const input = createInputState();
    assert.equal(applyKeyToInput(input, HUD_TOGGLE_KEY, true), null);
    assert.deepEqual(input, createInputState());
});
