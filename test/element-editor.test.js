import test from 'node:test';
import assert from 'node:assert/strict';
import {
    EDITOR_OPEN_KEYS,
    EDITOR_CLOSE_KEYS,
    EDITOR_BACK_ID,
    EDITOR_RESTORE_ID,
    ELEMENT_ENTRY,
    RANGE_ENTRY,
    RESTORE_ENTRY,
    BACK_ENTRY,
    ELEMENT_OPEN_MARK,
    ELEMENT_SHUT_MARK,
    SHADE_RANGE,
    isEditorOpenKey,
    isEditorCloseKey,
    label,
    rangeStep,
    stepPlaces,
    rangeRows,
    shadeColor,
    editorElements,
    createEditorState,
    setEditorWorld,
    restoreEditor,
    editorShowing,
    openEditor,
    closeEditor,
    editorEntry,
    editorElement,
    adjustEditorRange,
    chooseEditorEntry,
    editorPlacements,
    setEditorClearance,
    heldOffRunway,
    EDITOR_CLEARED_NOTE,
    rowId
} from '../js/element-editor.js';
import {
    ELEMENTS, ELEMENT_ORDER, getElement, resolveConfig, createField, applyElement, createRandom
} from '../js/environment/elements.js';
import {
    ENVIRONMENTS, getEnvironment, DEFAULT_ENVIRONMENT_ID, buildEnvironment
} from '../js/environment/presets.js';
import { SETTINGS_OPEN_KEYS } from '../js/settings.js';
import { DEFAULT_KEYMAP, RESET_KEYS } from '../js/input-map.js';
import { HELP_KEY } from '../js/controls-help.js';
import { MUTE_KEY } from '../js/audio.js';
import { HUD_TOGGLE_KEY } from '../js/hud-visibility.js';

const highlands = getEnvironment('highlands');

// The keys the panel opens on cannot be keys that already do something, or the
// pilot who reaches for the editor pitches the aircraft instead.
test('the key that opens the editor is a key nothing else has taken', () => {
    const taken = new Set([
        ...Object.values(DEFAULT_KEYMAP).flat(),
        ...RESET_KEYS, ...SETTINGS_OPEN_KEYS,
        HELP_KEY, MUTE_KEY, HUD_TOGGLE_KEY
    ]);

    for (const code of EDITOR_OPEN_KEYS) {
        assert.ok(!taken.has(code), `${code} already does something else`);
        assert.ok(isEditorOpenKey(code));
    }
});

test('the panel is backed out of the way every other panel is', () => {
    assert.deepEqual(EDITOR_CLOSE_KEYS, ['Escape', 'Backspace']);
    for (const code of EDITOR_CLOSE_KEYS) assert.ok(isEditorCloseKey(code));
    assert.ok(!isEditorCloseKey('KeyZ'));
});

test('a range reads as words rather than as the name it is declared with', () => {
    assert.equal(label('treeHeight'), 'TREE HEIGHT');
    assert.equal(label('buildingHeight'), 'BUILDING HEIGHT');
    assert.equal(label('depth'), 'DEPTH');
});

// A step read off the bounds is a step that stays right when the bounds move,
// which is what keeps it from being a second number to maintain.
test('a step is a readable fraction of what the range allows', () => {
    assert.equal(rangeStep({ low: 0, high: 1 }), 0.02);
    assert.equal(rangeStep({ low: 50, high: 2000 }), 50);
    assert.equal(rangeStep({ low: 0, high: 100 }), 2);
    assert.equal(rangeStep({ low: 0, high: 5 }), 0.1);
});

test('a range with no width to it still has a step to move by', () => {
    assert.equal(rangeStep({ low: 7, high: 7 }), 1);
});

test('a step says how many places the reading it moves is written to', () => {
    assert.equal(stepPlaces(50), 0);
    assert.equal(stepPlaces(2), 0);
    assert.equal(stepPlaces(0.1), 1);
    assert.equal(stepPlaces(0.02), 2);
});

test('a span is two rows, because a span is two numbers', () => {
    const rows = rangeRows('height', { kind: 'span', low: 0, high: 900, default: [180, 500] });
    assert.deepEqual(rows.map(row => row.part), ['min', 'max']);
    assert.deepEqual(rows.map(row => row.label), ['HEIGHT MIN', 'HEIGHT MAX']);
    assert.deepEqual(rows.map(row => row.at), [0, 1]);
});

test('a gradient is two rows, one per end, stepped as a shade of itself', () => {
    const rows = rangeRows('color', { kind: 'gradient', default: { light: [1, 1, 1], dark: [0, 0, 0] } });
    assert.deepEqual(rows.map(row => row.shade), ['light', 'dark']);
    for (const row of rows) assert.equal(row.range, SHADE_RANGE);
});

test('anything else is one row and one number', () => {
    const rows = rangeRows('density', { kind: 'scalar', low: 0, high: 1, default: 0.5 });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].label, 'DENSITY');
    assert.equal(rows[0].part, 'value');
});

// A shade walks a colour along its own hue. It never leaves what a channel can
// hold, so a colour turned all the way up is white rather than an overflow.
test('a shade lightens and darkens without leaving the channel', () => {
    assert.deepEqual(shadeColor([0.4, 0.2, 0.1], 1), [0.4, 0.2, 0.1]);
    assert.deepEqual(shadeColor([0.4, 0.2, 0.1], 0.5), [0.2, 0.1, 0.05]);
    assert.deepEqual(shadeColor([0.8, 0.5, 0.2], 2), [1, 1, 0.4]);
    assert.deepEqual(shadeColor([0.8, 0.5, 0.2], 0), [0, 0, 0]);
});

// --- The world the panel is holding ---------------------------------------

test('the panel lists the elements the world places, in the order they are applied', () => {
    const elements = editorElements(highlands);
    assert.deepEqual(elements.map(element => element.type),
        highlands.elements.map(placement => placement.type)
            .sort((a, b) => ELEMENT_ORDER.indexOf(a) - ELEMENT_ORDER.indexOf(b)));
});

test('every range an element declares has a reading to show', () => {
    for (const element of editorElements(highlands)) {
        const declared = Object.keys(getElement(element.type).ranges);
        assert.deepEqual(Object.keys(element.config).sort(), declared.sort());
    }
});

// The preset is the description every world is generated from. An editor that
// wrote into it would leave the next flight over that world carrying edits
// nobody asked for.
test('editing a world never edits the preset it was described by', () => {
    const before = JSON.stringify(highlands);
    const state = createEditorState('highlands');
    const mountain = state.elements.find(element => element.type === 'mountain');

    chooseEditorEntry(state, mountain.id);
    adjustEditorRange(state, rowId(mountain.id, 'height', 'max'), 5);

    assert.equal(JSON.stringify(highlands), before);
    assert.equal(JSON.stringify(getEnvironment('highlands')), before);
});

test('the world opens with every element shut', () => {
    const state = createEditorState('highlands');
    assert.ok(state.elements.every(element => !element.open));

    const kinds = state.entries.map(entry => entry.kind);
    assert.ok(!kinds.includes(RANGE_ENTRY), 'a shut element lists none of its ranges');
    assert.equal(kinds.filter(kind => kind === ELEMENT_ENTRY).length, state.elements.length);
});

test('the panel ends in the way back to the preset and the way out', () => {
    const state = createEditorState('highlands');
    const [restore, back] = state.entries.slice(-2);

    assert.equal(restore.kind, RESTORE_ENTRY);
    assert.equal(restore.id, EDITOR_RESTORE_ID);
    assert.equal(back.kind, BACK_ENTRY);
    assert.equal(back.id, EDITOR_BACK_ID);
});

test('choosing an element opens its ranges under it, and choosing it again shuts them', () => {
    const state = createEditorState('highlands');
    const mountain = state.elements.find(element => element.type === 'mountain');

    assert.equal(chooseEditorEntry(state, mountain.id), null, 'the ground is the ground it was');
    assert.ok(editorEntry(state, mountain.id).text.startsWith(ELEMENT_OPEN_MARK));

    const rows = state.entries.filter(entry => entry.kind === RANGE_ENTRY);
    assert.ok(rows.length > 0, 'an open element lists its ranges');
    assert.ok(rows.every(row => row.element === mountain.id));

    chooseEditorEntry(state, mountain.id);
    assert.ok(editorEntry(state, mountain.id).text.startsWith(ELEMENT_SHUT_MARK));
    assert.equal(state.entries.filter(entry => entry.kind === RANGE_ENTRY).length, 0);
});

// --- Moving a range --------------------------------------------------------

function openedOn(environmentId, type) {
    const state = createEditorState(environmentId);
    const element = state.elements.find(entry => entry.type === type);
    chooseEditorEntry(state, element.id);
    return { state, element };
}

test('stepping a range moves it by the step its bounds declare', () => {
    const { state, element } = openedOn('highlands', 'snow');
    const id = rowId(element.id, 'coverage', 'value');
    const before = editorEntry(state, id).value;
    const step = rangeStep(getElement('snow').ranges.coverage);

    assert.equal(adjustEditorRange(state, id, 1), element.id);
    assert.equal(editorEntry(state, id).value, Number((before + step).toFixed(2)));

    assert.equal(adjustEditorRange(state, id, -1), element.id);
    assert.equal(editorEntry(state, id).value, before);
});

// Walked twenty times, a step of a hundredth is a fifth and not a fifth plus
// the arithmetic's dust, or the readout grows a tail nobody can read.
test('a range walked and walked back is the number it started as', () => {
    const { state, element } = openedOn('highlands', 'snow');
    const id = rowId(element.id, 'coverage', 'value');
    const before = editorEntry(state, id).value;

    for (let i = 0; i < 20; i++) adjustEditorRange(state, id, -1);
    for (let i = 0; i < 20; i++) adjustEditorRange(state, id, 1);

    assert.equal(editorEntry(state, id).value, before);
});

test('a range stops at the bounds the registry declared it with', () => {
    const { state, element } = openedOn('highlands', 'snow');
    const range = getElement('snow').ranges.coverage;
    const id = rowId(element.id, 'coverage', 'value');

    for (let i = 0; i < 200; i++) adjustEditorRange(state, id, 1);
    assert.equal(editorEntry(state, id).value, range.high);

    for (let i = 0; i < 400; i++) adjustEditorRange(state, id, -1);
    assert.equal(editorEntry(state, id).value, range.low);
});

test('a range that cannot move any further reports that nothing moved', () => {
    const { state, element } = openedOn('highlands', 'snow');
    const id = rowId(element.id, 'coverage', 'value');

    for (let i = 0; i < 200; i++) adjustEditorRange(state, id, 1);
    assert.equal(adjustEditorRange(state, id, 1), null);
});

// A range whose ends have swapped is a range the generator has to guess about,
// so neither end is allowed past the other.
test('the ends of a span cannot be crossed over each other', () => {
    const { state, element } = openedOn('highlands', 'mountain');
    const min = rowId(element.id, 'height', 'min');
    const max = rowId(element.id, 'height', 'max');

    for (let i = 0; i < 200; i++) adjustEditorRange(state, min, 1);
    assert.equal(editorEntry(state, min).value, editorEntry(state, max).value);

    for (let i = 0; i < 400; i++) adjustEditorRange(state, max, -1);
    assert.equal(editorEntry(state, max).value, editorEntry(state, min).value);
});

test('stepping a gradient writes a shade of the colour the preset chose', () => {
    const { state, element } = openedOn('river-basin', 'grass');
    const id = rowId(element.id, 'color', 'light');
    const base = editorElement(state, element.id).base.color.light;

    adjustEditorRange(state, id, -5);

    const shade = editorEntry(state, id).value;
    assert.ok(shade < 1, 'the row should read as a darker shade than the preset');
    assert.deepEqual(editorElement(state, element.id).config.color.light, shadeColor(base, shade));
});

test('a shade reads as a percentage of the colour the preset chose', () => {
    const { state, element } = openedOn('river-basin', 'grass');
    const id = rowId(element.id, 'color', 'light');

    assert.ok(editorEntry(state, id).valueLabel.endsWith('%'));
    assert.equal(editorEntry(state, id).valueLabel, '100%');
});

test('an element row and the way out have no value to step', () => {
    const { state, element } = openedOn('highlands', 'mountain');

    assert.equal(adjustEditorRange(state, element.id, 1), null);
    assert.equal(adjustEditorRange(state, EDITOR_BACK_ID, 1), null);
    assert.equal(adjustEditorRange(state, 'nothing answers to this', 1), null);
});

test('a step of nothing moves nothing', () => {
    const { state, element } = openedOn('highlands', 'snow');
    assert.equal(adjustEditorRange(state, rowId(element.id, 'coverage', 'value'), 0), null);
});

// --- The way back and the way out ------------------------------------------

test('restoring puts every range back to what the world was assembled with', () => {
    const { state, element } = openedOn('river-basin', 'grass');
    const before = JSON.stringify(editorPlacements(state));

    adjustEditorRange(state, rowId(element.id, 'band', 'max'), -4);
    adjustEditorRange(state, rowId(element.id, 'color', 'dark'), 6);
    assert.notEqual(JSON.stringify(editorPlacements(state)), before);

    assert.equal(chooseEditorEntry(state, EDITOR_RESTORE_ID), EDITOR_RESTORE_ID);
    assert.equal(JSON.stringify(editorPlacements(state)), before);
});

test('restoring leaves the panel open where the pilot left it', () => {
    const { state, element } = openedOn('highlands', 'mountain');
    restoreEditor(state);
    assert.ok(editorEntry(state, element.id).text.startsWith(ELEMENT_OPEN_MARK));
});

test('the way out closes the panel and nothing else', () => {
    const state = createEditorState('highlands');
    openEditor(state);
    assert.ok(editorShowing(state));

    assert.equal(chooseEditorEntry(state, EDITOR_BACK_ID), EDITOR_BACK_ID);
    assert.ok(!editorShowing(state));

    assert.equal(closeEditor(state), false, 'a closed panel closes no further');
    assert.equal(openEditor(state), true);
});

// --- The world the panel is put on -----------------------------------------

test('a different world empties the panel and fills it from that preset', () => {
    const { state } = openedOn('highlands', 'mountain');
    const mountain = state.elements.find(element => element.type === 'mountain');
    adjustEditorRange(state, rowId(mountain.id, 'height', 'max'), -5);

    assert.equal(setEditorWorld(state, 'lakeside', false), true);
    assert.equal(state.environmentId, 'lakeside');
    assert.deepEqual(state.elements.map(element => element.type).sort(),
        editorElements(getEnvironment('lakeside')).map(element => element.type).sort());
});

test('the same world leaves the pilot the edits they made on it', () => {
    const state = createEditorState('highlands');
    const mountain = state.elements.find(element => element.type === 'mountain');
    chooseEditorEntry(state, mountain.id);
    adjustEditorRange(state, rowId(mountain.id, 'height', 'max'), -5);
    const edited = JSON.stringify(editorPlacements(state));

    assert.equal(setEditorWorld(state, 'highlands', false), false);
    assert.equal(JSON.stringify(editorPlacements(state)), edited);
});

// The strip is one of the things a world places, so turning it on is a
// different set of elements rather than the same set with a strip beside it.
test('turning the strip on is a different world, and it carries the runway', () => {
    const state = createEditorState('open-country', false);
    assert.ok(!state.elements.some(element => element.type === 'runway'));

    assert.equal(setEditorWorld(state, 'open-country', true), true);
    assert.ok(state.elements.some(element => element.type === 'runway'));
});

test('a world nothing answers to is the world a fresh install flies', () => {
    const state = createEditorState('no such world');
    assert.equal(state.environmentId, DEFAULT_ENVIRONMENT_ID);
});

// --- What the panel hands out ----------------------------------------------

test('the panel hands out placements the generator takes as they are', () => {
    const state = createEditorState('highlands');
    const placements = editorPlacements(state);

    for (const placement of placements) {
        assert.ok(ELEMENTS.some(element => element.id === placement.type));
        assert.doesNotThrow(() => applyElement(createField({ segments: 8 }), placement, createRandom(1)));
    }
});

// An unedited panel describes the world the preset describes, so opening the
// editor and closing it again is not a different world to fly.
test('a panel nobody has touched describes the ground the preset does', () => {
    for (const environment of ENVIRONMENTS) {
        const state = createEditorState(environment.id);
        const edited = buildEnvironment(environment, { segments: 16, elements: editorPlacements(state) });
        const preset = buildEnvironment(environment, { segments: 16 });

        assert.deepEqual([...edited.height], [...preset.height],
            `${environment.id} should be the same ground either way`);
    }
});

test('a moved range is ground that is actually different', () => {
    const { state, element } = openedOn('highlands', 'mountain');
    const preset = buildEnvironment(highlands, { segments: 16, elements: editorPlacements(state) });

    for (let i = 0; i < 5; i++) adjustEditorRange(state, rowId(element.id, 'height', 'max'), 1);
    const edited = buildEnvironment(highlands, { segments: 16, elements: editorPlacements(state) });

    assert.notDeepEqual([...edited.height], [...preset.height]);
});

// A range is stepped where it is listed, which is the only place the panel
// offers it. A row belonging to an element nobody has opened is a row nothing
// is pointing at, and stepping it would be stepping a number off screen.
test('a range under an element nobody has opened is not there to be stepped', () => {
    const state = createEditorState('highlands');
    const mountain = state.elements.find(element => element.type === 'mountain');

    assert.equal(adjustEditorRange(state, rowId(mountain.id, 'height', 'max'), 1), null);
    assert.deepEqual(editorElement(state, mountain.id).config.height,
        editorElement(state, mountain.id).base.height);
});

// Every configuration the panel hands out has already been through the
// registry's own clamping, so the generator is never asked for a world outside
// what the elements say they support.
test('every reading the panel holds is inside the range it was declared with', () => {
    const state = createEditorState('lakeside');

    for (const element of state.elements) {
        for (const [name, range] of Object.entries(getElement(element.type).ranges)) {
            const held = element.config[name];
            if (range.kind === 'span') {
                assert.ok(held[0] >= range.low && held[1] <= range.high, `${element.type}.${name}`);
                assert.ok(held[0] <= held[1], `${element.type}.${name} should not be inside out`);
            } else if (range.kind !== 'gradient') {
                assert.ok(held >= range.low && held <= range.high, `${element.type}.${name}`);
            }
        }
    }

    assert.deepEqual(
        editorPlacements(state).map(placement => resolveConfig(getElement(placement.type), placement.config)),
        state.elements.map(element => element.config)
    );
});

// The panel used to hand out its own live configuration objects, so a world
// recorded from a set of placements went on changing as the ranges were
// stepped. Whatever held that record - the terrain's, which is what decides
// whether the ground has to be laid again - then compared the edited world
// against itself, found nothing different, and left the ground exactly as it
// was however far a range was walked.
test('placements already handed out are not moved by the next edit', () => {
    const { state, element } = openedOn('highlands', 'mountain');

    const recorded = editorPlacements(state);
    const before = JSON.stringify(recorded);

    for (let i = 0; i < 8; i++) adjustEditorRange(state, rowId(element.id, 'height', 'max'), 1);

    assert.equal(JSON.stringify(recorded), before,
        'placements handed out before the edit describe the world before the edit');
    assert.notEqual(JSON.stringify(editorPlacements(state)), before,
        'and the next ask describes a world the ground has to be laid again for');
});

// A colour is held as an object inside the configuration rather than as a
// number beside it, so it is the case a copy is easiest to get half right.
test('a colour handed out is the colour it was handed out as', () => {
    const { state, element } = openedOn('river-basin', 'grass');

    const recorded = editorPlacements(state);
    const before = JSON.stringify(recorded);

    adjustEditorRange(state, rowId(element.id, 'color', 'light'), -6);

    assert.equal(JSON.stringify(recorded), before);
    assert.notEqual(JSON.stringify(editorPlacements(state)), before);
});

// --- Which way a chosen row moves ------------------------------------------

/**
 * A range row is drawn with a mark either side of its reading, so it reads as a
 * control with a down at one end and an up at the other. A click on the left of
 * one used to raise the value, which is the opposite of what the row looks like.
 */
test('a chosen range moves the way the choice says it went', () => {
    const state = createEditorState('highlands');
    const element = state.elements.find(item => item.type === 'mountain');
    chooseEditorEntry(state, element.id);

    const row = rowId(element.id, 'height', 'max');
    const reading = () => editorEntry(state, row).value;
    const opened = reading();

    assert.equal(chooseEditorEntry(state, row, -1), element.id);
    assert.ok(reading() < opened, `the left of the row moved it from ${opened} to ${reading()}`);

    chooseEditorEntry(state, row, 1);
    assert.equal(reading(), opened, 'and the right of it moved it back');
});

test('a choice that knows nothing about halves of a row steps it on', () => {
    const state = createEditorState('highlands');
    const element = state.elements.find(item => item.type === 'mountain');
    chooseEditorEntry(state, element.id);

    const row = rowId(element.id, 'height', 'max');
    const opened = editorEntry(state, row).value;

    chooseEditorEntry(state, row);
    assert.ok(editorEntry(state, row).value > opened, 'the way choosing a row always has');
});

// --- What the world held off the strip -------------------------------------

/**
 * The runway is the one surface a flight depends on existing, so it is the one
 * piece of ground the editor may not edit around: the generator cuts the strip
 * clear of anything that settled on it, and the panel has to say which element
 * that was. A range moved until it reached the runway and then quietly ignored
 * is a setting that reads as applied and is not.
 */
test('an element the world held off the strip says so on its own row', () => {
    const state = createEditorState('highlands', true);
    const water = state.elements.find(element => element.type === 'water');
    const before = editorEntry(state, water.id).note;

    assert.equal(heldOffRunway(state, 'water'), false, 'nothing is held off to begin with');
    assert.equal(setEditorClearance(state, ['water']), true, 'and the panel is drawn again for it');

    assert.equal(heldOffRunway(state, 'water'), true);
    assert.ok(editorEntry(state, water.id).note.startsWith(EDITOR_CLEARED_NOTE),
        `the row reads \`${editorEntry(state, water.id).note}\``);
    assert.ok(editorEntry(state, water.id).note.includes(before),
        'and still says what the element can be moved along');
});

test('the rows of every other element are left as they were', () => {
    const state = createEditorState('highlands', true);
    const notes = () => Object.fromEntries(
        state.elements.map(element => [element.type, editorEntry(state, element.id).note]));
    const before = notes();

    setEditorClearance(state, ['water']);
    for (const [type, note] of Object.entries(notes())) {
        if (type === 'water') continue;
        assert.equal(note, before[type], `${type} was not held off anything`);
    }
});

test('a strip that held nothing off puts every row back', () => {
    const state = createEditorState('highlands', true);
    const water = state.elements.find(element => element.type === 'water');
    const before = editorEntry(state, water.id).note;

    setEditorClearance(state, ['water']);
    assert.equal(setEditorClearance(state, []), true);
    assert.equal(editorEntry(state, water.id).note, before);
    assert.equal(heldOffRunway(state, 'water'), false);
});

test('the same clearance twice is not a panel to draw again', () => {
    const state = createEditorState('highlands', true);
    setEditorClearance(state, ['water']);

    assert.equal(setEditorClearance(state, ['water']), false);
    assert.equal(setEditorClearance(state, ['water', 'water']), false, 'however it is written');
});

test('a strip naming something that is not an element names nothing', () => {
    const state = createEditorState('highlands', true);
    assert.equal(setEditorClearance(state, ['not-an-element']), false);
    assert.equal(setEditorClearance(state, null), false, 'and a world with no strip holds nothing');
    assert.deepEqual(state.cleared, []);
});
