/**
 * Selection highlight - the hovered placement outlined lightly and the chosen
 * one firmly, traced round the reach a click is measured against and drawn
 * over the ground rather than into it.
 *
 * The tracing, the projection and the stroke are pure, so they are held here;
 * that the frame draws them, and through the camera it was drawn from, is
 * wiring and is read off the source in `page.test.js`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SIZE } from '../js/environment/elements.js';
import { placementReach, placementAt, PICK_WEIGHT } from '../js/build-select.js';
import {
    contourSegments, footprintContour, placementOutline, projectOutline, strokeOutline, surfaceEdges, chainSegments,
    HOVER_OUTLINE, CHOSEN_OUTLINE, OUTLINE_CELLS
} from '../js/build-overlay.js';
import { canvasPickBounds } from '../js/build-picking.js';
import { footprintWeight } from '../js/environment/footprints.js';

const HALF = DEFAULT_SIZE / 2;

function dropped(at, seed = 7, config = {}) {
    return { type: 'mountain', config: { height: [800, 800], radius: [1200, 1200], count: 1, at, ...config }, seed };
}

/** Every end of every segment, as points. */
function ends(segments) {
    return segments.flatMap(([x1, z1, x2, z2]) => [[x1, z1], [x2, z2]]);
}

// --- The trace -----------------------------------------------------------------

test('a contour runs round a region where its weight crosses the level', () => {
    const radius = 1500;
    const weigh = (x, z) => Math.max(0, 1 - Math.hypot(x, z) / (2 * radius));
    const segments = contourSegments(weigh, canvasPickBounds(DEFAULT_SIZE), 160, 0.5);
    const cell = DEFAULT_SIZE / 160;

    assert.ok(segments.length > 20);
    for (const [x, z] of ends(segments)) {
        assert.ok(Math.abs(Math.hypot(x, z) - radius) < cell * 0.05, 'each end lies on the circle, placed along its edge where the weight crosses');
    }

    const length = segments.reduce((sum, [x1, z1, x2, z2]) => sum + Math.hypot(x2 - x1, z2 - z1), 0);
    assert.ok(Math.abs(length - 2 * Math.PI * radius) < 2 * Math.PI * radius * 0.02, 'and goes all the way round');
    assert.ok(segments.every(([x1, z1, x2, z2]) => Math.hypot(x2 - x1, z2 - z1) <= cell * Math.SQRT2 + 1e-9),
        'one segment to a cell');
});

test('nothing reaching the level is nothing to trace, and a level filling the square has no edge', () => {
    const bounds = canvasPickBounds(DEFAULT_SIZE);
    assert.deepEqual(contourSegments(() => 0, bounds, 32, 0.5), []);
    assert.deepEqual(contourSegments(() => 1, bounds, 32, 0.5), []);
});

/**
 * The two cells marching squares can read either way: two opposite corners in
 * and two out. The middle settles it, so a contour never crosses itself.
 */
test('a saddle is settled by the middle of its cell', () => {
    const bounds = { minX: 0, maxX: 1, minZ: 0, maxZ: 1 };
    // In at the low-x low-z and high-x high-z corners, out at the other two.
    const weigh = (x, z) => (x === z ? 1 : 0);
    const join = segments => segments.map(([x1, z1, x2, z2]) => `${x1},${z1}-${x2},${z2}`).sort();

    assert.deepEqual(join(contourSegments(weigh, bounds, 1, 0.5)),
        join([[0, 0.5, 0.5, 1], [0.5, 0, 1, 0.5]]),
        'a middle that is in joins the two corners across it, cutting off the other two');
    assert.deepEqual(join(contourSegments(weigh, bounds, 1, 0.6)),
        join([[0, 0.4, 0.4, 0], [1, 0.6, 0.6, 1]]),
        'and one that is out keeps them apart');
});

// --- The outline of a placement --------------------------------------------------

test('a placement is outlined exactly where a click stops finding it', () => {
    const mountain = dropped([500, -800], 77, { girthRange: { on: true } });
    const outline = placementOutline(mountain, DEFAULT_SIZE);
    const reach = placementReach(mountain, DEFAULT_SIZE);

    assert.ok(outline.length > 20);
    for (const [x, z] of ends(outline)) {
        assert.ok(Math.abs(reach(x, z) - PICK_WEIGHT) < 0.02, `the line is drawn at the weight a click needs, ${reach(x, z)}`);
    }

    // Just inside the line toward the peak picks; just outside does not.
    const [x, z] = ends(outline)[0];
    const toward = (share) => [x + (500 - x) * share, z + (-800 - z) * share];
    assert.equal(placementAt([mountain], ...toward(0.08), DEFAULT_SIZE), 0);
    assert.equal(placementAt([mountain], ...toward(-0.08), DEFAULT_SIZE), null);
});

test('a peak dropped by an edge is outlined on both sides of the canvas', () => {
    const outline = placementOutline(dropped([HALF - 300, 0]), DEFAULT_SIZE);
    const xs = ends(outline).map(([x]) => x);
    assert.ok(xs.some(x => x > HALF - 1500), 'where it stands');
    assert.ok(xs.some(x => x < -HALF + 1500), 'and where its slope comes back in across the seam');
    assert.ok(xs.every(x => x >= -HALF && x <= HALF), 'cut at the canvas rather than drawn off it');
});

test('nothing reaching the canvas, or no canvas, has no outline', () => {
    assert.deepEqual(placementOutline({ type: 'mountain', config: { count: 4 } }, DEFAULT_SIZE), []);
    assert.deepEqual(placementOutline(dropped([0, 0]), 0), []);
    assert.ok(OUTLINE_CELLS >= 128, 'and the trace is fine enough to follow a small peak');
});

/**
 * A cell of the canvas is 62.5 units at `OUTLINE_CELLS`, and Extrude accepts a
 * region 40 units across, whose ground at full cover is about 20: traced over
 * the canvas, whether a rim was found at all came down to where the region fell
 * on that grid, and two drives of the same 200 unit block gave a rim of 83
 * pixels and a rim of 1. Traced over the region's own square, the smallest
 * region Extrude takes is outlined as closely as the largest.
 */
test('a region is traced at its own size, so a small one is outlined as closely as a large one', () => {
    // Off the middle by an odd amount, which is where the canvas's grid used to
    // decide it: a region centred on the canvas falls on the grid symmetrically.
    const rect = width => ({ kind: 'rect', x: 31, z: -47, width, depth: width });

    for (const width of [40, 200, 2400]) {
        const footprint = rect(width);
        const runs = surfaceEdges(footprint, 'top', DEFAULT_SIZE);
        assert.equal(runs.length, 1, `${width}: one rim round one region`);

        const run = runs[0];
        assert.ok(run.length > 40, `${width}: traced in ${run.length} points, which is not a rim`);
        assert.ok(Math.hypot(run[0][0] - run.at(-1)[0], run[0][1] - run.at(-1)[1]) < 1e-6,
            `${width}: and closed, coming back to where it began`);
        for (const [x, z] of run) {
            assert.ok(footprintWeight(footprint, x, z, DEFAULT_SIZE) > 1 - 1e-5, `${width}: ${x},${z} is not on the top`);
        }

        // The top is the region inset by its feather, which the hold keeps to
        // half the region's reach - so its rim spans about half the width.
        const span = Math.max(...run.map(([x]) => x)) - Math.min(...run.map(([x]) => x));
        const expected = width - 2 * Math.min(160, (width / 2) * 0.5);
        assert.ok(Math.abs(span - expected) < width / 20, `${width}: the rim spans ${span}, not about ${expected}`);
    }

    // The square is still the canvas where a region is as wide as it, and a
    // region past a seam is traced on both sides of the canvas as it was.
    const wide = { kind: 'rect', x: 0, z: 0, width: DEFAULT_SIZE * 2, depth: DEFAULT_SIZE * 2 };
    assert.deepEqual(footprintContour(wide, DEFAULT_SIZE, OUTLINE_CELLS, 0.5), [], 'a region covering the whole canvas has no edge on it');

    const seam = { kind: 'disc', x: HALF - 300, z: 0, radius: 1200 };
    const xs = chainSegments(footprintContour(seam, DEFAULT_SIZE, OUTLINE_CELLS, 0.5)).flat().map(([x]) => x);
    assert.ok(xs.some(x => x > HALF - 1500), 'where it stands');
    assert.ok(xs.some(x => x < -HALF + 1500), 'and where it comes back in across the seam');
    assert.ok(xs.every(x => x >= -HALF && x <= HALF), 'cut at the canvas rather than traced off it');
});

// --- Onto the screen ---------------------------------------------------------------

test('an outline is stood on the ground and projected, and what is out of view is left out', () => {
    const segments = [[0, 0, 10, 0], [10, 0, 20, 0], [20, 0, 30, 0]];
    const heights = [];
    const heightAt = (x, z) => { heights.push([x, z]); return x * 2; };
    // Anything at x 20 or beyond is behind the camera.
    const project = (x, y, z) => (x >= 20 ? null : { x: x + 100, y: y + z });

    assert.deepEqual(projectOutline(segments, heightAt, project), [[100, 0, 110, 20]]);
    assert.ok(heights.some(([x]) => x === 10), 'each end read off the ground under it');
    assert.deepEqual(projectOutline(null, heightAt, project), []);
});

test('an outline is stroked over a darker line under it, in the style asked for', () => {
    const calls = [];
    const ctx = {
        set lineWidth(v) { calls.push(['width', v]); },
        set strokeStyle(v) { calls.push(['colour', v]); },
        beginPath() { calls.push(['begin']); },
        moveTo(x, y) { calls.push(['move', x, y]); },
        lineTo(x, y) { calls.push(['line', x, y]); },
        stroke() { calls.push(['stroke']); }
    };

    strokeOutline(ctx, [[1, 2, 3, 4]], CHOSEN_OUTLINE);
    const widths = calls.filter(([kind]) => kind === 'width').map(([, v]) => v);
    assert.deepEqual(widths, [CHOSEN_OUTLINE.under.width, CHOSEN_OUTLINE.width], 'the under-stroke first, then the line');
    assert.equal(calls.filter(([kind]) => kind === 'stroke').length, 2);
    assert.deepEqual(calls.filter(([kind]) => kind === 'line')[0], ['line', 3, 4]);

    calls.length = 0;
    strokeOutline(ctx, [], CHOSEN_OUTLINE);
    assert.deepEqual(calls, [], 'and nothing to draw draws nothing');
});

test('the hover is lighter than the pick', () => {
    assert.ok(HOVER_OUTLINE.width < CHOSEN_OUTLINE.width, 'thinner');
    assert.notEqual(HOVER_OUTLINE.colour, CHOSEN_OUTLINE.colour, 'and in another colour');
    assert.ok(Object.isFrozen(HOVER_OUTLINE) && Object.isFrozen(CHOSEN_OUTLINE));
});

// --- The gumball drawn ----------------------------------------------------------------

/** A context that writes down the colours and widths it was stroked and filled with. */
function recorder() {
    const calls = [];
    const ctx = {
        set lineWidth(v) { calls.push(['width', v]); },
        set strokeStyle(v) { calls.push(['stroke', v]); },
        set fillStyle(v) { calls.push(['fill', v]); },
        set lineCap(v) {},
        setLineDash() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, arc() {},
        stroke() { calls.push(['stroked']); }, fill() { calls.push(['filled']); },
        fillRect() { calls.push(['filled']); }, strokeRect() { calls.push(['stroked']); }
    };
    return { ctx, calls };
}

test('the gumball is drawn in the art\'s colours, and the handle under the pointer over a white edge', async () => {
    const { gumballLayout, boundHandles } = await import('../js/gumball.js');
    const { strokeGumball, GUMBALL_LIT } = await import('../js/build-overlay.js');
    const mountain = { type: 'mountain', config: { at: [0, 0], height: [300, 500] }, seed: 3 };
    const layout = gumballLayout({ x: 100, y: 100 }, { red: { x: -9, y: 1 }, green: { x: 1, y: 7 }, blue: { x: 0, y: -5 } }, boundHandles(mountain));

    const plain = recorder();
    strokeGumball(plain.ctx, layout, null);
    const colours = new Set(plain.calls.filter(([kind]) => kind === 'stroke' || kind === 'fill').map(([, v]) => v));
    for (const colour of ['#fa2020', '#20fa20', '#2020fa', '#ffffff', '#000000']) assert.ok(colours.has(colour), colour);

    const lit = recorder();
    strokeGumball(lit.ctx, layout, 'move');
    const edges = calls => calls.filter(([kind, v]) => kind === 'stroke' && v === GUMBALL_LIT).length;
    assert.ok(edges(lit.calls) > edges(plain.calls), 'the hovered arrow gets a white edge it otherwise has not');

    const none = recorder();
    strokeGumball(none.ctx, { handles: [] }, null);
    strokeGumball(none.ctx, null, null);
    assert.deepEqual(none.calls, [], 'and nothing laid out draws nothing');
});
