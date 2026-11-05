/**
 * Build overlay - what the builder draws over the canvas rather than into it.
 *
 * Two outlines - the placement under the pointer, drawn lightly, and the one
 * in hand, drawn firmly - and the gumball on the one in hand. None of it is a
 * write into the ground. An
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
import { footprintSampler, polygonPoints, flattenPath, COMBINE_KIND } from './environment/footprints.js';
import { canvasPickBounds } from './build-picking.js';
import { AXIS_COLOURS } from './gumball.js';

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

// --- The gumball -------------------------------------------------------------------

/**
 * Draws a gumball laid out by `gumballLayout` in `js/gumball.js`, in the art's
 * own colours: the arcs and the dashed lines first, then the squares, the
 * arrows, the ticks and the dots, and the white centre over everything. The
 * handle under the pointer, `hovered`, is drawn over a white edge, which is
 * what the art's hover states do to an arc.
 */
export function strokeGumball(ctx, layout, hovered = null, colours = AXIS_COLOURS) {
    if (!layout?.handles?.length) return;

    const order = ['turn', 'extent', 'arrow', 'stand', 'spread', 'centre'];
    const handles = [...layout.handles].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));

    for (const handle of handles) {
        const colour = handle.axis ? colours[handle.axis] : '#ffffff';
        const lit = handle.id === hovered;
        ctx.setLineDash([]);
        ctx.lineCap = 'round';

        if (handle.kind === 'turn') {
            if (lit) strokePath(ctx, handle.points, 6, GUMBALL_LIT);
            strokePath(ctx, handle.points, lit ? 3 : 2, colour);
        } else if (handle.kind === 'extent') {
            ctx.setLineDash([2, 4]);
            strokePath(ctx, [handle.from, handle.at], 1.5, colour);
            ctx.setLineDash([]);
            const size = handle.half * 2;
            ctx.fillStyle = lit ? colour : '#ffffff';
            ctx.fillRect(handle.at.x - handle.half, handle.at.y - handle.half, size, size);
            ctx.lineWidth = lit ? 2.5 : 1.5;
            ctx.strokeStyle = lit ? GUMBALL_LIT : colour;
            ctx.strokeRect(handle.at.x - handle.half, handle.at.y - handle.half, size, size);
        } else if (handle.kind === 'arrow') {
            if (lit) strokePath(ctx, [handle.from, handle.to], 7, GUMBALL_LIT);
            strokePath(ctx, [handle.from, handle.to], 3, colour);
            fillHead(ctx, handle.from, handle.to, colour, lit);
        } else if (handle.kind === 'stand') {
            if (lit) strokePath(ctx, [handle.from, handle.to], 7, GUMBALL_LIT);
            strokePath(ctx, [handle.from, handle.to], 3, colour);
        } else if (handle.kind === 'spread' || handle.kind === 'centre') {
            ctx.beginPath();
            ctx.arc(handle.at.x, handle.at.y, handle.radius, 0, Math.PI * 2);
            ctx.fillStyle = handle.kind === 'centre' ? '#ffffff' : colour;
            ctx.fill();
            ctx.lineWidth = lit ? 3 : 1.5;
            ctx.strokeStyle = lit ? GUMBALL_LIT : handle.kind === 'centre' ? '#000000' : colour;
            ctx.stroke();
        }
    }
    ctx.setLineDash([]);
}

/** The edge a hovered handle is drawn over. */
export const GUMBALL_LIT = '#ffffff';

function strokePath(ctx, points, width, colour) {
    ctx.lineWidth = width;
    ctx.strokeStyle = colour;
    ctx.beginPath();
    points.forEach((point, i) => (i === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y)));
    ctx.stroke();
}

/** An arrowhead at the end of a shaft, the shape the art draws: long and narrow. */
function fillHead(ctx, from, to, colour, lit) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy) || 1;
    const ux = dx / length, uy = dy / length;
    const back = { x: to.x - ux * 13, y: to.y - uy * 13 };
    ctx.beginPath();
    ctx.moveTo(to.x + ux * 4, to.y + uy * 4);
    ctx.lineTo(back.x - uy * 5, back.y + ux * 5);
    ctx.lineTo(back.x + uy * 5, back.y - ux * 5);
    ctx.closePath();
    ctx.fillStyle = colour;
    ctx.fill();
    if (lit) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = GUMBALL_LIT;
        ctx.stroke();
    }
}

// --- A region's own edge: the selection, and a shape being drawn --------------

/**
 * How far apart, in world units, the points of a region's edge are stood on
 * the ground: near enough that a side of a box crossing a hill goes over it
 * rather than through it.
 */
export const PATH_STEP = 120;

/** The selection: a dashed white line lying on the ground, which is how the artwork marks one. */
export const SELECTION_OUTLINE = Object.freeze({
    width: 2,
    colour: '#ffffff',
    dash: Object.freeze([10, 7]),
    under: Object.freeze({ width: 4, colour: 'rgba(6, 29, 67, 0.5)' })
});

/** A shape as it is being drawn, before it is let go of: a solid line in the lasso art's blue. */
export const DRAWING_OUTLINE = Object.freeze({
    width: 2,
    colour: '#87ceeb',
    under: Object.freeze({ width: 4, colour: 'rgba(6, 29, 67, 0.5)' })
});

/**
 * A region's edge as one closed loop of `[x, z]` points in the canvas's frame,
 * traced from what it is rather than contoured from its weight: the corners of
 * a ring, a box's sides with its corners rounded, an ellipse or a disc sampled
 * round. Its weight is zero exactly here, which is where a drop inside it stops
 * being allowed. Empty for a footprint that is not a region.
 */
export function footprintLoop(footprint) {
    if (footprint == null) return [];
    const turn = (x, z, angle = 0) => [x * Math.cos(angle) - z * Math.sin(angle), x * Math.sin(angle) + z * Math.cos(angle)];
    const around = (count, at) => Array.from({ length: count }, (_, i) => at((i / count) * Math.PI * 2));

    switch (footprint.kind) {
        case 'ring': {
            const points = (footprint.points ?? []).filter(p => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]));
            return points.length >= 3 ? points.map(([x, z]) => [x, z]) : [];
        }
        case 'polygon':
            return polygonPoints(footprint);
        case 'path':
            return flattenPath(footprint).map(([x, z]) => [x, z]);
        case 'disc': {
            const { x = 0, z = 0, radius = 0 } = footprint;
            return radius > 0 ? around(64, t => [x + Math.cos(t) * radius, z + Math.sin(t) * radius]) : [];
        }
        case 'ellipse': {
            const { x = 0, z = 0, radiusX = 0, radiusZ = 0, angle = 0 } = footprint;
            if (!(radiusX > 0) || !(radiusZ > 0)) return [];
            return around(72, t => {
                const [dx, dz] = turn(Math.cos(t) * radiusX, Math.sin(t) * radiusZ, angle);
                return [x + dx, z + dz];
            });
        }
        case 'rect': {
            const { x = 0, z = 0, width = 0, depth = 0, angle = 0 } = footprint;
            if (!(width > 0) || !(depth > 0)) return [];
            const hx = width / 2, hz = depth / 2;
            const corner = Math.min(Math.max(Number(footprint.corner) || 0, 0), hx, hz);
            const loop = [];
            // Each corner's arc, from its centre inset by the corner's radius;
            // a corner of nothing is the corner itself.
            const corners = [[hx, hz, 0], [-hx, hz, Math.PI / 2], [-hx, -hz, Math.PI], [hx, -hz, Math.PI * 1.5]];
            for (const [cx, cz, from] of corners) {
                const ox = cx - Math.sign(cx) * corner;
                const oz = cz - Math.sign(cz) * corner;
                const steps = corner > 0 ? 8 : 0;
                for (let i = 0; i <= steps; i++) {
                    const t = from + (i / Math.max(steps, 1)) * (Math.PI / 2);
                    const [dx, dz] = turn(ox + Math.cos(t) * corner, oz + Math.sin(t) * corner, angle);
                    loop.push([x + dx, z + dz]);
                }
            }
            return loop;
        }
        default:
            return [];
    }
}

/**
 * A run of points with more put in between, so no two that follow each other
 * are further apart than `step` - which is what lets the run be stood on the
 * ground point by point and lie over a hill rather than cut through it.
 * `closed` runs on from the last point back to the first.
 */
export function subdividePath(points, step = PATH_STEP, closed = false) {
    const out = [];
    const count = points?.length ?? 0;
    const legs = closed ? count : count - 1;
    for (let i = 0; i < legs; i++) {
        const [x1, z1] = points[i];
        const [x2, z2] = points[(i + 1) % count];
        const pieces = Math.max(1, Math.ceil(Math.hypot(x2 - x1, z2 - z1) / step));
        for (let j = 0; j < pieces; j++) out.push([x1 + (x2 - x1) * j / pieces, z1 + (z2 - z1) * j / pieces]);
    }
    if (count > 0) out.push(closed ? [...points[0]] : [...points[count - 1]]);
    return out;
}

/**
 * The pieces of a run that lie on a canvas `size` wide, wherever it repeats:
 * the run itself and its eight neighbours a canvas width away, each cut where
 * it leaves the square - so a region drawn over an edge is drawn carrying on
 * across the opposite one, as the ground it reaches does.
 */
export function canvasPieces(points, size = 0) {
    if (!(size > 0) || !points?.length) return points?.length ? [points] : [];
    const half = size / 2;
    const inside = ([x, z]) => x >= -half && x <= half && z >= -half && z <= half;
    const pieces = [];

    for (const i of [-1, 0, 1]) {
        for (const j of [-1, 0, 1]) {
            let run = [];
            for (const [x, z] of points) {
                const shifted = [x + i * size, z + j * size];
                if (inside(shifted)) run.push(shifted);
                else if (run.length) { if (run.length > 1) pieces.push(run); run = []; }
            }
            if (run.length > 1) pieces.push(run);
        }
    }
    return pieces;
}

/**
 * A run of canvas points as it falls on the screen: each stood on the ground
 * and projected, and broken wherever one is out of view - `project` answers
 * null for those - so a line is never drawn to somewhere it is not.
 */
export function projectPath(points, heightAt, project) {
    const paths = [];
    let run = [];
    for (const [x, z] of points ?? []) {
        const at = project(x, heightAt(x, z), z);
        if (at) run.push(at);
        else if (run.length) { if (run.length > 1) paths.push(run); run = []; }
    }
    if (run.length > 1) paths.push(run);
    return paths;
}

/** Strokes screen paths in a style: its under-stroke, then itself, dashed where the style says. */
export function strokePaths(ctx, paths, style) {
    if (!paths?.length || style == null) return;
    for (const pass of [style.under, style]) {
        if (pass == null) continue;
        ctx.setLineDash?.(pass === style && style.dash ? [...style.dash] : []);
        ctx.lineWidth = pass.width;
        ctx.strokeStyle = pass.colour;
        ctx.beginPath();
        for (const path of paths) {
            path.forEach((point, i) => (i === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y)));
        }
        ctx.stroke();
    }
    ctx.setLineDash?.([]);
}

// --- A selection of shapes combined -----------------------------------------------

/**
 * The weight a combined region's edge is traced at: a hair inside where it
 * reaches nothing, so the line lies on the outer edge of the feathers.
 */
export const EDGE_LEVEL = 0.01;

/**
 * The edge of a region with no one outline of its own - shapes added to a
 * selection, drawn inside it or cut out of it - as runs of canvas points, the
 * contour of its weight chained end to end so a dashed line flows along it.
 * Traced over the canvas through the region's wrapped weight, so it is drawn on
 * both sides of a seam it crosses. A region that has an outline of its own is
 * better drawn from `footprintLoop`, which is its exact edge.
 */
export function regionEdges(footprint, size = 0, cells = OUTLINE_CELLS) {
    if (!(Number(size) > 0)) return [];
    const segments = contourSegments(footprintSampler(footprint, size), canvasPickBounds(size), cells, EDGE_LEVEL);
    return chainSegments(segments);
}

/** True for a region that is drawn from its contour rather than its own outline. */
export function contoured(footprint) {
    return footprint?.kind === COMBINE_KIND;
}

/**
 * Segments that meet end to end joined into runs of points: each run followed
 * from a loose end, or round a loop from anywhere on it, until it closes or
 * stops. Ends are matched to the thousandth of a unit, which is how marching
 * squares hands two neighbouring cells the same crossing.
 */
export function chainSegments(segments) {
    const key = (x, z) => `${x.toFixed(3)},${z.toFixed(3)}`;
    const ends = new Map();
    const used = new Array(segments.length).fill(false);
    segments.forEach(([x1, z1, x2, z2], i) => {
        for (const k of [key(x1, z1), key(x2, z2)]) {
            if (!ends.has(k)) ends.set(k, []);
            ends.get(k).push(i);
        }
    });

    const follow = (start, fromEnd) => {
        const run = [];
        let i = start;
        let at = fromEnd;
        while (i != null && !used[i]) {
            used[i] = true;
            const [x1, z1, x2, z2] = segments[i];
            const [from, to] = at === 0 ? [[x1, z1], [x2, z2]] : [[x2, z2], [x1, z1]];
            if (run.length === 0) run.push(from);
            run.push(to);
            const next = (ends.get(key(to[0], to[1])) ?? []).find(j => !used[j]);
            if (next == null) break;
            const [nx1, nz1] = segments[next];
            at = key(nx1, nz1) === key(to[0], to[1]) ? 0 : 1;
            i = next;
        }
        return run;
    };

    const runs = [];
    // Loose ends first, so an open run is followed from one end to the other.
    segments.forEach(([x1, z1, x2, z2], i) => {
        if (used[i]) return;
        if (ends.get(key(x1, z1)).length === 1) runs.push(follow(i, 0));
        else if (ends.get(key(x2, z2)).length === 1) runs.push(follow(i, 1));
    });
    segments.forEach((_, i) => { if (!used[i]) runs.push(follow(i, 0)); });
    return runs.filter(run => run.length > 1);
}
