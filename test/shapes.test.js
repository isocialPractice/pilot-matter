/**
 * Parametric shapes, Curved selections, Drawing against a selection, and
 * Shift at the press, shift in the drag - the regular figure held as its
 * parameters, the boundary of curves flattened once, the three ways a shape
 * meets a selection, and the key read at the press against the key pressed in
 * the drag.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    footprintWeight, footprintBounds, footprintSampler, isFootprint, polygonPoints, flattenPath,
    combineFootprints, COMBINE_OPS, COMBINE_KIND, FOOTPRINT_KINDS, PATH_PIECES
} from '../js/environment/footprints.js';
import { DEFAULT_SIZE } from '../js/environment/elements.js';
import {
    LASSO_TOOLS, lassoTool, lassoFootprint, lassoOp, combineSelection, coversGround, reshapeFootprint,
    squareInDrag, LASSO_ADD, LASSO_CUT, LASSO_WITHIN
} from '../js/lasso.js';
import {
    createBuildState, openBuildMode, beginCanvas, setSelection, drawIntoSelection, deselect,
    chooseLassoTool, setLassoValues, selectionTool, selectionLive, buildSelection, BUILD_FROM_TITLE
} from '../js/build-mode.js';
import { footprintLoop, regionEdges, chainSegments, contoured } from '../js/build-overlay.js';

const HALF = DEFAULT_SIZE / 2;
const P = (x, z) => ({ x, z });
const inside = (footprint, x, z) => footprintWeight(footprint, x, z) === 1;
const outside = (footprint, x, z) => footprintWeight(footprint, x, z) === 0;

// --- A regular figure, held as its parameters ---------------------------------------

test('a polygon is a regular figure: its corners worked out from its middle, reach, sides and turn', () => {
    const hexagon = { kind: 'polygon', x: 100, z: -50, radius: 1000, sides: 6, angle: 0 };
    const corners = polygonPoints(hexagon);
    assert.equal(corners.length, 6);
    for (const [x, z] of corners) assert.ok(Math.abs(Math.hypot(x - 100, z + 50) - 1000) < 1e-9, 'each corner its reach from the middle');
    assert.ok(Math.abs(corners[0][0] - 1100) < 1e-9 && Math.abs(corners[0][1] + 50) < 1e-9, 'the first where its turn points');
    const [first] = polygonPoints({ ...hexagon, angle: Math.PI / 6 });
    assert.ok(Math.abs(first[0] - (100 + Math.cos(Math.PI / 6) * 1000)) < 1e-9 && Math.abs(first[1] - (-50 + Math.sin(Math.PI / 6) * 1000)) < 1e-9,
        'and turned, the first corner turns with it');

    assert.ok(inside(hexagon, 100, -50) && outside(hexagon, 100, 2000));
    assert.ok(isFootprint(hexagon) && FOOTPRINT_KINDS.includes('polygon'));
    assert.deepEqual(footprintBounds({ ...hexagon, feather: 0 }), {
        minX: Math.min(...corners.map(c => c[0])), maxX: Math.max(...corners.map(c => c[0])),
        minZ: Math.min(...corners.map(c => c[1])), maxZ: Math.max(...corners.map(c => c[1]))
    });
});

test('changing its sides reshapes it where it stands, rather than asking for it again', () => {
    const six = { kind: 'polygon', x: 0, z: 0, radius: 1000, sides: 6, angle: Math.PI / 6 };
    const seven = { ...six, sides: 7 };
    assert.equal(polygonPoints(seven).length, 7);
    assert.ok(polygonPoints(seven).every(([x, z]) => Math.abs(Math.hypot(x, z) - 1000) < 1e-9), 'the same reach from the same middle');
    assert.notDeepEqual(polygonPoints(six), polygonPoints(seven));
    assert.deepEqual(polygonPoints({ ...six, sides: 6.4 }), polygonPoints(six), 'a count between two is the nearer whole one');
    assert.equal(polygonPoints({ ...six, sides: 500 }).length, 64, 'and no more than sixty-four, however many are asked for');
});

test('a star pulls every other corner in by its ratio', () => {
    const star = { kind: 'polygon', x: 0, z: 0, radius: 1000, sides: 5, inner: 0.4, angle: 0 };
    const corners = polygonPoints(star);
    assert.equal(corners.length, 10, 'five points and five corners between them');
    corners.forEach(([x, z], i) => assert.ok(Math.abs(Math.hypot(x, z) - (i % 2 ? 400 : 1000)) < 1e-9));
    assert.ok(inside(star, 0, 0));
    assert.equal(polygonPoints({ ...star, inner: 1 }).length, 5, 'a ratio of one pulls nothing in, and is the plain figure');
    assert.ok(outside(star, Math.cos(Math.PI / 5) * 900, Math.sin(Math.PI / 5) * 900), 'and between two points is outside it');
});

test('a figure of no reach or fewer than three sides is no region', () => {
    assert.equal(isFootprint({ kind: 'polygon', x: 0, z: 0, radius: 0, sides: 6 }), false);
    assert.equal(isFootprint({ kind: 'polygon', x: 0, z: 0, radius: 500, sides: 2 }), false);
    assert.equal(footprintWeight({ kind: 'polygon', x: 0, z: 0, radius: 500, sides: 2 }, 0, 0), 0);
    assert.deepEqual(polygonPoints({ kind: 'polygon', x: 0, z: 0, radius: 500, sides: 2 }), [], 'and has no corners to draw');
});

// --- A boundary of curves ------------------------------------------------------------

const POINTS = [[0, 0], [2000, 0], [2000, 2000], [0, 2000]];

test('a curve runs smoothly through every point it was drawn through', () => {
    const outline = flattenPath({ kind: 'path', points: POINTS, closed: true });
    assert.equal(outline.length, POINTS.length * PATH_PIECES, 'every curve in pieces, round the whole loop');
    for (const [x, z] of POINTS) {
        assert.ok(outline.some(([ox, oz]) => Math.hypot(ox - x, oz - z) < 1e-9), `through ${x},${z}`);
    }
    assert.ok(outline.some(([x, z]) => x > 2000 || z < 0), 'rounding out past the straight sides between them, as a curve does');
});

test('a curved polyline is joined straight back to its start, and a curved polygon round the loop', () => {
    const open = flattenPath({ kind: 'path', points: POINTS, closed: false });
    assert.equal(open.length, (POINTS.length - 1) * PATH_PIECES + 1);
    assert.deepEqual(open.at(-1), POINTS.at(-1), 'ending on its last point, from which it closes straight');
    const shut = { kind: 'path', points: POINTS, closed: true };
    const loose = { kind: 'path', points: POINTS, closed: false };
    assert.ok(inside(shut, 1000, 1000) && inside(loose, 1000, 1000));
    assert.ok(footprintWeight(shut, -100, 1000) > 0.9, 'the polygon bulging out past its last side, as the loop curves');
    assert.equal(footprintWeight(loose, -100, 1000), 0, 'where the polyline closes straight along it');
});

test('a curve is flattened once for as long as it is held, its control points kept', () => {
    const path = { kind: 'path', points: POINTS, closed: true };
    assert.equal(flattenPath(path), flattenPath(path), 'the same outline handed back, not worked out again');
    footprintSampler(path, DEFAULT_SIZE)(1000, 1000);
    assert.deepEqual(path.points, POINTS, 'and the points it is edited by left on it');
    assert.equal(isFootprint({ kind: 'path', points: [[0, 0], [10, 10]] }), false, 'two points are no curve round anything');
});

// --- Two regions as one ------------------------------------------------------------------

const BOX = { kind: 'rect', x: 0, z: 0, width: 4000, depth: 4000, angle: 0, corner: 0 };
const DISC = { kind: 'disc', x: 2000, z: 0, radius: 1200 };

test('a union is the larger weight, an intersection the product, a cut the first less the second', () => {
    assert.deepEqual([...COMBINE_OPS], ['union', 'intersect', 'subtract']);
    const points = [[0, 0], [1900, 0], [2900, 0], [0, 1990], [5000, 5000]];
    for (const [x, z] of points) {
        const a = footprintWeight(BOX, x, z), b = footprintWeight(DISC, x, z);
        assert.equal(footprintWeight(combineFootprints('union', BOX, DISC), x, z), Math.max(a, b));
        assert.equal(footprintWeight(combineFootprints('intersect', BOX, DISC), x, z), a * b);
        assert.equal(footprintWeight(combineFootprints('subtract', BOX, DISC), x, z), a * (1 - b));
    }
    const feathered = footprintWeight(combineFootprints('subtract', BOX, DISC), 0, 1950);
    assert.ok(feathered > 0 && feathered < 1, 'and an edge stays as soft as the softer of the two');
});

test('a combination reaches as far as its op lets it, and two that never meet intersect in nothing', () => {
    const union = footprintBounds(combineFootprints('union', BOX, DISC));
    assert.ok(union.maxX >= footprintBounds(DISC).maxX && union.minX <= footprintBounds(BOX).minX);
    assert.deepEqual(footprintBounds(combineFootprints('subtract', BOX, DISC)), footprintBounds(BOX), 'a cut reaches no further than what it cut from');
    const far = { kind: 'disc', x: 6000, z: 6000, radius: 500 };
    assert.equal(isFootprint(combineFootprints('intersect', BOX, far)), false);
    assert.equal(isFootprint(combineFootprints('join', BOX, DISC)), false, 'an op that is none of the three is no region');
});

test('combinations nest, and survive being written down', () => {
    const nested = combineFootprints('subtract', combineFootprints('union', BOX, DISC), { kind: 'ellipse', x: 0, z: 0, radiusX: 500, radiusZ: 300, angle: 0 });
    assert.equal(nested.kind, COMBINE_KIND);
    assert.ok(outside(nested, 0, 0), 'a hole cut in the middle');
    assert.ok(inside(nested, 2800, 0), 'and the disc added beside the box');
    assert.deepEqual(JSON.parse(JSON.stringify(nested)), structuredClone(nested));
    assert.equal(footprintWeight(JSON.parse(JSON.stringify(nested)), 2800, 0), 1);
});

test('a combination across a seam is cut out on both sides of it', () => {
    const edge = { kind: 'rect', x: HALF, z: 0, width: 4000, depth: 2000, angle: 0, corner: 0 };
    const hole = { kind: 'disc', x: HALF, z: 0, radius: 600 };
    const weigh = footprintSampler(combineFootprints('subtract', edge, hole), DEFAULT_SIZE);
    assert.equal(weigh(-HALF + 100, 0), 0, 'the hole carries across the seam');
    assert.equal(weigh(-HALF + 1500, 0), 1, 'and the box beyond it');
    assert.equal(weigh(HALF - 1500, 0), 1);
});

// --- The lasso's tools that draw them -------------------------------------------------

test('Triangle, Star and Polygon stand on the press, sized and turned by the drag', () => {
    const triangle = lassoFootprint('triangle', [P(100, 200), P(100, 1200)]);
    assert.deepEqual(triangle, { kind: 'polygon', x: 100, z: 200, radius: 1000, sides: 3, inner: 1, angle: Math.PI / 2 });
    assert.equal(lassoFootprint('polygon', [P(0, 0), P(800, 0)]).sides, 6, 'Polygon\'s sides off its panel');
    assert.equal(lassoFootprint('polygon', [P(0, 0), P(800, 0)], { numberOfSides: 9 }).sides, 9);
    const star = lassoFootprint('star', [P(0, 0), P(800, 0)], { numberOfPoints: 7, starRatio: 0.3 });
    assert.deepEqual([star.sides, star.inner], [7, 0.3]);
    assert.equal(lassoFootprint('star', [P(0, 0), P(10, 0)]), null, 'a figure a few units across is a slip');
    assert.deepEqual(Object.keys(lassoTool('polygon').ranges), ['numberOfSides']);
    assert.deepEqual(Object.keys(lassoTool('star').ranges), ['numberOfPoints', 'starRatio']);
    assert.equal(lassoTool('polygon').ranges.numberOfSides.step, 1, 'sides step in whole sides');
});

test('the curved tools draw a curve through the points clicked, closed as each closes', () => {
    const points = [P(0, 0), P(2000, 0), P(2000, 2000), P(0, 2000)];
    assert.deepEqual(lassoFootprint('curved-polygon', points), { kind: 'path', points: POINTS, closed: true });
    assert.deepEqual(lassoFootprint('curved-polyline', points), { kind: 'path', points: POINTS, closed: false });
    assert.equal(lassoFootprint('curved-polygon', [P(0, 0), P(1000, 0)]), null);
    for (const id of ['curved-polygon', 'curved-polyline']) {
        assert.equal(lassoFootprint(id, [P(0, 0), P(1000, 0), P(2000, 0)]), null, `${id}: a curve through points in a line covers nothing`);
    }
});

test('shift pressed in a drag keeps a box square and an ellipse round, sized to the longer way', () => {
    assert.deepEqual(lassoFootprint('rectangle', [P(0, 0), P(1000, -300)], {}, { square: true }),
        { kind: 'rect', x: 500, z: -500, width: 1000, depth: 1000, angle: 0, corner: 0 }, 'grown from the press toward the pointer');
    const round = lassoFootprint('ellipse', [P(0, 0), P(-400, 1000)], {}, { square: true });
    assert.equal(round.radiusX, round.radiusZ);
    assert.deepEqual(lassoFootprint('rectangle', [P(0, 0), P(1000, 300)]).depth, 300, 'and without it, the box the drag spans');
});

// --- The key at the press, and the key in the drag -------------------------------------------

test('the key held at the press says how a shape meets the selection', () => {
    assert.equal(lassoOp({ shiftKey: true }, true), LASSO_ADD);
    assert.equal(lassoOp({ altKey: true }, true), LASSO_CUT);
    assert.equal(lassoOp({}, true), LASSO_WITHIN, 'neither draws it inside, which is the clip every tool already has');
    assert.equal(lassoOp({}, false), LASSO_ADD, 'and with nothing selected, a shape adds');
    assert.equal(lassoOp({ shiftKey: true }, false), LASSO_ADD, 'shift means the same either way');
    assert.equal(lassoOp({ altKey: true }, false), LASSO_CUT, 'and so does alt');
    assert.equal(lassoOp({ shiftKey: true, altKey: true }, true), LASSO_CUT, 'alt with shift still cuts, so a cut is never an add by accident');
});

test('shift held from the press is the add and squares nothing; pressed again in the drag it squares', () => {
    let drag = { shiftUp: false };
    drag = { ...drag, ...squareInDrag(drag, true) };
    assert.equal(drag.square, false, 'still the shift of the press');
    drag = { ...drag, ...squareInDrag(drag, false) };
    assert.equal(drag.square, false);
    drag = { ...drag, ...squareInDrag(drag, true) };
    assert.equal(drag.square, true, 'pressed again once the drag is under way');

    let plain = { shiftUp: true };
    plain = { ...plain, ...squareInDrag(plain, true) };
    assert.equal(plain.square, true, 'a drag begun without shift squares the moment it is pressed');
});

test('a shape becomes the selection, or is added to it, drawn inside it or cut out of it', () => {
    assert.deepEqual(combineSelection(null, BOX, LASSO_ADD), BOX);
    assert.equal(combineSelection(null, BOX, LASSO_CUT), null, 'cutting out of nothing leaves nothing');
    assert.deepEqual(combineSelection(BOX, DISC, LASSO_WITHIN), combineFootprints('intersect', BOX, DISC));
    assert.deepEqual(combineSelection(BOX, null, LASSO_ADD), BOX, 'and a shape that is no region changes nothing');
    assert.equal(coversGround(BOX, DEFAULT_SIZE), true);
    assert.equal(coversGround(combineFootprints('subtract', DISC, BOX), DEFAULT_SIZE), true);
    assert.equal(coversGround(combineFootprints('subtract', DISC, { ...BOX, width: 9000, depth: 9000, x: 2000 }), DEFAULT_SIZE), false,
        'a region cut out of the whole of it covers no ground');
});

test('a figure on the ground is reshaped by its own tool\'s panel, and only by its own', () => {
    const hexagon = lassoFootprint('polygon', [P(0, 0), P(800, 0)]);
    assert.deepEqual(reshapeFootprint(hexagon, 'polygon', { numberOfSides: 7.4 }), { ...hexagon, sides: 7 });
    assert.equal(reshapeFootprint(hexagon, 'round-rect', { corner: 30 }), null, 'a box tool does not reshape a polygon');
    const star = lassoFootprint('star', [P(0, 0), P(800, 0)]);
    assert.deepEqual(reshapeFootprint(star, 'star', { numberOfPoints: 6, starRatio: 0.3 }), { ...star, sides: 6, inner: 0.3 },
        'a star takes both its count and its ratio');
    const box = lassoFootprint('round-rect', [P(0, 0), P(1000, 400)]);
    assert.equal(reshapeFootprint(box, 'round-rect', { corner: 5000 }).corner, 200, 'a corner held to half the shorter side');
    assert.equal(reshapeFootprint(box, 'round-rect', { corner: 50 }).corner, 50, 'and one inside that taken as it is');
});

// --- The session's half -------------------------------------------------------------------

function onLasso() {
    const state = createBuildState();
    openBuildMode(state, BUILD_FROM_TITLE);
    beginCanvas(state, 'highlands');
    return state;
}

test('a shape drawn with nothing selected is the selection, and remembers the tool that drew it', () => {
    const state = onLasso();
    assert.equal(drawIntoSelection(state, BOX, LASSO_ADD, { tool: 'rectangle', size: DEFAULT_SIZE }), true);
    assert.deepEqual(buildSelection(state), BOX);
    assert.equal(selectionTool(state), 'rectangle');
    deselect(state);
    assert.equal(state.selectionTool, null, 'and a deselect forgets it, on the session and not only in what it reads');
    assert.equal(selectionTool({ ...state, selection: null, selectionTool: 'rectangle' }), null,
        'which answers only for a selection that is there, whatever was left behind');
    assert.equal(drawIntoSelection(onLasso(), BOX, LASSO_CUT, { tool: 'rectangle', size: DEFAULT_SIZE }), false, 'and one cut out of nothing selects nothing');
});

test('a shape drawn against a selection combines with it, and then belongs to no one tool', () => {
    const state = onLasso();
    drawIntoSelection(state, BOX, LASSO_ADD, { tool: 'rectangle', size: DEFAULT_SIZE });
    drawIntoSelection(state, DISC, LASSO_ADD, { tool: 'ellipse', size: DEFAULT_SIZE });
    assert.deepEqual(buildSelection(state), combineFootprints('union', BOX, DISC));
    assert.equal(selectionTool(state), null);
    drawIntoSelection(state, { kind: 'disc', x: 0, z: 0, radius: 300 }, LASSO_CUT, { tool: 'ellipse', size: DEFAULT_SIZE });
    assert.equal(buildSelection(state).op, 'subtract');
});

test('a shape that leaves no ground selected leaves nothing selected', () => {
    const inside = onLasso();
    drawIntoSelection(inside, BOX, LASSO_ADD, { tool: 'rectangle', size: DEFAULT_SIZE });
    assert.equal(drawIntoSelection(inside, { kind: 'disc', x: 6000, z: 6000, radius: 500 }, LASSO_WITHIN, { size: DEFAULT_SIZE }), true);
    assert.equal(selectionLive(inside), false, 'drawn inside a selection it does not touch');

    const cut = onLasso();
    drawIntoSelection(cut, DISC, LASSO_ADD, { tool: 'ellipse', size: DEFAULT_SIZE });
    drawIntoSelection(cut, { ...BOX, width: 9000, depth: 9000, x: 2000 }, LASSO_CUT, { size: DEFAULT_SIZE });
    assert.equal(selectionLive(cut), false, 'or cut out of the whole of it');
});

test('a polygon selected is reshaped by its panel while it is one shape drawn by it', () => {
    const state = onLasso();
    chooseLassoTool(state, 'polygon');
    drawIntoSelection(state, lassoFootprint('polygon', [P(0, 0), P(900, 0)]), LASSO_ADD, { tool: 'polygon', size: DEFAULT_SIZE });
    setLassoValues(state, { numberOfSides: 8 });
    assert.equal(buildSelection(state).sides, 8, 'six sides set to eight is the octagon where the hexagon was');

    chooseLassoTool(state, 'star');
    setLassoValues(state, { numberOfPoints: 9 });
    assert.equal(buildSelection(state).sides, 8, 'another tool\'s panel leaves it alone');

    chooseLassoTool(state, 'polygon');
    drawIntoSelection(state, DISC, LASSO_ADD, { tool: 'ellipse', size: DEFAULT_SIZE });
    const combined = JSON.stringify(buildSelection(state));
    setLassoValues(state, { numberOfSides: 4 });
    assert.equal(JSON.stringify(buildSelection(state)), combined, 'and once combined, no one tool\'s fields describe it');

    deselect(state);
    assert.equal(selectionTool(state), null);
});

// --- Drawn on the ground ---------------------------------------------------------------------

test('a figure and a curve are outlined from what they are', () => {
    const hexagon = { kind: 'polygon', x: 0, z: 0, radius: 1000, sides: 6, angle: 0 };
    assert.deepEqual(footprintLoop(hexagon), polygonPoints(hexagon));
    const curve = { kind: 'path', points: POINTS, closed: true };
    assert.equal(footprintLoop(curve).length, flattenPath(curve).length);
    assert.equal(contoured(hexagon), false);
    assert.equal(contoured(combineFootprints('union', BOX, DISC)), true, 'and a combination, which has no one outline, is traced');
});

test('a combination\'s edge is traced as runs end to end, so a dashed line flows along it', () => {
    const runs = regionEdges(combineFootprints('union', BOX, DISC), DEFAULT_SIZE);
    assert.equal(runs.length, 1, 'one closed edge round the box and the disc together');
    const run = runs[0];
    assert.ok(Math.hypot(run[0][0] - run.at(-1)[0], run[0][1] - run.at(-1)[1]) < 1e-6, 'coming back to where it began');
    const weigh = footprintSampler(combineFootprints('union', BOX, DISC), DEFAULT_SIZE);
    assert.ok(run.every(([x, z]) => weigh(x, z) < 0.5), 'and drawn where the selection begins, on the outside of its feather');

    const holed = regionEdges(combineFootprints('subtract', BOX, { kind: 'disc', x: 0, z: 0, radius: 600 }), DEFAULT_SIZE);
    assert.equal(holed.length, 2, 'and a hole is an edge of its own');
});

test('segments that meet end to end are joined, open runs from their loose ends', () => {
    const runs = chainSegments([[1, 0, 2, 0], [0, 0, 1, 0], [2, 0, 3, 0], [10, 10, 11, 10]]);
    assert.equal(runs.length, 2);
    assert.deepEqual(runs.find(r => r.length === 4), [[0, 0], [1, 0], [2, 0], [3, 0]]);
});

test('every tool on the lasso is a gesture coming to a region the arithmetic reads', () => {
    for (const tool of LASSO_TOOLS) {
        const points = tool.gesture === 'drag' ? [P(0, 0), P(1500, 900)] : [P(0, 0), P(1500, 0), P(1500, 1500), P(0, 1500)];
        const region = lassoFootprint(tool.id, tool.kind === 'ring' && tool.gesture === 'drag' ? [P(0, 0), P(1500, 0), P(1500, 1500)] : points);
        assert.ok(isFootprint(region), tool.id);
        assert.ok(coversGround(region, DEFAULT_SIZE), `${tool.id} covers ground`);
    }
});
