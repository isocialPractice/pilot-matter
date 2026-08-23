/**
 * Keyboard menu - the entries of the menus the game is flown through, the
 * cursor over them, and the keys that move and choose. The selection rules are
 * pure and have no DOM or Three.js dependency so they can be unit tested in
 * Node; the small class at the bottom is the list they are drawn into, and
 * every menu on screen is one of them.
 */

// The menu the game opens on, before the first flight.
export const START_MENU_ENTRIES = [
    { id: 'start',    label: 'START FLIGHT' },
    { id: 'controls', label: 'CONTROLS' },
    { id: 'settings', label: 'SETTINGS' }
];

// The menu over a paused flight. Controls and Settings answer to the same ids
// the start menu uses, so both screens open the same thing.
export const PAUSE_MENU_ENTRIES = [
    { id: 'resume',   label: 'RESUME' },
    { id: 'reset',    label: 'RESET FLIGHT' },
    { id: 'controls', label: 'CONTROLS' },
    { id: 'settings', label: 'SETTINGS' }
];

// The cursor moves on the same keys the aircraft pitches with, so a hand
// already on the controls never has to go looking for the menu.
export const MENU_UP_KEYS     = ['ArrowUp', 'KeyW'];
export const MENU_DOWN_KEYS   = ['ArrowDown', 'KeyS'];
export const MENU_SELECT_KEYS = ['Enter', 'NumpadEnter', 'Space'];

// An entry that holds a value rather than an action is stepped left and right
// on the keys the aircraft rolls with, for the same reason.
export const MENU_LEFT_KEYS  = ['ArrowLeft', 'KeyA'];
export const MENU_RIGHT_KEYS = ['ArrowRight', 'KeyD'];

export function createMenuState(entries = PAUSE_MENU_ENTRIES) {
    return { entries, index: 0 };
}

export function selectedEntry(state) {
    return state.entries[state.index] ?? null;
}

export function selectedId(state) {
    return selectedEntry(state)?.id ?? null;
}

/**
 * Moves the cursor by a number of entries, wrapping round both ends so the
 * list has no dead stop at the top or the bottom.
 */
export function moveSelection(state, step) {
    const count = state.entries.length;
    if (count === 0) return null;
    state.index = (((state.index + step) % count) + count) % count;
    return selectedEntry(state);
}

/** Puts the cursor back on the first entry, the way the menu opens. */
export function resetSelection(state) {
    state.index = 0;
    return selectedEntry(state);
}

/** True for any key the menu acts on, so the caller knows to keep it. */
export function isMenuKey(code) {
    return MENU_UP_KEYS.includes(code)
        || MENU_DOWN_KEYS.includes(code)
        || MENU_SELECT_KEYS.includes(code);
}

/**
 * True for a key that steps the entry under the cursor rather than moving the
 * cursor itself. Kept apart from `isMenuKey` because only a menu carrying
 * values has anything to step: a menu of actions leaves these keys alone.
 */
export function isMenuAdjustKey(code) {
    return MENU_LEFT_KEYS.includes(code) || MENU_RIGHT_KEYS.includes(code);
}

/**
 * Which way an adjust key steps a value, as a number of places along the list
 * of settings it can take. A key that steps nothing is zero.
 */
export function menuAdjustStep(code) {
    if (MENU_LEFT_KEYS.includes(code))  return -1;
    if (MENU_RIGHT_KEYS.includes(code)) return 1;
    return 0;
}

/**
 * Applies a key event to the menu. Key releases and auto-repeat are ignored,
 * so a held key neither runs the cursor down the list nor chooses an entry
 * over and over.
 *
 * Returns the id of the entry chosen, or null when the key only moved the
 * cursor or meant nothing to the menu.
 */
export function applyMenuKey(state, code, down, repeat = false) {
    if (!down || repeat) return null;
    if (MENU_UP_KEYS.includes(code))     { moveSelection(state, -1); return null; }
    if (MENU_DOWN_KEYS.includes(code))   { moveSelection(state,  1); return null; }
    if (MENU_SELECT_KEYS.includes(code)) return selectedId(state);
    return null;
}

/**
 * A menu as a list on screen, with the cursor drawn as the selected row.
 *
 * An entry can also mark itself as the one currently in force - the
 * environment being flown, in the settings panel - which is drawn apart from
 * the cursor, because what is chosen and what is under the cursor are two
 * different things. An entry carrying a `text` is drawn as that rather than as
 * its label, which is how an entry holding a value shows the value.
 *
 * A list can be given a filter, and then draws only the entries it keeps while
 * still answering to the cursor of the whole menu. That is what lets one set of
 * entries be split across the headings of a panel without splitting the cursor
 * that walks them.
 */
export class MenuList {
    constructor(listElement, state, include = () => true) {
        this.list  = listElement;
        this.items = [];

        state.entries.forEach((entry, index) => {
            if (!include(entry, index)) return;

            const item = document.createElement('li');
            item.textContent = entry.text ?? entry.label;
            item.dataset.entry = entry.id;
            if (entry.note) item.dataset.note = entry.note;

            this.list.appendChild(item);
            this.items.push({ index, item });
        });
    }

    render(state) {
        for (const { index, item } of this.items) {
            const entry = state.entries[index];
            item.textContent = entry?.text ?? entry?.label ?? '';
            item.classList.toggle('selected', index === state.index);
            item.classList.toggle('current', entry?.current === true);
        }
    }
}
