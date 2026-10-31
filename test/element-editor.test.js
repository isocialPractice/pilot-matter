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
    rowId,
    rowValue,
    rowValueLabel,
    typedRowValue,
    isTypedEditorRow,
    typedEditorRow,
    typedEditorText,
    rangeNotice,
    beginTypedEditorValue,
    cancelTypedEditorValue,
    applyTypedEditorKey,
    GATE_RANGE,
    GATE_ON_LABEL,
    GATE_OFF_LABEL,
    gateOn
} from '../js/element-editor.js';
import { TYPED_CARET, TYPED_MAX, typedValueLabel } from '../js/typed-value.js';
import { isMenuControlKey } from '../js/menu.js';
import {
    ELEMENTS, ELEMENT_ORDER, getElement, resolveConfig, createField, applyElement, createRandom,
    gated, toggle
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
            if (range.kind === 'span' || range.kind === 'gated') {
                const pair = range.kind === 'gated' ? held.range : held;
                assert.ok(pair[0] >= range.low && pair[1] <= range.high, `${element.type}.${name}`);
                assert.ok(pair[0] <= pair[1], `${element.type}.${name} should not be inside out`);
                if (range.kind === 'gated') {
                    assert.equal(typeof held.on, 'boolean',
                        `${element.type}.${name} should hold its gate as an answer rather than a number`);
                }
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

// --- Typing a number into a range ------------------------------------------

/**
 * A range is stepped a fiftieth of its bounds at a time, which is the right way
 * to move a number nobody has a figure for and the wrong way to set one somebody
 * does: a snow line at 1200 metres is forty presses from where the preset left
 * it, and the pilot knew the figure before the panel was open.
 */
test('a row holding a range can be typed into, and no other row can', () => {
    const { state, element } = openedOn('highlands', 'snow');

    assert.equal(isTypedEditorRow(state, rowId(element.id, 'line', 'value')), true);
    assert.equal(isTypedEditorRow(state, rowId(element.id, 'color', 'light')), true,
        'a gradient end holds a figure too, which is the shade it is drawn at');

    assert.equal(isTypedEditorRow(state, element.id), false, 'an element opens rather than holds');
    assert.equal(isTypedEditorRow(state, EDITOR_RESTORE_ID), false);
    assert.equal(isTypedEditorRow(state, EDITOR_BACK_ID), false);
    assert.equal(isTypedEditorRow(state, 'nothing-of-the-sort'), false);
});

test('a digit at such a row starts the figure it is the first character of', () => {
    const { state, element } = openedOn('highlands', 'snow');
    const id = rowId(element.id, 'line', 'value');

    assert.equal(typedEditorRow(state), null, 'the panel opens typing nothing');
    assert.equal(beginTypedEditorValue(state, id, 'Digit1'), id);
    assert.equal(typedEditorText(state), '1');

    for (const code of ['Digit2', 'Digit0', 'Digit0']) {
        assert.equal(applyTypedEditorKey(state, code).result, 'typed');
    }
    assert.equal(typedEditorText(state), '1200');

    const committed = applyTypedEditorKey(state, 'Enter');
    assert.equal(committed.result, 'applied');
    assert.equal(committed.element, element.id, 'and the ground has to be drawn again');
    assert.equal(committed.value, 1200);
    assert.equal(editorEntry(state, id).value, 1200);
    assert.equal(typedEditorRow(state), null);
});

test('a key that types nothing starts nothing, and nor does a row with no range', () => {
    const { state, element } = openedOn('highlands', 'snow');
    const id = rowId(element.id, 'line', 'value');

    assert.equal(beginTypedEditorValue(state, id, 'KeyW'), null);
    assert.equal(beginTypedEditorValue(state, id, 'Period'), null);
    assert.equal(beginTypedEditorValue(state, element.id, 'Digit1'), null);
    assert.equal(beginTypedEditorValue(state, EDITOR_BACK_ID, 'Digit1'), null);
    assert.equal(typedEditorRow(state), null);
    assert.equal(applyTypedEditorKey(state, 'Digit1'), null, 'and nothing is being typed into');
});

/**
 * A gradient end reads as the percentage of the preset's colour it is drawn at,
 * so the figure the pilot answers is the figure on screen: 150 at a row reading
 * 150% is a shade of 1.5.
 */
test('a gradient end is typed in the percentages it reads in', () => {
    assert.equal(typedRowValue({ shade: 'light', range: SHADE_RANGE }, 150), 1.5);
    assert.equal(typedRowValue({ range: SHADE_RANGE }, 150), 150, 'and every other row holds what it reads');
    assert.equal(typedRowValue({ shade: 'light' }, null), null);

    const { state, element } = openedOn('highlands', 'snow');
    const id = rowId(element.id, 'color', 'light');

    beginTypedEditorValue(state, id, 'Digit1');
    for (const code of ['Digit5', 'Digit0']) applyTypedEditorKey(state, code);

    const committed = applyTypedEditorKey(state, 'Enter');
    assert.equal(committed.result, 'applied');
    assert.equal(committed.value, 1.5);
    assert.equal(editorEntry(state, id).valueLabel, '150%',
        'so the row reads back the figure that was typed into it');
});

/**
 * `moveValue` clamps every press to the bounds the registry declared, so a
 * figure outside them is one no amount of stepping could have reached - and the
 * two routes have to agree about that or the panel disagrees with itself.
 */
test('a figure outside the declared bounds is refused, and the row says what they are', () => {
    const { state, element } = openedOn('highlands', 'snow');
    const id = rowId(element.id, 'coverage', 'value');
    const was = editorEntry(state, id).value;

    // Coverage runs from nothing to one, so 5 is past the top of it.
    beginTypedEditorValue(state, id, 'Digit5');
    const refused = applyTypedEditorKey(state, 'Enter');

    assert.equal(refused.result, 'refused');
    assert.equal(refused.element, null, 'so there is no ground to draw again');
    assert.equal(editorEntry(state, id).value, was, 'and nothing is written');
    assert.equal(typedEditorRow(state), id, 'the row goes on taking characters');

    const row = editorEntry(state, id);
    assert.equal(row.valueLabel, rangeNotice(row.row));
    assert.ok(row.valueLabel.includes('TO'), `the row should read a span - it reads "${row.valueLabel}"`);

    // Erased back to nothing and typed again as a figure the bounds allow.
    applyTypedEditorKey(state, 'Backspace');
    assert.equal(typedEditorText(state), '');
    for (const code of ['Digit0', 'Period', 'Digit5']) applyTypedEditorKey(state, code);
    assert.equal(applyTypedEditorKey(state, 'Enter').result, 'applied');
    assert.equal(editorEntry(state, id).value, 0.5);
});

test('a bound a row is refused against is written the way the row writes a value', () => {
    const { state, element } = openedOn('highlands', 'snow');

    const coverage = editorEntry(state, rowId(element.id, 'coverage', 'value'));
    assert.equal(rangeNotice(coverage.row),
        `${rowValueLabel(coverage.row, 0)} TO ${rowValueLabel(coverage.row, 1)}`);

    const shade = editorEntry(state, rowId(element.id, 'color', 'light'));
    assert.equal(rangeNotice(shade.row), '20% TO 200%',
        'a gradient end is refused against percentages, because that is what it reads in');

    assert.equal(rangeNotice({}), '', 'a row with no range has no bounds to name');
    assert.equal(rangeNotice(null), '');
});

test('a figure nobody finished is refused rather than read as nothing', () => {
    const { state, element } = openedOn('highlands', 'snow');
    const id = rowId(element.id, 'line', 'value');
    const was = editorEntry(state, id).value;

    beginTypedEditorValue(state, id, 'Minus');
    assert.equal(applyTypedEditorKey(state, 'Enter').result, 'refused');
    assert.equal(editorEntry(state, id).value, was);
});

/**
 * A span cannot be crossed over itself, and a typed figure that skipped that
 * rule would be a way of writing a crossed-over range that stepping cannot
 * produce - which is why both routes write through one place.
 */
test('a typed figure cannot cross a span over itself', () => {
    const { state, element } = openedOn('highlands', 'mountain');
    const low  = rowId(element.id, 'height', 'min');
    const high = rowId(element.id, 'height', 'max');
    const ceiling = editorEntry(state, high).value;

    beginTypedEditorValue(state, low, 'Digit9');
    for (const code of ['Digit9', 'Digit9', 'Digit9']) applyTypedEditorKey(state, code);
    const committed = applyTypedEditorKey(state, 'Enter');

    if (committed.result === 'applied') {
        assert.ok(editorEntry(state, low).value <= ceiling,
            'a minimum typed past the maximum stops at it, the way a stepped one does');
    } else {
        assert.equal(committed.result, 'refused', '9999 is outside the bounds height declares');
    }
});

test('a figure the row was already on costs no world rebuild', () => {
    const { state, element } = openedOn('highlands', 'snow');
    const id = rowId(element.id, 'coverage', 'value');
    const held = editorEntry(state, id).value;

    beginTypedEditorValue(state, id, 'Digit0');
    for (const character of String(held).slice(1).split('')) {
        applyTypedEditorKey(state, character === '.' ? 'Period' : `Digit${character}`);
    }

    const committed = applyTypedEditorKey(state, 'Enter');
    assert.equal(committed.result, 'applied');
    assert.equal(committed.element, null,
        'the same answer the stepper gives for a press that moved nothing');
    assert.equal(editorEntry(state, id).value, held);
});

test('giving up leaves the range on the value it already had', () => {
    const { state, element } = openedOn('highlands', 'snow');
    const id = rowId(element.id, 'line', 'value');
    const was = editorEntry(state, id).value;

    beginTypedEditorValue(state, id, 'Digit9');
    assert.deepEqual(applyTypedEditorKey(state, 'Escape'),
        { result: 'cancelled', element: null, value: null });

    assert.equal(typedEditorRow(state), null);
    assert.equal(editorEntry(state, id).value, was);
    assert.equal(cancelTypedEditorValue(state), null, 'and giving up twice gives up on nothing');
});

test('a key the figure has no use for is handed back to the panel', () => {
    const { state, element } = openedOn('highlands', 'snow');
    beginTypedEditorValue(state, rowId(element.id, 'line', 'value'), 'Digit9');

    for (const code of ['KeyW', 'KeyS', 'ArrowUp', 'ArrowLeft', 'Space']) {
        assert.equal(applyTypedEditorKey(state, code), null, `${code} belongs to the panel`);
    }
    assert.equal(typedEditorText(state), '9', 'and none of them disturbed the figure');
});

/**
 * And a key neither the figure nor the panel claims leaves it alone, for the
 * reason it does in the settings panel: the keys the test above presses are all
 * keys the panel works with, which are the keys the handler gives a figure up
 * for. A key no branch claims has to fall past the lot of them with the figure
 * still in hand, so the digit after it carries on from what was typed.
 *
 * Read in the order js/main.js reads the press - the figure first, then the row
 * already being typed into, then the branch that gives up - because a giving up
 * reached outside that branch throws the figure away for every key at all.
 */
test('a key neither the figure nor the panel claims leaves the figure in hand', () => {
    const { state, element } = openedOn('highlands', 'snow');
    const id = rowId(element.id, 'line', 'value');

    for (const code of ['KeyQ', 'KeyE', 'KeyR', 'ShiftLeft', 'ControlLeft']) {
        assert.equal(isMenuControlKey(code), false,
            `${code} should not be a key the panel works with`);
        assert.ok(!EDITOR_CLOSE_KEYS.includes(code), `${code} should not be the way out either`);

        beginTypedEditorValue(state, id, 'Digit2');
        assert.equal(applyTypedEditorKey(state, code), null,
            `${code} should not be the figure's to take`);
        assert.equal(typedEditorRow(state), id,
            `${code} should leave the row being typed into, so no fresh figure begins`);

        if (isMenuControlKey(code)) cancelTypedEditorValue(state);

        assert.equal(typedEditorText(state), '2', `${code} should leave the figure where it was`);
        applyTypedEditorKey(state, 'Digit3');
        assert.equal(typedEditorText(state), '23',
            `the digit after ${code} should carry on rather than start a fresh figure`);
        cancelTypedEditorValue(state);
    }
});

/**
 * And so is a press the figure has no room for, which is the same answer for a
 * different reason: the character cannot legally go where it was aimed, so the
 * text is left as it was and the press comes back as nothing. A caller that
 * read that nothing as the start of a fresh figure would throw away everything
 * typed so far, with nothing on the row to say it had gone.
 */
test('a press the figure cannot take leaves what is already typed where it was', () => {
    const { state, element } = openedOn('highlands', 'snow');
    const id = rowId(element.id, 'line', 'value');

    beginTypedEditorValue(state, id, 'Digit1');
    for (const code of ['Digit2', 'Digit0']) applyTypedEditorKey(state, code);
    assert.equal(typedEditorText(state), '120');

    for (const code of ['Minus', 'NumpadSubtract']) {
        assert.equal(applyTypedEditorKey(state, code), null,
            `a ${code} part way along is not the figure's to take`);
        assert.equal(typedEditorText(state), '120', 'and the digits already typed are still there');
        assert.equal(typedEditorRow(state), id, 'on the row they were typed into');
    }

    for (const code of ['Digit0', 'Digit0', 'Digit0', 'Digit0', 'Digit0']) {
        applyTypedEditorKey(state, code);
    }
    assert.equal(typedEditorText(state).length, TYPED_MAX, 'the row is full');
    assert.equal(applyTypedEditorKey(state, 'Digit9'), null, 'so a ninth is not the figure\'s to take');
    assert.equal(typedEditorText(state), '12000000', 'and the eight it holds are untouched');
});

// --- How a row being typed into reads --------------------------------------

test('a row being typed into reads the figure rather than a value between step marks', () => {
    const { state, element } = openedOn('highlands', 'snow');
    const id = rowId(element.id, 'line', 'value');
    const stepped = editorEntry(state, id).text;

    beginTypedEditorValue(state, id, 'Digit1');
    const row = editorEntry(state, id);

    assert.equal(row.typing, true);
    assert.equal(row.valueLabel, typedValueLabel('1'));
    assert.ok(row.text.includes(TYPED_CARET), 'the row says it is taking more characters');
    assert.notEqual(row.text, stepped);

    applyTypedEditorKey(state, 'Escape');
    assert.equal(editorEntry(state, id).typing, false);
    assert.equal(editorEntry(state, id).text, stepped,
        'and the row reads exactly as it did once the typing is given up on');
});

test('every other row reads as it always did while one is being typed into', () => {
    const { state, element } = openedOn('highlands', 'snow');
    const id = rowId(element.id, 'line', 'value');
    const before = new Map(state.entries.map(entry => [entry.id, entry.text]));

    beginTypedEditorValue(state, id, 'Digit1');

    for (const entry of state.entries) {
        if (entry.id === id) continue;
        assert.equal(entry.text, before.get(entry.id), `${entry.id} is not the row being typed into`);
    }
});

/**
 * A panel that opened half way through a figure would read the first digit
 * pressed at it as the rest of one. A different world and a restored preset both
 * take the row out from under it, so both give up on the figure too.
 */
test('anything that rebuilds the panel is giving up on whatever was being typed', () => {
    const { state, element } = openedOn('highlands', 'snow');
    const id = rowId(element.id, 'line', 'value');

    beginTypedEditorValue(state, id, 'Digit1');
    closeEditor(state);
    assert.equal(typedEditorRow(state), null);

    beginTypedEditorValue(state, id, 'Digit1');
    openEditor(state);
    assert.equal(typedEditorRow(state), null);

    beginTypedEditorValue(state, id, 'Digit1');
    restoreEditor(state);
    assert.equal(typedEditorRow(state), null);

    beginTypedEditorValue(state, id, 'Digit1');
    setEditorWorld(state, ENVIRONMENTS.find(world => world.id !== 'highlands').id);
    assert.equal(typedEditorRow(state), null);
});

/**
 * Asking for the preset back with a figure in hand puts every range back and
 * gives up on the figure, which is the whole of what the row is for.
 *
 * This was unreachable from the keyboard until the cursor gave up on a figure
 * on its way down the panel: the Enter that asks for the restore was taken by
 * the figure still live on the row the cursor had left, so the row read its
 * typed value and the preset was never put back. Clicking the entry worked,
 * because the pointer route gives up on the figure first.
 */
test('the preset goes back under a figure half typed, rather than the figure over it', () => {
    const { state, element } = openedOn('highlands', 'snow');
    const moved = rowId(element.id, 'coverage', 'value');
    const typed = rowId(element.id, 'line', 'value');

    const base = editorEntry(state, moved).value;
    assert.equal(adjustEditorRange(state, moved, 1), element.id);
    assert.notEqual(editorEntry(state, moved).value, base, 'a range is away from the preset');

    beginTypedEditorValue(state, typed, 'Digit7');
    assert.equal(typedEditorRow(state), typed, 'and a figure is in hand at another row');

    assert.equal(chooseEditorEntry(state, EDITOR_RESTORE_ID), EDITOR_RESTORE_ID);

    assert.equal(editorEntry(state, moved).value, base, 'the range the panel moved is back');
    assert.equal(typedEditorRow(state), null, 'and the figure is given up on rather than committed');
    // The way back and the way out carry no reading at all, so the caret can
    // only be on a row that holds one.
    for (const entry of state.entries) {
        assert.ok(!(entry.text ?? '').includes(TYPED_CARET), `${entry.id} holds no caret`);
    }
});

test('a typed figure reaches the world the same way a stepped one does', () => {
    const { state, element } = openedOn('highlands', 'snow');
    const id = rowId(element.id, 'line', 'value');

    beginTypedEditorValue(state, id, 'Digit1');
    for (const code of ['Digit2', 'Digit0', 'Digit0']) applyTypedEditorKey(state, code);
    applyTypedEditorKey(state, 'Enter');

    const placed = editorPlacements(state).find(placement => placement.type === 'snow');
    assert.equal(placed.config.line, 1200,
        'the placements a caller is handed carry the typed figure, not the one it replaced');
    assert.equal(rowValue(element, 'line', editorEntry(state, id).row), 1200);
});

/**
 * Every one of those rebuilds hands back a new set of rows rather than writing
 * over the ones the panel had, because an element that opened or shut is a row
 * that came or went and there is nothing to write over.
 *
 * So a caller holding the rows is holding the ones from before the rebuild, and
 * has to be handed the new set to draw anything the rebuild changed. That is
 * what `setMenuEntries` is for in js/main.js, and the row reading a caret
 * nothing is typing into any more is what forgetting it looks like.
 */
test('giving up on a figure hands back new rows rather than writing over the old', () => {
    const { state, element } = openedOn('highlands', 'snow');
    const id = rowId(element.id, 'line', 'value');

    beginTypedEditorValue(state, id, 'Digit9');
    const typed = state.entries;
    assert.ok(typed.find(entry => entry.id === id).text.includes(TYPED_CARET));

    assert.equal(cancelTypedEditorValue(state), id);
    assert.notEqual(state.entries, typed, 'the panel is holding a different set of rows');
    assert.ok(!state.entries.find(entry => entry.id === id).text.includes(TYPED_CARET));
    assert.ok(typed.find(entry => entry.id === id).text.includes(TYPED_CARET),
        'and the set from before the rebuild still reads as it did, caret and all');
});

// --- The switch on a gated range -------------------------------------------

/**
 * A gated range is three rows: the switch, then the two bounds it governs.
 *
 * The bounds stay listed while the switch is off, rather than appearing with
 * it. A pilot sets the numbers and then turns the range on at least as often as
 * the other way round, and rows that came and went under the cursor would move
 * every row below them as the switch was worked.
 */
test('a gated range is drawn as a switch and the two bounds it turns on', () => {
    const rows = rangeRows('length', gated(100, 7000, 900, 2400));

    assert.deepEqual(rows.map(row => row.part), ['on', 'min', 'max']);
    assert.deepEqual(rows.map(row => row.label), ['LENGTH', 'LENGTH MIN', 'LENGTH MAX']);

    assert.equal(rows[0].range, GATE_RANGE, 'the switch is a range of its own');
    assert.ok(rows[0].gate, 'and says it is the switch');
    assert.ok(rows.slice(1).every(row => row.gated), 'the bounds say which kind holds them');
    assert.deepEqual(rows.slice(1).map(row => row.at), [0, 1]);
});

// Without a step of its own the switch would move a fiftieth of the way from
// off to on, and take fifty presses to throw.
test('the switch moves between off and on in one press', () => {
    assert.equal(rangeStep(GATE_RANGE), 1);
    assert.equal(stepPlaces(rangeStep(GATE_RANGE)), 0, 'and reads as a whole answer');

    // Which is a property of the range declaring one, not of this range: every
    // range that declares no step is still measured off its bounds.
    assert.equal(rangeStep({ low: 0, high: 1 }), 0.02);
    assert.equal(rangeStep({ low: 0, high: 1, step: 0.5 }), 0.5);
});

test('the switch reads as a word rather than as the number behind it', () => {
    const [gate, min] = rangeRows('length', gated(100, 7000, 900, 2400));

    assert.equal(rowValueLabel(gate, 0), GATE_OFF_LABEL);
    assert.equal(rowValueLabel(gate, 1), GATE_ON_LABEL);
    assert.equal(rowValueLabel(min, 900), '900', 'and a bound under it reads as the figure it is');

    assert.equal(rangeNotice(gate), GATE_OFF_LABEL + ' TO ' + GATE_ON_LABEL,
        'so a refused press at the switch is refused in the same words');

    assert.equal(gateOn(1), true);
    assert.equal(gateOn(0), false);
    assert.equal(gateOn(0.5), true, 'half thrown is thrown, so a press can never land between');
    assert.equal(gateOn(0.49), false);
});

/** The panel opened on the mountain, which is the element that declares them. */
function openedOnMountain() {
    return openedOn('highlands', 'mountain');
}

test('the panel lists the mountain footprint as three rows apiece', () => {
    const { state, element } = openedOnMountain();

    for (const name of ['length', 'width']) {
        for (const part of ['on', 'min', 'max']) {
            const entry = editorEntry(state, rowId(element.id, name, part));
            assert.ok(entry, name + ' should be drawn with an ' + part + ' row');
            assert.equal(entry.kind, RANGE_ENTRY);
        }
    }

    const gate = editorEntry(state, rowId(element.id, 'length', 'on'));
    assert.equal(gate.value, 0, 'and the switch opens off, as the range declares');
    assert.ok(gate.text.includes(GATE_OFF_LABEL), 'reading as the word rather than as a 0');
});

test('throwing the switch turns the range on and asks for the ground again', () => {
    const { state, element } = openedOnMountain();
    const id = rowId(element.id, 'length', 'on');

    assert.equal(element.config.length.on, false);
    assert.equal(adjustEditorRange(state, id, 1), element.id, 'the ground has to be drawn again');
    assert.equal(element.config.length.on, true, 'and the gate is held as an answer');
    assert.equal(typeof element.config.length.on, 'boolean');
    assert.ok(editorEntry(state, id).text.includes(GATE_ON_LABEL));

    assert.equal(adjustEditorRange(state, id, 1), null, 'on is as far as it goes');
    assert.equal(element.config.length.on, true);

    assert.equal(adjustEditorRange(state, id, -1), element.id);
    assert.equal(element.config.length.on, false, 'and it turns back off in one press');
});

test('a bound under the switch is stepped whether the switch is on or off', () => {
    const { state, element } = openedOnMountain();
    const id = rowId(element.id, 'length', 'max');
    const before = element.config.length.range[1];

    assert.equal(adjustEditorRange(state, id, 1), element.id);
    assert.ok(element.config.length.range[1] > before, 'set the numbers, then turn it on');
    assert.equal(element.config.length.on, false, 'and stepping a bound does not throw the switch');
});

// The same rule a span is held to, and it has to reach through the extra level
// a gated range holds its pair under: read as a span, the pair would be the
// `on` and the `range` rather than the two bounds.
test('the bounds under a switch cannot be crossed over each other', () => {
    const { state, element } = openedOnMountain();
    const declared = getElement('mountain').ranges.length;

    for (let i = 0; i < 400; i++) adjustEditorRange(state, rowId(element.id, 'width', 'min'), 1);
    const width = element.config.width.range;
    assert.ok(width[0] <= width[1], 'a minimum raised to the top stops at the maximum');

    for (let i = 0; i < 400; i++) adjustEditorRange(state, rowId(element.id, 'length', 'max'), -1);
    const length = element.config.length.range;
    assert.ok(length[0] <= length[1], 'and a maximum lowered to the bottom stops at the minimum');
    assert.ok(length[0] >= declared.low && length[1] <= declared.high,
        'and neither leaves the bounds the range was declared with');
});

test('a figure typed at the switch throws it, and anything else is refused', () => {
    const { state, element } = openedOnMountain();
    const id = rowId(element.id, 'length', 'on');

    assert.equal(beginTypedEditorValue(state, id, 'Digit1'), id);
    const thrown = applyTypedEditorKey(state, 'Enter');
    assert.equal(thrown.result, 'applied');
    assert.equal(thrown.element, element.id);
    assert.equal(element.config.length.on, true);

    assert.equal(beginTypedEditorValue(state, id, 'Digit0'), id);
    assert.equal(applyTypedEditorKey(state, 'Enter').result, 'applied');
    assert.equal(element.config.length.on, false, 'and a 0 turns it back off');

    assert.equal(beginTypedEditorValue(state, id, 'Digit5'), id);
    const refused = applyTypedEditorKey(state, 'Enter');
    assert.equal(refused.result, 'refused', 'a switch has no fifth position');
    assert.equal(element.config.length.on, false);
    assert.equal(editorEntry(state, id).valueLabel, GATE_OFF_LABEL + ' TO ' + GATE_ON_LABEL);
});

/**
 * The panel hands its world out as placements, which go back through
 * `resolveConfig` on the way into the generator. A gated range has to survive
 * that round trip or the ground drawn is not the ground the panel is reading -
 * and it is the copy on the way out that this catches: a resolved gated range
 * and a resolved gradient are both plain objects, so a copy that reads "an
 * object, therefore a gradient" throws on the one and silently flattens the
 * other.
 */
test('a gated range survives being handed out as a placement and resolved again', () => {
    const { state, element } = openedOnMountain();

    adjustEditorRange(state, rowId(element.id, 'length', 'on'), 1);
    for (let i = 0; i < 3; i++) adjustEditorRange(state, rowId(element.id, 'length', 'min'), 1);

    const placement = editorPlacements(state).find(entry => entry.type === 'mountain');
    assert.deepEqual(resolveConfig(getElement('mountain'), placement.config), element.config);
    assert.equal(placement.config.length.on, true);

    // Copied rather than referenced, the way every other range is: a caller
    // holding the placement should not find its world changing as the panel
    // goes on being worked.
    const held = placement.config.length.range[0];
    adjustEditorRange(state, rowId(element.id, 'length', 'min'), 1);
    assert.equal(placement.config.length.range[0], held, 'the pair is a copy');

    adjustEditorRange(state, rowId(element.id, 'length', 'on'), -1);
    assert.equal(placement.config.length.on, true, 'and so is the switch');
});

test('putting the preset back turns the switches back off with it', () => {
    const { state, element } = openedOnMountain();

    adjustEditorRange(state, rowId(element.id, 'width', 'on'), 1);
    for (let i = 0; i < 5; i++) adjustEditorRange(state, rowId(element.id, 'width', 'max'), -1);
    assert.equal(element.config.width.on, true);

    restoreEditor(state);
    const restored = state.elements.find(entry => entry.type === 'mountain');
    assert.deepEqual(restored.config.width, resolveConfig(getElement('mountain'), {}).width);
    assert.equal(restored.config.width.on, false);
});

// --- A mode, which is the switch without the bounds ------------------------

/**
 * A mode is drawn as one row, and it is the gate's row: the same step of one,
 * the same word in place of a number, the same notice a refused figure is
 * turned down with. What it carries of its own is `bare`, which says the
 * switch is the whole value rather than the `on` of a pair beside it - and
 * that is the only thing either side of the panel has to know about it.
 */
test('a mode is drawn as the switch alone', () => {
    const rows = rangeRows('bulk', toggle());

    assert.equal(rows.length, 1, 'a mode has no bounds to draw under it');
    assert.equal(rows[0].part, 'on');
    assert.equal(rows[0].label, 'BULK');
    assert.equal(rows[0].range, GATE_RANGE, 'stepped as the switch it is');
    assert.ok(rows[0].gate, 'and read as one');
    assert.ok(rows[0].bare, 'with the switch standing for the whole value');

    assert.equal(rowValueLabel(rows[0], 0), GATE_OFF_LABEL);
    assert.equal(rowValueLabel(rows[0], 1), GATE_ON_LABEL);
    assert.equal(rangeNotice(rows[0]), GATE_OFF_LABEL + ' TO ' + GATE_ON_LABEL);
});

test('the panel lists the mountain mode as one row, opening off', () => {
    const { state, element } = openedOnMountain();
    const entry = editorEntry(state, rowId(element.id, 'bulk', 'on'));

    assert.ok(entry, 'the mode should be drawn');
    assert.equal(entry.kind, RANGE_ENTRY);
    assert.equal(entry.value, 0, 'off, as the range declares');
    assert.ok(entry.text.includes(GATE_OFF_LABEL), 'reading as the word');

    for (const part of ['min', 'max']) {
        assert.equal(editorEntry(state, rowId(element.id, 'bulk', part)), null,
            'and a mode has no ' + part + ' row to draw');
    }
});

// The write path is the half that differs from a gate: a mode holds its answer
// where a gated range holds an object, so writing `config.bulk.on` would set a
// property on a boolean and throw nothing while changing nothing.
test('throwing a mode holds the answer itself and asks for the ground again', () => {
    const { state, element } = openedOnMountain();
    const id = rowId(element.id, 'bulk', 'on');

    assert.equal(element.config.bulk, false);
    assert.equal(adjustEditorRange(state, id, 1), element.id, 'the ground has to be drawn again');
    assert.equal(element.config.bulk, true, 'and the mode is the answer rather than holding one');
    assert.equal(typeof element.config.bulk, 'boolean');
    assert.ok(editorEntry(state, id).text.includes(GATE_ON_LABEL));

    assert.equal(adjustEditorRange(state, id, 1), null, 'on is as far as it goes');

    assert.equal(adjustEditorRange(state, id, -1), element.id);
    assert.equal(element.config.bulk, false, 'and it turns back off in one press');
});

test('a mode survives being handed out as a placement and put back', () => {
    const { state, element } = openedOnMountain();

    adjustEditorRange(state, rowId(element.id, 'bulk', 'on'), 1);

    const placement = editorPlacements(state).find(entry => entry.type === 'mountain');
    assert.equal(placement.config.bulk, true);
    assert.deepEqual(resolveConfig(getElement('mountain'), placement.config), element.config,
        'and resolves back to the world the panel is reading');

    restoreEditor(state);
    const restored = state.elements.find(entry => entry.type === 'mountain');
    assert.equal(restored.config.bulk, false, 'the preset knew nothing of the mode');
});
