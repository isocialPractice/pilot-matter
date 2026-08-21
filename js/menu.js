/**
 * Keyboard menu - the pause menu's entries, the cursor over them, and the
 * keys that move and choose. The selection rules are pure and have no DOM or
 * Three.js dependency so they can be unit tested in Node; the small class at
 * the bottom is the list they are drawn into.
 */

export const PAUSE_MENU_ENTRIES = [
    { id: 'resume',   label: 'RESUME' },
    { id: 'reset',    label: 'RESET FLIGHT' },
    { id: 'controls', label: 'CONTROLS' }
];

// The cursor moves on the same keys the aircraft pitches with, so a hand
// already on the controls never has to go looking for the menu.
export const MENU_UP_KEYS     = ['ArrowUp', 'KeyW'];
export const MENU_DOWN_KEYS   = ['ArrowDown', 'KeyS'];
export const MENU_SELECT_KEYS = ['Enter', 'NumpadEnter', 'Space'];

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

/** The menu as a list on screen, with the cursor drawn as the selected row. */
export class PauseMenu {
    constructor(listElement, state) {
        this.list  = listElement;
        this.items = state.entries.map(entry => {
            const item = document.createElement('li');
            item.textContent = entry.label;
            item.dataset.entry = entry.id;
            this.list.appendChild(item);
            return item;
        });
    }

    render(state) {
        this.items.forEach((item, index) => {
            item.classList.toggle('selected', index === state.index);
        });
    }
}
