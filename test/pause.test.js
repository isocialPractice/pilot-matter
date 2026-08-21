import test from 'node:test';
import assert from 'node:assert/strict';
import {
    PAUSE_KEY,
    createPauseState,
    isPauseKey,
    togglePause,
    resumeFlight,
    applyPauseKey,
    simulationDelta
} from '../js/pause.js';
import { createInputState, applyKeyToInput } from '../js/input-map.js';

test('gameplay starts unpaused', () => {
    assert.equal(createPauseState().paused, false);
});

test('isPauseKey matches only the P key code', () => {
    assert.equal(isPauseKey(PAUSE_KEY), true);
    assert.equal(isPauseKey('KeyP'), true);
    assert.equal(isPauseKey('KeyO'), false);
    assert.equal(isPauseKey('Space'), false);
});

test('togglePause flips the flag and returns the new value', () => {
    const state = createPauseState();
    assert.equal(togglePause(state), true);
    assert.equal(state.paused, true);
    assert.equal(togglePause(state), false);
    assert.equal(state.paused, false);
});

test('resumeFlight leaves the simulation running, whatever it was doing', () => {
    const state = createPauseState();
    assert.equal(resumeFlight(state), false, 'a running flight was already resumed');
    assert.equal(state.paused, false);

    togglePause(state);
    assert.equal(resumeFlight(state), true);
    assert.equal(state.paused, false);
    assert.equal(resumeFlight(state), false, 'the menu can only resume a flight once');
});

test('pressing P pauses and pressing it again resumes', () => {
    const state = createPauseState();
    assert.equal(applyPauseKey(state, 'KeyP', true), true);
    assert.equal(state.paused, true);
    assert.equal(applyPauseKey(state, 'KeyP', true), true);
    assert.equal(state.paused, false);
});

test('releasing P does not toggle, so pause is a latch and not a hold', () => {
    const state = createPauseState();
    applyPauseKey(state, 'KeyP', true);
    assert.equal(applyPauseKey(state, 'KeyP', false), false);
    assert.equal(state.paused, true, 'the sim stays paused after P is released');
});

test('auto-repeat while holding P does not flicker the pause state', () => {
    const state = createPauseState();
    applyPauseKey(state, 'KeyP', true, false);
    for (let i = 0; i < 5; i++) {
        assert.equal(applyPauseKey(state, 'KeyP', true, true), false);
    }
    assert.equal(state.paused, true);
});

test('other keys leave the pause state untouched', () => {
    const state = createPauseState();
    for (const code of ['KeyW', 'KeyC', 'KeyR', 'ShiftLeft']) {
        assert.equal(applyPauseKey(state, code, true), false);
    }
    assert.equal(state.paused, false);
});

test('P is not a flight control, so pausing never moves a control surface', () => {
    const input = createInputState();
    assert.equal(applyKeyToInput(input, PAUSE_KEY, true), null);
    assert.deepEqual(input, createInputState());
});

test('simulationDelta freezes the clock while paused and passes it through otherwise', () => {
    const state = createPauseState();
    assert.equal(simulationDelta(state, 0.016), 0.016);
    togglePause(state);
    assert.equal(simulationDelta(state, 0.016), 0);
    assert.equal(simulationDelta(state, 12.5), 0, 'a long pause never leaks in as one big step');
    togglePause(state);
    assert.equal(simulationDelta(state, 0.033), 0.033);
});
