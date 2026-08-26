import test from 'node:test';
import assert from 'node:assert/strict';
import {
    MenuList,
    PAUSE_MENU_ENTRIES,
    START_MENU_ENTRIES,
    MENU_SELECT_KEYS,
    MENU_LEFT_KEYS,
    MENU_RIGHT_KEYS,
    createMenuState,
    selectedEntry,
    selectedId,
    moveSelection,
    resetSelection,
    isMenuKey,
    isMenuAdjustKey,
    menuAdjustStep,
    applyMenuKey,
    applyMenuPointer
} from '../js/menu.js';
import { createInputState, applyKeyToInput } from '../js/input-map.js';

test('the pause menu offers a way out, a way back to the start, and the three panels', () => {
    const ids = PAUSE_MENU_ENTRIES.map(entry => entry.id);
    assert.deepEqual(ids, ['resume', 'reset', 'modes', 'controls', 'settings']);
    assert.equal(new Set(ids).size, ids.length, 'two entries answering to one id is one entry too many');
    for (const entry of PAUSE_MENU_ENTRIES) {
        assert.ok(entry.label.length > 0, `${entry.id} needs a label to be read by`);
    }
});

test('the start menu begins the flight, and reaches the three panels', () => {
    const ids = START_MENU_ENTRIES.map(entry => entry.id);
    assert.deepEqual(ids, ['start', 'modes', 'controls', 'settings']);
    assert.equal(selectedId(createMenuState(START_MENU_ENTRIES)), 'start',
        'the cursor should open on the entry that starts flying');
});

// Both screens open the same three panels, so the entries that do it answer to
// the same ids rather than to two names for one thing.
test('the entries the two menus share are the same entries', () => {
    for (const id of ['modes', 'controls', 'settings']) {
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
    assert.equal(moveSelection(state, 1).id, 'modes');
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

// An entry holding a value is stepped where an entry holding an action is
// chosen, and the two sets of keys are kept apart so a menu of actions is
// never quietly adjusted by the roll keys.
test('the roll keys step a value, in the direction they are pressed', () => {
    for (const code of MENU_LEFT_KEYS)  assert.equal(menuAdjustStep(code), -1);
    for (const code of MENU_RIGHT_KEYS) assert.equal(menuAdjustStep(code), 1);
    for (const code of [...MENU_LEFT_KEYS, ...MENU_RIGHT_KEYS]) {
        assert.equal(isMenuAdjustKey(code), true);
        assert.equal(isMenuKey(code), false, `${code} steps an entry rather than moving the cursor`);
    }
});

test('a key that steps nothing steps nowhere', () => {
    for (const code of ['ArrowUp', 'KeyW', 'Enter', 'KeyQ']) {
        assert.equal(isMenuAdjustKey(code), false);
        assert.equal(menuAdjustStep(code), 0);
    }
});

test('stepping an entry is not choosing it, so a step never runs a menu entry', () => {
    const state = createMenuState();
    for (const code of [...MENU_LEFT_KEYS, ...MENU_RIGHT_KEYS]) {
        assert.equal(applyMenuKey(state, code, true), null, `${code} should not choose an entry`);
    }
    assert.equal(state.index, 0, 'nor move the cursor');
});

// --- The pointer over the menu ---

test('the pointer moves the cursor onto the entry it is over', () => {
    const state = createMenuState();
    assert.equal(applyMenuPointer(state, 3), null, 'crossing an entry chooses nothing');
    assert.equal(selectedId(state), 'controls');
    assert.equal(applyMenuPointer(state, 1), null);
    assert.equal(selectedId(state), 'reset');
});

// The keys leave the cursor on the entry they last walked to, and the pointer is
// somewhere else entirely by then. A click means the entry under the pointer.
test('a click chooses the entry under the pointer, not the one the keys left', () => {
    const state = createMenuState();
    assert.equal(selectedId(state), 'resume', 'the keyboard cursor opens on the first entry');
    assert.equal(applyMenuPointer(state, 4, true), 'settings');
    assert.equal(state.index, 4, 'and the cursor is left where the click landed');
});

test('the mouse and the keys move one cursor rather than two', () => {
    const state = createMenuState();
    applyMenuPointer(state, 3);
    assert.equal(applyMenuKey(state, 'ArrowDown', true), null);
    assert.equal(selectedId(state), 'settings', 'the keys carry on from where the pointer left off');
    assert.equal(applyMenuKey(state, 'Enter', true), 'settings');
});

test('a pointer over nothing moves nothing and chooses nothing', () => {
    const state = createMenuState();
    moveSelection(state, 1);
    for (const index of [-1, state.entries.length, 99, undefined, null]) {
        assert.equal(applyMenuPointer(state, index, true), null, `${index} names no entry`);
        assert.equal(state.index, 1, `so the cursor stays where it was for ${index}`);
    }
});

test('an empty menu has nothing under the pointer either', () => {
    const state = createMenuState([]);
    assert.equal(applyMenuPointer(state, 0, true), null);
    assert.equal(state.index, 0);
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
// draw it in: elements that remember what was set on them, and a mouse that is
// the page reporting itself rather than a hand on a desk.
function fakeList() {
    const element = () => ({
        children: [],
        dataset: {},
        textContent: '',
        classes: new Set(),
        listeners: {},
        classList: {
            toggle(name, on) { on ? this.owner.classes.add(name) : this.owner.classes.delete(name); }
        },
        appendChild(child) { this.children.push(child); return child; },
        addEventListener(type, handler) { (this.listeners[type] ??= []).push(handler); },
        fire(type) { for (const handler of this.listeners[type] ?? []) handler(); }
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

// The settings panel splits one set of entries across two headings, so a list
// has to be able to draw part of a menu while the cursor still walks all of it.
test('a filtered list draws its own entries and answers to the whole cursor', () => {
    const state = createMenuState([
        { id: 'first',  label: 'FIRST',  kind: 'a' },
        { id: 'second', label: 'SECOND', kind: 'b' },
        { id: 'third',  label: 'THIRD',  kind: 'b' }
    ]);

    const list = fakeList();
    const menu = new MenuList(list, state, entry => entry.kind === 'b');

    assert.deepEqual(list.children.map(item => item.dataset.entry), ['second', 'third']);

    state.index = 0;
    menu.render(state);
    assert.deepEqual(list.children.map(item => item.classes.has('selected')), [false, false],
        'a cursor on an entry this list does not draw is drawn on none of them');

    state.index = 2;
    menu.render(state);
    assert.deepEqual(list.children.map(item => item.classes.has('selected')), [false, true]);
});

// An entry holding a value shows the value, and the value changes under it.
test('an entry carrying its own text is drawn as that text, and redrawn as it changes', () => {
    const entry = { id: 'fog', label: 'FOG DENSITY', text: 'FOG DENSITY  NORMAL' };
    const state = createMenuState([entry]);

    const list = fakeList();
    const menu = new MenuList(list, state);
    assert.equal(list.children[0].textContent, 'FOG DENSITY  NORMAL');

    entry.text = 'FOG DENSITY  THICK';
    menu.render(state);
    assert.equal(list.children[0].textContent, 'FOG DENSITY  THICK');
});

// --- The list under the mouse ---

test('a drawn list reports the entry the pointer crosses and the entry it clicks', () => {
    const list = fakeList();
    const menu = new MenuList(list, createMenuState());

    const seen = [];
    menu.followPointer((index, choose) => seen.push([index, choose]));

    list.children[2].fire('mouseenter');
    list.children[2].fire('click');
    assert.deepEqual(seen, [[2, false], [2, true]]);
});

// A menu nobody hands to the mouse is a menu the mouse does nothing to, which
// is how the panels stay worked by the keys alone.
test('a list not handed to the mouse listens for nothing', () => {
    const list = fakeList();
    new MenuList(list, createMenuState());

    for (const item of list.children) {
        assert.deepEqual(Object.keys(item.listeners), []);
    }
});

// A filtered list draws some of a menu, so a row's place on screen and its place
// in the menu are two different numbers. Reporting the wrong one would choose a
// different entry from the one that was clicked.
test('a filtered list points at the entry it drew rather than the row it drew it in', () => {
    const state = createMenuState([
        { id: 'first',  label: 'FIRST',  kind: 'a' },
        { id: 'second', label: 'SECOND', kind: 'b' },
        { id: 'third',  label: 'THIRD',  kind: 'b' }
    ]);

    const list = fakeList();
    const menu = new MenuList(list, state, entry => entry.kind === 'b');

    let chosen = null;
    menu.followPointer((index, choose) => { chosen = applyMenuPointer(state, index, choose); });

    list.children[0].fire('click');
    assert.equal(chosen, 'second', 'the first row drawn is the second entry of the menu');
    assert.equal(state.index, 1);
});

// The cursor is drawn where the state says it is, whichever moved it there, so
// a menu worked with the mouse is a menu that looks worked.
test('the cursor is redrawn on the entry the pointer moved it to', () => {
    const list = fakeList();
    const state = createMenuState();
    const menu = new MenuList(list, state);

    menu.followPointer((index, choose) => {
        applyMenuPointer(state, index, choose);
        menu.render(state);
    });

    list.children[3].fire('mouseenter');
    assert.deepEqual(list.children.map(item => item.classes.has('selected')),
        [false, false, false, true, false]);
});

test('an empty menu has nothing to select and does not fall over being asked', () => {
    const state = createMenuState([]);
    assert.equal(selectedEntry(state), null);
    assert.equal(selectedId(state), null);
    assert.equal(moveSelection(state, 1), null);
    assert.equal(applyMenuKey(state, 'Enter', true), null);
});
