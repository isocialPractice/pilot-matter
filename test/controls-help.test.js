import test from 'node:test';
import assert from 'node:assert/strict';
import {
    HELP_KEY,
    HELP_HINT,
    createHelpState,
    isHelpKey,
    toggleHelp,
    expandHelp,
    applyHelpKey
} from '../js/controls-help.js';
import { createInputState, applyKeyToInput } from '../js/input-map.js';
import { CONTROL_REFERENCE_LABEL } from '../js/control-settings.js';

test('the control list starts open, where a first flight needs it', () => {
    assert.equal(createHelpState().expanded, true);
});

test('the collapsed list still names the key that brings it back', () => {
    assert.ok(HELP_HINT.startsWith('H'), 'the hint should open with the H key');
    // Long enough to name the list, short enough to stay the one line the
    // collapse exists to leave behind. The shortest row of the list it
    // replaces is longer than this.
    assert.ok(HELP_HINT.length <= 24, 'the hint is a line, not a list');
});

// The row that opens the list, the heading the list carries and the line the
// collapsed list leaves behind are three sightings of one thing, so they are
// spelt one way. Collapsing a list should not look like swapping it for a
// different one.
test('the collapsed list is named for the list it reopens', () => {
    assert.ok(HELP_HINT.includes(CONTROL_REFERENCE_LABEL),
        `the hint "${HELP_HINT}" should name the ${CONTROL_REFERENCE_LABEL} list it brings back`);
});

test('isHelpKey matches only the H key code', () => {
    assert.equal(isHelpKey(HELP_KEY), true);
    assert.equal(isHelpKey('KeyH'), true);
    assert.equal(isHelpKey('KeyG'), false);
    assert.equal(isHelpKey('Help'), false);
});

test('toggleHelp flips the list and returns what it left it as', () => {
    const state = createHelpState();
    assert.equal(toggleHelp(state), false);
    assert.equal(state.expanded, false);
    assert.equal(toggleHelp(state), true);
});

test('pressing H collapses the list and pressing it again opens it', () => {
    const state = createHelpState();
    assert.equal(applyHelpKey(state, 'KeyH', true), true);
    assert.equal(state.expanded, false);
    assert.equal(applyHelpKey(state, 'KeyH', true), true);
    assert.equal(state.expanded, true);
});

test('releasing H does not toggle, so the list is a latch and not a hold', () => {
    const state = createHelpState();
    applyHelpKey(state, 'KeyH', true);
    assert.equal(applyHelpKey(state, 'KeyH', false), false);
    assert.equal(state.expanded, false, 'the list stays collapsed after H is released');
});

test('auto-repeat while holding H does not flicker the list', () => {
    const state = createHelpState();
    applyHelpKey(state, 'KeyH', true, false);
    for (let i = 0; i < 5; i++) {
        assert.equal(applyHelpKey(state, 'KeyH', true, true), false);
    }
    assert.equal(state.expanded, false);
});

test('other keys leave the list where it is', () => {
    const state = createHelpState();
    for (const code of ['KeyW', 'KeyP', 'Tab', 'ShiftLeft']) {
        assert.equal(applyHelpKey(state, code, true), false);
    }
    assert.equal(state.expanded, true);
});

test('the pause menu can reopen a list whose key has been forgotten', () => {
    const state = createHelpState();
    toggleHelp(state);
    assert.equal(expandHelp(state), true, 'reopening a collapsed list is a change');
    assert.equal(state.expanded, true);
    assert.equal(expandHelp(state), false, 'reopening an open list changes nothing');
    assert.equal(state.expanded, true);
});

test('H is not a flight control, so hiding the list never moves a surface', () => {
    const input = createInputState();
    assert.equal(applyKeyToInput(input, HELP_KEY, true), null);
    assert.deepEqual(input, createInputState());
});
