/**
 * Build overlay - what the builder draws over the canvas rather than into it.
 *
 * Today that is two outlines: the placement under the pointer, drawn lightly,
 * and the one in hand, drawn firmly. Neither is a write into the ground. An
 * outline is traced once round the placement's reach, in the canvas's frame,
 * and each frame its points are stood on the ground and projected through the
 * camera onto a 2D canvas laid over the renderer - so hovering and picking
 * rebuild no ground, and the outline lies over the terrain wherever the view
 * is moved to.
 *
 * The trace is the same reach a click is measured against, at the weight a
 * click needs, so what is outlined is exactly what a click inside it picks.
 * It is traced as a contour over a grid rather than written per kind, so a
 * mountain dropped at a point, a footprint of any kind, and a peak carrying on
 * across a seam are all outlined by one piece of arithmetic.
 *
 * Pure module with no DOM or Three.js dependency: the drawing context and the
 * projection are handed in, so what is traced and what is stroked can be unit
 * tested in Node.
 */

import { placementReach, PICK_WEIGHT } from './build-select.js';
import { canvasPickBounds } from './build-picking.js';

/**
 * How many cells across the canvas an outline is traced over. A canvas is a
 * few hundred metres to a cell at this, which follows a mountain's ellipse
 * closely, and a trace is a few milliseconds - made once when a placement
 * changes, not once a frame.
 */
export const OUTLINE_CELLS = 256;

/** The placement under the pointer: thin and light, a hint at what a click would take. */
export const HOVER_OUTLINE = Object.freeze({
    width: 1.5,
    colour: 'rgba(255, 255, 255, 0.8)',
    under: Object.freeze({ width: 3.5, colour: 'rgba(6, 29, 67, 0.35)' })
});

/** The placement in hand: firm, in the selection's blue, over the dock's navy so it reads on snow. */
export const CHOSEN_OUTLINE = Object.freeze({
    width: 3,
    colour: '#7fd8ff',
    under: Object.freeze({ width: 6, colour: 'rgba(6, 29, 67, 0.6)' })
});

/**
 * Where a weight crosses `level` over a square, as line segments
 * `[x1, z1, x2, z2]` in the square's own frame.
 *
 * Marching squares: `weigh` is sampled at the corners of a grid of `cells`
 * cells across `bounds`, and each cell whose corners lie on both sides of the
 * level is crossed by a segment between its edges, each end placed along its
 * edge where the weight between the two corners would reach the level. A
 * saddle - two opposite corners in, two out - is settled by the middle of the
 * cell, so a contour never crosses itself.
 *
 * A region running over the edge of the square is cut there rather than closed
 * along it, because the part beyond is the part that carries on across the
 * seam, and it is traced where it comes back in on the opposite side.
 */
export function contourSegments(weigh, bounds, cells = OUTLINE_CELLS, level = PICK_WEIGHT) {
    const across = Math.max(1, Math.round(cells));
    const width  = bounds.maxX - bounds.minX;
    const depth  = bounds.maxZ - bounds.minZ;
    const stepX  = width / across;
    const stepZ  = depth / across;
    const stride = across + 1;
    const xAt    = i => bounds.minX + i * stepX;
    const zAt    = j => bounds.minZ + j * stepZ;

    const grid = new Float64Array(stride * stride);
    for (let j = 0; j <= across; j++) {
        for (let i = 0; i <= across; i++) grid[j * stride + i] = weigh(xAt(i), zAt(j));
    }

    const segments = [];

    // Where along an edge the level is crossed, as a share of the way from the
    // first corner to the second.
    const share = (from, to) => {
        const span = to - from;
        return span === 0 ? 0.5 : Math.min(Math.max((level - from) / span, 0), 1);
    };

    for (let j = 0; j < across; j++) {
        for (let i = 0; i < across; i++) {
            // The corners, round the cell: low x low z, high x low z, high x
            // high z, low x high z.
            const a = grid[j * stride + i];
            const b = grid[j * stride + i + 1];
            const c = grid[(j + 1) * stride + i + 1];
            const d = grid[(j + 1) * stride + i];

            const index = (a >= level ? 1 : 0) | (b >= level ? 2 : 0) | (c >= level ? 4 : 0) | (d >= level ? 8 : 0);
            if (index === 0 || index === 15) continue;

            const x0 = xAt(i), x1 = xAt(i + 1);
            const z0 = zAt(j), z1 = zAt(j + 1);

            // The four edges, each crossed where the level falls along it.
            const bottom = () => [x0 + share(a, b) * stepX, z0];
            const right  = () => [x1, z0 + share(b, c) * stepZ];
            const top    = () => [x0 + share(d, c) * stepX, z1];
            const left   = () => [x0, z0 + share(a, d) * stepZ];

            const join = (p, q) => segments.push([p[0], p[1], q[0], q[1]]);
            const middle = (a + b + c + d) / 4 >= level;

            switch (index) {
                case 1: case 14: join(left(), bottom()); break;
                case 2: case 13: join(bottom(), right()); break;
                case 3: case 12: join(left(), right()); break;
                case 4: case 11: join(right(), top()); break;
                case 6: case 9:  join(bottom(), top()); break;
                case 7: case 8:  join(left(), top()); break;
                // The saddles: the middle says whether the two corners that
                // are in are joined across it or cut off from each other.
                case 5:
                    if (middle) { join(left(), top()); join(bottom(), right()); }
                    else        { join(left(), bottom()); join(right(), top()); }
                    break;
                case 10:
                    if (middle) { join(left(), bottom()); join(right(), top()); }
                    else        { join(left(), top()); join(bottom(), right()); }
                    break;
            }
        }
    }

    return segments;
}

/**
 * The outline of a placement on a canvas `size` wide, as segments in the
 * canvas's frame: its reach traced at the weight a click needs.
 */
export function placementOutline(placement, size = 0, cells = OUTLINE_CELLS) {
    if (!(Number(size) > 0)) return [];
    return contourSegments(placementReach(placement, size), canvasPickBounds(size), cells, PICK_WEIGHT);
}

/**
 * An outline as it falls on the screen: each end of each segment stood on the
 * ground under it - `heightAt(x, z)` - and handed to `project(x, y, z)`, which
 * answers `{ x, y }` in the overlay's pixels or null for a point the camera
 * cannot see. A segment either end of which is out of view is left out rather
 * than drawn to somewhere it is not.
 */
export function projectOutline(segments, heightAt, project) {
    const drawn = [];
    for (const [x1, z1, x2, z2] of segments ?? []) {
        const from = project(x1, heightAt(x1, z1), z1);
        if (from == null) continue;
        const to = project(x2, heightAt(x2, z2), z2);
        if (to == null) continue;
        drawn.push([from.x, from.y, to.x, to.y]);
    }
    return drawn;
}

/** Strokes projected segments onto a 2D context in a style: its under-stroke first, then itself. */
export function strokeOutline(ctx, drawn, style) {
    if (!drawn?.length || style == null) return;

    for (const pass of [style.under, style]) {
        if (pass == null) continue;
        ctx.lineWidth = pass.width;
        ctx.strokeStyle = pass.colour;
        ctx.beginPath();
        for (const [x1, y1, x2, y2] of drawn) {
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
        }
        ctx.stroke();
    }
}
