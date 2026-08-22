import test from 'node:test';
import assert from 'node:assert/strict';
import {
    MenuList,
    PAUSE_MENU_ENTRIES,
    START_MENU_ENTRIES,
    MENU_SELECT_KEYS,
    createMenuState,
    selectedEntry,
    selectedId,
    moveSelection,
    resetSelection,
    isMenuKey,
    applyMenuKey
} from '../js/menu.js';
import { createInputState, applyKeyToInput } from '../js/input-map.js';

test('the pause menu offers a way out, a way back to the start, the controls, and the settings', () => {
    const ids = PAUSE_MENU_ENTRIES.map(entry => entry.id);
    assert.deepEqual(ids, ['resume', 'reset', 'controls', 'settings']);
    assert.equal(new Set(ids).size, ids.length, 'two entries answering to one id is one entry too many');
    for (const entry of PAUSE_MENU_ENTRIES) {
        assert.ok(entry.label.length > 0, `${entry.id} needs a label to be read by`);
    }
});

test('the start menu begins the flight, and reaches the controls and the settings', () => {
    const ids = START_MENU_ENTRIES.map(entry => entry.id);
    assert.deepEqual(ids, ['start', 'controls', 'settings']);
    assert.equal(selectedId(createMenuState(START_MENU_ENTRIES)), 'start',
        'the cursor should open on the entry that starts flying');
});

// Both screens open the same two panels, so the entries that do it answer to
// the same ids rather than to two names for one thing.
test('the entries the two menus share are the same entries', () => {
    for (const id of ['controls', 'settings']) {
        assert.ok(START_MENU_ENTRIES.some(entry => entry.id === id), `the start menu should offer ${id}`);
        assert.ok(PAUSE_MENU_ENTRIES.some(entry => entry.id === id), `the pause menu should offer ${id}`);
    }
});

test('the menu opens on its first entry, so resuming is one key press away', () => {
    const state = createMenuState();
    assert.equal(state.index, 0);
    assert.equal(selectedId(state), 'resume');
});

test('the cursor walks the list in both directions', () => {
    const state = createMenuState();
    assert.equal(moveSelection(state, 1).id, 'reset');
    assert.equal(moveSelection(state, 1).id, 'controls');
    assert.equal(moveSelection(state, -1).id, 'reset');
});

test('the cursor wraps rather than stopping dead at either end', () => {
    const state = createMenuState();
    assert.equal(moveSelection(state, -1).id, 'settings', 'up from the top lands on the bottom');
    assert.equal(moveSelection(state, 1).id, 'resume', 'down from the bottom lands on the top');
});

test('the pitch keys move the cursor, so a hand on the controls stays there', () => {
    const state = createMenuState();
    for (const code of ['KeyS', 'ArrowDown']) {
        resetSelection(state);
        assert.equal(applyMenuKey(state, code, true), null, `${code} moves rather than chooses`);
        assert.equal(selectedId(state), 'reset');
    }
    for (const code of ['KeyW', 'ArrowUp']) {
        resetSelection(state);
        assert.equal(applyMenuKey(state, code, true), null);
        assert.equal(selectedId(state), 'settings');
    }
});

test('every select key chooses the entry under the cursor', () => {
    for (const code of MENU_SELECT_KEYS) {
        const state = createMenuState();
        assert.equal(applyMenuKey(state, code, true), 'resume');
        moveSelection(state, 1);
        assert.equal(applyMenuKey(state, code, true), 'reset');
    }
});

test('a key release chooses nothing, so one press is one choice', () => {
    const state = createMenuState();
    assert.equal(applyMenuKey(state, 'Enter', false), null);
    assert.equal(applyMenuKey(state, 'ArrowDown', false), null);
    assert.equal(state.index, 0, 'a release should not move the cursor either');
});

test('holding a key neither runs the cursor down the list nor chooses twice', () => {
    const state = createMenuState();
    assert.equal(applyMenuKey(state, 'ArrowDown', true, true), null);
    assert.equal(state.index, 0);
    assert.equal(applyMenuKey(state, 'Enter', true, true), null);
});

test('keys the menu knows nothing about are left alone', () => {
    const state = createMenuState();
    for (const code of ['KeyA', 'KeyD', 'KeyC', 'ShiftLeft']) {
        assert.equal(applyMenuKey(state, code, true), null);
        assert.equal(isMenuKey(code), false, `${code} is not a menu key`);
    }
    assert.equal(state.index, 0);
});

test('isMenuKey names every key the menu acts on', () => {
    for (const code of ['ArrowUp', 'ArrowDown', 'KeyW', 'KeyS', ...MENU_SELECT_KEYS]) {
        assert.equal(isMenuKey(code), true, `${code} should be kept for the menu`);
    }
});

test('reopening the menu puts the cursor back on the first entry', () => {
    const state = createMenuState();
    moveSelection(state, 2);
    assert.equal(resetSelection(state).id, 'resume');
    assert.equal(state.index, 0);
});

test('choosing an entry is not a flight control, so a choice never moves a surface', () => {
    const input = createInputState();
    for (const code of MENU_SELECT_KEYS) {
        assert.equal(applyKeyToInput(input, code, true), null, `${code} should not fly the aircraft`);
    }
    assert.deepEqual(input, createInputState());
});

// --- The list the menu is drawn into ---

// Enough of a document for the menu to draw itself into, with no browser to
// draw it in: elements that remember what was set on them.
function fakeList() {
    const element = () => ({
        children: [],
        dataset: {},
        textContent: '',
        classes: new Set(),
        classList: {
            toggle(name, on) { on ? this.owner.classes.add(name) : this.owner.classes.delete(name); }
        },
        appendChild(child) { this.children.push(child); return child; }
    });

    globalThis.document = {
        createElement: () => {
            const item = element();
            item.classList.owner = item;
            return item;
        }
    };
    return element();
}

test('the menu is drawn as the entries it holds, in the order it holds them', () => {
    const list = fakeList();
    const state = createMenuState();
    new MenuList(list, state);

    assert.deepEqual(list.children.map(item => item.textContent),
        PAUSE_MENU_ENTRIES.map(entry => entry.label));
    assert.deepEqual(list.children.map(item => item.dataset.entry),
        PAUSE_MENU_ENTRIES.map(entry => entry.id));
});

test('the cursor is drawn on one entry, and it is the selected one', () => {
    const list = fakeList();
    const state = createMenuState();
    const menu = new MenuList(list, state);

    for (let index = 0; index < state.entries.length; index++) {
        state.index = index;
        menu.render(state);
        const selected = list.children.filter(item => item.classes.has('selected'));
        assert.equal(selected.length, 1, 'a cursor on two entries is a cursor on neither');
        assert.equal(selected[0].dataset.entry, selectedId(state));
    }
});

// What is chosen and what is under the cursor are two different things, so an
// entry can be marked as the one in force without the cursor being on it.
test('the entry in force is drawn apart from the cursor', () => {
    const list = fakeList();
    const state = createMenuState([
        { id: 'first',  label: 'FIRST' },
        { id: 'second', label: 'SECOND', current: true }
    ]);
    const menu = new MenuList(list, state);
    menu.render(state);

    assert.deepEqual(list.children.map(item => item.classes.has('current')), [false, true]);
    assert.deepEqual(list.children.map(item => item.classes.has('selected')), [true, false]);
});

test('an empty menu has nothing to select and does not fall over being asked', () => {
    const state = createMenuState([]);
    assert.equal(selectedEntry(state), null);
    assert.equal(selectedId(state), null);
    assert.equal(moveSelection(state, 1), null);
    assert.equal(applyMenuKey(state, 'Enter', true), null);
});
