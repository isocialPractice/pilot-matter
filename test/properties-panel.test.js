import test from 'node:test';
import assert from 'node:assert/strict';
import * as panel from '../js/properties-panel.js';
import {
    rangeRows, rowValue, rowValueLabel, stepRow, gateOpen, panelRows, isTypedRow,
    writeRowValue, GATE_RANGE
} from '../js/properties-panel.js';
import * as editor from '../js/element-editor.js';
import {
    ELEMENTS, BASE_RANGES, getElement, isElementId, resolveConfig,
    span, scalar, gradient, gated, toggle, choice, color
} from '../js/environment/elements.js';
import { CHOICE_FIELD, TOGGLE_FIELD } from '../js/config.js';
import { BUILD_TOOLS } from '../js/build-tools.js';

/**
 * A holder for an element's ranges as a panel holds them: the configuration
 * they resolve to, and for each gradient the shade either end is drawn at and
 * the colour that shade is measured against.
 */
function holderFor(ranges, given = {}) {
    const config = resolveConfig({ ranges }, given);
    const shades = {}, base = {};
    for (const [name, range] of Object.entries(ranges)) {
        if (range.kind !== 'gradient') continue;
        shades[name] = { light: 1, dark: 1 };
        base[name] = structuredClone(config[name]);
    }
    return { config, shades, base };
}

// --- One panel ---------------------------------------------------------------

/**
 * The element editor is pointed at the panel rather than left beside it: the
 * rows it draws are the panel's own, by the same functions, not a copy that
 * could drift from them.
 */
test('the element editor draws its rows with the panel\'s own functions', () => {
    for (const name of [
        'rangeRows', 'label', 'rangeStep', 'stepPlaces', 'rowValue', 'rowValueLabel',
        'rangeEntryText', 'typedRowValue', 'rangeNotice', 'shadeColor', 'gateOn'
    ]) {
        assert.equal(editor[name], panel[name], `the editor's ${name} should be the panel's`);
    }
    for (const name of ['RANGE_STEPS', 'SHADE_RANGE', 'GATE_RANGE', 'GATE_ON_LABEL', 'GATE_OFF_LABEL']) {
        assert.equal(editor[name], panel[name], `and its ${name}`);
    }
});

/**
 * The artwork for Build Mountains was drawn from the registry by hand: six rows,
 * in the registry's own order. The mountain has gained ranges since - the gated
 * length, width and girth range, and bulk - which come after them, so the six
 * still lead in the order the artwork draws them.
 */
test('the mountain\'s rows open with the six the Build Mountains artwork draws', () => {
    const rows = Object.entries(getElement('mountain').ranges)
        .flatMap(([name, range]) => rangeRows(name, range).map(row => row.label));

    assert.deepEqual(rows.slice(0, 6), ['COUNT', 'HEIGHT MIN', 'HEIGHT MAX', 'RADIUS MIN', 'RADIUS MAX', 'GIRTH']);
});

// --- The kinds -----------------------------------------------------------------

test('a toggle and a choice are named for what js/config.js calls them', () => {
    assert.equal(toggle().kind, TOGGLE_FIELD);
    assert.equal(choice(['a', 'b']).kind, CHOICE_FIELD);
});

test('a choice resolves to one of its values or to its default', () => {
    const shape = choice(['rect', 'ellipse', 'polygon'], 'ellipse');
    assert.equal(shape.default, 'ellipse');
    assert.deepEqual([...shape.values], ['rect', 'ellipse', 'polygon']);

    const ranges = { shape };
    assert.equal(resolveConfig({ ranges }, { shape: 'polygon' }).shape, 'polygon');
    assert.equal(resolveConfig({ ranges }, { shape: 'hexagon' }).shape, 'ellipse', 'a value not on the list is not a choice');
    assert.equal(resolveConfig({ ranges }, {}).shape, 'ellipse');
    assert.equal(choice(['x', 'y'], 'z').default, 'x', 'and a default not on the list is the first value');
});

test('a choice is one row, stepped along its list and stopping at either end', () => {
    const ranges = { tip: choice(['round', 'square', 'roundRect'], 'round') };
    const holder = holderFor(ranges);
    const [row] = rangeRows('tip', ranges.tip);

    assert.equal(rangeRows('tip', ranges.tip).length, 1);
    assert.equal(rowValueLabel(row, 'roundRect'), 'ROUND RECT', 'read as a word, as the panel writes a name');

    assert.equal(stepRow(holder, 'tip', row, -1), false, 'there is nothing before the first');
    assert.equal(stepRow(holder, 'tip', row, 1), true);
    assert.equal(rowValue(holder, 'tip', row), 'square');
    stepRow(holder, 'tip', row, 1);
    assert.equal(stepRow(holder, 'tip', row, 1), false, 'and nothing after the last');
    assert.equal(rowValue(holder, 'tip', row), 'roundRect');
});

test('a choice holds no figure, so nothing is typed into one', () => {
    const [row] = rangeRows('tip', choice(['round', 'square']));
    assert.equal(isTypedRow(row), false);
    assert.equal(isTypedRow(rangeRows('density', scalar(0, 1, 0.5))[0]), true);
});

test('a range declared without options is the object it always was', () => {
    assert.deepEqual(span(0, 900, 180, 500), { kind: 'span', low: 0, high: 900, default: [180, 500] });
    assert.deepEqual(scalar(0, 1, 0.5), { kind: 'scalar', low: 0, high: 1, default: 0.5 });
    assert.deepEqual(toggle(), { kind: 'toggle', low: 0, high: 1, default: false });
    assert.ok(!('when' in gradient([1, 1, 1], [0, 0, 0])));
    assert.ok(!('when' in gated(0, 10, 2, 8)));
});

// --- Gates ---------------------------------------------------------------------

/**
 * The checkbox case: a span that is live while a toggle beside it is on, which
 * is what the mountain's queued length range is, written with no new kind.
 */
const LENGTH = {
    useLength: toggle(false),
    length: span(100, 4000, 400, 1200, { when: { useLength: true } })
};

test('a row gated on a toggle is live while the toggle is on and held while it is off', () => {
    const holder = holderFor(LENGTH);
    const shut = panelRows(LENGTH, holder).filter(row => row.name === 'length');
    assert.equal(shut.length, 2, 'the span is still listed while it is gated shut');
    assert.ok(shut.every(row => row.live === false), 'and drawn held');

    const toggleRow = panelRows(LENGTH, holder).find(row => row.name === 'useLength').row;
    stepRow(holder, 'useLength', toggleRow, 1);
    assert.ok(panelRows(LENGTH, holder).filter(row => row.name === 'length').every(row => row.live),
        'turning the toggle on opens the gate');
});

/**
 * The rule the plan says is annoying to retrofit: a gated value is kept, not
 * reset. Off and on again gives back the number that was there.
 */
test('a gated value survives being gated: off and on again gives back what was there', () => {
    const holder = holderFor(LENGTH, { useLength: true, length: [700, 2600] });
    const toggleRow = rangeRows('useLength', LENGTH.useLength)[0];

    stepRow(holder, 'useLength', toggleRow, -1);
    assert.deepEqual(holder.config.length, [700, 2600], 'shut, the value is held');
    assert.deepEqual(panelRows(LENGTH, holder).filter(row => row.name === 'length').map(row => row.value), [700, 2600]);

    stepRow(holder, 'useLength', toggleRow, 1);
    assert.deepEqual(holder.config.length, [700, 2600], 'and open again it is the same pair, not the default');

    assert.deepEqual(resolveConfig({ ranges: LENGTH }, { useLength: false, length: [700, 2600] }).length, [700, 2600],
        'resolving a configuration keeps a range whose gate is shut rather than dropping it');
});

test('a gate can open on any of several values of a choice', () => {
    const sides = scalar(3, 12, 6, { when: { shape: ['polygon', 'star'] } });
    for (const [shape, open] of [['polygon', true], ['star', true], ['rect', false], [undefined, false]]) {
        assert.equal(gateOpen(sides, { shape }), open, `with the shape ${shape}`);
    }
});

/**
 * A gate that reads the session rather than the element: whether a selection
 * is live is not a field on any element, so it is handed to the panel as a
 * context and read only from there.
 */
test('a gate written ctx reads the context the panel is handed and nothing else', () => {
    const count = scalar(0, 200, 0, { when: { 'ctx.lasso': false } });

    assert.equal(gateOpen(count, {}, { lasso: false }), true);
    assert.equal(gateOpen(count, {}, { lasso: true }), false);
    assert.equal(gateOpen(count, { lasso: false }, { lasso: true }), false,
        'a field of the same name on the element does not answer for the session');
    assert.equal(gateOpen(count, {}, {}), false, 'and a context that says nothing does not open it');
});

test('a range with no gate is always live', () => {
    assert.equal(gateOpen(scalar(0, 1, 0.5)), true);
    assert.ok(panelRows(getElement('snow').ranges, holderFor(getElement('snow').ranges)).every(row => row.live));
});

/**
 * The element editor reads the gate through the panel: a row gated shut is
 * listed held, a press does not move it, and a digit does not start a figure.
 */
test('the element editor holds a row gated shut', () => {
    const state = editor.createEditorState('highlands');
    editor.openEditor(state);
    editor.chooseEditorEntry(state, state.elements[0].id);

    const row = state.entries.find(entry => entry.kind === editor.RANGE_ENTRY);
    assert.equal(row.locked, undefined, 'a row with no gate carries no mark at all');

    row.locked = true;
    assert.equal(editor.adjustEditorRange(state, row.id, 1), null, 'a press at a held row moves nothing');
    assert.equal(editor.isTypedEditorRow(state, row.id), false, 'and a digit starts nothing');
});

// --- Conformance ------------------------------------------------------------------

/**
 * Every row of a range moves: a press one way or the other reads a different
 * value afterwards. A row that cannot be moved from where it starts is a row
 * that renders and does nothing.
 */
function rowMoves(ranges, name, row) {
    for (const step of [1, -1]) {
        const holder = holderFor(ranges);
        const was = JSON.stringify(rowValue(holder, name, row));
        stepRow(holder, name, row, step);
        if (JSON.stringify(rowValue(holder, name, row)) !== was) return true;
    }
    return false;
}

function conforms(owner, ranges) {
    for (const [name, range] of Object.entries(ranges)) {
        const rows = rangeRows(name, range);
        assert.ok(rows.length > 0, `${owner}.${name} is a ${range.kind} and renders no row`);
        for (const row of rows) {
            assert.ok(rowMoves(ranges, name, row), `${owner}.${name} ${row.label} renders but does not move`);
            const label = rowValueLabel(row, rowValue(holderFor(ranges), name, row));
            assert.ok(typeof label === 'string' && label.length > 0, `${owner}.${name} ${row.label} reads as nothing`);
        }
    }
}

/**
 * The test that keeps the panel shared: every range the registry declares, and
 * every range of every tool's element, is walked off the registry rather than
 * off a list, so a kind with no renderer fails here on the commit that declares
 * it rather than drawing an empty row on a panel nobody has opened yet.
 */
test('every range every element declares renders rows that move', () => {
    for (const element of ELEMENTS) conforms(element.id, element.ranges);
    conforms('base', BASE_RANGES);
});

test('every tool that edits an element draws that element\'s ranges, and they conform', () => {
    const drawing = BUILD_TOOLS.filter(tool => tool.element != null);
    assert.ok(drawing.length > 0, 'some tools edit an element');

    for (const tool of drawing) {
        assert.ok(isElementId(tool.element), `${tool.id} edits ${tool.element}, which the registry does not hold`);
        conforms(tool.id, getElement(tool.element).ranges);
    }
});

test('every kind the vocabulary offers renders rows that move', () => {
    conforms('kinds', {
        span: span(0, 100, 20, 80),
        scalar: scalar(0, 1, 0.5),
        gradient: gradient([0.8, 0.8, 0.8], [0.2, 0.2, 0.2]),
        gated: gated(0, 100, 20, 80),
        toggle: toggle(),
        choice: choice(['a', 'b', 'c'], 'b'),
        color: color([0.2, 0.4, 0.6]),
        percent: scalar(0, 1, 0.4, { percent: true })
    });
});

test('a kind the panel cannot draw draws no rows, which is what fails the walk above', () => {
    assert.deepEqual(rangeRows('mystery', { kind: 'texture', default: 'moss' }), []);
    assert.deepEqual(rangeRows('mystery', {}), []);
    assert.throws(() => conforms('declared', { mystery: { kind: 'texture', default: 'moss' } }),
        /renders no row/);
});

test('a switch is written as the boolean it is, whatever the row reads in', () => {
    const holder = holderFor({ bulk: toggle() });
    const [row] = rangeRows('bulk', toggle());
    assert.equal(row.range, GATE_RANGE);
    writeRowValue(holder, 'bulk', row, 1);
    assert.equal(holder.config.bulk, true);
});
