/**
 * The builder's picker - the six canvases a session can start from, which one
 * is chosen, and the two rows under them.
 *
 * It is a list over the environment registry rather than six cards written out
 * by hand, so a preset added to `js/environment/presets.js` is a card here
 * without an edit. Highlands is the default because it is the world the
 * simulator already opens on.
 *
 * Pure module with no DOM or Three.js dependency, so the entries and the choice
 * can be unit tested in Node. The cards are drawn by `index.html` through the
 * same menu machinery every other panel is drawn with.
 */

import { BUILDER_ENVIRONMENTS, DEFAULT_ENVIRONMENT_ID } from './environment/presets.js';
import { BUILDER_LABEL } from './build-mode.js';

/** The picker carries the name of the entry that opened it, and not a second one. */
export const PICKER_TITLE = BUILDER_LABEL;

export const PICKER_HEADING = 'CHOOSE A CANVAS';

export const PICKER_START_ID    = 'picker-start';
export const PICKER_START_LABEL = 'START';

export const PICKER_BACK_ID    = 'picker-back';
export const PICKER_BACK_LABEL = 'BACK';

/** What a row of the picker is: a canvas to start from, or one of the two answers. */
export const CARD_ENTRY   = 'card';
export const ACTION_ENTRY = 'action';

/**
 * The canvases, in the order the registry holds them, each as the label band
 * and the line of description the card carries.
 *
 * The thumbnail the card is drawn over is art the builder ships, which arrives
 * with it; until then the band and the description are the card.
 */
export function pickerCards() {
    return BUILDER_ENVIRONMENTS.map(environment => ({
        id: environment.id,
        label: environment.label,
        note: environment.description,
        kind: CARD_ENTRY
    }));
}

/** Every id the picker offers as a canvas, which is what a stored choice is held to. */
export function pickerEnvironmentIds() {
    return BUILDER_ENVIRONMENTS.map(environment => environment.id);
}

/** True for a canvas the picker offers, so nothing else can be started on. */
export function isPickerEnvironmentId(id) {
    return pickerEnvironmentIds().includes(id);
}

export function createPickerState(chosen = DEFAULT_ENVIRONMENT_ID) {
    return { chosen: isPickerEnvironmentId(chosen) ? chosen : DEFAULT_ENVIRONMENT_ID };
}

/** Which canvas a `START` would open, which is the card drawn as chosen. */
export function pickerChoice(state) {
    return isPickerEnvironmentId(state?.chosen) ? state.chosen : DEFAULT_ENVIRONMENT_ID;
}

/**
 * The picker as one menu: the six cards, then the two rows beneath them.
 *
 * One menu rather than two, because one cursor walks the whole screen - the
 * same way the settings panel's three lists are one menu split across three
 * headings. The card that is chosen is marked `current`, which is what says
 * which canvas `START` would open, and is not the same thing as the card the
 * cursor happens to be over.
 */
export function pickerEntries(state) {
    const chosen = pickerChoice(state);

    return [
        ...pickerCards().map(card => ({ ...card, current: card.id === chosen })),
        { id: PICKER_START_ID, label: PICKER_START_LABEL, kind: ACTION_ENTRY },
        { id: PICKER_BACK_ID,  label: PICKER_BACK_LABEL,  kind: ACTION_ENTRY }
    ];
}

/** True for one of the two rows under the cards, which the panel draws apart. */
export function isPickerAction(id) {
    return id === PICKER_START_ID || id === PICKER_BACK_ID;
}

/** What choosing a row of the picker did. */
export const PICKER_CHOSE   = 'chose';
export const PICKER_STARTED = 'started';
export const PICKER_LEFT    = 'left';

/**
 * Applies a chosen row.
 *
 * A card moves the choice without leaving the picker, so a pilot can read the
 * six and settle on one. `START` opens the canvas on whatever the choice is
 * now, and `BACK` leaves the builder entirely rather than stepping back to
 * something behind the picker - there is nothing behind it.
 *
 * Returns what happened, or null for a row the picker does not offer.
 */
export function choosePickerEntry(state, id) {
    if (id === PICKER_START_ID) return { action: PICKER_STARTED, environment: pickerChoice(state) };
    if (id === PICKER_BACK_ID)  return { action: PICKER_LEFT };

    if (!isPickerEnvironmentId(id)) return null;

    state.chosen = id;
    return { action: PICKER_CHOSE, environment: id };
}
