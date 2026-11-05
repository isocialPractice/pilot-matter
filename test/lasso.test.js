/**
 * Lasso mode and Lasso shapes - ten tools in the rows the artwork groups them
 * into, each a gesture coming to one kind of region, and the two gestures they
 * all are.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FOOTPRINT_KINDS, footprintWeight, isFootprint } from '../js/environment/footprints.js';
import {
    LASSO_TOOLS, LASSO_ROWS, LASSO_HEADING, LASSO_ART, LASSO_DRAG, LASSO_CLICKS, DEFAULT_LASSO_TOOL,
    MIN_REGION, CLOSE_PIXELS, lassoTool, lassoToolBuilt, lassoRows, lassoToolArt, lassoToolName,
    lassoFootprint, clickVertex
} from '../js/lasso.js';

const ids = tools => tools.map(tool => tool.id);

// --- Ten tools, in the artwork's rows -------------------------------------------------

test('the lasso is ten tools in the four rows the artwork draws, under its own heading', () => {
    assert.equal(LASSO_HEADING, 'LASSO SELECT TOOLS');
    assert.deepEqual(LASSO_ROWS, ['row-shapes-1', 'row-shapes-2', 'row-polygons', 'row-curves']);
    const byRow = row => ids(LASSO_TOOLS.filter(tool => tool.row === row));
    assert.deepEqual(byRow('row-shapes-1'), ['free', 'rectangle', 'ellipse']);
    assert.deepEqual(byRow('row-shapes-2'), ['round-rect', 'triangle', 'star']);
    assert.deepEqual(byRow('row-polygons'), ['polygon', 'polyline']);
    assert.deepEqual(byRow('row-curves'), ['curved-polygon', 'curved-polyline']);
    assert.ok(Object.isFrozen(LASSO_TOOLS) && LASSO_TOOLS.every(Object.isFrozen));
});

/** The plan's table: a tool is a gesture, a kind is what the region turns out to be. */
test('the ten come down to a handful of kinds and two gestures', () => {
    const table = Object.fromEntries(LASSO_TOOLS.map(tool => [tool.id, [tool.kind, tool.gesture]]));
    assert.deepEqual(table, {
        free:              ['ring',    LASSO_DRAG],
        rectangle:         ['rect',    LASSO_DRAG],
        ellipse:           ['ellipse', LASSO_DRAG],
        'round-rect':      ['rect',    LASSO_DRAG],
        triangle:          ['polygon', LASSO_DRAG],
        star:              ['polygon', LASSO_DRAG],
        polygon:           ['polygon', LASSO_DRAG],
        polyline:          ['ring',    LASSO_CLICKS],
        'curved-polygon':  ['path',    LASSO_CLICKS],
        'curved-polyline': ['path',    LASSO_CLICKS]
    });
});

test('a tool is drawn once the kind it draws can be read, and the rest wait for theirs', () => {
    assert.deepEqual(ids(LASSO_TOOLS.filter(tool => lassoToolBuilt(tool.id))), ['free', 'rectangle', 'ellipse', 'round-rect', 'polyline']);
    for (const tool of LASSO_TOOLS) assert.equal(lassoToolBuilt(tool.id), FOOTPRINT_KINDS.includes(tool.kind), tool.id);
    assert.equal(lassoToolBuilt('lasso-of-truth'), false);

    assert.deepEqual(lassoRows().map(({ row, tools }) => [row, ids(tools)]), [
        ['row-shapes-1', ['free', 'rectangle', 'ellipse']],
        ['row-shapes-2', ['round-rect']],
        ['row-polygons', ['polyline']]
    ], 'and a row with none of its tools built is left out');
    assert.equal(lassoToolBuilt(DEFAULT_LASSO_TOOL), true, 'a lasso starts on a tool that works');
});

test('each tool\'s icon is cut from the art by a view of its own box, and its name is written in the page', () => {
    const art = readFileSync(new URL(`../${LASSO_ART}`, import.meta.url), 'utf8');
    const [, , width, height] = art.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
    for (const tool of LASSO_TOOLS) {
        const [x, y, w, h] = tool.art;
        assert.ok(x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= width && y + h <= height, `${tool.id}'s box lies on the art`);
        assert.equal(lassoToolArt(tool.id), `assets/builder/lasso-tools.svg#svgView(viewBox(${tool.art.join(',')}))`);
    }
    assert.equal(lassoToolName('round-rect'), 'Round rect. select');
    assert.equal(lassoToolArt('nothing'), null);
});

// --- What a gesture comes to --------------------------------------------------------------

const P = (x, z) => ({ x, z });

test('a free lasso is a ring of the points it gathered, each that landed on the one before dropped', () => {
    const ring = lassoFootprint('free', [P(0, 0), P(0, 0.5), P(1000, 0), P(1000, 1000), P(0, 1000), P(0, 0)]);
    assert.deepEqual(ring, { kind: 'ring', points: [[0, 0], [1000, 0], [1000, 1000], [0, 1000]] },
        'and the one it closed on, where it started, too');
    assert.equal(footprintWeight(ring, 500, 500), 1, 'a region the middle of is wholly inside');
    assert.equal(footprintWeight(ring, 3000, 3000), 0);
});

test('a ring of fewer than three points, or of no area, selects nothing', () => {
    assert.equal(lassoFootprint('free', [P(0, 0), P(100, 100)]), null);
    assert.equal(lassoFootprint('free', [P(0, 0), P(100, 0), P(200, 0), P(300, 0)]), null, 'three points in a line are a line');
    assert.equal(lassoFootprint('polyline', [P(0, 0), P(5, 0), P(5, 5)]), null, 'and a scrap a few units across is a slip');
    assert.equal(lassoFootprint('free', [P(0, 0), { x: NaN, z: 1 }, P(1000, 0), P(0, 1000)]).points.length, 3, 'a point that is no point is left out');
});

test('a box is the two corners a drag spans, square to the canvas, whichever way it went', () => {
    const forward = lassoFootprint('rectangle', [P(-200, 100), P(600, 900)]);
    assert.deepEqual(forward, { kind: 'rect', x: 200, z: 500, width: 800, depth: 800, angle: 0, corner: 0 });
    assert.deepEqual(lassoFootprint('rectangle', [P(600, 900), P(-200, 100)]), forward);
    assert.deepEqual(lassoFootprint('rectangle', [P(0, 0), P(300, 0), P(800, 400)]), lassoFootprint('rectangle', [P(0, 0), P(800, 400)]),
        'from the press to where the pointer is now');
    assert.equal(lassoFootprint('rectangle', [P(0, 0), P(MIN_REGION - 1, 500)]), null, 'a box thinner than a slip selects nothing');
});

test('a rounded box rounds its corners by its panel, never past half its shorter side', () => {
    const round = lassoTool('round-rect');
    assert.equal(lassoFootprint('round-rect', [P(0, 0), P(2000, 2000)]).corner, round.ranges.corner.default, 'its own default to start');
    assert.equal(lassoFootprint('round-rect', [P(0, 0), P(2000, 2000)], { corner: 250 }).corner, 250);
    assert.equal(lassoFootprint('round-rect', [P(0, 0), P(2000, 400)], { corner: 900 }).corner, 200, 'held to half the shorter side');
    assert.equal(lassoFootprint('rectangle', [P(0, 0), P(2000, 2000)], { corner: 900 }).corner, 0, 'and a plain box is never rounded');
});

test('an ellipse fills the box a drag spans', () => {
    assert.deepEqual(lassoFootprint('ellipse', [P(0, 0), P(1000, 400)]),
        { kind: 'ellipse', x: 500, z: 200, radiusX: 500, radiusZ: 200, angle: 0 });
    assert.equal(lassoFootprint('ellipse', [P(0, 0)]), null, 'a press that went nowhere selects nothing');
});

test('a tool whose kind cannot be drawn yet draws nothing', () => {
    for (const id of ['triangle', 'star', 'polygon', 'curved-polygon', 'curved-polyline']) {
        assert.equal(lassoFootprint(id, [P(0, 0), P(1000, 1000)]), null, id);
    }
    assert.equal(lassoFootprint('nothing', [P(0, 0), P(1000, 1000)]), null);
});

test('every region a built tool draws is one the region arithmetic reads', () => {
    const shapes = {
        free: [P(0, 0), P(900, 0), P(900, 900)],
        polyline: [P(0, 0), P(900, 0), P(900, 900)],
        rectangle: [P(0, 0), P(900, 900)],
        'round-rect': [P(0, 0), P(900, 900)],
        ellipse: [P(0, 0), P(900, 900)]
    };
    for (const [id, points] of Object.entries(shapes)) assert.ok(isFootprint(lassoFootprint(id, points)), id);
});

// --- A click per vertex ------------------------------------------------------------------------

const S = (x, y) => ({ x, y });

test('a click places a point where the ground was clicked', () => {
    let shape = clickVertex(null, P(0, 0), S(100, 100));
    shape = clickVertex(shape, P(1000, 0), S(300, 100));
    assert.deepEqual(shape.points, [P(0, 0), P(1000, 0)]);
    assert.equal(shape.closed, false);
    assert.deepEqual(clickVertex(shape, null, S(500, 500)).points, shape.points, 'a click over the sky places nothing');
});

test('a click on the first point closes the shape, once there are three', () => {
    let shape = clickVertex(null, P(0, 0), S(100, 100));
    shape = clickVertex(shape, P(1000, 0), S(300, 100));
    assert.equal(clickVertex(shape, P(1, 1), S(102, 103)).closed, false, 'two points and a click on the first is no region yet');
    shape = clickVertex(shape, P(1000, 1000), S(300, 300));
    const closed = clickVertex(shape, P(2, 2), S(100 + CLOSE_PIXELS - 2, 100));
    assert.equal(closed.closed, true);
    assert.deepEqual(closed.points, shape.points, 'and adds no point of its own');
});

test('a click on the last point again - a double click - closes it too', () => {
    let shape = clickVertex(null, P(0, 0), S(100, 100));
    shape = clickVertex(shape, P(1000, 0), S(300, 100));
    shape = clickVertex(shape, P(1000, 1000), S(300, 300));
    assert.equal(clickVertex(shape, P(1000, 1000), S(301, 299)).closed, true);
});

test('a double click with too few points starts nothing, and a click is a new shape, not the old one changed', () => {
    const one = clickVertex(null, P(0, 0), S(100, 100));
    const twice = clickVertex(one, P(0, 0), S(100, 101));
    assert.equal(twice.points.length, 1, 'a point clicked again is not placed again');
    assert.equal(twice.closed, false);
    const before = JSON.stringify(one);
    clickVertex(one, P(5, 5), S(400, 400));
    assert.equal(JSON.stringify(one), before);
});
