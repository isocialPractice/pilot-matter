import test from 'node:test';
import assert from 'node:assert/strict';
import {
    TITLE_NAME,
    START_HINT,
    createTitleState,
    startFlight,
    titleShowing,
    preFlightDelta
} from '../js/title-screen.js';
import { START_MENU_ENTRIES, createMenuState, applyMenuKey, selectedId } from '../js/menu.js';

test('the game opens on the title screen, before any flight', () => {
    const state = createTitleState();
    assert.equal(state.started, false);
    assert.equal(titleShowing(state), true);
});

test('the screen names the game and says how to work the menu on it', () => {
    assert.equal(TITLE_NAME, 'PILOT MATTER');
    assert.match(START_HINT, /SELECT/);
    assert.match(START_HINT, /CHOOSE/);
});

test('the flight starts when the menu says so, and not before', () => {
    const state = createTitleState();
    const menu = createMenuState(START_MENU_ENTRIES);

    // Walking the cursor down to Settings and back is not an answer
    applyMenuKey(menu, 'ArrowDown', true);
    assert.equal(titleShowing(state), true);

    applyMenuKey(menu, 'ArrowUp', true);
    assert.equal(selectedId(menu), 'start');
    assert.equal(applyMenuKey(menu, 'Enter', true), 'start');

    assert.equal(startFlight(state), true);
    assert.equal(titleShowing(state), false);
});

test('the title screen never comes back once the flight has started', () => {
    const state = createTitleState();
    startFlight(state);
    assert.equal(startFlight(state), false, 'a second answer changes nothing');
    assert.equal(titleShowing(state), false);
});

test('the clock is held until the flight starts', () => {
    const state = createTitleState();
    assert.equal(preFlightDelta(state, 0.016), 0);
    assert.equal(preFlightDelta(state, 45), 0, 'a long wait never leaks in as one big step');
    startFlight(state);
    assert.equal(preFlightDelta(state, 0.016), 0.016);
});
