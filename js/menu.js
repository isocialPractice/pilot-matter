/**
 * Menu - the entries of the menus the game is flown through, the cursor over
 * them, and the keys and the pointer that move and choose. The selection rules
 * are pure and have no DOM or Three.js dependency so they can be unit tested in
 * Node; the small class at the bottom is the list they are drawn into, and
 * every menu on screen is one of them.
 */

// The menu the game opens on, before the first flight.
export const START_MENU_ENTRIES = [
    { id: 'start',    label: 'START FLIGHT' },
    { id: 'modes',    label: 'GAME MODES' },
    { id: 'controls', label: 'CONTROLS' },
    { id: 'settings', label: 'SETTINGS' }
];

// The menu over a paused flight. Game Modes, Controls, and Settings answer to
// the same ids the start menu uses, so both screens open the same thing.
export const PAUSE_MENU_ENTRIES = [
    { id: 'resume',   label: 'RESUME' },
    { id: 'reset',    label: 'RESET FLIGHT' },
    { id: 'modes',    label: 'GAME MODES' },
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

/**
 * Puts a menu on a different set of entries, keeping the cursor on the list
 * rather than off the end of it.
 *
 * A menu whose rows open and shut is shorter one moment than the next, and a
 * cursor left where it was would be pointing past the last row - which walks
 * as though the list were still the length it used to be.
 */
export function setMenuEntries(state, entries = []) {
    state.entries = entries;
    state.index = Math.min(Math.max(state.index, 0), Math.max(0, entries.length - 1));
    return state;
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
 * True for any key a menu works with at all, whether it moves the cursor,
 * chooses an entry, or steps the value under it.
 *
 * Every one of them also flies the aircraft, which is the reason this exists:
 * a menu on screen has to be able to take its keys before the flight behind it
 * reads them, or walking a list would pitch and roll the aircraft under it.
 */
export function isMenuControlKey(code) {
    return isMenuKey(code) || isMenuAdjustKey(code);
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
 * Which way a click on a row steps the value on it, from where along the row it
 * landed: the left half steps down and the right half steps up.
 *
 * A row holding a value is drawn `LABEL  ‹ VALUE ›`, so it reads as a control
 * with a down at one end and an up at the other - and every control of that
 * shape reads left as down. A click that stepped the value up wherever it
 * landed did the opposite of what the row looked like, on half of every press.
 *
 * A row of no width - one nothing has laid out yet - has no halves to be
 * clicked in, so it steps up, which is what choosing a row has always done.
 */
export function menuPointerStep(offsetX, width) {
    return width > 0 && offsetX < width / 2 ? -1 : 1;
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
 * Applies the pointer to the menu, as the entry it is over and whether it was
 * clicked there. The cursor follows the pointer, so the mouse and the keys move
 * one cursor rather than two, and a click chooses the entry under the pointer
 * rather than the one the keys were last left on.
 *
 * An index naming no entry - the gap between two rows, or a row drawn from a
 * menu that has changed under it - moves nothing and chooses nothing.
 *
 * Returns the id of the entry chosen, or null when the pointer only moved the
 * cursor or was over nothing.
 */
export function applyMenuPointer(state, index, choose = false) {
    if (!state.entries[index]) return null;
    state.index = index;
    return choose ? selectedId(state) : null;
}

/**
 * Hands several lists to one pointer handler, which is what a panel drawing one
 * menu across more than one list needs: the entry a click reports is its place
 * in the whole menu whichever list it was drawn into, so three lists under three
 * headings are worked as the one menu the cursor already treats them as.
 *
 * Returns the lists, so the wiring reads as one statement.
 */
export function followPointers(lists = [], handler) {
    for (const list of lists) list?.followPointer(handler);
    return lists;
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
 *
 * A list can also be handed to the mouse, and then reports the entry the
 * pointer crosses onto and the entry it is clicked on. A list that is not
 * handed to it is worked with the keys alone.
 */
/**
 * Which way a click on a drawn row steps it. The row is measured rather than
 * asked for an offset, because a click reports where it landed in the box it
 * was caught on and a row can carry marks of its own.
 */
function clickStep(event, item) {
    const box = item.getBoundingClientRect?.();
    if (!box) return 1;
    return menuPointerStep(event.clientX - box.left, box.width);
}

export class MenuList {
    constructor(listElement, state, include = () => true) {
        this.list    = listElement;
        this.include = include;
        this.items   = [];
        // Where the cursor was when the list was last drawn, so a redraw can
        // tell a cursor that moved from a list that was simply redrawn.
        this.cursor = null;
        // Who is told about the pointer, and null for a list nobody has handed
        // to it, which is a list worked with the keys alone.
        this.handler = null;

        this.build(state);
    }

    /** Draws a row for every entry this list keeps, in the order they come. */
    build(state) {
        state.entries.forEach((entry, index) => {
            if (!this.include(entry, index)) return;

            const item = document.createElement('li');
            item.textContent = entry.text ?? entry.label;
            item.dataset.entry = entry.id;
            // What kind of row this is, for a panel that draws one kind
            // differently from another. Written as data rather than as a class
            // so it cannot collide with the three the cursor already uses.
            if (entry.kind) item.dataset.kind = entry.kind;
            if (entry.note) item.dataset.note = entry.note;

            this.list.appendChild(item);
            this.items.push({ index, item });
        });
        return this.items.length;
    }

    /**
     * Draws the list again, from a menu whose entries are no longer the ones it
     * was built with.
     *
     * A list built once is enough for a menu that is a fixed set of rows, which
     * every menu here was until one of them started opening and shutting its
     * sections. A menu that grows and shrinks has to have its rows built again
     * to be walked at all: the rows carry their place in the menu, and a place
     * that has moved is a row pointing at somebody else's entry.
     *
     * The list goes back to the mouse afterwards where it was ever handed to
     * it, because the rows the pointer was listening on have gone.
     */
    rebuild(state) {
        for (const { item } of this.items) item.remove();
        this.items.length = 0;
        this.cursor = null;

        this.build(state);
        if (this.handler) this.followPointer(this.handler);

        return this;
    }

    /**
     * Hands the drawn list to the mouse: the handler is called as the pointer
     * crosses onto an entry, and again when one is clicked. A list nobody hands
     * to the mouse listens for nothing, which is how a menu stays keyboard-only.
     *
     * The handler is given an entry's place in the whole menu rather than its
     * row in this list, so a filtered list points at the same entry the cursor
     * walks to rather than at whatever sits that far down the panel.
     *
     * A click also reports which way it steps a value, read off which half of
     * the row it landed in. The cursor does not care, and a row holding a value
     * does: the marks either side of the reading say the row is stepped, so
     * which side was pressed is half of what the press meant.
     */
    followPointer(handler) {
        this.handler = handler;

        for (const { index, item } of this.items) {
            item.addEventListener('mouseenter', () => handler(index, false));
            item.addEventListener('click', (event) => handler(index, true, clickStep(event, item)));
        }
        return this;
    }

    /**
     * True once the list has been handed to the mouse, so a caller can tell a
     * list that is worked with the pointer from one worked with the keys alone.
     */
    get pointed() {
        return this.handler != null;
    }

    render(state) {
        for (const { index, item } of this.items) {
            const entry = state.entries[index];
            item.textContent = entry?.text ?? entry?.label ?? '';
            item.classList.toggle('selected', index === state.index);
            item.classList.toggle('current', entry?.current === true);
            // An entry something other than the pilot is holding, which is
            // drawn as set rather than as changeable.
            item.classList.toggle('locked', entry?.locked === true);
        }

        // A panel with more entries than a short window can hold scrolls, and a
        // cursor that had walked off the top of it would be a cursor nobody
        // could follow. Only a cursor that has just moved asks to be seen, so a
        // redraw of a list nothing moved in leaves the panel where it was left.
        if (state.index !== this.cursor) {
            this.cursor = state.index;
            this.items.find(({ index }) => index === state.index)
                ?.item.scrollIntoView?.({ block: 'nearest' });
        }
    }
}
