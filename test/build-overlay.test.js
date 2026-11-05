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
    contourSegments, placementOutline, projectOutline, strokeOutline,
    HOVER_OUTLINE, CHOSEN_OUTLINE, OUTLINE_CELLS
} from '../js/build-overlay.js';
import { canvasPickBounds } from '../js/build-picking.js';

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
