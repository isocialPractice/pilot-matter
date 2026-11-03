import test from 'node:test';
import assert from 'node:assert/strict';
import {
    pickerCards, pickerEnvironmentIds, isPickerEnvironmentId,
    createPickerState, pickerChoice, pickerEntries, choosePickerEntry, isPickerAction,
    PICKER_TITLE, PICKER_HEADING,
    PICKER_START_ID, PICKER_START_LABEL, PICKER_BACK_ID, PICKER_BACK_LABEL,
    CARD_ENTRY, ACTION_ENTRY, PICKER_CHOSE, PICKER_STARTED, PICKER_LEFT
} from '../js/build-picker.js';
import {
    ENVIRONMENTS, MODE_ENVIRONMENTS, BUILDER_ENVIRONMENTS, BLANK_CANVAS_ID,
    DEFAULT_ENVIRONMENT_ID, getEnvironment, isEnvironmentId
} from '../js/environment/presets.js';
import { BUILDER_LABEL } from '../js/build-mode.js';

test('the picker offers six canvases: the five worlds and the blank one', () => {
    const cards = pickerCards();

    assert.equal(cards.length, 6);
    assert.deepEqual(cards.map(card => card.id), [...ENVIRONMENTS.map(world => world.id), BLANK_CANVAS_ID]);
    assert.equal(cards[5].id, BLANK_CANVAS_ID, 'and the blank one is the sixth');
});

/**
 * The five are read off the registry rather than written out, so a preset added
 * to `js/environment/presets.js` is a card here without an edit - which is the
 * one thing this file exists to keep true.
 */
test('the five preset canvases are the registry rather than a list of their own', () => {
    for (const world of ENVIRONMENTS) {
        const card = pickerCards().find(entry => entry.id === world.id);
        assert.ok(card, `${world.id} should be a card`);
        assert.equal(card.label, world.label, 'under the label the registry gives it');
        assert.equal(card.note, world.description, 'and the line it describes itself with');
    }
});

test('a game mode world is not a canvas, because a mode brings its own ground', () => {
    for (const world of MODE_ENVIRONMENTS) {
        assert.equal(isPickerEnvironmentId(world.id), false, `${world.id} should not be offered`);
    }
});

test('every canvas the picker offers is a world something can be generated from', () => {
    for (const id of pickerEnvironmentIds()) {
        assert.equal(getEnvironment(id).id, id, `${id} should resolve to itself`);
    }

    assert.deepEqual(pickerEnvironmentIds(), BUILDER_ENVIRONMENTS.map(world => world.id));
});

// Highlands is the world the simulator already opens on, so it is the canvas
// the picker opens on.
test('Highlands is the canvas chosen before anything is chosen', () => {
    const state = createPickerState();

    assert.equal(pickerChoice(state), DEFAULT_ENVIRONMENT_ID);
    assert.equal(DEFAULT_ENVIRONMENT_ID, 'highlands');
});

test('a stored choice the picker does not offer reads as the default', () => {
    for (const id of ['open-country', 'nonsense', '', null, undefined]) {
        assert.equal(pickerChoice(createPickerState(id)), DEFAULT_ENVIRONMENT_ID,
            `${JSON.stringify(id)} names no canvas`);
    }

    assert.equal(pickerChoice(createPickerState(BLANK_CANVAS_ID)), BLANK_CANVAS_ID,
        'and one it does offer is kept');
});

test('the picker is the six cards and the two rows under them', () => {
    const entries = pickerEntries(createPickerState());

    assert.equal(entries.length, 8);
    assert.deepEqual(entries.slice(6).map(entry => entry.id), [PICKER_START_ID, PICKER_BACK_ID]);
    assert.equal(entries[6].label, PICKER_START_LABEL);
    assert.equal(entries[7].label, PICKER_BACK_LABEL);

    for (const entry of entries.slice(0, 6)) assert.equal(entry.kind, CARD_ENTRY);
    for (const entry of entries.slice(6)) assert.equal(entry.kind, ACTION_ENTRY);

    assert.ok(isPickerAction(PICKER_START_ID) && isPickerAction(PICKER_BACK_ID));
    assert.equal(isPickerAction(DEFAULT_ENVIRONMENT_ID), false);
});

// What is chosen and what the cursor is over are two different things, and the
// mark is what says which canvas START would open.
test('the chosen card is the one marked, and only that one', () => {
    const state = createPickerState(BLANK_CANVAS_ID);
    const marked = pickerEntries(state).filter(entry => entry.current === true);

    assert.equal(marked.length, 1);
    assert.equal(marked[0].id, BLANK_CANVAS_ID);
});

test('choosing a card moves the choice without leaving the picker', () => {
    const state = createPickerState();
    const chosen = choosePickerEntry(state, 'dune-sea');

    assert.deepEqual(chosen, { action: PICKER_CHOSE, environment: 'dune-sea' });
    assert.equal(pickerChoice(state), 'dune-sea');
});

test('START opens whatever the choice is now', () => {
    const state = createPickerState();
    choosePickerEntry(state, 'lakeside');

    assert.deepEqual(choosePickerEntry(state, PICKER_START_ID),
        { action: PICKER_STARTED, environment: 'lakeside' });
});

// The picker is the builder's first screen rather than a gate in front of it,
// so BACK leaves the builder rather than stepping back to something behind it.
test('BACK leaves, and says so rather than naming a canvas', () => {
    assert.deepEqual(choosePickerEntry(createPickerState(), PICKER_BACK_ID), { action: PICKER_LEFT });
});

test('a row the picker does not offer does nothing at all', () => {
    const state = createPickerState();

    assert.equal(choosePickerEntry(state, 'open-country'), null, 'a mode world is not a card');
    assert.equal(choosePickerEntry(state, 'nonsense'), null);
    assert.equal(pickerChoice(state), DEFAULT_ENVIRONMENT_ID, 'and the choice is where it was');
});

// A pilot who chooses one name should land on a screen carrying the same one.
test('the picker is headed with the name of the entry that opens it', () => {
    assert.equal(PICKER_TITLE, BUILDER_LABEL);
    assert.ok(PICKER_HEADING.length > 0, 'and says what the cards under it are');
});

/**
 * Blank Canvas sits beside `ENVIRONMENTS` rather than in it.
 *
 * Everything in that list is offered by the settings panel as a world to fly,
 * and flat green country is a poor thing to fly over - it is a thing to build
 * on. So the builder lists the five plus the one, and the settings panel goes
 * on offering the five.
 */
test('Blank Canvas is a canvas to build on rather than a world to fly', () => {
    assert.equal(isPickerEnvironmentId(BLANK_CANVAS_ID), true, 'the builder offers it');
    assert.equal(isEnvironmentId(BLANK_CANVAS_ID), false, 'and the settings panel does not');
    assert.ok(!ENVIRONMENTS.some(world => world.id === BLANK_CANVAS_ID),
        'so it is not in the list the panel reads');
});
