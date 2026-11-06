import test from 'node:test';
import assert from 'node:assert/strict';
import {
    BUILD_TOOLS, BUILD_TOOL_IDS, BUILT_TOOLS, SELECT_TOOL, ACCEPT_TOOL, FILES_TOOL,
    isBuildTool, isBuiltTool, isChoosableTool, paletteTools, isPaletteBar, toolMark,
    toolModes, toolDoes, insertsTemplate,
    buildTool, dropsAtClick, derivedValues, droppedPlacement, toolPlacement
} from '../js/build-tools.js';
import { modeType } from '../js/mode-types.js';
import { getElement } from '../js/environment/elements.js';

/**
 * The tour's twelve, in the order it walks them and the palette stacks them,
 * with the palette's later art's three: Insert City beside Extrude, Insert
 * Plane beside the way out, and the SAVE / LOAD bar across the foot.
 */
test('the tools are the tour\'s twelve and the later art\'s three, in the palette\'s order', () => {
    assert.deepEqual(BUILD_TOOL_IDS, [
        'select', 'lasso', 'mountain', 'grass', 'sand', 'water',
        'snow', 'runway', 'paint', 'erase', 'extrude', 'city', 'plane', 'accept', 'files'
    ]);
    assert.equal(BUILD_TOOL_IDS[0], SELECT_TOOL, 'Select is the first');
    assert.equal(BUILD_TOOLS.filter(tool => !tool.bar).at(-1).id, ACCEPT_TOOL, 'the way out is the last tile');
    assert.deepEqual(BUILD_TOOLS.filter(tool => tool.bar).map(tool => tool.id), [FILES_TOOL], 'and the one bar is after it');
});

test('the bar has no mark - it is its words - and every tile has one', () => {
    assert.equal(isPaletteBar(FILES_TOOL), true);
    assert.equal(toolMark(FILES_TOOL), null);
    for (const tool of BUILD_TOOLS.filter(each => !each.bar)) {
        assert.equal(isPaletteBar(tool.id), false);
        assert.equal(toolMark(tool.id), `assets/builder/${tool.id}.svg`);
    }
    assert.equal(isPaletteBar('hammer'), false);
});

test('a built bar is drawn after the way out, and never before it', () => {
    assert.deepEqual(paletteTools([FILES_TOOL, ACCEPT_TOOL, 'plane', SELECT_TOOL]).map(tool => tool.id),
        [SELECT_TOOL, 'plane', ACCEPT_TOOL, FILES_TOOL]);
});

// --- Mode types ----------------------------------------------------------------------

/**
 * What a section that inserts, loads or saves does is declared on it, and read
 * back from the declaration: Insert Runway's click is the one that places a
 * template because it is `Insert asset<runway>`, not because of a flag.
 */
test('every tool that inserts, loads or saves declares what each of its sections does', () => {
    const written = Object.fromEntries(BUILD_TOOLS.filter(tool => tool.modes).map(tool => [tool.id, tool.modes.map(modeType)]));
    assert.deepEqual(written, {
        runway: ['Insert asset<runway>'],
        city:   ['Insert asset<city>'],
        plane:  ['Insert asset<flight:plane>', 'Insert config<flight:start-point>'],
        files:  ['Save data<file>', 'Load data<file>', 'Load data<asset>']
    });
    for (const tool of BUILD_TOOLS) {
        for (const type of toolModes(tool.id)) assert.ok(Object.isFrozen(type), `${tool.id}: ${modeType(type)} cannot be rewritten`);
        assert.ok(!('inserts' in tool), `${tool.id}: no flag beside the declaration`);
    }
    assert.deepEqual(toolModes('mountain'), [], 'a tool that builds declares none');
    assert.deepEqual(toolModes('hammer'), []);
});

test('Insert Runway places a template because of what it is declared to do', () => {
    assert.deepEqual(BUILD_TOOLS.filter(tool => insertsTemplate(tool.id)).map(tool => tool.id), ['runway']);
    assert.equal(toolDoes('runway', 'insert', 'asset', 'runway'), true);
    assert.equal(toolDoes('runway', 'insert', 'asset'), true, 'an asset of any subject');
    assert.equal(toolDoes('city', 'insert', 'asset', 'runway'), false, 'an asset of another subject is not a runway');
    assert.equal(toolDoes('plane', 'insert', 'config', 'flight:start-point'), true);
    assert.equal(toolDoes('files', 'load', 'data', 'asset'), true);
    assert.equal(toolDoes('files', 'insert', 'asset'), false);
});

test('every tool carries a name for its tile and a line for the pointer', () => {
    for (const tool of BUILD_TOOLS) {
        assert.ok(typeof tool.label === 'string' && tool.label.length > 0, `${tool.id} has a name`);
        assert.equal(tool.label, tool.label.toUpperCase(), `${tool.id} is named the way the panels are`);
        assert.ok(typeof tool.hint === 'string' && tool.hint.length > 0, `${tool.id} has a hint`);
    }
});

// A tile that does nothing is a row that does nothing with a picture on it.
test('the palette draws only the tools that work', () => {
    assert.deepEqual(paletteTools().map(tool => tool.id), BUILT_TOOLS);
    for (const tool of paletteTools()) assert.ok(isBuiltTool(tool.id));
});

test('today the palette is the tour\'s twelve and SAVE / LOAD, Insert City and Insert Plane joining as they work', () => {
    assert.deepEqual(BUILT_TOOLS, [SELECT_TOOL, 'lasso', 'mountain', 'grass', 'sand', 'water', 'snow', 'runway', 'paint', 'erase', 'extrude', ACCEPT_TOOL, FILES_TOOL]);
    assert.deepEqual(BUILD_TOOL_IDS.filter(id => !BUILT_TOOLS.includes(id)), ['city', 'plane'],
        'Insert City and Insert Plane declared, and drawn once each works');
    for (const id of ['city', 'plane']) assert.equal(isChoosableTool(id), false, `${id} cannot be chosen yet`);
    assert.equal(isChoosableTool(FILES_TOOL), true, 'and SAVE / LOAD is a tool a canvas can be worked with: its panel is the files');
    assert.equal(isChoosableTool('mountain'), true, 'Mountain is a mode a canvas can be worked with');
    assert.equal(isChoosableTool('lasso'), true, 'and so is the lasso, which draws the selection');
    assert.equal(isChoosableTool('water'), true, 'and the cover tool, pointed at any of its four');
    assert.equal(isChoosableTool('runway'), true, 'and Insert Runway, which places a template');
    assert.equal(isChoosableTool('paint'), true, 'and Free Paint, which lays a colour');
    assert.equal(isChoosableTool('erase'), true, 'and Erase, which takes elements away');
    assert.equal(isChoosableTool('extrude'), true, 'and Extrude, which lifts a region');
});

// --- Mountain drops at a click --------------------------------------------------

test('Mountain is the one tool that drops at a click, and its click settles the count', () => {
    assert.deepEqual(BUILD_TOOLS.filter(tool => dropsAtClick(tool.id)).map(tool => tool.id), ['mountain']);
    assert.deepEqual(derivedValues(buildTool('mountain')), { count: 1 });
    assert.ok(Object.isFrozen(buildTool('mountain').derived), 'the declaration cannot be rewritten');
    assert.deepEqual(derivedValues(buildTool(SELECT_TOOL)), {}, 'a tool with no gesture of its own settles nothing');
    assert.ok('count' in getElement('mountain').ranges, 'and what it settles is a range the element declares');
    assert.equal(buildTool('hammer'), null);
});

test('a dropped mountain is the panel\'s values, then the click\'s, then the point', () => {
    const mountain = buildTool('mountain');
    assert.deepEqual(droppedPlacement(mountain, { count: 12, height: [400, 600] }, { x: -301.6, y: 55, z: 7.5 }), {
        type: 'mountain',
        config: { count: 1, height: [400, 600], at: [-302, 8] }
    }, 'a count carried in from a panel is overruled by the click, which drops one');
    assert.deepEqual(droppedPlacement(mountain, null, { x: 0.2, z: -0.4 }).config.at, [0, 0]);
    assert.ok(Object.is(droppedPlacement(mountain, {}, { x: -0.4, z: 0 }).config.at[0], 0), 'and never -0');
});

test('nothing is dropped off the ground, or by a tool that does not drop', () => {
    const mountain = buildTool('mountain');
    for (const point of [null, {}, { x: 1 }, { x: NaN, z: 1 }, { x: 1, z: -Infinity }]) {
        assert.equal(droppedPlacement(mountain, {}, point), null, JSON.stringify(point));
    }
    assert.equal(droppedPlacement(buildTool(SELECT_TOOL), {}, { x: 0, z: 0 }), null);
    assert.equal(droppedPlacement(null, {}, { x: 0, z: 0 }), null);
    assert.deepEqual(toolPlacement(mountain, { at: [1, 2] }).config, { at: [1, 2] },
        'the point goes to the configuration, not to a footprint');
});

/**
 * Whatever is added between them, a tool lands in the place the twelve give
 * it, and the way out stays at the foot of the column.
 */
test('a tool added to the built list lands in its place, and accept stays last', () => {
    const built = ['accept', 'snow', 'select', 'mountain'];
    assert.deepEqual(paletteTools(built).map(tool => tool.id),
        ['select', 'mountain', 'snow', 'accept']);
});

test('a name the twelve do not hold is not a tool, built or otherwise', () => {
    assert.equal(isBuildTool('hammer'), false);
    assert.equal(isBuiltTool('hammer', ['hammer']), false,
        'listing it as built does not make it one of the twelve');
    assert.deepEqual(paletteTools(['hammer']), []);
});

test('the way out is drawn but is never the tool a canvas is worked with', () => {
    assert.equal(isBuiltTool(ACCEPT_TOOL), true);
    assert.equal(isChoosableTool(ACCEPT_TOOL), false);
    assert.equal(isChoosableTool(SELECT_TOOL), true);
    assert.equal(isChoosableTool('hammer'), false, 'and a name that is no tool cannot be chosen either');
});

test('the declarations cannot be rewritten by whoever reads them', () => {
    assert.ok(Object.isFrozen(BUILD_TOOLS));
    assert.ok(BUILD_TOOLS.every(tool => Object.isFrozen(tool)));
    assert.ok(Object.isFrozen(BUILT_TOOLS));
});
