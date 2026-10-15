import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
    HELP_KEY,
    HELP_HINT,
    HELP_BINDING_ROWS,
    createHelpState,
    isHelpKey,
    toggleHelp,
    expandHelp,
    applyHelpKey,
    helpRowKeys,
    helpRowText,
    helpRowLines
} from '../js/controls-help.js';
import { createInputState, applyKeyToInput } from '../js/input-map.js';
import { CONTROL_REFERENCE_LABEL } from '../js/control-settings.js';
import {
    BINDING_NAMES, UNBOUND_LABEL, defaultBindings, rebind, clearBinding
} from '../js/key-bindings.js';

const read = (path) => readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), 'utf8');

const indexHtml  = read('index.html');
// js/main.js imports Three.js, so what it does with the list is read off its
// source rather than by opening one.
const mainSource = read('js/main.js');

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

// --- The list the keys are read off -----------------------------------------

/**
 * The list used to be written into the page and left there, which was right
 * while nothing could move a key. A pilot who has rebound one reads this list
 * first, so a row still naming the key the game shipped with would be the one
 * thing on screen contradicting the panel that moved it.
 */
test('every row that names a movable key is written from the map', () => {
    const named = HELP_BINDING_ROWS.flatMap(row => row.bindings);

    assert.equal(new Set(named).size, named.length, 'a binding named on two rows is two rows to keep');
    for (const name of named) {
        assert.ok(BINDING_NAMES.includes(name), `${name} should be a binding there is a key for`);
    }
    for (const name of BINDING_NAMES) {
        assert.ok(named.includes(name), `${name} can be moved, so the list has to be able to say where to`);
    }
});

test('a row reads as the keys it is on and then what they do', () => {
    const lines = helpRowLines();

    assert.equal(lines.pitch, 'W/S or ↑/↓ - Pitch',
        'the keys of a pair read down the alternatives rather than across the controls');
    assert.equal(lines.roll, 'A/D or ←/→ - Roll');
    assert.equal(lines.yaw, 'Q/E - Yaw');
    assert.equal(lines.throttleUp, 'Shift - Throttle Up',
        'and an alternative that reads the same as the one before it is written once');
    assert.equal(lines.throttleDown, 'Ctrl - Throttle Down');
    assert.equal(lines.levelOff, 'Space - Level Off');
    assert.equal(lines.reset, 'R - Reset Position');
});

test('a key moved is a row that names the key it was moved to', () => {
    const bindings = defaultBindings();
    rebind(bindings, 'pitchUp', 'KeyI');

    assert.equal(helpRowLines(bindings).pitch, 'I/S or ↓ - Pitch',
        'a control on one key runs out of alternatives, and the other end of the pair keeps its own');

    rebind(bindings, 'pitchDown', 'KeyK');
    assert.equal(helpRowLines(bindings).pitch, 'I/K - Pitch',
        'with both ends on one key there is one way to fly the axis and one row to say so');

    assert.equal(helpRowKeys(HELP_BINDING_ROWS.find(row => row.id === 'pitch'), bindings), 'I/K');
});

test('a row for a binding on no key says so rather than going blank', () => {
    const bindings = defaultBindings();
    clearBinding(bindings, 'reset');

    assert.equal(helpRowText(HELP_BINDING_ROWS.find(row => row.id === 'reset'), bindings),
        `${UNBOUND_LABEL} - Reset Position`);
});

/**
 * The page carries the rows as the game ships them, and the script rewrites
 * them from the map. Those two readings have to be one reading on a first
 * flight, or the list changes under a pilot who has touched nothing.
 */
test('the rows written into the page are the rows the map writes', () => {
    const list = indexHtml.match(/<div id="controls-help-list">([\s\S]*?)<\/div>/);
    assert.ok(list, 'index.html should carry the control list');

    const lines = helpRowLines();
    for (const row of HELP_BINDING_ROWS) {
        const written = list[1].match(new RegExp(`<span data-help-row="${row.id}">([^<]*)</span>`));
        assert.ok(written, `index.html should carry a ${row.id} row the script can write into`);
        assert.equal(written[1], lines[row.id],
            `the ${row.id} row in the page and the one the map writes should be one line`);
    }
});

// A row the script cannot find is a row that goes stale the moment a key moves.
test('the script writes every row the page marks, and marks every row it writes', () => {
    const marked = [...indexHtml.matchAll(/data-help-row="([^"]*)"/g)].map(match => match[1]);

    assert.deepEqual(marked, HELP_BINDING_ROWS.map(row => row.id),
        'the page should mark exactly the rows the map writes, in the order it writes them');
    assert.ok(mainSource.includes('helpRowLines(controlBindings(this.controlSettings))'),
        'js/main.js should write the rows from the map the panel holds');
    assert.ok(/querySelectorAll\('#controls-help-list \[data-help-row\]'\)/.test(mainSource),
        'reading the rows off the page by the mark they carry');
});
