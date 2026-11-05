/**
 * Footprints - a region on a placement, which is the thing the element registry
 * has never had a word for.
 *
 * Every element in `elements.js` is an algorithm over the whole field: grass is
 * an altitude band, water is a level, a mountain scatters its peaks from the
 * seeded stream. None of them takes a position and none of them can be told
 * where to stop, so "drop one here" and "only inside what I drew" are asks the
 * vocabulary cannot express. A footprint is that word: an optional,
 * JSON-shaped description of where a placement reaches, which leaves a
 * placement with no footprint exactly what a placement is today.
 *
 * The coordinates are the **canvas's** rather than the world's - the tile's own
 * frame, measured from its centre - so the same footprint lands in the same
 * place on every tile and a built tile reads as the pattern the world repeats.
 * It also means a region is meaningful without knowing which tile is being
 * drawn, which is what lets one be recorded, compared and stored.
 *
 * Pure module with no DOM or Three.js dependency, like every module the
 * generators are written in, so a region can be unit tested in Node.
 */

import { smoothstep } from '../terrain-math.js';
import { DEFAULT_SIZE, DEFAULT_SEGMENTS } from './elements.js';

/**
 * The kinds a pointer can draw: a click, a closed outline, a drag, the two
 * shapes a box and a circle come to, a regular figure held as its parameters,
 * and a boundary of curves.
 *
 * Listed so a caller can ask what the vocabulary is rather than matching
 * against a literal, which is what the conformance checks read.
 */
export const FOOTPRINT_KINDS = Object.freeze(['disc', 'ring', 'stroke', 'rect', 'ellipse', 'polygon', 'path']);

/**
 * Two regions made one: `{ kind: 'combine', op, a, b }`. Not a kind a pointer
 * draws but how a shape meets a selection already there - added to it, drawn
 * inside it, or cut out of it - and every region is a weight between 0 and 1,
 * so each is one expression over the two weights:
 *
 * - `union`: the larger, `max(a, b)`.
 * - `intersect`: the product, `a * b`, which is what clipping already was.
 * - `subtract`: `a * (1 - b)`.
 *
 * Feathers carry through all three, so an edge stays soft wherever either
 * region's edge was soft. A combination may hold combinations, so a lasso
 * drawn, a box added and a circle cut out is three regions in one.
 */
export const COMBINE_KIND = 'combine';
export const COMBINE_OPS = Object.freeze(['union', 'intersect', 'subtract']);

/** Two regions as one, by one of `COMBINE_OPS`. */
export function combineFootprints(op, a, b) {
    return { kind: COMBINE_KIND, op, a, b };
}

/** The weight a combination comes to from the weights of its two regions. */
function combineWeights(op, a, b) {
    if (op === 'union') return Math.max(a, b);
    if (op === 'intersect') return a * b;
    if (op === 'subtract') return a * (1 - b);
    return 0;
}

/**
 * How wide the band a region's weight falls across is, in world units, when
 * nothing says otherwise.
 *
 * Measured off the field's sampling rather than written as a number, because
 * what the feather is for is keeping an edge off the vertices: a region that
 * ended inside one cell would end at a cliff of its own making, whatever that
 * cliff was drawn at. Two cells is the least that reads as a slope at the
 * resolution the world is sampled at.
 */
export const FEATHER_CELLS = 2;

export function featherFor(step = 0) {
    return step > 0 ? step * FEATHER_CELLS : 0;
}

/** The feather the bundled field's sampling comes to, which is 160 units. */
export const DEFAULT_FEATHER = featherFor(DEFAULT_SIZE / DEFAULT_SEGMENTS);

/**
 * How much of a footprint covers a point: 0 outside it, 1 well inside it, and
 * somewhere between across the feather at its edge.
 *
 * `x` and `z` are in the canvas's frame rather than the world's, so a caller
 * drawing a tile subtracts that tile's origin before asking. A footprint that
 * is not one of the kinds above covers nothing rather than everything, because
 * a region nobody can read is not a region every point is inside.
 *
 * Given a `wrap` - the canvas size - the region is measured against the nearest
 * of its repeats rather than only against itself, so one drawn over an edge of
 * the canvas goes on across the opposite edge. See `footprintSampler`.
 */
export function footprintWeight(footprint, x, z, wrap = 0) {
    if (wrap > 0) return footprintSampler(footprint, wrap)(x, z);

    if (footprint?.kind === COMBINE_KIND) {
        if (!isFootprint(footprint)) return 0;
        return combineWeights(footprint.op, footprintWeight(footprint.a, x, z), footprintWeight(footprint.b, x, z));
    }

    const inside = insideDistance(footprint, x, z);
    if (inside == null) return 0;

    return falloff(inside, feather(footprint));
}

/**
 * The places a region repeats at, in canvas widths: itself and the eight around
 * it. A region drawn on the canvas sits inside it, so a point on the canvas is
 * never more than one width from the nearest repeat that can reach it.
 */
const REPEATS = Object.freeze([
    [0, 0], [-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]
]);

/**
 * A footprint made ready to be weighed at many points: a function of `x` and
 * `z`, in the canvas's frame, that answers what `footprintWeight` would.
 *
 * Worked out once rather than per point, because the callers that weigh a
 * region weigh it at every vertex of a tile - 40,401 of them at the default
 * sampling - and the square round a long stroke or a freehand outline is a walk
 * over every one of its points.
 *
 * With a `wrap`, the canvas tiles the world and a region is one of a grid of
 * repeats a canvas width apart. The weight is the strongest of the repeats that
 * reach the point - the union, which is what a region overlapping a copy of
 * itself across a seam is - and the square check means a repeat that cannot
 * reach the point costs a comparison, not a distance. Without one, the region
 * stands alone, which is what it always did.
 */
export function footprintSampler(footprint, wrap = 0) {
    const square = footprintBounds(footprint);
    if (square == null) return () => 0;

    // A combination is weighed from its two regions each weighed with the
    // wrap, rather than wrapped whole: a selection cut out across a seam is
    // cut out on both sides of it.
    if (footprint.kind === COMBINE_KIND) {
        const a = footprintSampler(footprint.a, wrap);
        const b = footprintSampler(footprint.b, wrap);
        return (x, z) => combineWeights(footprint.op, a(x, z), b(x, z));
    }

    const edge   = feather(footprint);
    const across = Number(wrap) > 0 ? Number(wrap) : 0;
    const shifts = across > 0 ? REPEATS.map(([i, j]) => [i * across, j * across]) : [[0, 0]];

    return function weigh(x, z) {
        let best = 0;

        for (const [shiftX, shiftZ] of shifts) {
            // A repeat moved a width one way is the region seen from a point
            // moved a width the other, which is the cheaper of the two to ask.
            const px = x - shiftX;
            const pz = z - shiftZ;
            if (px < square.minX || px > square.maxX || pz < square.minZ || pz > square.maxZ) continue;

            const weight = falloff(insideDistance(footprint, px, pz), edge);
            if (weight >= 1) return 1;
            if (weight > best) best = weight;
        }

        return best;
    };
}

/**
 * The square a footprint reaches, in the canvas's frame, feather included.
 *
 * It is the only thing the tiling needs from a region: a placement whose square
 * does not touch the tile being drawn is a placement that tile can skip without
 * walking 40,401 vertices to find that out.
 *
 * Null for a footprint of no readable kind, which is the same answer
 * `footprintWeight` gives it - there is no square to draw round nothing.
 */
export function footprintBounds(footprint) {
    const box = extent(footprint);
    if (box == null) return null;

    const edge = feather(footprint);
    return {
        minX: box.minX - edge, maxX: box.maxX + edge,
        minZ: box.minZ - edge, maxZ: box.maxZ + edge
    };
}

/**
 * True for a footprint this module can read, which is the test a caller makes
 * before holding one.
 *
 * Asked of the square rather than of the weight, because the two refuse exactly
 * the same descriptions - a disc of no radius, a ring of two points, a stroke
 * with no stamp - and the square refuses them without being handed a point to
 * measure from.
 */
export function isFootprint(footprint) {
    return extent(footprint) != null;
}

// --- The kinds -------------------------------------------------------------

/**
 * How far inside a region a point is, in world units: positive within it,
 * negative outside, and zero on its boundary. Null for a footprint that
 * describes no region at all.
 *
 * One signed distance per kind is the whole of the arithmetic here. The weight
 * and the feather are then one expression over it, so a kind added later says
 * where its edge is and gets the softness, the bounds and the weight for free.
 */
function insideDistance(footprint, x, z) {
    if (footprint == null) return null;

    switch (footprint.kind) {
        case 'disc':    return discDistance(footprint, x, z);
        case 'ring':    return ringDistance(footprint, x, z);
        case 'stroke':  return strokeDistance(footprint, x, z);
        case 'rect':    return rectDistance(footprint, x, z);
        case 'ellipse': return ellipseDistance(footprint, x, z);
        case 'polygon': return outlineDistance(polygonPoints(footprint), x, z);
        case 'path':    return outlineDistance(flattenPath(footprint), x, z);
        default:        return null;
    }
}

/** How far inside a closed outline a point is, negative outside, or null for no outline. */
function outlineDistance(corners, x, z) {
    if (corners.length < 3) return null;
    const edge = distanceToOutline(corners, x, z, true);
    return insidePolygon(corners, x, z) ? edge : -edge;
}

/**
 * A regular figure's corners: `sides` of them, `radius` from its middle, the
 * first at `angle` - or, with an `inner` below 1, a star of `sides` points,
 * every other corner pulled in to `inner` of the radius. Worked out from the
 * figure each time rather than kept, because the figure is what is held: a
 * hexagon with its `sides` set to 7 is a heptagon, not six points to redraw.
 *
 * Empty for a figure that is no region - no radius, or fewer than three sides.
 */
export function polygonPoints(footprint) {
    const { x = 0, z = 0, radius = 0, angle = 0 } = footprint ?? {};
    const sides = Math.round(Number(footprint?.sides));
    if (!(radius > 0) || !(sides >= 3)) return [];

    const count = Math.min(sides, 64);
    const inner = Number(footprint?.inner);
    const star  = Number.isFinite(inner) && inner > 0 && inner < 1;
    const steps = star ? count * 2 : count;
    const points = [];
    for (let i = 0; i < steps; i++) {
        const theta = (Number(angle) || 0) + (i / steps) * Math.PI * 2;
        const reach = star && i % 2 === 1 ? radius * inner : radius;
        points.push([x + Math.cos(theta) * reach, z + Math.sin(theta) * reach]);
    }
    return points;
}

/** How many straight pieces each curve of a path is flattened into. */
export const PATH_PIECES = 12;

/** The flattened outline of each path, worked out once for as long as the path is held. */
const FLATTENED = new WeakMap();

/**
 * A boundary of curves as the closed outline it is weighed by: a smooth curve
 * through every control point, as a Catmull-Rom spline does - round the whole
 * loop when the path is `closed`, and through its points in order with the
 * last joined straight back to the first when it is not, which is what a
 * curved polyline closes with.
 *
 * Flattened once per path rather than once per point weighed: a tile weighs a
 * region at every one of its 40,401 vertices, and the curve is the same curve
 * at all of them. The control points stay on the footprint, which is what a
 * curve is edited by; the flattened outline is a derived thing, kept only while
 * the footprint itself is.
 */
export function flattenPath(footprint) {
    if (footprint == null || typeof footprint !== 'object') return [];
    const held = FLATTENED.get(footprint);
    if (held) return held;

    const points = usablePoints(footprint.points);
    const closed = footprint.closed !== false;
    let outline = [];
    if (points.length >= 3) {
        const count = points.length;
        const at = i => (closed ? points[(i + count) % count] : points[Math.min(Math.max(i, 0), count - 1)]);
        const segments = closed ? count : count - 1;
        for (let i = 0; i < segments; i++) {
            const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
            for (let j = 0; j < PATH_PIECES; j++) {
                const t = j / PATH_PIECES;
                outline.push(catmullRom(p0, p1, p2, p3, t));
            }
        }
        if (!closed) outline.push([...points[count - 1]]);
    }
    FLATTENED.set(footprint, outline);
    return outline;
}

/** A point on the uniform Catmull-Rom curve between `p1` and `p2`, `t` of the way along. */
function catmullRom(p0, p1, p2, p3, t) {
    const t2 = t * t, t3 = t2 * t;
    const along = k => 0.5 * (
        2 * p1[k]
        + (-p0[k] + p2[k]) * t
        + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2
        + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3
    );
    return [along(0), along(1)];
}

/** A click, which is what a dropped element covers. */
function discDistance({ x: cx = 0, z: cz = 0, radius = 0 }, x, z) {
    if (!(radius > 0)) return null;
    return radius - Math.hypot(x - cx, z - cz);
}

/**
 * A closed outline given as its corners - a freehand lasso sampled as it was
 * drawn, or a polyline clicked vertex by vertex.
 *
 * Two points are a line rather than a region, so a ring left with fewer than
 * three is not one: the lasso that produced it is discarded rather than
 * clipping everything to a thread.
 */
function ringDistance({ points }, x, z) {
    const corners = usablePoints(points);
    if (corners.length < 3) return null;

    const edge = distanceToOutline(corners, x, z, true);
    return insidePolygon(corners, x, z) ? edge : -edge;
}

/**
 * A drag, with one stamp swept whole along the way it went.
 *
 * The stamp is a rounded rectangle, which is the one form every dragging tool
 * needs: a round brush tip is `width === depth` with `corner` at half of it, a
 * square tip is `corner: 0`, and a ground cover's rectangle sets all three
 * freely. Swept rather than stamped at each sample, so a stroke is a
 * continuous swathe at whatever speed the pointer happened to be moving.
 *
 * A stroke of one point is a single stamp, which is the press that never
 * travelled.
 */
function strokeDistance({ points, stamp }, x, z) {
    const path = usablePoints(points);
    if (path.length === 0) return null;

    const width  = Math.max(Number(stamp?.width) || 0, 0);
    const depth  = Math.max(Number(stamp?.depth) || 0, 0);
    if (!(width > 0) || !(depth > 0)) return null;

    const corner = Math.max(Number(stamp?.corner) || 0, 0);

    if (path.length === 1) {
        const [only] = path;
        return roundedBoxDistance(x - only[0], z - only[1], 0, width / 2, depth / 2, corner);
    }

    // The sweep is the union of the segments, and a union of signed distances is
    // the largest of them: a point inside any one stamp is inside the stroke.
    let best = -Infinity;
    for (let i = 1; i < path.length; i++) {
        const from = path[i - 1], to = path[i];
        const dx = to[0] - from[0], dz = to[1] - from[1];
        const length = Math.hypot(dx, dz);

        // A sample that landed on the one before it adds no length, so it is
        // the stamp on its own rather than a segment with no direction.
        //
        // Negated because `unrotate` turns a point by the angle rather than
        // turning the box, so the angle that lays the stamp's long side along
        // the segment is the one that brings the segment back onto z. Without
        // the sign the stamp is turned by twice the segment's angle, which is
        // right for a drag along either axis and perpendicular at 45 degrees.
        const angle = length > 0 ? -Math.atan2(dx, dz) : 0;
        const midX  = (from[0] + to[0]) / 2;
        const midZ  = (from[1] + to[1]) / 2;

        // The stamp's own depth is carried along the segment, which is what
        // makes the sweep reach past each end by half a stamp rather than
        // stopping at the sample.
        const reach = roundedBoxDistance(
            x - midX, z - midZ, angle, width / 2, length / 2 + depth / 2, corner
        );
        if (reach > best) best = reach;
    }

    return best;
}

/** A rectangle or a square, hard-cornered at a `corner` of 0 and rounded above it. */
function rectDistance({ x: cx = 0, z: cz = 0, width = 0, depth = 0, angle = 0, corner = 0 }, x, z) {
    if (!(width > 0) || !(depth > 0)) return null;
    return roundedBoxDistance(
        x - cx, z - cz, angle, width / 2, depth / 2, Math.max(corner, 0)
    );
}

/**
 * An ellipse, which is what a circle drawn with one axis longer than the other
 * comes to.
 *
 * The distance is the gap scaled back by the shorter radius rather than
 * measured to the curve exactly. An exact distance to an ellipse has no closed
 * form, and what the feather needs is a reading that is zero on the boundary
 * and grows monotonically either side of it - which this is, in the units the
 * feather is written in.
 */
function ellipseDistance({ x: cx = 0, z: cz = 0, radiusX = 0, radiusZ = 0, angle = 0 }, x, z) {
    if (!(radiusX > 0) || !(radiusZ > 0)) return null;

    const [dx, dz] = unrotate(x - cx, z - cz, angle);
    const reach = Math.hypot(dx / radiusX, dz / radiusZ);

    return (1 - reach) * Math.min(radiusX, radiusZ);
}

// --- The arithmetic the kinds share ---------------------------------------

/**
 * The weight a signed distance comes to across a feather: nothing outside the
 * region, everything a feather inside it, and eased between the two.
 *
 * Eased rather than ramped because the band is what keeps a region's edge from
 * reading as a cut, and a linear ramp still leaves a crease where it meets the
 * ground on both sides.
 */
function falloff(inside, edge) {
    if (!(edge > 0)) return inside >= 0 ? 1 : 0;
    return smoothstep(inside / edge);
}

/**
 * The feather a footprint carries, which is the sampling's where it names none.
 * A combination carries none of its own: its two regions keep theirs.
 */
function feather(footprint) {
    if (footprint?.kind === COMBINE_KIND) return 0;
    const stated = Number(footprint?.feather);
    if (Number.isFinite(stated) && stated >= 0) return stated;
    return DEFAULT_FEATHER;
}

/**
 * The signed distance to a box of half-extents `hx` by `hz`, turned by `angle`
 * and with its corners rounded by `corner`.
 *
 * Positive inside, so it reads the way every other kind here reads. The corner
 * is held to half the shorter side, because a radius wider than that is a box
 * describing a shape it is not - and the artwork can ask for one.
 */
function roundedBoxDistance(dx, dz, angle, hx, hz, corner) {
    const radius = Math.min(Math.max(corner, 0), hx, hz);
    const [px, pz] = unrotate(dx, dz, angle);

    const qx = Math.abs(px) - (hx - radius);
    const qz = Math.abs(pz) - (hz - radius);

    const outside = Math.hypot(Math.max(qx, 0), Math.max(qz, 0));
    const insideBox = Math.min(Math.max(qx, qz), 0);

    return radius - (outside + insideBox);
}

/** A point brought back into the frame of something turned by `angle`. */
function unrotate(dx, dz, angle = 0) {
    if (!Number.isFinite(angle) || angle === 0) return [dx, dz];

    const cos = Math.cos(-angle), sin = Math.sin(-angle);
    return [dx * cos - dz * sin, dx * sin + dz * cos];
}

/** Every point of an outline that is a pair of finite numbers, and no others. */
function usablePoints(points) {
    if (!Array.isArray(points)) return [];
    return points
        .filter(point => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1]))
        .map(point => [point[0], point[1]]);
}

/**
 * How far a point is from an outline, whichever side of it the point is on.
 * `closed` measures the segment from the last corner back to the first as well,
 * which is what makes an outline a boundary rather than a path.
 */
function distanceToOutline(points, x, z, closed = false) {
    let best = Infinity;
    const last = points.length - 1;

    for (let i = 0; i < last; i++) {
        best = Math.min(best, distanceToSegment(points[i], points[i + 1], x, z));
    }
    if (closed && points.length > 2) {
        best = Math.min(best, distanceToSegment(points[last], points[0], x, z));
    }

    return best;
}

/** How far a point is from a line between two others. */
function distanceToSegment(from, to, x, z) {
    const dx = to[0] - from[0], dz = to[1] - from[1];
    const span = dx * dx + dz * dz;
    if (span === 0) return Math.hypot(x - from[0], z - from[1]);

    const along = Math.max(0, Math.min(1, ((x - from[0]) * dx + (z - from[1]) * dz) / span));
    return Math.hypot(x - (from[0] + along * dx), z - (from[1] + along * dz));
}

/**
 * True for a point inside a closed outline, by the crossing count every
 * rasterizer uses: a ray cast one way crosses an odd number of edges from
 * inside and an even number from outside, whatever shape the outline is and
 * whether or not it crosses itself.
 */
function insidePolygon(points, x, z) {
    let inside = false;

    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [ix, iz] = points[i];
        const [jx, jz] = points[j];

        if ((iz > z) !== (jz > z) && x < ix + ((z - iz) / (jz - iz)) * (jx - ix)) {
            inside = !inside;
        }
    }

    return inside;
}

/** The square a region covers before its feather is added to it. */
function extent(footprint) {
    if (footprint == null) return null;

    switch (footprint.kind) {
        case 'disc': {
            const { x = 0, z = 0, radius = 0 } = footprint;
            if (!(radius > 0)) return null;
            return box(x - radius, x + radius, z - radius, z + radius);
        }
        case 'ring': {
            const corners = usablePoints(footprint.points);
            if (corners.length < 3) return null;
            return pointsBox(corners);
        }
        case 'stroke': {
            const path = usablePoints(footprint.points);
            const width = Math.max(Number(footprint.stamp?.width) || 0, 0);
            const depth = Math.max(Number(footprint.stamp?.depth) || 0, 0);
            if (path.length === 0 || !(width > 0) || !(depth > 0)) return null;

            // The stamp can be turned any way along the stroke, so the square
            // round it is its own diagonal rather than its width - which is the
            // only reach that holds for every direction the drag went in.
            const reach = Math.hypot(width, depth) / 2;
            const over  = pointsBox(path);
            return box(over.minX - reach, over.maxX + reach, over.minZ - reach, over.maxZ + reach);
        }
        case 'rect': {
            const { x = 0, z = 0, width = 0, depth = 0 } = footprint;
            if (!(width > 0) || !(depth > 0)) return null;
            const reach = Math.hypot(width, depth) / 2;
            return box(x - reach, x + reach, z - reach, z + reach);
        }
        case 'ellipse': {
            const { x = 0, z = 0, radiusX = 0, radiusZ = 0 } = footprint;
            if (!(radiusX > 0) || !(radiusZ > 0)) return null;
            const reach = Math.max(radiusX, radiusZ);
            return box(x - reach, x + reach, z - reach, z + reach);
        }
        case 'polygon': {
            const corners = polygonPoints(footprint);
            return corners.length >= 3 ? pointsBox(corners) : null;
        }
        case 'path': {
            const outline = flattenPath(footprint);
            return outline.length >= 3 ? pointsBox(outline) : null;
        }
        case COMBINE_KIND: {
            // The squares of the two regions, feathers and all, since a
            // combination has none of its own: both of them for a union, where
            // they overlap for an intersection - and nowhere, which is no
            // region, where they do not - and the first's for a cut.
            if (!COMBINE_OPS.includes(footprint.op)) return null;
            const a = footprintBounds(footprint.a);
            const b = footprintBounds(footprint.b);
            if (a == null || b == null) return null;
            if (footprint.op === 'union') {
                return box(Math.min(a.minX, b.minX), Math.max(a.maxX, b.maxX), Math.min(a.minZ, b.minZ), Math.max(a.maxZ, b.maxZ));
            }
            if (footprint.op === 'subtract') return a;
            const both = box(Math.max(a.minX, b.minX), Math.min(a.maxX, b.maxX), Math.max(a.minZ, b.minZ), Math.min(a.maxZ, b.maxZ));
            return both.minX < both.maxX && both.minZ < both.maxZ ? both : null;
        }
        default:
            return null;
    }
}

function box(minX, maxX, minZ, maxZ) {
    return { minX, maxX, minZ, maxZ };
}

function pointsBox(points) {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;

    for (const [x, z] of points) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (z < minZ) minZ = z;
        if (z > maxZ) maxZ = z;
    }

    return box(minX, maxX, minZ, maxZ);
}
