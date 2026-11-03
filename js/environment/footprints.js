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
 * The kinds a pointer can draw: a click, a closed outline, a drag, and the two
 * shapes a box and a circle come to.
 *
 * Listed so a caller can ask what the vocabulary is rather than matching
 * against a literal, which is what the conformance checks read.
 */
export const FOOTPRINT_KINDS = Object.freeze(['disc', 'ring', 'stroke', 'rect', 'ellipse']);

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
 */
export function footprintWeight(footprint, x, z) {
    const inside = insideDistance(footprint, x, z);
    if (inside == null) return 0;

    return falloff(inside, feather(footprint));
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
        default:        return null;
    }
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

/** The feather a footprint carries, which is the sampling's where it names none. */
function feather(footprint) {
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
