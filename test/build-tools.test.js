import test from 'node:test';
import assert from 'node:assert/strict';
import {
    BUILD_TOOLS, BUILD_TOOL_IDS, BUILT_TOOLS, SELECT_TOOL, ACCEPT_TOOL,
    isBuildTool, isBuiltTool, isChoosableTool, paletteTools
} from '../js/build-tools.js';

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

test('today the palette is Select and the way out, and nothing else', () => {
    assert.deepEqual(BUILT_TOOLS, [SELECT_TOOL, ACCEPT_TOOL]);
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
    assert.equal(isChoosableTool('lasso'), false, 'and an unbuilt tool cannot be chosen either');
});

test('the declarations cannot be rewritten by whoever reads them', () => {
    assert.ok(Object.isFrozen(BUILD_TOOLS));
    assert.ok(BUILD_TOOLS.every(tool => Object.isFrozen(tool)));
    assert.ok(Object.isFrozen(BUILT_TOOLS));
});
