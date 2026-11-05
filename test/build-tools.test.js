import test from 'node:test';
import assert from 'node:assert/strict';
import {
    BUILD_TOOLS, BUILD_TOOL_IDS, BUILT_TOOLS, SELECT_TOOL, ACCEPT_TOOL,
    isBuildTool, isBuiltTool, isChoosableTool, paletteTools,
    buildTool, dropsAtClick, derivedValues, droppedPlacement, toolPlacement
} from '../js/build-tools.js';
import { getElement } from '../js/environment/elements.js';

// The twelve, in the order the tour walks them and the palette stacks them.
test('the twelve tools are the tour\'s, in its order', () => {
    assert.deepEqual(BUILD_TOOL_IDS, [
        'select', 'lasso', 'mountain', 'grass', 'sand', 'water',
        'snow', 'runway', 'paint', 'erase', 'extrude', 'accept'
    ]);
    assert.equal(BUILD_TOOL_IDS[0], SELECT_TOOL, 'Select is the first');
    assert.equal(BUILD_TOOL_IDS.at(-1), ACCEPT_TOOL, 'and the way out is the last');
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

test('today the palette is Select, Lasso, Mountain, the four covers, Insert Runway and the way out, and nothing else', () => {
    assert.deepEqual(BUILT_TOOLS, [SELECT_TOOL, 'lasso', 'mountain', 'grass', 'sand', 'water', 'snow', 'runway', ACCEPT_TOOL]);
    assert.equal(isChoosableTool('mountain'), true, 'Mountain is a mode a canvas can be worked with');
    assert.equal(isChoosableTool('lasso'), true, 'and so is the lasso, which draws the selection');
    assert.equal(isChoosableTool('water'), true, 'and the cover tool, pointed at any of its four');
    assert.equal(isChoosableTool('runway'), true, 'and Insert Runway, which places a template');
    assert.equal(isChoosableTool('extrude'), false, 'but not yet Extrude, which draws nothing');
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
    assert.equal(isChoosableTool('paint'), false, 'and an unbuilt tool cannot be chosen either');
});

test('the declarations cannot be rewritten by whoever reads them', () => {
    assert.ok(Object.isFrozen(BUILD_TOOLS));
    assert.ok(BUILD_TOOLS.every(tool => Object.isFrozen(tool)));
    assert.ok(Object.isFrozen(BUILT_TOOLS));
});
