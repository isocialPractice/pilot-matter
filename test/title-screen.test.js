import test from 'node:test';
import assert from 'node:assert/strict';
import {
    TITLE_NAME,
    START_PROMPT,
    MODIFIER_KEYS,
    createTitleState,
    isStartKey,
    applyStartKey,
    titleShowing,
    preFlightDelta
} from '../js/title-screen.js';
import { createInputState, applyKeyToInput } from '../js/input-map.js';

test('the game opens on the title screen, before any flight', () => {
    const state = createTitleState();
    assert.equal(state.started, false);
    assert.equal(titleShowing(state), true);
});

test('the prompt names the game and says what to do about it', () => {
    assert.equal(TITLE_NAME, 'PILOT MATTER');
    assert.match(START_PROMPT, /PRESS ANY KEY/);
});

test('any key means any key', () => {
    for (const code of ['KeyW', 'Space', 'Enter', 'KeyP', 'F1', 'Digit1', 'Tab']) {
        const state = createTitleState();
        assert.equal(applyStartKey(state, code, true), true, `${code} should start the flight`);
        assert.equal(titleShowing(state), false);
    }
});

test('a modifier on its own is not an answer to the prompt', () => {
    for (const code of MODIFIER_KEYS) {
        const state = createTitleState();
        assert.equal(isStartKey(code), false, `${code} should not start the flight`);
        assert.equal(applyStartKey(state, code, true), false);
        assert.equal(titleShowing(state), true, `resting a hand on ${code} should leave the title up`);
    }
});

test('releasing a key does not start the flight, so a held key starts it once', () => {
    const state = createTitleState();
    assert.equal(applyStartKey(state, 'Space', false), false);
    assert.equal(titleShowing(state), true);
    assert.equal(applyStartKey(state, 'Space', true), true);
    assert.equal(applyStartKey(state, 'Space', false), false);
});

test('auto-repeat while holding a key changes nothing after the first press', () => {
    const state = createTitleState();
    applyStartKey(state, 'Space', true, false);
    for (let i = 0; i < 5; i++) {
        assert.equal(applyStartKey(state, 'Space', true, true), false);
    }
    assert.equal(state.started, true);
});

test('the title screen never comes back once the flight has started', () => {
    const state = createTitleState();
    applyStartKey(state, 'Enter', true);
    assert.equal(applyStartKey(state, 'Enter', true), false, 'a second press is a flight control, not a start');
    assert.equal(titleShowing(state), false);
});

test('the clock is held until the flight starts', () => {
    const state = createTitleState();
    assert.equal(preFlightDelta(state, 0.016), 0);
    assert.equal(preFlightDelta(state, 45), 0, 'a long wait never leaks in as one big step');
    applyStartKey(state, 'Space', true);
    assert.equal(preFlightDelta(state, 0.016), 0.016);
});

test('the key that starts the flight is not one that also flies it', () => {
    // The key press is swallowed by the title screen rather than passed on,
    // so nothing the input map maps should be moved by it
    const input = createInputState();
    assert.equal(applyKeyToInput(input, 'Space', true), null);
    assert.deepEqual(input, createInputState());
});
