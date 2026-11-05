/**
 * Coarse steps, Placed runway, Runway templates, Insert a template, and The
 * strip a flight starts on - `shift` moving a row ten points or ten steps, a
 * strip laid where it was asked for, the templates placed as groups of the
 * registry's own elements, Insert Runway's cards and the template it places at
 * a click, and the placed strip a runway start opens on.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    createField, createRandom, applyElement, fieldX, fieldZ, readColor, isElementId, flightStrip, isOnRunway,
    RUNWAY_FREEBOARD, DEFAULT_SIZE
} from '../js/environment/elements.js';
import { buildEnvironment, getEnvironment } from '../js/environment/presets.js';
import {
    RUNWAY_TEMPLATES, GROUP_TYPE, GROUP_RANGES, runwayTemplate, templateBuilt, offeredTemplates, placeTemplate,
    arrivalHeading, expandGroup, expandGroups, groupStrips, groupConfig, keepStripOnCanvas, groupReach, isGroup
} from '../js/templates.js';
import {
    createBuildState, openBuildMode, beginCanvas, chooseBuildTool, chooseRunwayTemplate, insertTemplate,
    buildRunwayTemplate, buildDraft, acceptDraft, committedPlacements, confirmOpen, draftPending, selectPlacement,
    startDraft, closeBuildMode, BUILD_FROM_TITLE
} from '../js/build-mode.js';
import { dockContent, DOCK_RUNWAY, DOCK_ACCEPT, DOCK_CANCEL, PICK_SECTION } from '../js/build-panel.js';
import { isChoosableTool, insertsTemplate } from '../js/build-tools.js';
import { boundHandles, handleBinding, dragHandle, gumballKind, gumballCentre, GUMBALL_FLAT } from '../js/gumball.js';
import { placementAt } from '../js/build-select.js';
import { viewBearing, createBuildCamera } from '../js/build-camera.js';
import { coarseStep, stepRow, rangeRows, rangeStep, COARSE_STEPS, COARSE_POINTS, SHADE_RANGE } from '../js/properties-panel.js';
import { createEditorState, chooseEditorEntry, adjustEditorRange, editorEntry, rowId } from '../js/element-editor.js';
import { getElement } from '../js/environment/elements.js';

const near = (a, b, within = 1e-6) => Math.abs(a - b) <= within;

function onCanvas(tool = 'runway') {
    const state = createBuildState();
    openBuildMode(state, BUILD_FROM_TITLE);
    beginCanvas(state, 'highlands');
    if (tool) chooseBuildTool(state, tool);
    return state;
}

/** A field whose ground is `height(x, z)` in the world's own coordinates. */
function ground(height, { size = DEFAULT_SIZE, segments = 100, originX = 0, originZ = 0 } = {}) {
    const field = createField({ size, segments, originX, originZ });
    for (let i = 0; i < field.count; i++) field.height[i] = height(fieldX(field, i), fieldZ(field, i));
    return field;
}

// --- Coarse steps --------------------------------------------------------------------------

test('shift is ten points on a row read as a percentage, added rather than compounded', () => {
    const holder = { config: { color: { light: [0.5, 0.5, 0.5], dark: [0.5, 0.5, 0.5] } }, shades: { color: { light: 1, dark: 1 } }, base: { color: { light: [0.5, 0.5, 0.5], dark: [0.5, 0.5, 0.5] } } };
    const [, dark] = rangeRows('color', { kind: 'gradient', default: {} });
    for (const expected of [1.1, 1.2]) {
        stepRow(holder, 'color', dark, coarseStep(dark, 1));
        assert.ok(near(holder.shades.color.dark, expected), `${holder.shades.color.dark} - 100%, 110%, 120%, not 121%`);
    }
    assert.ok(near(coarseStep(dark, -1) * rangeStep(SHADE_RANGE), -COARSE_POINTS / 100));
});

test('shift is ten ordinary steps on any other row, either way', () => {
    assert.equal(COARSE_STEPS, 10);
    assert.equal(COARSE_POINTS, 10);
    const row = { part: 'value', range: { kind: 'scalar', low: 0, high: 100, default: 0 } };
    assert.equal(coarseStep(row, 1), COARSE_STEPS);
    assert.equal(coarseStep(row, -1), -COARSE_STEPS);
    const holder = { config: { n: 0 } };
    stepRow(holder, 'n', row, coarseStep(row, 1));
    assert.equal(holder.config.n, COARSE_STEPS * rangeStep(row.range));
});

test('the element editor takes shift and an arrow the way the dock takes shift and a click', () => {
    const state = createEditorState('highlands');
    const element = state.elements.find(entry => entry.type === 'snow');
    chooseEditorEntry(state, element.id);
    const id = rowId(element.id, 'coverage', 'value');
    const before = editorEntry(state, id).value;
    const step = rangeStep(getElement('snow').ranges.coverage);
    adjustEditorRange(state, id, -1, { coarse: true });
    assert.ok(near(editorEntry(state, id).value, before - COARSE_STEPS * step, 1e-9), `${before} -> ${editorEntry(state, id).value}`);
});

test('the dock passes shift with a spinner pressed, and steps by it', () => {
    const view = readFileSync(new URL('../js/panel-view.js', import.meta.url), 'utf8');
    assert.match(view, /this\.handlers\.onStep\?\.\(entry, step, event\.shiftKey === true\);/);
    const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
    assert.match(main, /stepRow\(holder, entry\.name, entry\.row, coarse \? coarseStep\(entry\.row, step\) : step\)/);
    assert.match(main, /adjustEditorRange\(this\.editor, selectedId\(this\.editorState\), menuAdjustStep\(e\.code\), \{ coarse: e\.shiftKey \}\)/);
});

// --- Runway templates ------------------------------------------------------------------------

test('four templates in the panel\'s order, every one offered now its elements are all drawn', () => {
    assert.deepEqual(RUNWAY_TEMPLATES.map(t => t.label), ['BASIC RUNWAY', 'COMMERCIAL', 'BASIC AIRPORT', 'COMMERCIAL AIRPORT']);
    assert.deepEqual(offeredTemplates().map(t => t.id), ['basic-runway', 'commercial', 'basic-airport', 'commercial-airport']);
    for (const template of offeredTemplates()) assert.ok(template.members.every(member => isElementId(member.type)), template.id);
    for (const id of ['basic-airport', 'commercial-airport']) {
        assert.equal(templateBuilt(id), true);
        assert.deepEqual([...new Set(runwayTemplate(id).members.map(member => member.type))], ['runway', 'paint', 'extrude']);
    }
    assert.equal(templateBuilt('runway'), false);
    assert.equal(runwayTemplate('commercial').members[0].config.centreline, true, 'the commercial strip carries its centreline');
    assert.ok(runwayTemplate('commercial').length > runwayTemplate('basic-runway').length);
    assert.ok(runwayTemplate('commercial').width > runwayTemplate('basic-runway').width);
});

test('a placed template carries copies of its members, and survives being written down', () => {
    const placed = placeTemplate('basic-runway', [1200.4, -800.6], 47);
    assert.equal(placed.type, GROUP_TYPE);
    assert.deepEqual(placed.config, { at: [1200, -801], heading: 50, length: 2400, width: 240 });
    assert.deepEqual(placed.members, runwayTemplate('basic-runway').members);
    assert.notEqual(placed.members[0], runwayTemplate('basic-runway').members[0], 'copied, so a template improved later leaves it as it was');
    assert.deepEqual(structuredClone(placed), placed);
    assert.deepEqual(JSON.parse(JSON.stringify(placed)), placed);
    assert.equal(placeTemplate('regional-airport', [0, 0]), null, 'and a template not offered places nothing');
});

test('a template arrives lined up with the view, to the nearest ten degrees', () => {
    assert.equal(arrivalHeading(47), 50);
    assert.equal(arrivalHeading(356), 0);
    assert.equal(arrivalHeading(-4), 0);
    assert.equal(arrivalHeading(174), 170);
    // A view's yaw turns it away from looking south: at 90 it looks east.
    const bearings = [0, 90, 180, 270].map(yaw => Math.round(viewBearing({ ...createBuildCamera(DEFAULT_SIZE), yaw })));
    assert.deepEqual(bearings, [180, 90, 0, 270]);
});

test('a group expands into its members turned about its middle and moved into place', () => {
    const group = { ...placeTemplate('basic-runway', [1000, -500], 90),
        members: [
            { type: 'runway', role: 'strip', config: { at: [0, 0], heading: [0, 0] } },
            { type: 'runway', role: 'taxiway', config: { at: [400, 300], heading: [0, 0] } }
        ] };
    const [strip, beside] = expandGroup(group);
    assert.deepEqual(strip.config, { at: [1000, -500], heading: [90, 90], length: [2400, 2400], width: [240, 240] });
    assert.ok(near(Math.hypot(beside.config.at[0] - 1000, beside.config.at[1] + 500), Math.hypot(400, 300)), 'every member kept its distance from the middle');
    assert.ok(near(beside.config.at[0], 1000 - 300) && near(beside.config.at[1], -500 + 400), 'along became east and across became north');
    assert.deepEqual(beside.config.heading, [90, 90]);

    const plain = { type: 'grass', config: {} };
    assert.deepEqual(expandGroups([plain, group]).map(p => p.type), ['grass', 'runway', 'runway']);
    assert.deepEqual(expandGroup(plain), []);
});

test('a strip is held wholly on the canvas, so no copy of it crosses a seam', () => {
    const group = placeTemplate('commercial', [7900, -7950], 30);
    const [strip] = expandGroup(group, DEFAULT_SIZE);
    const reach = groupReach(group);
    assert.ok(Math.abs(strip.config.at[0]) <= DEFAULT_SIZE / 2 - reach + 1e-6);
    assert.ok(Math.abs(strip.config.at[1]) <= DEFAULT_SIZE / 2 - reach + 1e-6);
    assert.deepEqual(keepStripOnCanvas([123, -456], reach, DEFAULT_SIZE), [123, -456], 'one well inside is where it was put');
    assert.deepEqual(keepStripOnCanvas([9000, 0], reach, 0), [9000, 0], 'and with no canvas, nowhere is held');
    const room = DEFAULT_SIZE / 2 - reach;
    assert.ok(room < 7000);
    assert.deepEqual(keepStripOnCanvas([9000, 0], reach, DEFAULT_SIZE), [-room, 0],
        'carried off one edge it comes in at the other, held where the whole strip is on the canvas');
});

test('a group\'s own values are held to the strip\'s bounds', () => {
    const declared = getElement('runway').ranges;
    assert.equal(GROUP_RANGES.length.low, declared.length.low);
    assert.equal(GROUP_RANGES.width.high, declared.width.high);
    const held = groupConfig({ type: GROUP_TYPE, config: { at: [1, 2], heading: 370, length: 99999, width: 1 }, members: [] });
    assert.deepEqual(held, { at: [1, 2], heading: 359, length: declared.length.high, width: declared.width.low });
});

// --- Placed runway ---------------------------------------------------------------------------

const PLACED = { type: 'runway', config: { at: [800, -600], heading: [90, 90], length: [2000, 2000], width: [200, 200] } };

test('a placed strip is laid where it was asked for, along its heading, on the tile it lands on', () => {
    const field = ground((x, z) => 100 + 0.01 * x);
    const stream = createRandom(7);
    const strip = applyElement(field, PLACED, stream);
    assert.deepEqual([strip.x, strip.z, strip.heading, strip.length, strip.width, strip.placed], [800, -600, 90, 2000, 200, true]);
    assert.equal(stream(), createRandom(7)(), 'taking nothing from the seeded stream, so it moves nothing else in the world');

    const away = ground((x, z) => 100 + 0.01 * (x - DEFAULT_SIZE), { originX: DEFAULT_SIZE });
    const copy = applyElement(away, PLACED);
    assert.deepEqual([copy.x - DEFAULT_SIZE, copy.z], [800, -600], 'at the same canvas place on every tile');
});

test('a placed strip is graded to the ground under its own footprint', () => {
    const field = ground((x, z) => 100 + 0.02 * x);
    const strip = applyElement(field, PLACED);
    assert.ok(near(strip.elevation, 100 + 0.02 * 800, 1), `at ${strip.elevation}, the ground under its middle`);
    for (let i = 0; i < field.count; i++) {
        if (isOnRunway(strip, fieldX(field, i), fieldZ(field, i))) assert.ok(near(field.height[i], strip.elevation, 1e-3), `vertex ${i} paved level`);
    }
});

test('a placed strip ignores the search\'s band and separation, and is lifted clear of water under it', () => {
    const ridge = ground(() => 1900);
    const high = applyElement(ridge, { ...PLACED, config: { ...PLACED.config, band: [20, 400], separation: 12000 } });
    assert.ok(near(high.elevation, 1900, 1e-3), 'a strip put on a ridge is a strip on a ridge');

    const marsh = ground(() => 20);
    applyElement(marsh, { type: 'water', config: { level: 50 } });
    const lifted = applyElement(marsh, PLACED);
    assert.equal(lifted.elevation, 50 + RUNWAY_FREEBOARD);
    assert.deepEqual(lifted.cleared, ['water']);
});

test('a strip with no centreline is the strip every preset draws, and one with it carries dashes down its middle', () => {
    const plain = ground(() => 100);
    const off = ground(() => 100);
    const on = ground(() => 100);
    applyElement(plain, { type: 'runway', config: { ...PLACED.config } });
    applyElement(off, { type: 'runway', config: { ...PLACED.config, centreline: false } });
    const strip = applyElement(on, { type: 'runway', config: { ...PLACED.config, centreline: true } });
    assert.deepEqual(off.color, plain.color);

    let dashes = 0, gaps = 0;
    for (let i = 0; i < on.count; i++) {
        const differs = readColor(on, i).some((c, k) => c !== plain.color[i * 3 + k]);
        if (!differs) continue;
        assert.ok(isOnRunway(strip, fieldX(on, i), fieldZ(on, i)), 'only on the paving');
        dashes++;
    }
    for (let along = -800; along <= 800; along += 80) {
        const i = Math.round((-600 + DEFAULT_SIZE / 2) / on.step) * on.stride + Math.round((800 - along + DEFAULT_SIZE / 2) / on.step);
        if (readColor(on, i).every((c, k) => c === plain.color[i * 3 + k])) gaps++;
    }
    assert.ok(dashes > 5 && gaps > 2, `${dashes} painted, ${gaps} gaps down the middle`);
});

test('a world built with a placed template lays its strip, and the strip a flight starts on is the placed one', () => {
    const world = buildEnvironment(getEnvironment('highlands'), {
        segments: 60, runway: true,
        elements: [...getEnvironment('highlands').elements, { type: 'runway', config: {} }, placeTemplate('basic-runway', [2000, 1000], 120)]
    });
    const placed = world.runways.find(strip => strip.placed);
    assert.ok(placed, 'laid from the group');
    assert.deepEqual([placed.x, placed.z, placed.heading], [2000, 1000, 120]);
    assert.equal(world.runways.filter(strip => !strip.placed).length, 1, 'beside the strip the search found');
    assert.equal(flightStrip(world.runways), placed);

    const searched = { x: 0, z: 0 };
    assert.equal(flightStrip([searched]), searched, 'the searched strip where none was placed');
    const [a, b] = [{ placed: true, id: 'a' }, { placed: true, id: 'b' }];
    assert.equal(flightStrip([searched, a, b]), b, 'and the last placed of several');
    assert.equal(flightStrip([]), null);

    // The terrain is drawn with Three.js, so its own reading is held by what it says.
    const terrain = readFileSync(new URL('../js/terrain.js', import.meta.url), 'utf8');
    assert.match(terrain, /getRunway\(\) \{\s*return flightStrip\(this\.getRunways\(\)\);\s*\}/, 'and the world\'s strip is that one');
});

// --- Insert a template -------------------------------------------------------------------------

test('Insert Runway is on the palette, armed by a card and refused without one', () => {
    assert.ok(isChoosableTool('runway') && insertsTemplate('runway'));
    const state = onCanvas();
    assert.equal(buildRunwayTemplate(state), null);
    assert.equal(insertTemplate(state, { x: 0, z: 0 }, 0, { size: DEFAULT_SIZE }), false, 'no card, no runway');
    assert.equal(chooseRunwayTemplate(state, 'regional-airport'), false, 'a card not offered cannot be chosen');
    assert.equal(chooseRunwayTemplate(state, 'basic-runway'), true);
    assert.equal(buildRunwayTemplate(state), 'basic-runway');
    assert.equal(chooseRunwayTemplate(onCanvas('mountain'), 'basic-runway'), false, 'and only with Insert Runway live');

    closeBuildMode(state);
    openBuildMode(state, BUILD_FROM_TITLE);
    beginCanvas(state, 'lakeside');
    assert.equal(buildRunwayTemplate(state), null, 'a new canvas opens with no card chosen');
});

test('a click places the chosen template lined up with the view, and a click with it in hand moves it', () => {
    const state = onCanvas();
    chooseRunwayTemplate(state, 'basic-runway');
    assert.equal(insertTemplate(state, { x: 1000, z: 2000 }, 47, { size: DEFAULT_SIZE }), true);
    const placed = buildDraft(state);
    assert.equal(placed.template, 'basic-runway');
    assert.deepEqual(placed.config, { at: [1000, 2000], heading: 50, length: 2400, width: 240 });

    assert.equal(insertTemplate(state, { x: -1000, z: 0 }, 200, { size: DEFAULT_SIZE }), true);
    assert.deepEqual(buildDraft(state).config, { at: [-1000, 0], heading: 50, length: 2400, width: 240 }, 'moved, still facing the way it was turned');
    assert.equal(insertTemplate(state, { x: Infinity, z: 0 }, 0), false, 'the sky places nothing');

    acceptDraft(state);
    assert.equal(committedPlacements(state).length, 1, 'kept as one placement');
    assert.ok(isGroup(committedPlacements(state)[0]));
});

test('a card pressed with a template in hand turns that one into it, where it stands', () => {
    const state = onCanvas();
    chooseRunwayTemplate(state, 'basic-runway');
    insertTemplate(state, { x: 500, z: 500 }, 90, { size: DEFAULT_SIZE });
    const before = state.draft;
    chooseRunwayTemplate(state, 'commercial');
    assert.notEqual(state.draft, before, 'a new draft, so its rows are read again');
    assert.deepEqual(buildDraft(state).config, { at: [500, 500], heading: 90, length: 3600, width: 360 });
    assert.equal(buildDraft(state).template, 'commercial');
});

test('a template is held on the canvas where it is placed', () => {
    const state = onCanvas();
    chooseRunwayTemplate(state, 'commercial');
    insertTemplate(state, { x: 7990, z: 0 }, 0, { size: DEFAULT_SIZE });
    const at = buildDraft(state).config.at;
    assert.ok(at[0] <= DEFAULT_SIZE / 2 - groupReach(buildDraft(state)) + 1);
});

test('Insert Runway\'s panel is its cards, and the strip\'s rows under them once one is in hand', () => {
    const state = onCanvas();
    let shown = dockContent(state, {});
    assert.equal(shown.kind, DOCK_RUNWAY);
    assert.equal(shown.heading, 'INSERT RUNWAY');
    assert.deepEqual(shown.shapes[0].tools.map(tool => [tool.label, tool.live, tool.art]),
        [['BASIC RUNWAY', false, null], ['COMMERCIAL', false, null], ['BASIC AIRPORT', false, null], ['COMMERCIAL AIRPORT', false, null]]);
    assert.deepEqual([shown.rows, shown.actions], [[], []]);

    chooseRunwayTemplate(state, 'commercial');
    insertTemplate(state, { x: 0, z: 0 }, 0, { size: DEFAULT_SIZE });
    shown = dockContent(state, {});
    assert.deepEqual(shown.shapes[0].tools.map(tool => tool.live), [false, true, false, false]);
    assert.deepEqual(shown.rows.map(entry => [entry.row.label, entry.value]), [['HEADING', 0], ['LENGTH', 3600], ['WIDTH', 360]]);
    assert.deepEqual(shown.actions, [DOCK_ACCEPT, DOCK_CANCEL]);
});

test('a placed runway picked again with Select is headed by its card, with its own rows', () => {
    const state = onCanvas();
    chooseRunwayTemplate(state, 'basic-runway');
    insertTemplate(state, { x: 0, z: 0 }, 0, { size: DEFAULT_SIZE });
    acceptDraft(state);
    chooseBuildTool(state, 'select');
    selectPlacement(state, 0);
    const section = dockContent(state, { camera: createBuildCamera(DEFAULT_SIZE) }).sections.find(s => s.id === PICK_SECTION);
    assert.equal(section.heading, 'SELECTED BASIC RUNWAY');
    assert.deepEqual(section.rows.map(entry => entry.row.label), ['HEADING', 'LENGTH', 'WIDTH']);
});

test('a placed runway is picked as one wherever its strip lies, and not beside it', () => {
    const group = placeTemplate('basic-runway', [0, 0], 0);
    assert.equal(placementAt([group], 0, 1000, DEFAULT_SIZE), 0, 'along the strip, north of its middle');
    assert.equal(placementAt([group], 0, -1100, DEFAULT_SIZE), 0);
    assert.equal(placementAt([group], 1500, 0, DEFAULT_SIZE), null, 'well off to the side');
    const [strip] = groupStrips(group);
    assert.ok(strip.width > 240 && strip.depth > 2400, 'its apron and all');
});

test('a placed runway takes the Flat gumball: moved by its centre, turned by its arc, sized by its squares', () => {
    const group = placeTemplate('basic-runway', [1000, -500], 90);
    assert.equal(gumballKind(GROUP_TYPE), GUMBALL_FLAT);
    assert.deepEqual(gumballCentre(group), { x: 1000, z: -500 });
    assert.deepEqual(handleBinding('rotate-blue', group), { from: 'config', name: 'heading', mode: 'turn' });
    assert.deepEqual(handleBinding('scale-x', group), { from: 'config', name: 'width', mode: 'scale' });
    assert.deepEqual(handleBinding('scale-y', group), { from: 'config', name: 'length', mode: 'scale' });

    assert.equal(dragHandle(group, 'rotate-blue', { turn: Math.PI / 2 }).config.heading, 180, 'in whole degrees');
    assert.equal(dragHandle(group, 'rotate-blue', { turn: -Math.PI }).config.heading, 270, 'round the card');
    assert.equal(dragHandle(group, 'scale-y', { along: 10000 }).config.length, GROUP_RANGES.length.high, 'held to the strip\'s bounds');
    assert.equal(dragHandle(group, 'scale-x', { along: -10000 }).config.width, GROUP_RANGES.width.low);
    // Moved to just short of the east edge, where the paving would cross it.
    const moved = dragHandle(group, 'move-uniform', { ground: { dx: 6800, dz: 0 } }, { size: DEFAULT_SIZE });
    assert.ok(Math.abs(moved.config.at[0]) <= DEFAULT_SIZE / 2 - groupReach(group) + 1, `and moved, held on the canvas: ${moved.config.at[0]}`);
});
